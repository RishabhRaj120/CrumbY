import {
  Order,
  OrderStatus,
  DashboardStats,
  ChangeRequest,
  ExtractedOrderPayload,
} from "@/types/order";
import { orderSchema } from "../schemas/order";
import { SAMPLE_DEMO_ORDERS } from "./demo-data";
import {
  canTransitionStatus,
  evaluateDeadlineStatus,
  computeOrderFieldDiffs,
  isChangeRequestStale,
  createHistoryEvent,
  normalizeWeightValue,
} from "../change-policy";
import { getStoredPolicySettings } from "./settings";

const STORAGE_KEY = "crumbdesk_orders_v1";
export const ORDERS_CHANGED_EVENT = "crumbdesk_orders_changed";

// In-memory store fallback for SSR and test runners
let memoryOrderStore: string | null = null;

export function setRawStoredOrdersForTesting(json: string | null): void {
  if (typeof window !== "undefined") {
    if (json === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, json);
    }
  } else {
    memoryOrderStore = json;
  }
}

/**
 * Safely reads orders from localStorage and migrates older schemas.
 * Handles corrupt data gracefully without crashing.
 */
export function getStoredOrders(): Order[] {
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : memoryOrderStore;

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn("Stored orders is not an array; resetting.");
      return [];
    }

    // Validate and migrate each order record individually
    const validOrders: Order[] = [];
    for (const item of parsed) {
      // Safe sanitization of legacy / invalid records before schema validation
      if (typeof item === "object" && item !== null) {
        // Sanitize negative or non-finite payment amounts without destroying the record
        if (
          typeof item.payment_amount === "number" &&
          (item.payment_amount < 0 ||
            isNaN(item.payment_amount) ||
            !isFinite(item.payment_amount))
        ) {
          console.warn(
            `Sanitizing invalid negative payment_amount (${item.payment_amount}) in stored order ${item.id}`
          );
          item.payment_amount = null;
          if (!Array.isArray(item.missing_or_unverified)) {
            item.missing_or_unverified = [];
          }
          if (
            !item.missing_or_unverified.includes(
              "Payment amount was invalid (negative) — flagged for baker review"
            )
          ) {
            item.missing_or_unverified.push(
              "Payment amount was invalid (negative) — flagged for baker review"
            );
          }
          item.requires_confirmation = true;
        }

        // Sanitize legacy bare weight strings without units
        if (typeof item.weight === "string") {
          item.weight = normalizeWeightValue(item.weight);
        }
      }

      const result = orderSchema.safeParse(item);
      if (result.success) {
        const order = result.data as Order;

        // Backward compatibility migration: ensure history has at least initial created event
        if (!order.history || order.history.length === 0) {
          order.history = [
            createHistoryEvent("order_created", "Order created and stored", {
              actor: "system",
            }),
          ];
          if (order.status === "confirmed") {
            order.history.push(
              createHistoryEvent("order_confirmed", "Order confirmed by baker", {
                actor: "baker",
              })
            );
          }
        }

        if (!order.change_requests) {
          order.change_requests = [];
        }

        validOrders.push(order);
      } else {
        console.warn("Filtered out invalid stored order record:", result.error);
      }
    }

    // Sort newest created first
    return validOrders.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (err) {
    console.warn("Error reading orders from localStorage:", err);
    return [];
  }
}

/**
 * Persists orders to localStorage and dispatches a change event.
 */
function setStoredOrders(orders: Order[]): void {
  const json = JSON.stringify(orders);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, json);
      window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT));
    } catch (err) {
      console.error("Failed to save orders to localStorage:", err);
    }
  } else {
    memoryOrderStore = json;
  }
}

/**
 * Adds a new order to storage or updates an existing one.
 */
