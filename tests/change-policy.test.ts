import { describe, it, expect, beforeEach } from "vitest";
import {
  isScheduleResolved,
  calculateChangeDeadline,
  evaluateDeadlineStatus,
  canTransitionStatus,
  computeOrderFieldDiffs,
  isChangeRequestStale,
  createHistoryEvent,
  normalizeWeightValue,
} from "@/lib/change-policy";
import {
  getStoredOrders,
  addOrder,
  transitionOrderStatus,
  recordChangeRequest,
  approveChangeRequest,
  rejectChangeRequest,
  clearAllOrders,
  setRawStoredOrdersForTesting,
} from "@/lib/storage/orders";
import { orderSchema } from "@/lib/schemas/order";
import { Order, ChangeRequest } from "@/types/order";

describe("Phase 10: Order Change Policy & Cutoff Calculations", () => {
  it("A1: correctly determines whether fulfillment schedule is resolved", () => {
    // Valid ISO date and HH:mm time
    expect(isScheduleResolved("2026-10-25", "18:00")).toBe(true);
    expect(isScheduleResolved("2026-10-25", "09:30")).toBe(true);

    // Missing date or time
    expect(isScheduleResolved(null, "18:00")).toBe(false);
    expect(isScheduleResolved("2026-10-25", null)).toBe(false);
    expect(isScheduleResolved(undefined, undefined)).toBe(false);

    // Non-ISO date expressions (e.g. "Sunday", "next week")
    expect(isScheduleResolved("Sunday", "18:00")).toBe(false);
    expect(isScheduleResolved("tomorrow", "18:00")).toBe(false);
    expect(isScheduleResolved("25/10/2026", "18:00")).toBe(false);

    // Non-standard times
    expect(isScheduleResolved("2026-10-25", "evening")).toBe(false);
    expect(isScheduleResolved("2026-10-25", "6 PM")).toBe(false);
  });

  it("A2: calculates change deadline accurately based on cutoff hours in browser local time", () => {
    // 2026-10-25 18:00 with default 24h cutoff
    const res24 = calculateChangeDeadline(
      { resolved_date: "2026-10-25", requested_time: "18:00" },
      24
    );
    expect(res24.isResolved).toBe(true);
    expect(res24.deadline).not.toBeNull();

    // The deadline should be exactly 24h prior: 2026-10-24 at 18:00 local time
    const deadline24 = res24.deadline!;
    expect(deadline24.getFullYear()).toBe(2026);
    expect(deadline24.getMonth()).toBe(9); // 0-indexed: October is 9
    expect(deadline24.getDate()).toBe(24);
    expect(deadline24.getHours()).toBe(18);
    expect(deadline24.getMinutes()).toBe(0);

    // Custom cutoff: 12h
    const res12 = calculateChangeDeadline(
      { resolved_date: "2026-10-25", requested_time: "18:00" },
      12
    );
    const deadline12 = res12.deadline!;
    expect(deadline12.getDate()).toBe(25);
    expect(deadline12.getHours()).toBe(6);

    // Custom cutoff: 48h
    const res48 = calculateChangeDeadline(
      { resolved_date: "2026-10-25", requested_time: "18:00" },
      48
    );
    const deadline48 = res48.deadline!;
    expect(deadline48.getDate()).toBe(23);
    expect(deadline48.getHours()).toBe(18);
  });

  it("A3: returns unresolved schedule error when date or time is missing", () => {
    const resNoTime = calculateChangeDeadline({
      resolved_date: "2026-10-25",
      requested_time: null,
    });
    expect(resNoTime.isResolved).toBe(false);
    expect(resNoTime.deadline).toBeNull();
    expect(resNoTime.error).toContain("Change deadline unavailable");

    const resRelativeDate = calculateChangeDeadline({
      resolved_date: "Sunday",
      requested_time: "18:00",
    });
    expect(resRelativeDate.isResolved).toBe(false);
    expect(resRelativeDate.deadline).toBeNull();
  });

  it("A3b: calculates deadline successfully when both resolved_date (2026-10-17) and time (18:00) are present", () => {
    const res = calculateChangeDeadline(
      {
        resolved_date: "2026-10-17",
        requested_time: "18:00",
      },
      24
    );
    expect(res.isResolved).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.deadline).not.toBeNull();
    const d = res.deadline!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9); // October
    expect(d.getDate()).toBe(16); // 24h prior to 17th
    expect(d.getHours()).toBe(18);
  });

  it("A4 & G: evaluates deadline status with injected wall-clock time", () => {
    const order = {
      status: "confirmed" as const,
      resolved_date: "2026-10-25",
      requested_time: "18:00",
      preparation_started_at: null,
    };

    // Cutoff deadline is 2026-10-24 18:00

    // Scenario 1: More than 24h before deadline (e.g. 2026-10-23 12:00)
    const nowBefore = new Date(2026, 9, 23, 12, 0, 0);
    const evalBefore = evaluateDeadlineStatus(order, 24, nowBefore);
    expect(evalBefore.status).toBe("within_window");
    expect(evalBefore.canApproveNormally).toBe(true);
    expect(evalBefore.requiresException).toBe(false);
    expect(evalBefore.hoursRemaining).toBeGreaterThan(24);

    // Scenario 2: Exactly at deadline (2026-10-24 18:00)
    const nowExact = new Date(2026, 9, 24, 18, 0, 0);
    const evalExact = evaluateDeadlineStatus(order, 24, nowExact);
    expect(evalExact.status).toBe("within_window");
    expect(evalExact.canApproveNormally).toBe(true);

    // Scenario 3: Less than 24h remaining / Past deadline (e.g. 2026-10-24 20:00, 2h past cutoff)
    const nowPast = new Date(2026, 9, 24, 20, 0, 0);
    const evalPast = evaluateDeadlineStatus(order, 24, nowPast);
    expect(evalPast.status).toBe("past_deadline");
    expect(evalPast.canApproveNormally).toBe(false);
    expect(evalPast.requiresException).toBe(true);
    expect(evalPast.hoursRemaining).toBeLessThan(0);
    expect(evalPast.message).toContain("Change window closed");
  });
});

