"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  ShieldAlert,
  Info,
  Calendar,
  Clock,
  Sparkles,
  Save,
  Check,
  Flame,
  Award,
  XCircle,
  FileEdit,
  ArrowRight,
  PlusCircle,
} from "lucide-react";
import {
  Order,
  ExtractedOrderPayload,
  FulfillmentMethod,
  PaymentStatus,
  OrderStatus,
  ChangeRequest,
} from "@/types/order";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  getPaymentStatusBadge,
  getOrderStatusBadge,
  formatDate,
  formatDateTime,
} from "@/lib/utils";
import {
  evaluateDeadlineStatus,
  computeOrderFieldDiffs,
  normalizeWeightValue,
} from "@/lib/change-policy";
import { getStoredPolicySettings } from "@/lib/storage/settings";
import {
  transitionOrderStatus,
  recordChangeRequest,
  approveChangeRequest,
  rejectChangeRequest,
  updateBakerNotes,
} from "@/lib/storage/orders";
import { OrderHistoryTimeline } from "./OrderHistoryTimeline";
import { OrderChangeRequestModal } from "./OrderChangeRequestModal";
import { ChangeRequestApprovalModal } from "./ChangeRequestApprovalModal";
import { CancelOrderModal } from "./CancelOrderModal";

interface OrderReviewPanelProps {
  initialData: ExtractedOrderPayload | Order;
  rawMessage: string;
  isExistingOrder?: boolean;
  onSave: (order: Order) => void;
  onCancel: () => void;
  onOpenDraftReply?: (orderData: Partial<Order>) => void;
}