export function addOrder(order: Order): Order {
  const current = getStoredOrders();
  const existingIdx = current.findIndex((o) => o.id === order.id);

  // Initialize history if missing
  const initialHistory = order.history && order.history.length > 0
    ? order.history
    : [
        createHistoryEvent("order_created", "Order created and stored", {
          actor: "system",
        }),
      ];

  if (order.status === "confirmed" && !initialHistory.some((h) => h.type === "order_confirmed")) {
    initialHistory.push(
      createHistoryEvent("order_confirmed", "Order confirmed by baker", {
        actor: "baker",
      })
    );
  }

  if (typeof order.payment_amount === "number" && order.payment_amount < 0) {
    throw new Error("Payment amount cannot be negative.");
  }

  const normalizedOrder: Order = {
    ...order,
    weight: normalizeWeightValue(order.weight),
    change_requests: order.change_requests || [],
    history: initialHistory,
  };

  let updated: Order[];
  if (existingIdx !== -1) {
    updated = [...current];
    updated[existingIdx] = {
      ...normalizedOrder,
      updated_at: new Date().toISOString(),
    };
  } else {
    updated = [normalizedOrder, ...current];
  }

  setStoredOrders(updated);
  return normalizedOrder;
}

/**
 * Updates an existing order by ID.
 */
export function updateOrder(
  id: string,
  updates: Partial<Order>
): Order | null {
  const current = getStoredOrders();
  const index = current.findIndex((o) => o.id === id);

  if (index === -1) {
    return null;
  }

  const updatedOrder: Order = {
    ...current[index],
    ...updates,
    id, // preserve immutable ID
    updated_at: new Date().toISOString(),
  };

  const updatedList = [...current];
  updatedList[index] = updatedOrder;
  setStoredOrders(updatedList);
  return updatedOrder;
}

/**
 * Transitions an order's lifecycle status, enforcing valid status graph rules
 * and appending to history.
 */
export function transitionOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  options?: { reason?: string }
): Order {
  const current = getStoredOrders();
  const index = current.findIndex((o) => o.id === orderId);

  if (index === -1) {
    throw new Error(`Order with ID '${orderId}' not found.`);
  }

  const order = current[index];
  const validation = canTransitionStatus(order.status, newStatus, options);
  if (!validation.allowed) {
    throw new Error(validation.error || `Invalid status transition to '${newStatus}'.`);
  }

  const history = [...(order.history || [])];
  const updates: Partial<Order> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === "in_preparation") {
    const startedAt = new Date().toISOString();
    updates.preparation_started_at = startedAt;
    history.push(
      createHistoryEvent(
        "preparation_started",
        "Order preparation started in bakery. Ordinary changes are locked.",
        { actor: "baker" }
      )
    );
  } else if (newStatus === "ready") {
    history.push(
      createHistoryEvent(
        "order_ready",
        "Order marked ready for pickup / delivery.",
        { actor: "baker" }
      )
    );
  } else if (newStatus === "completed") {
    history.push(
      createHistoryEvent("order_completed", "Order completed and fulfilled.", {
        actor: "baker",
      })
    );
  } else if (newStatus === "cancelled") {
    updates.cancellation_reason = options?.reason?.trim() || null;
    history.push(
      createHistoryEvent(
        "order_cancelled",
        `Order cancelled${options?.reason ? `: ${options.reason}` : ""}.`,
        { actor: "baker", reason: options?.reason }
      )
    );
  } else if (newStatus === "confirmed") {
    history.push(
      createHistoryEvent("order_confirmed", "Order confirmed by baker.", {
        actor: "baker",
      })
    );
  }

  updates.history = history;

  const updatedOrder: Order = {
    ...order,
    ...updates,
  };

  const updatedList = [...current];
  updatedList[index] = updatedOrder;
  setStoredOrders(updatedList);
  return updatedOrder;
}

/**
 * Records a change request on an order without mutating the accepted order.
 * Enforces:
 * - Only one pending change request allowed at a time.
 * - Terminal orders cannot receive change requests.
 * - Computes diffs and captures snapshot of original values.
 * - Evaluates deadline status at request time.
 */
