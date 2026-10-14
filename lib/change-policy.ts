import {
  Order,
  OrderStatus,
  ExtractedOrderPayload,
  DeadlineEvaluationStatus,
  FieldChange,
  ChangeRequest,
  OrderHistoryEvent,
  OrderHistoryEventType,
} from "@/types/order";
import { DEFAULT_CUTOFF_HOURS } from "./storage/settings";

export interface DeadlineEvaluationResult {
  status: DeadlineEvaluationStatus;
  deadline: Date | null;
  deadlineIso: string | null;
  fulfillmentDateTime: Date | null;
  isResolved: boolean;
  hoursRemaining: number | null;
  message: string;
  canApproveNormally: boolean;
  requiresException: boolean;
}

export interface TransitionValidationResult {
  allowed: boolean;
  error?: string;
  requiresReason?: boolean;
}

export const SUPPORTED_CHANGE_FIELDS: Array<{
  key: keyof ExtractedOrderPayload | "baker_notes";
  label: string;
}> = [
  { key: "product", label: "Product / Flavor" },
  { key: "quantity", label: "Quantity (Units)" },
  { key: "weight", label: "Weight / Size" },
  { key: "dietary_preference", label: "Dietary Preference" },
  { key: "requested_date", label: "Requested Date" },
  { key: "resolved_date", label: "Resolved Calendar Date" },
  { key: "requested_time", label: "Fulfillment Time" },
  { key: "fulfillment_method", label: "Fulfillment Method" },
  { key: "payment_amount", label: "Payment Amount" },
  { key: "payment_currency", label: "Currency" },
  { key: "payment_method", label: "Payment Method" },
  { key: "payment_status", label: "Payment Status" },
  { key: "notes", label: "Order Notes" },
  { key: "baker_notes", label: "Baker Internal Notes" },
];

/**
 * Checks whether an order has both an unambiguous resolved calendar date (YYYY-MM-DD)
 * and an exact, usable fulfillment time (HH:mm).
 */
export function isScheduleResolved(
  resolvedDate: string | null | undefined,
  requestedTime: string | null | undefined
): boolean {
  if (!resolvedDate || !requestedTime) {
    return false;
  }

  // resolvedDate must be strict ISO YYYY-MM-DD
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(resolvedDate.trim())) {
    return false;
  }

  // requestedTime must be exact time in HH:mm (24h or standard format)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  const trimmedTime = requestedTime.trim();
  if (!timeRegex.test(trimmedTime)) {
    return false;
  }

  return true;
}

/**
 * Constructs a local JavaScript Date object from a resolved date (YYYY-MM-DD)
 * and time (HH:mm) using the browser's local timezone.
 */
export function parseFulfillmentDateTime(
  resolvedDate: string | null | undefined,
  requestedTime: string | null | undefined
): Date | null {
  if (!isScheduleResolved(resolvedDate, requestedTime)) {
    return null;
  }

  try {
    const [yearStr, monthStr, dayStr] = (resolvedDate as string).trim().split("-");
    const [hourStr, minStr] = (requestedTime as string).trim().split(":");

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // 0-indexed in JS
    const day = parseInt(dayStr, 10);
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minStr, 10);

    const localDate = new Date(year, month, day, hour, minute, 0, 0);
    if (isNaN(localDate.getTime())) {
      return null;
    }
    return localDate;
  } catch {
    return null;
  }
}

/**
 * Calculates the exact change cutoff deadline:
 * scheduled fulfillment date and time MINUS configured cutoff hours.
 * Uses browser local timezone.
 */