describe("Phase 10: Lifecycle Restrictions & Status Transitions", () => {
  it("B1: validates correct progression along the lifecycle graph", () => {
    expect(canTransitionStatus("needs_review", "confirmed").allowed).toBe(true);
    expect(canTransitionStatus("needs_review", "cancelled").allowed).toBe(true);
    expect(canTransitionStatus("confirmed", "in_preparation").allowed).toBe(true);
    expect(canTransitionStatus("confirmed", "cancelled").allowed).toBe(true);
    expect(canTransitionStatus("in_preparation", "ready").allowed).toBe(true);
    expect(canTransitionStatus("ready", "completed").allowed).toBe(true);
  });

  it("B2: prohibits backwards status transitions that would bypass edit restrictions", () => {
    // Confirmed cannot be moved back to needs_review
    const res = canTransitionStatus("confirmed", "needs_review");
    expect(res.allowed).toBe(false);
    expect(res.error).toContain("Cannot move order backwards");

    // In_preparation cannot be moved back to confirmed or needs_review
    expect(canTransitionStatus("in_preparation", "confirmed").allowed).toBe(false);
    expect(canTransitionStatus("in_preparation", "needs_review").allowed).toBe(false);
    expect(canTransitionStatus("ready", "in_preparation").allowed).toBe(false);
  });

  it("B3: terminal states (completed, cancelled) cannot transition to any other status", () => {
    expect(canTransitionStatus("completed", "confirmed").allowed).toBe(false);
    expect(canTransitionStatus("completed", "ready").allowed).toBe(false);
    expect(canTransitionStatus("cancelled", "confirmed").allowed).toBe(false);
    expect(canTransitionStatus("cancelled", "needs_review").allowed).toBe(false);
  });

  it("B4: cancelling an order after preparation has started requires a mandatory reason", () => {
    // No reason provided
    const noReason = canTransitionStatus("in_preparation", "cancelled");
    expect(noReason.allowed).toBe(false);
    expect(noReason.requiresReason).toBe(true);
    expect(noReason.error).toContain("mandatory reason");

    // Valid reason provided
    const withReason = canTransitionStatus("in_preparation", "cancelled", {
      reason: "Customer cancelled emergency; sponge discarded.",
    });
    expect(withReason.allowed).toBe(true);
  });
});