export function recordChangeRequest(
  orderId: string,
  proposedChanges: Partial<ExtractedOrderPayload & { baker_notes?: string }>,
  requestNotes?: string,
  now: Date = new Date()
): { order: Order; changeRequest: ChangeRequest } {
  const current = getStoredOrders();
  const index = current.findIndex((o) => o.id === orderId);

  if (index === -1) {
    throw new Error(`Order with ID '${orderId}' not found.`);
  }

  const order = current[index];

  // Terminal orders cannot be modified
  if (order.status === "completed" || order.status === "cancelled") {
    throw new Error(`Cannot record change request on ${order.status} order.`);
  }

  // Prevent multiple conflicting pending requests
  const pending = (order.change_requests || []).find((r) => r.status === "pending");
  if (pending) {
    throw new Error(
      "A pending change request already exists for this order. Please approve or reject the existing request first."
    );
  }

  // Sanitize proposed changes
  const sanitizedProposed: Partial<ExtractedOrderPayload & { baker_notes?: string }> = { ...proposedChanges };
  if ("weight" in sanitizedProposed && typeof sanitizedProposed.weight === "string") {
    sanitizedProposed.weight = normalizeWeightValue(sanitizedProposed.weight);
  }
  if ("payment_amount" in sanitizedProposed && typeof sanitizedProposed.payment_amount === "number") {
    if (
      sanitizedProposed.payment_amount < 0 ||
      isNaN(sanitizedProposed.payment_amount) ||
      !isFinite(sanitizedProposed.payment_amount)
    ) {
      throw new Error("Proposed payment amount cannot be negative or invalid.");
    }
  }

  // Compute diffs against accepted order
  const diffs = computeOrderFieldDiffs(order, sanitizedProposed);
  if (diffs.length === 0) {
    throw new Error("No changes detected. Proposed values are identical to current accepted order.");
  }

  // Capture original values snapshot
  const originalValues: Record<string, unknown> = {};
  for (const diff of diffs) {
    originalValues[diff.field] = diff.old_value;
  }

  // Evaluate deadline status at request time
  const policySettings = getStoredPolicySettings();
  const deadlineEval = evaluateDeadlineStatus(order, policySettings.cutoff_hours, now);

  const changeRequest: ChangeRequest = {
    id: `cr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    order_id: orderId,
    created_at: now.toISOString(),
    status: "pending",
    proposed_changes: sanitizedProposed as Partial<ExtractedOrderPayload>,
    original_values: originalValues as Partial<ExtractedOrderPayload>,
    request_notes: requestNotes?.trim() || "",
    deadline_status_at_request: deadlineEval.status,
    deadline_at_request: deadlineEval.deadlineIso,
  };

  const history = [...(order.history || [])];
  history.push(
    createHistoryEvent(
      "change_requested",
      `Customer requested change (${diffs.length} field(s))${
        requestNotes ? `: ${requestNotes}` : ""
      }`,
      {
        actor: "baker",
        change_request_id: changeRequest.id,
        reason: requestNotes,
        field_changes: diffs,
      }
    )
  );

  const updatedOrder: Order = {
    ...order,
    change_requests: [...(order.change_requests || []), changeRequest],
    history,
    updated_at: new Date().toISOString(),
  };

  const updatedList = [...current];
  updatedList[index] = updatedOrder;
  setStoredOrders(updatedList);

  return { order: updatedOrder, changeRequest };
}

/**
 * Approves a pending change request.
 * Enforces:
 * - Request is pending and belongs to order.
 * - Stale proposal check (current accepted values must match original values at request time).
 * - Cutoff deadline policy: if past cutoff, prep started, ready, or schedule unresolved, requires explicit exception and non-empty reason.
 * - Applies changes to order, records history, and marks request as approved.
 */
export function approveChangeRequest(
  orderId: string,
  requestId: string,
  options?: { isException?: boolean; reason?: string },
  now: Date = new Date()
): Order {
  const current = getStoredOrders();
  const index = current.findIndex((o) => o.id === orderId);

  if (index === -1) {
    throw new Error(`Order with ID '${orderId}' not found.`);
  }

  const order = current[index];
  const requestIndex = (order.change_requests || []).findIndex((r) => r.id === requestId);

  if (requestIndex === -1) {
    throw new Error(`Change request '${requestId}' not found on order.`);
  }

  const request = order.change_requests![requestIndex];
  if (request.status !== "pending") {
    throw new Error(`Change request is already ${request.status} and cannot be approved again.`);
  }

  // Stale request guard
  const staleCheck = isChangeRequestStale(order, request);
  if (staleCheck.isStale) {
    throw new Error(
      `Cannot approve stale change request. The accepted order was modified after this request was created in fields: ${staleCheck.conflictingFields.join(
        ", "
      )}.`
    );
  }

  // Evaluate current deadline policy
  const policySettings = getStoredPolicySettings();
  const deadlineEval = evaluateDeadlineStatus(order, policySettings.cutoff_hours, now);

  if (deadlineEval.requiresException) {
    if (!options?.isException) {
      throw new Error(`Exception approval is required: ${deadlineEval.message}`);
    }
    if (!options?.reason || !options.reason.trim()) {
      throw new Error("A non-empty reason is mandatory for exceptional change approvals.");
    }
  }

  // Calculate applied diffs
  const diffs = computeOrderFieldDiffs(order, request.proposed_changes);

  // Update change request
  const updatedRequest: ChangeRequest = {
    ...request,
    status: "approved",
    decided_at: now.toISOString(),
    decision_reason: options?.reason?.trim() || null,
    is_exception: Boolean(options?.isException),
  };

  const updatedChangeRequests = [...order.change_requests!];
  updatedChangeRequests[requestIndex] = updatedRequest;

  // Add history event
  const history = [...(order.history || [])];
  const eventType = options?.isException ? "exception_approved" : "change_approved";
  const summary = options?.isException
    ? `Exception approved by baker: ${options.reason}`
    : "Change request approved by baker.";

  history.push(
    createHistoryEvent(eventType, summary, {
      actor: "baker",
      change_request_id: requestId,
      reason: options?.reason,
      field_changes: diffs,
    })
  );

  // Apply proposed changes directly to accepted order
  const appliedChanges = { ...(request.proposed_changes as Partial<Order>) };
  if (typeof appliedChanges.weight === "string") {
    appliedChanges.weight = normalizeWeightValue(appliedChanges.weight);
  }

  const updatedOrder: Order = {
    ...order,
    ...appliedChanges,
    change_requests: updatedChangeRequests,
    history,
    updated_at: new Date().toISOString(),
  };

  const updatedList = [...current];
  updatedList[index] = updatedOrder;
  setStoredOrders(updatedList);

  return updatedOrder;
}

/**
 * Rejects a pending change request.
 * Leaves the accepted order completely unchanged.
 * Records rejection in request history and order history.
 */
export function rejectChangeRequest(
  orderId: string,
  requestId: string,
  reason?: string,
  now: Date = new Date()
): Order {
  const current = getStoredOrders();
  const index = current.findIndex((o) => o.id === orderId);

  if (index === -1) {
    throw new Error(`Order with ID '${orderId}' not found.`);
  }

  const order = current[index];
  const requestIndex = (order.change_requests || []).findIndex((r) => r.id === requestId);

  if (requestIndex === -1) {
    throw new Error(`Change request '${requestId}' not found on order.`);
  }

  const request = order.change_requests![requestIndex];
  if (request.status !== "pending") {
    throw new Error(`Change request is already ${request.status} and cannot be rejected again.`);
  }

  const updatedRequest: ChangeRequest = {
    ...request,
    status: "rejected",
    decided_at: now.toISOString(),
    decision_reason: reason?.trim() || null,
  };

  const updatedChangeRequests = [...order.change_requests!];
  updatedChangeRequests[requestIndex] = updatedRequest;

  const history = [...(order.history || [])];
  history.push(
    createHistoryEvent(
      "change_rejected",
      `Change request rejected by baker${reason ? `: ${reason}` : ""}.`,
      {
        actor: "baker",
        change_request_id: requestId,
        reason,
      }
    )
  );

  // Order specifications remain unchanged!
  const updatedOrder: Order = {
    ...order,
    change_requests: updatedChangeRequests,
    history,
    updated_at: new Date().toISOString(),
  };

  const updatedList = [...current];
  updatedList[index] = updatedOrder;
  setStoredOrders(updatedList);

  return updatedOrder;
}

/**
 * Safely updates internal baker notes on an order with history tracking.
 */
export function updateBakerNotes(orderId: string, notes: string): Order {
  const current = getStoredOrders();
  const index = current.findIndex((o) => o.id === orderId);

  if (index === -1) {
    throw new Error(`Order with ID '${orderId}' not found.`);
  }

  const order = current[index];
  const history = [...(order.history || [])];
  history.push(
    createHistoryEvent("baker_note_updated", "Baker internal notes updated.", {
      actor: "baker",
      reason: notes.trim(),
    })
  );

  const updatedOrder: Order = {
    ...order,
    baker_notes: notes.trim(),
    history,
    updated_at: new Date().toISOString(),
  };

  const updatedList = [...current];
  updatedList[index] = updatedOrder;
  setStoredOrders(updatedList);

  return updatedOrder;
}

/**
 * Deletes an order by ID.
 */
export function deleteOrder(id: string): boolean {
  const current = getStoredOrders();
  const filtered = current.filter((o) => o.id !== id);

  if (filtered.length === current.length) {
    return false;
  }

  setStoredOrders(filtered);
  return true;
}

/**
 * Loads pre-defined demo orders into storage without overwriting
 * existing user-created orders.
 */
export function loadDemoOrders(): Order[] {
  const current = getStoredOrders();
  const nonDemoOrders = current.filter((o) => !o.is_demo);
  const merged = [...SAMPLE_DEMO_ORDERS, ...nonDemoOrders];
  setStoredOrders(merged);
  return merged;
}

/**
 * Removes only the sample demo orders, leaving real baker orders intact.
 */
export function removeDemoOrders(): void {
  const current = getStoredOrders();
  const remaining = current.filter((o) => !o.is_demo);
  setStoredOrders(remaining);
}

/**
 * Clears all orders (for settings/factory reset).
 */
export function clearAllOrders(): void {
  setStoredOrders([]);
}

/**
 * Calculates live dashboard statistics from an array of orders.
 */
export function calculateDashboardStats(orders: Order[]): DashboardStats {
  const totalOrders = orders.length;
  const needsReview = orders.filter((o) => o.status === "needs_review").length;
  const confirmed = orders.filter((o) => o.status === "confirmed").length;
  const inPreparation = orders.filter((o) => o.status === "in_preparation").length;
  const ready = orders.filter((o) => o.status === "ready").length;
  const completed = orders.filter((o) => o.status === "completed").length;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;

  const pendingChanges = orders.filter((o) =>
    (o.change_requests || []).some((r) => r.status === "pending")
  ).length;

  // Upcoming: non-completed, non-cancelled orders that have a resolved date in future/today, or a requested date
  const nowStr = new Date().toISOString().split("T")[0];
  const upcomingFulfillments = orders.filter((o) => {
    if (o.status === "completed" || o.status === "cancelled") {
      return false;
    }
    if (o.resolved_date) {
      return o.resolved_date >= nowStr;
    }
    return Boolean(o.requested_date);
  }).length;

  return {
    totalOrders,
    needsReview,
    confirmed,
    inPreparation,
    ready,
    completed,
    cancelled,
    pendingChanges,
    upcomingFulfillments,
  };
}