export function calculateChangeDeadline(
  order: {
    resolved_date: string | null | undefined;
    requested_time: string | null | undefined;
  },
  cutoffHours: number = DEFAULT_CUTOFF_HOURS
): {
  isResolved: boolean;
  deadline: Date | null;
  deadlineIso: string | null;
  fulfillmentDateTime: Date | null;
  error?: string;
} {
  const fulfillmentDateTime = parseFulfillmentDateTime(
    order.resolved_date,
    order.requested_time
  );

  if (!fulfillmentDateTime) {
    return {
      isResolved: false,
      deadline: null,
      deadlineIso: null,
      fulfillmentDateTime: null,
      error: "Change deadline unavailable — resolve the fulfillment schedule first.",
    };
  }

  const deadlineMs = fulfillmentDateTime.getTime() - cutoffHours * 3600 * 1000;
  const deadline = new Date(deadlineMs);

  return {
    isResolved: true,
    deadline,
    deadlineIso: deadline.toISOString(),
    fulfillmentDateTime,
  };
}

/**
 * Centrally evaluates the deadline status of an order according to all business rules:
 * - Terminal states (completed, cancelled)
 * - Preparation started or ready states
 * - Schedule resolution check
 * - Within cutoff window vs past cutoff window
 *
 * `now` can be injected for deterministic unit testing.
 */
export function evaluateDeadlineStatus(
  order: Pick<
    Order,
    "status" | "resolved_date" | "requested_time" | "preparation_started_at"
  >,
  cutoffHours: number = DEFAULT_CUTOFF_HOURS,
  now: Date = new Date()
): DeadlineEvaluationResult {
  // 1. Terminal states
  if (order.status === "completed" || order.status === "cancelled") {
    return {
      status: "terminal",
      deadline: null,
      deadlineIso: null,
      fulfillmentDateTime: null,
      isResolved: false,
      hoursRemaining: null,
      message:
        order.status === "completed"
          ? "This order has been completed. Ordinary change requests cannot modify completed orders."
          : "This order has been cancelled. Ordinary change requests cannot modify cancelled orders.",
      canApproveNormally: false,
      requiresException: false,
    };
  }

  // 2. Order Ready
  if (order.status === "ready") {
    return {
      status: "ready",
      deadline: null,
      deadlineIso: null,
      fulfillmentDateTime: null,
      isResolved: isScheduleResolved(order.resolved_date, order.requested_time),
      hoursRemaining: null,
      message:
        "Order is ready for fulfillment. Ordinary changes remain locked; exceptional corrections require explicit baker intervention and confirmation.",
      canApproveNormally: false,
      requiresException: true,
    };
  }

  // 3. Preparation Started
  if (order.status === "in_preparation" || Boolean(order.preparation_started_at)) {
    return {
      status: "prep_started",
      deadline: null,
      deadlineIso: null,
      fulfillmentDateTime: null,
      isResolved: isScheduleResolved(order.resolved_date, order.requested_time),
      hoursRemaining: null,
      message:
        "Preparation has started. Ordinary order changes are locked immediately. Exceptional approval requires a mandatory reason.",
      canApproveNormally: false,
      requiresException: true,
    };
  }

  // 4. Check schedule resolution
  const deadlineCalc = calculateChangeDeadline(order, cutoffHours);
  if (!deadlineCalc.isResolved || !deadlineCalc.deadline) {
    return {
      status: "unresolved_schedule",
      deadline: null,
      deadlineIso: null,
      fulfillmentDateTime: null,
      isResolved: false,
      hoursRemaining: null,
      message: "Change deadline unavailable — resolve the fulfillment schedule first.",
      canApproveNormally: false,
      requiresException: true,
    };
  }

  // 5. Compute time remaining until cutoff deadline
  const msRemaining = deadlineCalc.deadline.getTime() - now.getTime();
  const hoursRemaining = msRemaining / (3600 * 1000);

  if (msRemaining >= 0) {
    const formattedHours = hoursRemaining.toFixed(1);
    return {
      status: "within_window",
      deadline: deadlineCalc.deadline,
      deadlineIso: deadlineCalc.deadlineIso,
      fulfillmentDateTime: deadlineCalc.fulfillmentDateTime,
      isResolved: true,
      hoursRemaining,
      message: `Within change window (~${formattedHours}h remaining before ${cutoffHours}h cutoff).`,
      canApproveNormally: true,
      requiresException: false,
    };
  }

  const hoursPast = Math.abs(hoursRemaining).toFixed(1);
  return {
    status: "past_deadline",
    deadline: deadlineCalc.deadline,
    deadlineIso: deadlineCalc.deadlineIso,
    fulfillmentDateTime: deadlineCalc.fulfillmentDateTime,
    isResolved: true,
    hoursRemaining,
    message: `Change window closed ~${hoursPast}h ago (${cutoffHours}h cutoff passed). Approval requires an explicit exception and a mandatory reason.`,
    canApproveNormally: false,
    requiresException: true,
  };
}