export const OrderReviewPanel: React.FC<OrderReviewPanelProps> = ({
  initialData,
  rawMessage,
  isExistingOrder = false,
  onSave,
  onCancel,
  onOpenDraftReply,
}) => {
  // If it's an existing order with an ID, we keep the live order object in state
  const [currentOrder, setCurrentOrder] = useState<Order>(() => {
    if ("id" in initialData) {
      const existing = { ...(initialData as Order) };
      existing.weight = normalizeWeightValue(existing.weight);
      if (
        typeof existing.payment_amount === "number" &&
        (existing.payment_amount < 0 || !isFinite(existing.payment_amount))
      ) {
        existing.payment_amount = null;
      }
      return existing;
    }
    // Synthetic unsaved order
    const safeAmount =
      typeof initialData.payment_amount === "number" &&
      initialData.payment_amount >= 0 &&
      isFinite(initialData.payment_amount)
        ? initialData.payment_amount
        : null;

    return {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "needs_review",
      raw_message: rawMessage,
      customer_name: initialData.customer_name || null,
      product: initialData.product || null,
      quantity: initialData.quantity ?? null,
      weight: normalizeWeightValue(initialData.weight),
      requested_date: initialData.requested_date || null,
      resolved_date: initialData.resolved_date || null,
      requested_time: initialData.requested_time || null,
      dietary_preference: initialData.dietary_preference || null,
      fulfillment_method: initialData.fulfillment_method || "unknown",
      payment_amount: safeAmount,
      payment_currency: initialData.payment_currency || "INR",
      payment_method: initialData.payment_method || null,
      payment_status: initialData.payment_status || "not_mentioned",
      notes: initialData.notes || [],
      missing_or_unverified: initialData.missing_or_unverified || [],
      requires_confirmation: initialData.requires_confirmation ?? true,
      change_requests: [],
      history: [],
    };
  });

  const isConfirmedOrLater = currentOrder.status !== "needs_review";

  // Editable form state for needs_review orders
  const [customerName, setCustomerName] = useState(
    currentOrder.customer_name || ""
  );
  const [product, setProduct] = useState(currentOrder.product || "");
  const [quantity, setQuantity] = useState<string>(
    currentOrder.quantity !== null && currentOrder.quantity !== undefined
      ? String(currentOrder.quantity)
      : ""
  );
  const [weight, setWeight] = useState(currentOrder.weight || "");
  const [requestedDate, setRequestedDate] = useState(
    currentOrder.requested_date || ""
  );
  const [resolvedDate, setResolvedDate] = useState(
    currentOrder.resolved_date || ""
  );
  const [requestedTime, setRequestedTime] = useState(
    currentOrder.requested_time || ""
  );
  const [dietaryPreference, setDietaryPreference] = useState(
    currentOrder.dietary_preference || ""
  );
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>(
    currentOrder.fulfillment_method || "unknown"
  );
  const [paymentAmount, setPaymentAmount] = useState<string>(
    currentOrder.payment_amount !== null &&
      currentOrder.payment_amount !== undefined
      ? String(currentOrder.payment_amount)
      : ""
  );
  const [paymentCurrency, setPaymentCurrency] = useState(
    currentOrder.payment_currency || "INR"
  );
  const [paymentMethod, setPaymentMethod] = useState(
    currentOrder.payment_method || ""
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    currentOrder.payment_status || "not_mentioned"
  );
  const [notesStr, setNotesStr] = useState(
    Array.isArray(currentOrder.notes) ? currentOrder.notes.join("\n") : ""
  );
  const [missingItemsStr, setMissingItemsStr] = useState(
    Array.isArray(currentOrder.missing_or_unverified)
      ? currentOrder.missing_or_unverified.join("\n")
      : ""
  );
  const [bakerNotesInput, setBakerNotesInput] = useState(
    currentOrder.baker_notes || ""
  );
  const [bakerNotesSavedMsg, setBakerNotesSavedMsg] = useState(false);

  // Sub-modals
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isRecordChangeModalOpen, setIsRecordChangeModalOpen] = useState(false);
  const [reviewingChangeRequest, setReviewingChangeRequest] =
    useState<ChangeRequest | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [panelErrorMsg, setPanelErrorMsg] = useState<string | null>(null);

  // Policy & Deadline Evaluation
  const policySettings = getStoredPolicySettings();
  const deadlineEval = evaluateDeadlineStatus(
    currentOrder,
    policySettings.cutoff_hours
  );

  const pendingChangeRequest = (currentOrder.change_requests || []).find(
    (r) => r.status === "pending"
  );

  // Parse notes and missing items arrays
  const missingItemsList = missingItemsStr
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const hasUncertainties =
    missingItemsList.length > 0 ||
    !resolvedDate ||
    !requestedTime ||
    fulfillmentMethod === "unknown" ||
    paymentStatus === "not_mentioned" ||
    paymentStatus === "unclear";

  const constructOrderObject = (finalStatus: OrderStatus): Order => {
    const parsedQty = quantity.trim() ? parseFloat(quantity) : null;
    const parsedAmount = paymentAmount.trim()
      ? parseFloat(paymentAmount)
      : null;

    const safePaymentAmount =
      parsedAmount !== null &&
      !isNaN(parsedAmount) &&
      isFinite(parsedAmount) &&
      parsedAmount >= 0
        ? parsedAmount
        : null;

    return {
      ...currentOrder,
      updated_at: new Date().toISOString(),
      status: finalStatus,
      raw_message: rawMessage,
      customer_name: customerName.trim() || null,
      product: product.trim() || null,
      quantity: isNaN(Number(parsedQty)) ? null : parsedQty,
      weight: normalizeWeightValue(weight),
      requested_date: requestedDate.trim() || null,
      resolved_date: resolvedDate.trim() || null,
      requested_time: requestedTime.trim() || null,
      dietary_preference: dietaryPreference.trim() || null,
      fulfillment_method: fulfillmentMethod,
      payment_amount: safePaymentAmount,
      payment_currency: paymentCurrency.trim() || null,
      payment_method: paymentMethod.trim() || null,
      payment_status: paymentStatus,
      notes: notesStr
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      missing_or_unverified: missingItemsList,
      requires_confirmation: missingItemsList.length > 0,
      baker_notes: bakerNotesInput.trim() || undefined,
    };
  };

  const validatePaymentInput = (): boolean => {
    if (paymentAmount.trim()) {
      const parsed = parseFloat(paymentAmount);
      if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) {
        setPanelErrorMsg("Payment amount cannot be negative or invalid.");
        return false;
      }
    }
    return true;
  };

  const handleSaveAsNeedsReview = () => {
    setPanelErrorMsg(null);
    if (!validatePaymentInput()) return;
    const order = constructOrderObject("needs_review");
    onSave(order);
  };

  const handleAttemptConfirm = () => {
    setPanelErrorMsg(null);
    if (!validatePaymentInput()) return;
    if (hasUncertainties) {
      setShowWarningModal(true);
    } else {
      executeConfirmation();
    }
  };

  const executeConfirmation = () => {
    const order = constructOrderObject("confirmed");
    setShowWarningModal(false);
    onSave(order);
  };

  // Lifecycle Transitions for confirmed orders
  const handleTransition = (
    newStatus: OrderStatus,
    options?: { reason?: string }
  ) => {
    setPanelErrorMsg(null);
    try {
      const updated = transitionOrderStatus(
        currentOrder.id,
        newStatus,
        options
      );
      setCurrentOrder(updated);
      onSave(updated);
    } catch (err) {
      setPanelErrorMsg(
        err instanceof Error ? err.message : "Failed to transition status."
      );
    }
  };

  // Record Change Request
  const handleRecordChangeRequest = (
    proposed: Partial<ExtractedOrderPayload>,
    notes: string
  ) => {
    setPanelErrorMsg(null);
    try {
      const result = recordChangeRequest(currentOrder.id, proposed, notes);
      setCurrentOrder(result.order);
      onSave(result.order);
    } catch (err) {
      setPanelErrorMsg(
        err instanceof Error ? err.message : "Failed to record change request."
      );
    }
  };

  // Approve Change Request
  const handleApproveChange = (options?: {
    isException?: boolean;
    reason?: string;
  }) => {
    if (!reviewingChangeRequest) return;
    setPanelErrorMsg(null);
    try {
      const updated = approveChangeRequest(
        currentOrder.id,
        reviewingChangeRequest.id,
        options
      );
      setCurrentOrder(updated);
      setReviewingChangeRequest(null);
      onSave(updated);
    } catch (err) {
      setPanelErrorMsg(
        err instanceof Error ? err.message : "Failed to approve change request."
      );
    }
  };

  // Reject Change Request
  const handleRejectChange = (reason?: string) => {
    if (!reviewingChangeRequest) return;
    setPanelErrorMsg(null);
    try {
      const updated = rejectChangeRequest(
        currentOrder.id,
        reviewingChangeRequest.id,
        reason
      );
      setCurrentOrder(updated);
      setReviewingChangeRequest(null);
      onSave(updated);
    } catch (err) {
      setPanelErrorMsg(
        err instanceof Error ? err.message : "Failed to reject change request."
      );
    }
  };

  // Save Baker Internal Notes
  const handleSaveBakerNotes = () => {
    try {
      const updated = updateBakerNotes(currentOrder.id, bakerNotesInput);
      setCurrentOrder(updated);
      onSave(updated);
      setBakerNotesSavedMsg(true);
      setTimeout(() => setBakerNotesSavedMsg(false), 2500);
    } catch (err) {
      setPanelErrorMsg(
        err instanceof Error ? err.message : "Failed to update notes."
      );
    }
  };

  const paymentBadge = getPaymentStatusBadge(currentOrder.payment_status);
  const statusBadge = getOrderStatusBadge(currentOrder.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-crumb-espresso/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-crumb-surface border border-crumb-border rounded-2xl max-w-4xl w-full shadow-modal overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-crumb-border flex items-center justify-between bg-crumb-surface">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-crumb-terracotta-light text-crumb-terracotta flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-crumb-espresso font-serif">
                  {isExistingOrder
                    ? `Order Details — ${currentOrder.id}`
                    : "Review Extracted Order"}
                </h2>
                <Badge
                  variant={
                    currentOrder.status === "confirmed"
                      ? "success"
                      : currentOrder.status === "in_preparation"
                      ? "terracotta"
                      : currentOrder.status === "ready"
                      ? "neutral"
                      : currentOrder.status === "cancelled"
                      ? "danger"
                      : "warning"
                  }
                  dot
                >
                  {statusBadge.label}
                </Badge>
                {pendingChangeRequest && (
                  <Badge variant="warning" size="sm">
                    Pending Change
                  </Badge>
                )}
              </div>
              <p className="text-xs text-crumb-muted">
                {isConfirmedOrLater
                  ? "Accepted Order under Baker Change Control. Ordinary field edits require a change request."
                  : "Inspect and modify AI-extracted fields before confirming."}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-crumb-subtle hover:text-crumb-espresso p-1.5 rounded-lg hover:bg-crumb-surface-alt transition"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {panelErrorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{panelErrorMsg}</span>
            </div>
            <button
              onClick={() => setPanelErrorMsg(null)}
              className="text-rose-500 hover:text-rose-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Lifecycle & Policy Banner for Confirmed / Active Orders */}
        {isConfirmedOrLater && (
          <div className="px-6 py-3.5 bg-crumb-surface-alt/70 border-b border-crumb-border text-xs flex flex-wrap items-center justify-between gap-3">
            {/* Left: Deadline & Policy status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-crumb-espresso">
                Change Policy:
              </span>
              <span className="text-crumb-muted">{deadlineEval.message}</span>
            </div>

            {/* Right: Lifecycle Progression Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {currentOrder.status === "confirmed" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTransition("in_preparation")}
                    className="border-orange-300 text-orange-800 hover:bg-orange-50"
                    leftIcon={<Flame className="w-3.5 h-3.5 text-orange-600" />}
                  >
                    Start Preparation
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCancelModalOpen(true)}
                    className="text-rose-600 hover:bg-rose-50"
                  >
                    Cancel Order
                  </Button>
                </>
              )}

              {currentOrder.status === "in_preparation" && (
                <>
                  <div className="flex items-center gap-1.5 text-orange-800 font-medium px-2 py-1 rounded bg-orange-100/70">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Prep Started</span>
                    {currentOrder.preparation_started_at && (
                      <span className="font-mono text-[10px] text-orange-700">
                        ({formatDateTime(currentOrder.preparation_started_at)})
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTransition("ready")}
                    className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    leftIcon={<Check className="w-3.5 h-3.5 text-emerald-600" />}
                  >
                    Mark Ready
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCancelModalOpen(true)}
                    className="text-rose-600 hover:bg-rose-50"
                  >
                    Cancel Order
                  </Button>
                </>
              )}

              {currentOrder.status === "ready" && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleTransition("completed")}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  leftIcon={<Award className="w-3.5 h-3.5" />}
                >
                  Mark Completed
                </Button>
              )}

              {currentOrder.status === "completed" && (
                <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold text-[11px] flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  <span>Order Completed</span>
                </span>
              )}

              {currentOrder.status === "cancelled" && (
                <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px] flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Order Cancelled</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content Body: Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Active Pending Change Request Banner */}
          {pendingChangeRequest && (
            <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span className="font-bold text-amber-900 text-xs uppercase tracking-wider">
                    Customer Change Request Awaiting Baker Decision
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setReviewingChangeRequest(pendingChangeRequest)}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                >
                  Review & Decide
                </Button>
              </div>

              {pendingChangeRequest.request_notes && (
                <p className="text-xs text-amber-950 italic bg-white/70 p-2 rounded-lg border border-amber-200">
                  Context: &ldquo;{pendingChangeRequest.request_notes}&rdquo;
                </p>
              )}

              <div className="text-xs text-amber-900 space-y-1">
                <span className="font-semibold text-[11px] uppercase tracking-wider block">
                  Proposed Changes:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                  {computeOrderFieldDiffs(
                    currentOrder,
                    pendingChangeRequest.proposed_changes
                  ).map((diff) => (
                    <div
                      key={diff.field}
                      className="flex items-center gap-1.5 bg-white/80 p-1 rounded border border-amber-200"
                    >
                      <span className="font-sans font-semibold text-crumb-espresso">
                        {diff.field_label}:
                      </span>
                      <span className="line-through text-crumb-subtle">
                        {String(diff.old_value ?? "—")}
                      </span>
                      <ArrowRight className="w-3 h-3 text-amber-700 flex-shrink-0" />
                      <span className="font-bold text-emerald-800">
                        {String(diff.new_value ?? "—")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Missing / Unverified Details Banner (for needs_review) */}
          {!isConfirmedOrLater && missingItemsList.length > 0 && (
            <div className="p-4 rounded-xl bg-crumb-amber-light/80 border border-crumb-amber/30 text-xs text-crumb-espresso space-y-2">
              <div className="flex items-center gap-2 font-semibold text-crumb-amber">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Information Requiring Baker Clarification</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-crumb-espresso-light">
                {missingItemsList.map((item, idx) => (
                  <li key={idx} className="font-medium">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Original Customer Message Reference */}
          <div className="p-3.5 rounded-xl bg-crumb-surface-alt border border-crumb-border text-xs">
            <div className="flex items-center justify-between mb-1 text-crumb-muted font-medium">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-crumb-terracotta" />
                <span>Original Customer Message</span>
              </span>
              <span className="text-[11px] text-crumb-subtle">
                Reference for verification
              </span>
            </div>
            <p className="font-mono text-crumb-espresso bg-white/70 p-2.5 rounded-lg border border-crumb-border/70 whitespace-pre-wrap leading-relaxed">
              {currentOrder.raw_message || "(No raw message text stored)"}
            </p>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column: Product & Customer */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-crumb-border pb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-crumb-terracotta">
                  Accepted Order Specifications
                </h3>
                {isConfirmedOrLater && (
                  <span className="text-[10px] text-crumb-subtle italic">
                    Protected (Change request required)
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-crumb-espresso mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  disabled={isConfirmedOrLater}
                  value={isConfirmedOrLater ? currentOrder.customer_name || "" : customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Priya Sharma (if stated)"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-crumb-espresso mb-1">
                  Product / Flavor {!isConfirmedOrLater && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  disabled={isConfirmedOrLater}
                  value={isConfirmedOrLater ? currentOrder.product || "" : product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="e.g. Chocolate truffle cake"
                  className={`w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none ${
                    !product && !isConfirmedOrLater
                      ? "border-amber-400 bg-amber-50/20"
                      : "border-crumb-border focus:border-crumb-terracotta"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-crumb-espresso mb-1">
                    Quantity (Units)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={isConfirmedOrLater}
                    value={
                      isConfirmedOrLater
                        ? currentOrder.quantity !== null && currentOrder.quantity !== undefined
                          ? String(currentOrder.quantity)
                          : ""
                        : quantity
                    }
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-crumb-espresso mb-1">
                    Weight / Size
                  </label>
                  <input
                    type="text"
                    disabled={isConfirmedOrLater}
                    value={isConfirmedOrLater ? currentOrder.weight || "" : weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 1 kg, 500g"
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-crumb-espresso mb-1">
                  Dietary Preference
                </label>
                <input
                  type="text"
                  disabled={isConfirmedOrLater}
                  value={
                    isConfirmedOrLater
                      ? currentOrder.dietary_preference || ""
                      : dietaryPreference
                  }
                  onChange={(e) => setDietaryPreference(e.target.value)}
                  placeholder="e.g. Eggless, Vegan, Gluten-free"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-crumb-espresso mb-1">
                  Fulfillment Method
                </label>
                <select
                  disabled={isConfirmedOrLater}
                  value={
                    isConfirmedOrLater
                      ? currentOrder.fulfillment_method
                      : fulfillmentMethod
                  }
                  onChange={(e) =>
                    setFulfillmentMethod(e.target.value as FulfillmentMethod)
                  }
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none"
                >
                  <option value="pickup">Pickup</option>
                  <option value="delivery">Delivery</option>
                  <option value="unknown">Unknown (Needs Confirmation)</option>
                </select>
              </div>

              {/* Action to record change request on confirmed orders */}
              {isConfirmedOrLater &&
                currentOrder.status !== "completed" &&
                currentOrder.status !== "cancelled" && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsRecordChangeModalOpen(true)}
                      disabled={Boolean(pendingChangeRequest)}
                      className="w-full justify-center border-crumb-terracotta/40 text-crumb-terracotta hover:bg-crumb-terracotta-light"
                      leftIcon={<PlusCircle className="w-4 h-4" />}
                      title={
                        pendingChangeRequest
                          ? "Resolve the pending change request before recording another."
                          : "Record a customer change request"
                      }
                    >
                      {pendingChangeRequest
                        ? "Pending Change Request Active"
                        : "Record Customer Change Request"}
                    </Button>
                  </div>
                )}
            </div>

            {/* Right Column: Schedule & Payment */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-crumb-terracotta border-b border-crumb-border pb-1">
                Fulfillment Schedule & Payment
              </h3>

              <div>
                <label className="block text-xs font-medium text-crumb-espresso mb-1">
                  Requested Date (Customer Stated)
                </label>
                <input
                  type="text"
                  disabled={isConfirmedOrLater}
                  value={
                    isConfirmedOrLater
                      ? currentOrder.requested_date || ""
                      : requestedDate
                  }
                  onChange={(e) => setRequestedDate(e.target.value)}
                  placeholder="e.g. Sunday evening"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-crumb-espresso mb-1">
                    Resolved Date (ISO)
                  </label>
                  <input
                    type="date"
                    disabled={isConfirmedOrLater}
                    value={
                      isConfirmedOrLater
                        ? currentOrder.resolved_date || ""
                        : resolvedDate
                    }
                    onChange={(e) => setResolvedDate(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none"
                  />
                  {!currentOrder.resolved_date && (
                    <span className="text-[10px] text-amber-700 mt-0.5 block">
                      Needs calendar confirmation
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-crumb-espresso mb-1">
                    Time (HH:mm)
                  </label>
                  <input
                    type="text"
                    disabled={isConfirmedOrLater}
                    value={
                      isConfirmedOrLater
                        ? currentOrder.requested_time || ""
                        : requestedTime
                    }
                    onChange={(e) => setRequestedTime(e.target.value)}
                    placeholder="e.g. 18:00"
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none"
                  />
                </div>
              </div>

              {/* Payment Section */}
              <div className="p-3.5 rounded-xl bg-crumb-surface-alt/70 border border-crumb-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-crumb-espresso">
                    Payment Details
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${paymentBadge.bg}`}
                    title={paymentBadge.tooltip}
                  >
                    {paymentBadge.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-crumb-espresso mb-1">
                      Reported Amount
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      disabled={isConfirmedOrLater}
                      value={
                        isConfirmedOrLater
                          ? currentOrder.payment_amount !== null &&
                            currentOrder.payment_amount !== undefined
                            ? String(currentOrder.payment_amount)
                            : ""
                          : paymentAmount
                      }
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="e.g. 1200"
                      className={`w-full text-xs px-2.5 py-1.5 rounded-lg bg-crumb-surface border ${
                        !isConfirmedOrLater &&
                        paymentAmount.trim() &&
                        (parseFloat(paymentAmount) < 0 || isNaN(parseFloat(paymentAmount)))
                          ? "border-rose-400 focus:border-rose-500"
                          : "border-crumb-border"
                      } disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none`}
                    />
                    {!isConfirmedOrLater &&
                      paymentAmount.trim() &&
                      (parseFloat(paymentAmount) < 0 || isNaN(parseFloat(paymentAmount))) && (
                        <span className="text-[10px] text-rose-600 font-medium mt-1 block">
                          Payment amount cannot be negative.
                        </span>
                      )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-crumb-espresso mb-1">
                      Currency
                    </label>
                    <input
                      type="text"
                      disabled={isConfirmedOrLater}
                      value={
                        isConfirmedOrLater
                          ? currentOrder.payment_currency || "INR"
                          : paymentCurrency
                      }
                      onChange={(e) => setPaymentCurrency(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-crumb-surface border border-crumb-border disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-crumb-espresso mb-1">
                      Method Stated
                    </label>
                    <input
                      type="text"
                      disabled={isConfirmedOrLater}
                      value={
                        isConfirmedOrLater
                          ? currentOrder.payment_method || ""
                          : paymentMethod
                      }
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      placeholder="e.g. GPay, Cash"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-crumb-surface border border-crumb-border disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-crumb-espresso mb-1">
                      Reported Status
                    </label>
                    <select
                      disabled={isConfirmedOrLater}
                      value={
                        isConfirmedOrLater
                          ? currentOrder.payment_status
                          : paymentStatus
                      }
                      onChange={(e) =>
                        setPaymentStatus(e.target.value as PaymentStatus)
                      }
                      className="w-full text-xs px-2 py-1.5 rounded-lg bg-crumb-surface border border-crumb-border disabled:bg-crumb-surface-alt/60 disabled:text-crumb-espresso outline-none"
                    >
                      <option value="customer_reported_paid">
                        Reported Paid
                      </option>
                      <option value="customer_reported_unpaid">
                        Reported Unpaid
                      </option>
                      <option value="not_mentioned">Not Mentioned</option>
                      <option value="unclear">Unclear</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Baker Internal Notes (Directly Editable Even for Confirmed Orders!) */}
              <div className="space-y-1.5 p-3 rounded-xl bg-crumb-surface-alt/40 border border-crumb-border">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-crumb-espresso">
                    Baker Internal Notes
                  </label>
                  {isConfirmedOrLater && (
                    <button
                      type="button"
                      onClick={handleSaveBakerNotes}
                      className="text-[11px] text-crumb-terracotta hover:text-crumb-terracotta-hover font-semibold flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      <span>Save Notes</span>
                    </button>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={bakerNotesInput}
                  onChange={(e) => setBakerNotesInput(e.target.value)}
                  placeholder="Private notes (e.g. allergy precautions, box size, ribbon color)"
                  className="w-full text-xs px-3 py-1.5 rounded-lg bg-crumb-surface border border-crumb-border outline-none focus:border-crumb-terracotta resize-none"
                />
                {bakerNotesSavedMsg && (
                  <span className="text-[10px] text-emerald-700 font-semibold block">
                    ✓ Internal notes updated.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Persistent Order History Timeline */}
          {currentOrder.history && currentOrder.history.length > 0 && (
            <div className="pt-4 border-t border-crumb-border">
              <OrderHistoryTimeline events={currentOrder.history} />
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 border-t border-crumb-border bg-crumb-surface-alt/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onOpenDraftReply && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onOpenDraftReply(constructOrderObject(currentOrder.status))
                }
                leftIcon={<MessageSquare className="w-4 h-4 text-crumb-terracotta" />}
                title="Generate reply text to ask customer for missing details"
              >
                Draft Customer Reply
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="md" onClick={onCancel}>
              {isConfirmedOrLater ? "Close" : "Cancel"}
            </Button>

            {!isConfirmedOrLater && (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleSaveAsNeedsReview}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Save as Needs Review
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleAttemptConfirm}
                  leftIcon={<Check className="w-4 h-4" />}
                >
                  Confirm Order
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Warning Modal (For needs_review orders with uncertainties) */}
      {showWarningModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-crumb-espresso/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-crumb-surface border border-crumb-border rounded-xl max-w-md w-full p-5 shadow-modal space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-crumb-espresso">
                  Confirm Order with Unresolved Items?
                </h3>
                <p className="text-xs text-crumb-muted mt-1 leading-relaxed">
                  This order still has missing or customer-reported details:
                </p>
                <ul className="mt-2 text-xs text-amber-800 list-disc pl-5 space-y-0.5">
                  {!resolvedDate && <li>Resolved calendar date is not set</li>}
                  {!requestedTime && <li>Requested pickup/delivery time is missing</li>}
                  {fulfillmentMethod === "unknown" && (
                    <li>Fulfillment method is unknown</li>
                  )}
                  {paymentStatus === "customer_reported_paid" && (
                    <li>Payment was reported by customer, not verified by bank</li>
                  )}
                  {missingItemsList.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-crumb-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWarningModal(false)}
              >
                Go Back & Edit
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={executeConfirmation}
                className="bg-crumb-amber hover:bg-amber-700"
              >
                Confirm Anyway
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Record Change Request Modal */}
      {isRecordChangeModalOpen && (
        <OrderChangeRequestModal
          order={currentOrder}
          isOpen={isRecordChangeModalOpen}
          onClose={() => setIsRecordChangeModalOpen(false)}
          onSubmit={handleRecordChangeRequest}
        />
      )}

      {/* Change Request Approval / Rejection Modal */}
      {reviewingChangeRequest && (
        <ChangeRequestApprovalModal
          order={currentOrder}
          request={reviewingChangeRequest}
          isOpen={Boolean(reviewingChangeRequest)}
          onClose={() => setReviewingChangeRequest(null)}
          onApprove={handleApproveChange}
          onReject={handleRejectChange}
        />
      )}

      {/* Cancel Order Modal */}
      {isCancelModalOpen && (
        <CancelOrderModal
          order={currentOrder}
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          onConfirmCancel={(orderId, reason) =>
            handleTransition("cancelled", { reason })
          }
        />
      )}
    </div>
  );
};
