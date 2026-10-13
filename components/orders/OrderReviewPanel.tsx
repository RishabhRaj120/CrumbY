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
} from "lucide-react";
import {
  Order,
  ExtractedOrderPayload,
  FulfillmentMethod,
  PaymentStatus,
  OrderStatus,
} from "@/types/order";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { getPaymentStatusBadge, getOrderStatusBadge } from "@/lib/utils";

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
  // Editable form state initialized from extracted data
  const [customerName, setCustomerName] = useState(
    initialData.customer_name || ""
  );
  const [product, setProduct] = useState(initialData.product || "");
  const [quantity, setQuantity] = useState<string>(
    initialData.quantity !== null && initialData.quantity !== undefined
      ? String(initialData.quantity)
      : ""
  );
  const [weight, setWeight] = useState(initialData.weight || "");
  const [requestedDate, setRequestedDate] = useState(
    initialData.requested_date || ""
  );
  const [resolvedDate, setResolvedDate] = useState(
    initialData.resolved_date || ""
  );
  const [requestedTime, setRequestedTime] = useState(
    initialData.requested_time || ""
  );
  const [dietaryPreference, setDietaryPreference] = useState(
    initialData.dietary_preference || ""
  );
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>(
    initialData.fulfillment_method || "unknown"
  );
  const [paymentAmount, setPaymentAmount] = useState<string>(
    initialData.payment_amount !== null &&
      initialData.payment_amount !== undefined
      ? String(initialData.payment_amount)
      : ""
  );
  const [paymentCurrency, setPaymentCurrency] = useState(
    initialData.payment_currency || "INR"
  );
  const [paymentMethod, setPaymentMethod] = useState(
    initialData.payment_method || ""
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    initialData.payment_status || "not_mentioned"
  );
  const [notesStr, setNotesStr] = useState(
    Array.isArray(initialData.notes) ? initialData.notes.join("\n") : ""
  );
  const [missingItemsStr, setMissingItemsStr] = useState(
    Array.isArray(initialData.missing_or_unverified)
      ? initialData.missing_or_unverified.join("\n")
      : ""
  );
  const [bakerNotes, setBakerNotes] = useState(
    "baker_notes" in initialData ? initialData.baker_notes || "" : ""
  );
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>(
    "status" in initialData ? initialData.status : "needs_review"
  );

  const [showWarningModal, setShowWarningModal] = useState(false);

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
    const existingId = "id" in initialData ? initialData.id : null;
    const existingCreatedAt =
      "created_at" in initialData ? initialData.created_at : null;

    const parsedQty = quantity.trim() ? parseFloat(quantity) : null;
    const parsedAmount = paymentAmount.trim()
      ? parseFloat(paymentAmount)
      : null;

    return {
      id: existingId || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: existingCreatedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: finalStatus,
      raw_message: rawMessage,
      customer_name: customerName.trim() || null,
      product: product.trim() || null,
      quantity: isNaN(Number(parsedQty)) ? null : parsedQty,
      weight: weight.trim() || null,
      requested_date: requestedDate.trim() || null,
      resolved_date: resolvedDate.trim() || null,
      requested_time: requestedTime.trim() || null,
      dietary_preference: dietaryPreference.trim() || null,
      fulfillment_method: fulfillmentMethod,
      payment_amount: isNaN(Number(parsedAmount)) ? null : parsedAmount,
      payment_currency: paymentCurrency.trim() || null,
      payment_method: paymentMethod.trim() || null,
      payment_status: paymentStatus,
      notes: notesStr
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      missing_or_unverified: missingItemsList,
      requires_confirmation: missingItemsList.length > 0,
      baker_notes: bakerNotes.trim() || undefined,
      is_demo: "is_demo" in initialData ? initialData.is_demo : false,
    };
  };

  const handleSaveAsNeedsReview = () => {
    const order = constructOrderObject("needs_review");
    onSave(order);
  };

  const handleAttemptConfirm = () => {
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

  const paymentBadge = getPaymentStatusBadge(paymentStatus);
  const statusBadge = getOrderStatusBadge(currentStatus);

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
                  {isExistingOrder ? "Order Details & Review" : "Review Extracted Order"}
                </h2>
                <Badge
                  variant={currentStatus === "confirmed" ? "success" : "warning"}
                  dot
                >
                  {statusBadge.label}
                </Badge>
              </div>
              <p className="text-xs text-crumb-muted">
                Inspect and modify AI-extracted fields before confirming.
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

        {/* Content Body: Two Columns */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Missing / Unverified Details Banner */}
          {missingItemsList.length > 0 && (
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
              {rawMessage || "(No raw message text stored)"}
            </p>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column: Product & Customer */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-crumb-terracotta border-b border-crumb-border pb-1">
                Order & Customer
              </h3>

              <div>
                <label className="block text-xs font-medium text-crumb-espresso mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Priya Sharma (if stated)"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border focus:border-crumb-terracotta focus:ring-1 focus:ring-crumb-terracotta/40 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-crumb-espresso mb-1">
                  Product / Flavor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="e.g. Chocolate truffle cake"
                  className={`w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border outline-none ${
                    !product
                      ? "border-amber-400 bg-amber-50/20"
                      : "border-crumb-border focus:border-crumb-terracotta focus:ring-1 focus:ring-crumb-terracotta/40"
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
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border focus:border-crumb-terracotta outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-crumb-espresso mb-1">
                    Weight / Size
                  </label>
                  <input
                    type="text"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 1 kg, 500g"
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border focus:border-crumb-terracotta outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-crumb-espresso mb-1">
                  Dietary Preference
                </label>
                <input
                  type="text"
                  value={dietaryPreference}
                  onChange={(e) => setDietaryPreference(e.target.value)}
                  placeholder="e.g. Eggless, Vegan, Gluten-free"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border focus:border-crumb-terracotta outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-crumb-espresso mb-1">
                  Fulfillment Method
                </label>
                <select
                  value={fulfillmentMethod}
                  onChange={(e) =>
                    setFulfillmentMethod(e.target.value as FulfillmentMethod)
                  }
                  className={`w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border outline-none ${
                    fulfillmentMethod === "unknown"
                      ? "border-amber-400 bg-amber-50/20"
                      : "border-crumb-border focus:border-crumb-terracotta"
                  }`}
                >
                  <option value="pickup">Pickup</option>
                  <option value="delivery">Delivery</option>
                  <option value="unknown">Unknown (Needs Confirmation)</option>
                </select>
              </div>
            </div>

            {/* Right Column: Schedule & Payment */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-crumb-terracotta border-b border-crumb-border pb-1">
                Fulfillment Schedule & Payment
              </h3>

              <div>
                <label className="block text-xs font-medium text-crumb-espresso mb-1">
                  Requested Date (Customer&apos;s Words)
                </label>
                <input
                  type="text"
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  placeholder="e.g. Sunday evening"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border focus:border-crumb-terracotta outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-crumb-espresso mb-1">
                    Resolved Date (ISO)
                  </label>
                  <input
                    type="date"
                    value={resolvedDate}
                    onChange={(e) => setResolvedDate(e.target.value)}
                    className={`w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border outline-none ${
                      !resolvedDate
                        ? "border-amber-300"
                        : "border-crumb-border focus:border-crumb-terracotta"
                    }`}
                  />
                  {!resolvedDate && (
                    <span className="text-[10px] text-amber-700 mt-0.5 block">
                      Needs calendar confirmation
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-crumb-espresso mb-1">
                    Time (HH:mm / stated)
                  </label>
                  <input
                    type="text"
                    value={requestedTime}
                    onChange={(e) => setRequestedTime(e.target.value)}
                    placeholder="e.g. 18:00"
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border focus:border-crumb-terracotta outline-none"
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
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="e.g. 1200"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-crumb-surface border border-crumb-border outline-none focus:border-crumb-terracotta"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-crumb-espresso mb-1">
                      Currency
                    </label>
                    <input
                      type="text"
                      value={paymentCurrency}
                      onChange={(e) => setPaymentCurrency(e.target.value)}
                      placeholder="INR"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-crumb-surface border border-crumb-border outline-none focus:border-crumb-terracotta"
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
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      placeholder="e.g. GPay, Cash"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-crumb-surface border border-crumb-border outline-none focus:border-crumb-terracotta"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-crumb-espresso mb-1">
                      Customer Payment Status
                    </label>
                    <select
                      value={paymentStatus}
                      onChange={(e) =>
                        setPaymentStatus(e.target.value as PaymentStatus)
                      }
                      className="w-full text-xs px-2 py-1.5 rounded-lg bg-crumb-surface border border-crumb-border outline-none focus:border-crumb-terracotta"
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

                <p className="text-[10px] text-crumb-subtle italic">
                  Note: CrumbDesk records customer-reported status only. Verify transactions in your actual bank/UPI app.
                </p>
              </div>

              {/* Notes & Missing Details */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-crumb-espresso mb-1">
                    Missing Details to Clarify (One per line)
                  </label>
                  <textarea
                    rows={2}
                    value={missingItemsStr}
                    onChange={(e) => setMissingItemsStr(e.target.value)}
                    placeholder="e.g. Exact calendar date&#10;Pickup time"
                    className="w-full text-xs px-3 py-1.5 rounded-lg bg-crumb-surface border border-crumb-border outline-none focus:border-crumb-terracotta resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-crumb-espresso mb-1">
                    Baker Internal Notes
                  </label>
                  <textarea
                    rows={2}
                    value={bakerNotes}
                    onChange={(e) => setBakerNotes(e.target.value)}
                    placeholder="Private notes (e.g. allergy precautions, box size, ribbon color)"
                    className="w-full text-xs px-3 py-1.5 rounded-lg bg-crumb-surface border border-crumb-border outline-none focus:border-crumb-terracotta resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 border-t border-crumb-border bg-crumb-surface-alt/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onOpenDraftReply && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onOpenDraftReply(constructOrderObject(currentStatus))
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
              Cancel
            </Button>
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
          </div>
        </div>
      </div>

      {/* Confirmation Warning Modal */}
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
    </div>
  );
};