/**
 * Validates whether an order status transition is allowed by the domain lifecycle graph.
 *
 * Graph:
 * needs_review -> confirmed | cancelled
 * confirmed -> in_preparation | cancelled
 * in_preparation -> ready | cancelled (cancellation requires explicit warning & reason)
 * ready -> completed
 * completed -> terminal
 * cancelled -> terminal
 */
export function canTransitionStatus(
  from: OrderStatus,
  to: OrderStatus,
  options?: { reason?: string }
): TransitionValidationResult {
  if (from === to) {
    return { allowed: false, error: `Order is already in status '${from}'.` };
  }

  // Terminal states cannot transition
  if (from === "completed" || from === "cancelled") {
    return {
      allowed: false,
      error: `Orders in '${from}' status are terminal and cannot be transitioned.`,
    };
  }

  // Backwards transitions are prohibited
  const progressionOrder: OrderStatus[] = [
    "needs_review",
    "confirmed",
    "in_preparation",
    "ready",
    "completed",
  ];
  const fromIndex = progressionOrder.indexOf(from);
  const toIndex = progressionOrder.indexOf(to);

  if (fromIndex !== -1 && toIndex !== -1 && toIndex < fromIndex) {
    return {
      allowed: false,
      error: `Cannot move order backwards from '${from}' to '${to}' as this would bypass edit restrictions.`,
    };
  }

  switch (from) {
    case "needs_review":
      if (to === "confirmed" || to === "cancelled") {
        return { allowed: true };
      }
      return {
        allowed: false,
        error: `Cannot transition directly from 'needs_review' to '${to}'. Confirm order first.`,
      };

    case "confirmed":
      if (to === "in_preparation" || to === "cancelled") {
        return { allowed: true };
      }
      return {
        allowed: false,
        error: `Confirmed orders can only transition to 'in_preparation' or 'cancelled'.`,
      };

    case "in_preparation":
      if (to === "ready") {
        return { allowed: true };
      }
      if (to === "cancelled") {
        if (!options?.reason || !options.reason.trim()) {
          return {
            allowed: false,
            requiresReason: true,
            error: "Cancelling an order after preparation has started requires a mandatory reason.",
          };
        }
        return { allowed: true, requiresReason: true };
      }
      return {
        allowed: false,
        error: `Orders in preparation can only transition to 'ready' or 'cancelled'.`,
      };

    case "ready":
      if (to === "completed") {
        return { allowed: true };
      }
      return {
        allowed: false,
        error: `Ready orders can only transition to 'completed'.`,
      };

    default:
      return { allowed: false, error: `Unknown transition from '${from}' to '${to}'.` };
  }
}

/**
 * Normalizes weight strings to preserve explicit units (g, kg, lbs).
 * Ensures bare numbers (e.g. 1000 -> "1 kg", 500 -> "500g", 1 -> "1 kg")
 * always include their explicit unit and never display as bare numbers.
 */