describe("Phase 10: Preparation Locks & Exceptions", () => {
  it("C1: once preparation has started, ordinary changes are locked even if >24h remains", () => {
    const orderInPrep = {
      status: "in_preparation" as const,
      resolved_date: "2026-10-30", // 5 days away!
      requested_time: "18:00",
      preparation_started_at: "2026-10-25T10:00:00Z",
    };

    const now = new Date(2026, 9, 25, 12, 0, 0);
    const evalResult = evaluateDeadlineStatus(orderInPrep, 24, now);

    expect(evalResult.status).toBe("prep_started");
    expect(evalResult.canApproveNormally).toBe(false);
    expect(evalResult.requiresException).toBe(true);
    expect(evalResult.message).toContain("Preparation has started");
  });

  it("C2: ready orders lock ordinary changes and require deliberate exception intervention", () => {
    const orderReady = {
      status: "ready" as const,
      resolved_date: "2026-10-25",
      requested_time: "18:00",
      preparation_started_at: "2026-10-25T08:00:00Z",
    };

    const now = new Date(2026, 9, 25, 12, 0, 0);
    const evalResult = evaluateDeadlineStatus(orderReady, 24, now);

    expect(evalResult.status).toBe("ready");
    expect(evalResult.canApproveNormally).toBe(false);
    expect(evalResult.requiresException).toBe(true);
  });

  it("C3: unresolved schedules require exception review and cannot bypass deadline checks", () => {
    const orderUnresolved = {
      status: "confirmed" as const,
      resolved_date: null,
      requested_time: null,
      preparation_started_at: null,
    };

    const evalResult = evaluateDeadlineStatus(orderUnresolved, 24);
    expect(evalResult.status).toBe("unresolved_schedule");
    expect(evalResult.canApproveNormally).toBe(false);
    expect(evalResult.requiresException).toBe(true);
    expect(evalResult.deadline).toBeNull();
  });
});

describe("Phase 10: Change Requests, Diff Computation & Stale Guards", () => {
  const sampleOrder: Order = {
    id: "ord_test_001",
    customer_name: "Priya Sharma",
    product: "chocolate truffle cake",
    quantity: 1,
    weight: "500g",
    requested_date: "Sunday",
    resolved_date: "2026-10-25",
    requested_time: "18:00",
    dietary_preference: "regular",
    fulfillment_method: "pickup",
    payment_amount: 800,
    payment_currency: "INR",
    payment_method: "GPay",
    payment_status: "customer_reported_paid",
    notes: ["Sister birthday"],
    missing_or_unverified: [],
    requires_confirmation: false,
    status: "confirmed",
    raw_message: "Need 500g chocolate cake for Sunday 6 PM.",
    created_at: "2026-10-20T10:00:00Z",
    updated_at: "2026-10-20T10:00:00Z",
    change_requests: [],
    history: [],
  };

  it("D1: computeOrderFieldDiffs only reports fields whose values actually changed", () => {
    // Propose changing weight from 500g to 1 kg, and dietary_preference to eggless
    const proposed = {
      weight: "1 kg",
      dietary_preference: "eggless",
      quantity: 1, // unchanged
      product: "chocolate truffle cake", // unchanged
    };

    const diffs = computeOrderFieldDiffs(sampleOrder, proposed);
    expect(diffs).toHaveLength(2);

    const weightDiff = diffs.find((d) => d.field === "weight");
    expect(weightDiff).toBeDefined();
    expect(weightDiff?.old_value).toBe("500g");
    expect(weightDiff?.new_value).toBe("1 kg");

    const dietaryDiff = diffs.find((d) => d.field === "dietary_preference");
    expect(dietaryDiff).toBeDefined();
    expect(dietaryDiff?.old_value).toBe("regular");
    expect(dietaryDiff?.new_value).toBe("eggless");
  });

  it("D2: isChangeRequestStale detects when accepted order has changed since request was created", () => {
    const request: ChangeRequest = {
      id: "cr_1",
      order_id: sampleOrder.id,
      created_at: "2026-10-21T10:00:00Z",
      status: "pending",
      proposed_changes: { weight: "1 kg" },
      original_values: { weight: "500g" },
      deadline_status_at_request: "within_window",
      deadline_at_request: "2026-10-24T18:00:00.000Z",
    };

    // When order is still 500g: not stale
    expect(isChangeRequestStale(sampleOrder, request).isStale).toBe(false);

    // If baker updated accepted order to "750g" prior to approving request: stale!
    const modifiedOrder: Order = { ...sampleOrder, weight: "750g" };
    const staleResult = isChangeRequestStale(modifiedOrder, request);
    expect(staleResult.isStale).toBe(true);
    expect(staleResult.conflictingFields).toContain("weight");
  });
});

