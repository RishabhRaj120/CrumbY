"use client";

import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Order } from "@/types/order";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  order: Order | null;
  onConfirm: (orderId: string) => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  order,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-crumb-espresso/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-crumb-surface border border-crumb-border rounded-2xl max-w-md w-full p-6 shadow-modal space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-crumb-espresso">
              Delete Order Record?
            </h3>
            <p className="text-xs text-crumb-muted leading-relaxed">
              Are you sure you want to delete this order for{" "}
              <strong>{order.product || "unspecified bake"}</strong>
              {order.customer_name ? ` (${order.customer_name})` : ""}?
            </p>
            <p className="text-[11px] text-red-600 mt-2 font-medium">
              This action permanently removes the record from browser storage.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-crumb-border">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onConfirm(order.id)}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete Order
          </Button>
        </div>
      </div>
    </div>
  );
};
