"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Clock,
  Info,
} from "lucide-react";
import { Order, ChangeRequest } from "@/types/order";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  computeOrderFieldDiffs,
  evaluateDeadlineStatus,
  isChangeRequestStale,
} from "@/lib/change-policy";
import { getStoredPolicySettings } from "@/lib/storage/settings";

interface ChangeRequestApprovalModalProps {
  order: Order;
  request: ChangeRequest;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (options?: { isException?: boolean; reason?: string }) => void;
  onReject: (reason?: string) => void;
}

export const ChangeRequestApprovalModal: React.FC<
  ChangeRequestApprovalModalProps
> = ({ order, request, isOpen, onClose, onApprove, onReject }) => {
  const [mode, setMode] = useState<"review" | "reject">("review");
  const [exceptionReason, setExceptionReason] = useState("");
  const [confirmExceptionCheckbox, setConfirmExceptionCheckbox] =
    useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const policySettings = getStoredPolicySettings();
  const deadlineEval = evaluateDeadlineStatus(order, policySettings.cutoff_hours);
  const staleCheck = isChangeRequestStale(order, request);
  const diffs = computeOrderFieldDiffs(order, request.proposed_changes);

  const handleApprove = () => {
    setErrorMsg(null);

    if (staleCheck.isStale) {
      setErrorMsg(
        `Cannot approve: The accepted order was modified in [${staleCheck.conflictingFields.join(
          ", "
        )}] after this request was recorded.`
      );
      return;
    }

    if (deadlineEval.requiresException) {
      if (!exceptionReason.trim()) {
        setErrorMsg("A mandatory reason is required for exceptional change approval.");
        return;
      }
      if (!confirmExceptionCheckbox) {
        setErrorMsg("Please check the confirmation box to authorize this exception.");
        return;
      }
      onApprove({ isException: true, reason: exceptionReason.trim() });
    } else {
      onApprove({ isException: false });
    }

    onClose();
  };

  const handleReject = () => {
    onReject(rejectionReason.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-crumb-espresso/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-crumb-surface border border-crumb-border rounded-2xl max-w-2xl w-full shadow-modal overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-crumb-border flex items-center justify-between bg-crumb-surface">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                deadlineEval.requiresException
                  ? "bg-amber-100 text-amber-700"
                  : "bg-crumb-sage-light text-crumb-sage"
              }`}
            >
              {deadlineEval.requiresException ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-crumb-espresso font-serif">
                  {mode === "review"
                    ? deadlineEval.requiresException
                      ? "Review Exception Change Request"
                      : "Review Order Change Request"
                    : "Reject Change Request"}
                </h3>
                <Badge
                  variant={
                    deadlineEval.requiresException ? "warning" : "success"
                  }
                  size="sm"
                >
                  {deadlineEval.requiresException ? "Exception" : "Within Policy"}
                </Badge>
              </div>
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {staleCheck.isStale && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-800 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-600" />
                <span>Stale Change Proposal Warning</span>
              </div>
              <p className="leading-relaxed">
                The accepted order has been updated in fields [
                <strong>{staleCheck.conflictingFields.join(", ")}</strong>] since
                this request was recorded. Approving this request is blocked to
                prevent overwriting newer accepted data.
              </p>
            </div>
          )}

          {mode === "review" ? (
            <>
              {/* Customer Request Context */}
              {request.request_notes && (
                <div className="p-3.5 rounded-xl bg-crumb-surface-alt border border-crumb-border text-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-crumb-muted block">
                    Customer Stated Context (Recorded by Baker)
                  </span>
                  <p className="text-crumb-espresso font-medium italic">
                    &ldquo;{request.request_notes}&rdquo;
                  </p>
                </div>
              )}

              {/* Proposed Field Modifications Diff */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-crumb-terracotta block">
                  Proposed Order Modifications
                </span>
                {diffs.length > 0 ? (
                  <div className="rounded-xl border border-crumb-border overflow-hidden divide-y divide-crumb-border">
                    {diffs.map((diff) => (
                      <div
                        key={diff.field}
                        className="p-3 text-xs grid grid-cols-1 sm:grid-cols-3 gap-2 bg-crumb-surface hover:bg-crumb-surface-alt/40 transition-colors"
                      >
                        <span className="font-semibold text-crumb-espresso sm:col-span-1">
                          {diff.field_label}:
                        </span>
                        <div className="sm:col-span-2 flex items-center gap-2 font-mono">
                          <span className="line-through text-crumb-subtle">
                            {String(diff.old_value ?? "—")}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-crumb-terracotta flex-shrink-0" />
                          <span className="font-semibold text-emerald-700">
                            {String(diff.new_value ?? "—")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-crumb-surface-alt text-xs text-crumb-muted text-center">
                    No field differences found.
                  </div>
                )}
              </div>

              {/* Policy Restriction & Exception Requirements */}
              {deadlineEval.requiresException ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-900">
                        Exception Approval Required
                      </h4>
                      <p className="text-amber-800 mt-0.5 leading-relaxed">
                        {deadlineEval.message}
                      </p>
                      <p className="text-amber-700 text-[11px] mt-1 italic">
                        Notice: Late changes can disrupt ingredient quantities, baking
                        timelines, sponge cooling, and packaging.
                      </p>
                    </div>
                  </div>

                  {/* Mandatory Reason Input */}
                  <div className="space-y-1 pt-1">
                    <label className="block text-xs font-bold text-amber-950">
                      Baker Reason for Authorizing Exception{" "}
                      <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={exceptionReason}
                      onChange={(e) => setExceptionReason(e.target.value)}
                      placeholder="e.g. Ingredients available, customer agreed to additional ₹200 rush fee."
                      className="w-full text-xs p-2.5 rounded-lg bg-white border border-amber-300 outline-none focus:ring-1 focus:ring-amber-500 text-crumb-espresso resize-none"
                    />
                  </div>

                  {/* Confirmation Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={confirmExceptionCheckbox}
                      onChange={(e) =>
                        setConfirmExceptionCheckbox(e.target.checked)
                      }
                      className="w-4 h-4 rounded text-crumb-terracotta focus:ring-crumb-terracotta"
                    />
                    <span className="text-xs font-semibold text-amber-950 select-none">
                      I understand the production risks and authorize this exception.
                    </span>
                  </label>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-crumb-sage-light/70 border border-crumb-sage/30 text-xs text-crumb-espresso flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-crumb-sage flex-shrink-0" />
                  <span>
                    This change is within the configured <strong>{policySettings.cutoff_hours}h</strong>{" "}
                    change window. Ordinary baker approval is permitted.
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Rejection View */
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                <span className="font-bold block">
                  Reject Customer Change Proposal
                </span>
                <p className="leading-relaxed">
                  The accepted order specifications will remain strictly unchanged.
                  The customer proposal and your rejection reason will be permanently
                  preserved in the order history.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-crumb-espresso mb-1">
                  Rejection Reason / Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Sponge already baked; unable to increase cake size on pickup day."
                  className="w-full text-xs p-2.5 rounded-lg bg-crumb-surface border border-crumb-border outline-none focus:border-crumb-terracotta resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-crumb-border bg-crumb-surface-alt/40 flex items-center justify-between gap-3">
          {mode === "review" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode("reject")}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
              >
                Reject Request
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApprove}
                  disabled={staleCheck.isStale}
                  className={
                    deadlineEval.requiresException
                      ? "bg-amber-600 hover:bg-amber-700"
                      : ""
                  }
                  leftIcon={
                    deadlineEval.requiresException ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {deadlineEval.requiresException
                    ? "Approve Exception"
                    : "Approve Changes"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode("review")}
              >
                Back to Review
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleReject}
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
              >
                Confirm Rejection
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