describe("Phase 10: Change Request Workflow & Storage Operations", () => {
  beforeEach(() => {
    clearAllOrders();
  });

  it("E1: creating a change request does NOT mutate the accepted order", () => {
    const baseOrder: Order = {
      id: "ord_req_101",
      customer_name: "Rahul Verma",
      product: "vanilla sponge",
      quantity: 1,
      weight: "500g",
      requested_date: "Sunday",
      resolved_date: "2026-10-25",
      requested_time: "16:00",
      dietary_preference: "eggless",
      fulfillment_method: "pickup",
      payment_amount: 500,
      payment_currency: "INR",
      payment_method: "UPI",
      payment_status: "customer_reported_paid",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: false,
      status: "confirmed",
      raw_message: "Need vanilla cake",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      change_requests: [],
      history: [],
    };

    addOrder(baseOrder);

    // Record change request: customer wants 1 kg
    const { order: updatedOrder, changeRequest } = recordChangeRequest(
      baseOrder.id,
      { weight: "1 kg" },
      "Customer called to upgrade cake weight to 1kg"
    );

    // Accepted order specifications must remain unchanged!
    expect(updatedOrder.weight).toBe("500g");
    expect(changeRequest.status).toBe("pending");
    expect(changeRequest.proposed_changes.weight).toBe("1 kg");
    expect(changeRequest.original_values.weight).toBe("500g");

    // Persisted in storage
    const stored = getStoredOrders().find((o) => o.id === baseOrder.id);
    expect(stored?.weight).toBe("500g"); // STILL 500g!
    expect(stored?.change_requests).toHaveLength(1);
    expect(stored?.history?.some((h) => h.type === "change_requested")).toBe(true);
  });

  it("E2: prevents multiple conflicting pending requests on the same order", () => {
    const baseOrder: Order = {
      id: "ord_multi_102",
      customer_name: "Aman",
      product: "muffins",
      quantity: 6,
      weight: null,
      requested_date: "Tomorrow",
      resolved_date: "2026-10-26",
      requested_time: "10:00",
      dietary_preference: "regular",
      fulfillment_method: "delivery",
      payment_amount: 300,
      payment_currency: "INR",
      payment_method: "Cash",
      payment_status: "not_mentioned",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: false,
      status: "confirmed",
      raw_message: "Muffins please",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      change_requests: [],
      history: [],
    };

    addOrder(baseOrder);

    recordChangeRequest(baseOrder.id, { quantity: 12 }, "Customer wants 12 instead");

    // Second change request before resolving first must throw!
    expect(() =>
      recordChangeRequest(baseOrder.id, { quantity: 18 }, "Customer changed mind again")
    ).toThrow(/already exists/i);
  });

  it("E3: approving a pending change applies changes exactly once and logs history", () => {
    const baseOrder: Order = {
      id: "ord_appr_103",
      customer_name: "Sneha",
      product: "red velvet cake",
      quantity: 1,
      weight: "500g",
      requested_date: "Sunday",
      resolved_date: "2026-10-25",
      requested_time: "18:00",
      dietary_preference: "regular",
      fulfillment_method: "pickup",
      payment_amount: 700,
      payment_currency: "INR",
      payment_method: "GPay",
      payment_status: "customer_reported_paid",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: false,
      status: "confirmed",
      raw_message: "Red velvet 500g",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      change_requests: [],
      history: [],
    };

    addOrder(baseOrder);

    // Record request 48h before fulfillment (within window)
    const nowTime = new Date(2026, 9, 23, 10, 0, 0); // 2026-10-23
    const { changeRequest } = recordChangeRequest(
      baseOrder.id,
      { weight: "1 kg", dietary_preference: "eggless" },
      "WhatsApp change",
      nowTime
    );

    // Normal approval within window
    const approvedOrder = approveChangeRequest(
      baseOrder.id,
      changeRequest.id,
      { isException: false },
      nowTime
    );

    // Accepted order is now modified!
    expect(approvedOrder.weight).toBe("1 kg");
    expect(approvedOrder.dietary_preference).toBe("eggless");

    const reqInOrder = approvedOrder.change_requests?.find((r) => r.id === changeRequest.id);
    expect(reqInOrder?.status).toBe("approved");

    const historyEvent = approvedOrder.history?.find((h) => h.type === "change_approved");
    expect(historyEvent).toBeDefined();

    // Repeated approval must throw!
    expect(() =>
      approveChangeRequest(baseOrder.id, changeRequest.id, { isException: false }, nowTime)
    ).toThrow(/already approved/i);
  });

  it("E4: rejecting a change proposal preserves accepted order unchanged and records decision", () => {
    const baseOrder: Order = {
      id: "ord_rej_104",
      customer_name: "Karan",
      product: "carrot cake",
      quantity: 1,
      weight: "1 kg",
      requested_date: "Tomorrow",
      resolved_date: "2026-10-25",
      requested_time: "14:00",
      dietary_preference: "regular",
      fulfillment_method: "pickup",
      payment_amount: 900,
      payment_currency: "INR",
      payment_method: "UPI",
      payment_status: "customer_reported_paid",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: false,
      status: "confirmed",
      raw_message: "Carrot cake 1kg",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      change_requests: [],
      history: [],
    };

    addOrder(baseOrder);

    const { changeRequest } = recordChangeRequest(
      baseOrder.id,
      { weight: "2 kg" },
      "Wants 2kg"
    );

    const rejectedOrder = rejectChangeRequest(
      baseOrder.id,
      changeRequest.id,
      "Unable to bake 2kg on short notice; tin size unavailable."
    );

    // Accepted order remains strictly unchanged
    expect(rejectedOrder.weight).toBe("1 kg");

    const req = rejectedOrder.change_requests?.find((r) => r.id === changeRequest.id);
    expect(req?.status).toBe("rejected");
    expect(req?.decision_reason).toContain("short notice");

    const historyEvent = rejectedOrder.history?.find((h) => h.type === "change_rejected");
    expect(historyEvent).toBeDefined();
    expect(historyEvent?.reason).toContain("short notice");

    // Repeated rejection must throw
    expect(() =>
      rejectChangeRequest(baseOrder.id, changeRequest.id, "Try again")
    ).toThrow(/already rejected/i);
  });

  it("E5: exceptional approval requires explicit reason and authorization", () => {
    const baseOrder: Order = {
      id: "ord_exc_105",
      customer_name: "Maya",
      product: "chocolate fudge",
      quantity: 1,
      weight: "500g",
      requested_date: "Tomorrow 6 PM",
      resolved_date: "2026-10-25",
      requested_time: "18:00",
      dietary_preference: "regular",
      fulfillment_method: "pickup",
      payment_amount: 600,
      payment_currency: "INR",
      payment_method: "GPay",
      payment_status: "customer_reported_paid",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: false,
      status: "confirmed",
      raw_message: "Fudge cake",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      change_requests: [],
      history: [],
    };

    addOrder(baseOrder);

    // Record change past the 24h cutoff: e.g. 2026-10-25 10:00 AM (8h before fulfillment)
    const lateNow = new Date(2026, 9, 25, 10, 0, 0);

    const { changeRequest } = recordChangeRequest(
      baseOrder.id,
      { weight: "1 kg" },
      "Late request",
      lateNow
    );

    // Attempting normal approval without exception flag must fail!
    expect(() =>
      approveChangeRequest(baseOrder.id, changeRequest.id, { isException: false }, lateNow)
    ).toThrow(/Exception approval is required/i);

    // Attempting exception approval with empty reason must fail!
    expect(() =>
      approveChangeRequest(
        baseOrder.id,
        changeRequest.id,
        { isException: true, reason: "" },
        lateNow
      )
    ).toThrow(/non-empty reason is mandatory/i);

    // Valid exception approval with reason succeeds
    const approvedOrder = approveChangeRequest(
      baseOrder.id,
      changeRequest.id,
      { isException: true, reason: "Customer agreed to rush fee; sponge batch ready." },
      lateNow
    );

    expect(approvedOrder.weight).toBe("1 kg");
    const historyEvent = approvedOrder.history?.find((h) => h.type === "exception_approved");
    expect(historyEvent).toBeDefined();
    expect(historyEvent?.reason).toContain("rush fee");
  });
});

