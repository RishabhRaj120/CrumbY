"use client";

import React, { useState } from "react";
import { X, AlertTriangle, ShieldAlert } from "lucide-react";
import { Order } from "@/types/order";
import { Button } from "../ui/Button";

interface CancelOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: (orderId: string, reason?: string) => void;
}

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmCancel,
}) => {
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const isPrepStarted =
    order.status === "in_preparation" ||
    order.status === "ready" ||
    Boolean(order.preparation_started_at);

  const handleConfirm = () => {
    setErrorMsg(null);
    if (isPrepStarted && !reason.trim()) {
      setErrorMsg(
        "A cancellation reason is mandatory when cancelling an order after preparation has started."
      );
      return;
    }

    onConfirmCancel(order.id, reason.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-crumb-espresso/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-crumb-surface border border-crumb-border rounded-xl max-w-md w-full p-5 shadow-modal space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-crumb-espresso">
                Cancel Order {order.id}?
              </h3>
              <p className="text-xs text-crumb-muted mt-0.5">
                Customer: <strong>{order.customer_name || "Unknown"}</strong> •{" "}
                {order.product || "Unspecified Cake"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-crumb-subtle hover:text-crumb-espresso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isPrepStarted && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>Production Alert</span>
            </div>
            <p className="leading-relaxed">
              Preparation for this order has already started in the kitchen.
              Ingredients, baking time, and schedules have been committed.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-crumb-espresso">
            Cancellation Reason {isPrepStarted ? "(Required)" : "(Optional)"}
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isPrepStarted
                ? "e.g. Customer cancelled emergency, sponge scrapped."
                : "e.g. Customer changed mind, no response to confirmation."
            }
            className="w-full text-xs p-2.5 rounded-lg bg-crumb-surface border border-crumb-border outline-none focus:border-crumb-terracotta resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-crumb-border">
          <Button variant="outline" size="sm" onClick={onClose}>
            Back
          </Button>
          <Button variant="danger" size="sm" onClick={handleConfirm}>
            Confirm Cancellation
          </Button>
        </div>
      </div>
    </div>
  );
};