export function normalizeWeightValue(
  weight: string | null | undefined
): string | null {
  if (!weight || typeof weight !== "string") return null;
  const trimmed = weight.trim();
  if (!trimmed) return null;

  // If bare number without unit:
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const num = parseFloat(trimmed);
    if (num === 1000) return "1 kg";
    if (num >= 50) return `${num}g`;
    return `${num} kg`;
  }

  // Grams: e.g. "1000g", "1000 g", "1000 grams" -> convert to "1 kg"
  const gMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:g|gm|gms|grams?)$/i);
  if (gMatch) {
    const num = parseFloat(gMatch[1]);
    if (num === 1000) return "1 kg";
    return trimmed;
  }

  // Kilograms / pounds / others: preserve unit string
  return trimmed;
}

/**
 * Normalizes values for comparison (empty strings / null / undefined treated equivalently).
 */
function normalizeForComparison(val: unknown, key?: string): unknown {
  if (val === undefined || val === null || val === "") {
    return null;
  }
  if (key === "weight" && typeof val === "string") {
    const norm = normalizeWeightValue(val) || val;
    const lower = norm.toLowerCase().replace(/\s+/g, "");
    if (lower === "1000g" || lower === "1kg") return "1kg";
    if (lower === "500g" || lower === "0.5kg") return "500g";
    return lower;
  }
  if (typeof val === "string") {
    return val.trim();
  }
  if (Array.isArray(val)) {
    return val.map((v) => (typeof v === "string" ? v.trim() : v)).filter(Boolean).join("; ");
  }
  return val;
}

/**
 * Compares original order values against proposed change fields.
 * Returns only the fields that actually changed!
 */
export function computeOrderFieldDiffs(
  original: Order | ExtractedOrderPayload,
  proposed: Partial<ExtractedOrderPayload & { baker_notes?: string }>
): FieldChange[] {
  const diffs: FieldChange[] = [];

  for (const fieldDef of SUPPORTED_CHANGE_FIELDS) {
    const key = fieldDef.key;
    if (!(key in proposed)) {
      continue;
    }

    const proposedVal = proposed[key as keyof typeof proposed];
    const originalVal = (original as unknown as Record<string, unknown>)[key];

    let finalOldVal = originalVal ?? null;
    let finalProposedVal = proposedVal ?? null;

    if (key === "weight") {
      finalOldVal = normalizeWeightValue(originalVal as string | null | undefined);
      finalProposedVal = normalizeWeightValue(proposedVal as string | null | undefined);
    }

    const normProposed = normalizeForComparison(proposedVal, key);
    const normOriginal = normalizeForComparison(originalVal, key);

    if (normProposed !== normOriginal) {
      diffs.push({
        field: key,
        field_label: fieldDef.label,
        old_value: finalOldVal,
        new_value: finalProposedVal,
      });
    }
  }

  return diffs;
}

/**
 * Checks if a pending change request has become stale because the accepted order
 * was modified after the request was created.
 */
export function isChangeRequestStale(
  currentOrder: Order,
  request: ChangeRequest
): { isStale: boolean; conflictingFields: string[] } {
  const conflictingFields: string[] = [];

  for (const [key, origValAtRequest] of Object.entries(request.original_values)) {
    const currentVal = (currentOrder as unknown as Record<string, unknown>)[key];
    const normCurrent = normalizeForComparison(currentVal, key);
    const normOrig = normalizeForComparison(origValAtRequest, key);

    if (normCurrent !== normOrig) {
      conflictingFields.push(key);
    }
  }

  return {
    isStale: conflictingFields.length > 0,
    conflictingFields,
  };
}

/**
 * Helper to construct an OrderHistoryEvent with stable ID and timestamp.
 */
export function createHistoryEvent(
  type: OrderHistoryEventType,
  summary: string,
  details?: {
    actor?: "baker" | "system";
    change_request_id?: string;
    reason?: string;
    field_changes?: FieldChange[];
  }
): OrderHistoryEvent {
  return {
    id: `he_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    type,
    summary,
    actor: details?.actor ?? "baker",
    change_request_id: details?.change_request_id,
    reason: details?.reason,
    field_changes: details?.field_changes ?? [],
  };
}