describe("Phase 10: Backward Compatibility & Schema Migration", () => {
  it("F1: loads legacy stored orders missing Phase 10 fields seamlessly", () => {
    // Legacy record from older CrumbDesk version (no change_requests, history, preparation_started_at)
    const legacyRecord = {
      id: "legacy_001",
      customer_name: "Anita",
      product: "cheesecake",
      quantity: 1,
      weight: "1 kg",
      requested_date: "Sunday",
      resolved_date: "2026-10-25",
      requested_time: "17:00",
      dietary_preference: null,
      fulfillment_method: "pickup",
      payment_amount: 1500,
      payment_currency: "INR",
      payment_method: "UPI",
      payment_status: "customer_reported_paid",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: false,
      status: "confirmed",
      raw_message: "Cheesecake order",
      created_at: "2026-10-01T12:00:00Z",
      updated_at: "2026-10-01T12:00:00Z",
      // Notice: change_requests, history, preparation_started_at are absent!
    };

    const parsed = orderSchema.safeParse(legacyRecord);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.change_requests).toEqual([]);
      expect(parsed.data.history).toEqual([]);
      expect(parsed.data.preparation_started_at).toBeNull();
    }
  });

  it("F2: history events and change requests survive serialization and deserialization", () => {
    const historyItem = createHistoryEvent(
      "order_confirmed",
      "Order confirmed by baker",
      { actor: "baker" }
    );

    const json = JSON.stringify(historyItem);
    const roundTripped = JSON.parse(json);

    expect(roundTripped.id).toBe(historyItem.id);
    expect(roundTripped.type).toBe("order_confirmed");
    expect(roundTripped.actor).toBe("baker");
  });
});

