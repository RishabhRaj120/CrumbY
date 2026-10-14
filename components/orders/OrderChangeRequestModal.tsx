"use client";

import React, { useState } from "react";
import {
  X,
  Clock,
  AlertTriangle,
  ArrowRight,
  Send,
  Info,
  ShieldAlert,
} from "lucide-react";
import { Order, ExtractedOrderPayload, FulfillmentMethod, PaymentStatus } from "@/types/order";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  computeOrderFieldDiffs,
  evaluateDeadlineStatus,
  normalizeWeightValue,
} from "@/lib/change-policy";
import { getStoredPolicySettings } from "@/lib/storage/settings";

interface OrderChangeRequestModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    proposedChanges: Partial<ExtractedOrderPayload>,
    requestNotes: string
  ) => void;
}

export const OrderChangeRequestModal: React.FC<OrderChangeRequestModalProps> = ({
  order,
  isOpen,
  onClose,
  onSubmit,
}) => {
  // Proposed values state initialized from accepted order
  const [product, setProduct] = useState(order.product || "");
  const [quantity, setQuantity] = useState(
    order.quantity !== null && order.quantity !== undefined
      ? String(order.quantity)
      : ""
  );
  const [weight, setWeight] = useState(order.weight || "");
  const [dietaryPreference, setDietaryPreference] = useState(
    order.dietary_preference || ""
  );
  const [requestedDate, setRequestedDate] = useState(
    order.requested_date || ""
  );
  const [resolvedDate, setResolvedDate] = useState(order.resolved_date || "");
  const [requestedTime, setRequestedTime] = useState(
    order.requested_time || ""
  );
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>(
    order.fulfillment_method || "unknown"
  );
  const [paymentAmount, setPaymentAmount] = useState(
    order.payment_amount !== null && order.payment_amount !== undefined
      ? String(order.payment_amount)
      : ""
  );
  const [paymentCurrency, setPaymentCurrency] = useState(
    order.payment_currency || "INR"
  );
  const [paymentMethod, setPaymentMethod] = useState(
    order.payment_method || ""
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    order.payment_status || "not_mentioned"
  );
  const [notesStr, setNotesStr] = useState(
    Array.isArray(order.notes) ? order.notes.join("\n") : ""
  );
  const [requestNotes, setRequestNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const policySettings = getStoredPolicySettings();
  const deadlineEval = evaluateDeadlineStatus(order, policySettings.cutoff_hours);

  // Construct proposed changes payload
  const parsedQty = quantity.trim() ? parseFloat(quantity) : null;
  const parsedAmount = paymentAmount.trim() ? parseFloat(paymentAmount) : null;

  const proposedPayload: Partial<ExtractedOrderPayload> = {
    product: product.trim() || null,
    quantity: isNaN(Number(parsedQty)) ? null : parsedQty,
    weight: normalizeWeightValue(weight),
    dietary_preference: dietaryPreference.trim() || null,
    requested_date: requestedDate.trim() || null,
    resolved_date: resolvedDate.trim() || null,
    requested_time: requestedTime.trim() || null,
    fulfillment_method: fulfillmentMethod,
    payment_amount: isNaN(Number(parsedAmount)) ? null : parsedAmount,
    payment_currency: paymentCurrency.trim() || null,
    payment_method: paymentMethod.trim() || null,
    payment_status: paymentStatus,
    notes: notesStr
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };

  const diffs = computeOrderFieldDiffs(order, proposedPayload);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (
      parsedAmount !== null &&
      (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount < 0)
    ) {
      setErrorMsg("Payment amount cannot be negative or invalid.");
      return;
    }

    if (diffs.length === 0) {
      setErrorMsg("No changes detected. Please modify at least one field.");
      return;
    }

    try {
      onSubmit(proposedPayload, requestNotes);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to record change request.");
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-crumb-espresso/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-crumb-surface border border-crumb-border rounded-2xl max-w-3xl w-full shadow-modal overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-crumb-border flex items-center justify-between bg-crumb-surface">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-crumb-terracotta-light text-crumb-terracotta flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-crumb-espresso font-serif">
                Record Customer Change Request
              </h3>
              <p className="text-xs text-crumb-muted">
                Order ID: <span className="font-mono">{order.id}</span> • Customer:{" "}
                <strong>{order.customer_name || "Unknown"}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-crumb-subtle hover:text-crumb-espresso p-1.5 rounded-lg hover:bg-crumb-surface-alt transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Policy Status Banner */}
        <div className="px-6 py-3 bg-crumb-surface-alt/70 border-b border-crumb-border text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {deadlineEval.status === "within_window" ? (
              <Info className="w-4 h-4 text-crumb-sage flex-shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-crumb-amber flex-shrink-0" />
            )}
            <span className="text-crumb-espresso font-medium">
              {deadlineEval.message}
            </span>
          </div>
          <Badge
            variant={deadlineEval.status === "within_window" ? "success" : "warning"}
            size="sm"
          >
            {deadlineEval.status === "within_window" ? "Normal Window" : "Exception Req."}
          </Badge>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Context / WhatsApp reason input */}
          <div className="p-3.5 rounded-xl bg-crumb-surface-alt border border-crumb-border space-y-1.5">
            <label className="block text-xs font-semibold text-crumb-espresso">
              Customer Change Context / Stated Reason
            </label>
            <input
              type="text"
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              placeholder="e.g. Customer requested a 1 kg cake instead of 500g via WhatsApp."
              className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border focus:border-crumb-terracotta outline-none text-crumb-espresso"
            />
            <span className="text-[10px] text-crumb-muted block">
              Documenting the communication channel and context helps resolve disputes.
            </span>
          </div>

          {/* Live Diff Preview */}
          {diffs.length > 0 ? (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-800 uppercase tracking-wider text-[11px]">
                  Proposed Changes ({diffs.length} field(s))
                </span>
                <span className="text-[10px] text-emerald-700 italic">
                  Will not mutate accepted order until baker approves
                </span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                {diffs.map((diff) => (
                  <div
                    key={diff.field}
                    className="flex items-center gap-2 bg-white/80 p-1.5 rounded border border-emerald-100"
                  >
                    <span className="font-sans font-semibold text-crumb-espresso w-36 flex-shrink-0">
                      {diff.field_label}:
                    </span>
                    <span className="line-through text-crumb-subtle">
                      {String(diff.old_value ?? "—")}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-crumb-terracotta flex-shrink-0" />
                    <span className="font-semibold text-emerald-700">
                      {String(diff.new_value ?? "—")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-crumb-surface-alt/40 border border-crumb-border text-center text-xs text-crumb-subtle">
              No modifications entered yet. Edit any fields below to propose a change.
            </div>
          )}

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Product */}
            <div>
              <label className="block text-xs font-medium text-crumb-espresso mb-1">
                Product / Flavor
              </label>
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border focus:border-crumb-terracotta outline-none"
              />
            </div>

            {/* Dietary Preference */}
            <div>
              <label className="block text-xs font-medium text-crumb-espresso mb-1">
                Dietary Preference
              </label>
              <input
                type="text"
                value={dietaryPreference}
                onChange={(e) => setDietaryPreference(e.target.value)}
                placeholder="e.g. Eggless, Gluten-Free"
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border focus:border-crumb-terracotta outline-none"
              />
            </div>

            {/* Quantity */}
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
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border focus:border-crumb-terracotta outline-none"
              />
            </div>

            {/* Weight */}
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

            {/* Resolved Date */}
            <div>
              <label className="block text-xs font-medium text-crumb-espresso mb-1">
                Resolved Date (ISO)
              </label>
              <input
                type="date"
                value={resolvedDate}
                onChange={(e) => setResolvedDate(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border focus:border-crumb-terracotta outline-none"
              />
            </div>

            {/* Time */}
            <div>
              <label className="block text-xs font-medium text-crumb-espresso mb-1">
                Fulfillment Time (HH:mm)
              </label>
              <input
                type="text"
                value={requestedTime}
                onChange={(e) => setRequestedTime(e.target.value)}
                placeholder="e.g. 18:00"
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border focus:border-crumb-terracotta outline-none"
              />
            </div>

            {/* Fulfillment Method */}
            <div>
              <label className="block text-xs font-medium text-crumb-espresso mb-1">
                Fulfillment Method
              </label>
              <select
                value={fulfillmentMethod}
                onChange={(e) =>
                  setFulfillmentMethod(e.target.value as FulfillmentMethod)
                }
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border outline-none focus:border-crumb-terracotta"
              >
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            {/* Payment Amount */}
            <div>
              <label className="block text-xs font-medium text-crumb-espresso mb-1">
                Payment Amount
              </label>
              <input
                type="number"
                step="any"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border outline-none focus:border-crumb-terracotta"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-crumb-espresso mb-1">
                Order Notes (One per line)
              </label>
              <textarea
                rows={2}
                value={notesStr}
                onChange={(e) => setNotesStr(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg bg-crumb-surface border border-crumb-border outline-none focus:border-crumb-terracotta resize-none"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-crumb-border flex items-center justify-end gap-2.5">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={diffs.length === 0}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Submit Change Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