describe("Phase 10 Part B: Weight Unit Preservation & Normalization Regression", () => {
  beforeEach(() => {
    clearAllOrders();
  });

  const baseOrder: Order = {
    id: "ord_weight_test",
    customer_name: "Farhan",
    product: "Chocolate Truffle",
    quantity: 1,
    weight: "500g",
    requested_date: "Tomorrow 6 PM",
    resolved_date: "2026-10-25",
    requested_time: "18:00",
    dietary_preference: "eggless",
    fulfillment_method: "pickup",
    payment_amount: 800,
    payment_currency: "INR",
    payment_method: "GPay",
    payment_status: "customer_reported_paid",
    notes: [],
    missing_or_unverified: [],
    requires_confirmation: false,
    status: "confirmed",
    raw_message: "500g cake",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    change_requests: [],
    history: [],
  };

  it("W1: computes diff preserving explicit unit for 500g -> 1kg", () => {
    const diffs = computeOrderFieldDiffs(baseOrder, { weight: "1kg" });
    const weightDiff = diffs.find((d) => d.field === "weight");
    expect(weightDiff).toBeDefined();
    expect(weightDiff?.old_value).toBe("500g");
    expect(weightDiff?.new_value).toBe("1kg");
  });

  it("W2: converts bare '1000' or '1000g' to explicit unit '1 kg', never bare '1000'", () => {
    // Propose bare number 1000
    const diffsBare = computeOrderFieldDiffs(baseOrder, { weight: "1000" });
    const weightDiffBare = diffsBare.find((d) => d.field === "weight");
    expect(weightDiffBare).toBeDefined();
    expect(weightDiffBare?.old_value).toBe("500g");
    expect(weightDiffBare?.new_value).toBe("1 kg");
    expect(weightDiffBare?.new_value).not.toBe("1000");

    // Propose 1000g
    const diffsG = computeOrderFieldDiffs(baseOrder, { weight: "1000g" });
    const weightDiffG = diffsG.find((d) => d.field === "weight");
    expect(weightDiffG?.new_value).toBe("1 kg");
  });

  it("W3: treats unchanged weight values ('500g' vs '500 g') as identical with 0 diffs", () => {
    const diffs = computeOrderFieldDiffs(baseOrder, { weight: "500 g" });
    expect(diffs.length).toBe(0);
  });

  it("W4: approved weight change applies intended unit to accepted order and logs in history", () => {
    addOrder(baseOrder);
    const validTime = new Date(2026, 9, 20, 10, 0, 0);

    const { changeRequest } = recordChangeRequest(
      baseOrder.id,
      { weight: "1 kg" },
      "Upgrade to 1kg",
      validTime
    );

    const approved = approveChangeRequest(
      baseOrder.id,
      changeRequest.id,
      { isException: false },
      validTime
    );

    expect(approved.weight).toBe("1 kg");

    const historyEvent = approved.history?.find((h) => h.type === "change_approved");
    expect(historyEvent).toBeDefined();
    const diff = historyEvent?.field_changes?.find((f) => f.field === "weight");
    expect(diff?.old_value).toBe("500g");
    expect(diff?.new_value).toBe("1 kg");
  });

  it("W5: rejected change leaves original weight unit completely untouched", () => {
    addOrder(baseOrder);
    const validTime = new Date(2026, 9, 20, 10, 0, 0);

    const { changeRequest } = recordChangeRequest(
      baseOrder.id,
      { weight: "2 kg" },
      "Too heavy",
      validTime
    );

    const rejected = rejectChangeRequest(
      baseOrder.id,
      changeRequest.id,
      "Cannot bake 2kg in time"
    );

    expect(rejected.weight).toBe("500g");
  });
});

describe("Phase 10 Part C: Exception Safeguards Regression", () => {
  beforeEach(() => {
    clearAllOrders();
  });

  const baseOrder: Order = {
    id: "ord_safeguard_test",
    customer_name: "Rahul",
    product: "Pineapple Cake",
    quantity: 1,
    weight: "1 kg",
    requested_date: "Tomorrow 6 PM",
    resolved_date: "2026-10-25",
    requested_time: "18:00",
    dietary_preference: "eggless",
    fulfillment_method: "pickup",
    payment_amount: 1000,
    payment_currency: "INR",
    payment_method: "GPay",
    payment_status: "customer_reported_paid",
    notes: [],
    missing_or_unverified: [],
    requires_confirmation: false,
    status: "confirmed",
    raw_message: "Pineapple cake",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    change_requests: [],
    history: [],
  };

  it("S1: rejects blank or whitespace-only reasons for exceptional approvals", () => {
    addOrder(baseOrder);
    // 5 hours before fulfillment -> past 24h cutoff!
    const lateTime = new Date(2026, 9, 25, 13, 0, 0);

    const { changeRequest } = recordChangeRequest(
      baseOrder.id,
      { dietary_preference: "regular" },
      "Change dietary",
      lateTime
    );

    // Whitespace-only reason
    expect(() =>
      approveChangeRequest(
        baseOrder.id,
        changeRequest.id,
        { isException: true, reason: "     " },
        lateTime
      )
    ).toThrow(/non-empty reason is mandatory/i);

    // Empty reason
    expect(() =>
      approveChangeRequest(
        baseOrder.id,
        changeRequest.id,
        { isException: true, reason: "" },
        lateTime
      )
    ).toThrow(/non-empty reason is mandatory/i);
  });

  it("S2: preparation-started orders remain protected from ordinary changes", () => {
    const prepOrder: Order = {
      ...baseOrder,
      id: "ord_prep_started",
      status: "in_preparation",
      preparation_started_at: new Date().toISOString(),
    };
    addOrder(prepOrder);

    // Even if 3 days before fulfillment:
    const farAheadTime = new Date(2026, 9, 22, 10, 0, 0);
    const deadlineEval = evaluateDeadlineStatus(prepOrder, 24, farAheadTime);

    expect(deadlineEval.status).toBe("prep_started");
    expect(deadlineEval.canApproveNormally).toBe(false);
    expect(deadlineEval.requiresException).toBe(true);

    const { changeRequest } = recordChangeRequest(
      prepOrder.id,
      { weight: "2 kg" },
      "Customer wants bigger size",
      farAheadTime
    );

    // Ordinary approval must throw
    expect(() =>
      approveChangeRequest(
        prepOrder.id,
        changeRequest.id,
        { isException: false },
        farAheadTime
      )
    ).toThrow(/Exception approval is required/i);
  });

  it("S3: repeated approval of already approved change is blocked", () => {
    addOrder(baseOrder);
    const validTime = new Date(2026, 9, 20, 10, 0, 0);

    const { changeRequest } = recordChangeRequest(
      baseOrder.id,
      { weight: "1.5 kg" },
      "Bigger size",
      validTime
    );

    approveChangeRequest(baseOrder.id, changeRequest.id, { isException: false }, validTime);

    expect(() =>
      approveChangeRequest(baseOrder.id, changeRequest.id, { isException: false }, validTime)
    ).toThrow(/already approved/i);
  });
});

describe("Phase 10 Part A: Storage Sanitization of Negative Payment Amounts", () => {
  beforeEach(() => {
    clearAllOrders();
  });

  it("A_STORE: safely preserves records with negative payment amounts and flags for manual review", () => {
    // Corrupted record in storage with negative payment amount -293
    const corruptedRecord = {
      id: "corrupted_order_001",
      customer_name: "Karan",
      product: "Red Velvet",
      quantity: 1,
      weight: "1000", // Bare 1000
      requested_date: "Saturday",
      resolved_date: "2026-10-25",
      requested_time: "18:00",
      dietary_preference: "eggless",
      fulfillment_method: "pickup",
      payment_amount: -293, // Invalid negative amount
      payment_currency: "INR",
      payment_method: "Cash",
      payment_status: "unclear",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: false,
      status: "confirmed",
      raw_message: "Red velvet cake",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Store directly as JSON in storage
    const json = JSON.stringify([corruptedRecord]);
    setRawStoredOrdersForTesting(json);

    const stored = getStoredOrders();
    expect(stored.length).toBe(1);

    const sanitized = stored[0];
    // Record preserved!
    expect(sanitized.id).toBe("corrupted_order_001");
    // Negative payment sanitized to null!
    expect(sanitized.payment_amount).toBeNull();
    // Bare weight normalized to "1 kg"!
    expect(sanitized.weight).toBe("1 kg");
    // Flagged for manual baker review!
    expect(sanitized.requires_confirmation).toBe(true);
    expect(
      sanitized.missing_or_unverified.some((m) => m.toLowerCase().includes("payment"))
    ).toBe(true);
  });
});
