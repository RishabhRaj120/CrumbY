"use client";

import React from "react";
import {
  Calendar,
  Clock,
  MessageSquare,
  Edit3,
  Trash2,
  CheckCircle,
  Package,
  AlertCircle,
  Sparkles,
  Flame,
  Check,
  Award,
} from "lucide-react";
import { Order, OrderStatus } from "@/types/order";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import {
  formatDate,
  formatCurrency,
  getOrderStatusBadge,
  getPaymentStatusBadge,
  getFulfillmentBadge,
} from "@/lib/utils";

interface OrderTableProps {
  orders: Order[];
  onReview: (order: Order) => void;
  onDraftReply: (order: Order) => void;
  onQuickConfirm: (order: Order) => void;
  onQuickTransition?: (order: Order, newStatus: OrderStatus) => void;
  onDeleteRequest: (order: Order) => void;
  onOpenImport: () => void;
  onLoadDemoData: () => void;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  onReview,
  onDraftReply,
  onQuickConfirm,
  onQuickTransition,
  onDeleteRequest,
  onOpenImport,
  onLoadDemoData,
}) => {
  if (orders.length === 0) {
    return (
      <div className="bg-crumb-surface border border-crumb-border rounded-2xl p-10 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-crumb-terracotta-light text-crumb-terracotta flex items-center justify-center mx-auto">
          <Package className="w-7 h-7" />
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h3 className="text-base font-bold text-crumb-espresso font-serif">
            No Orders Found
          </h3>
          <p className="text-xs text-crumb-muted leading-relaxed">
            Import an order from a customer message or load sample bakery records to test CrumbDesk&apos;s extraction pipeline.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadDemoData}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-crumb-amber" />}
          >
            Load Sample Orders
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenImport}
            leftIcon={<Package className="w-3.5 h-3.5" />}
          >
            Import Customer Message
          </Button>
        </div>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: OrderStatus) => {
    switch (status) {
      case "confirmed":
        return "success";
      case "in_preparation":
        return "terracotta";
      case "ready":
        return "success";
      case "completed":
        return "neutral";
      case "cancelled":
        return "danger";
      case "needs_review":
      default:
        return "warning";
    }
  };

  return (
    <div className="bg-crumb-surface border border-crumb-border rounded-xl shadow-sm overflow-hidden">
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-crumb-border bg-crumb-surface-alt/60 text-[11px] font-bold uppercase tracking-wider text-crumb-muted">
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Customer & Product</th>
              <th className="py-3 px-4">Qty & Weight</th>
              <th className="py-3 px-4">Fulfillment Schedule</th>
              <th className="py-3 px-4">Payment Info</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-crumb-border/60 text-xs">
            {orders.map((order) => {
              const statusBadge = getOrderStatusBadge(order.status);
              const paymentBadge = getPaymentStatusBadge(order.payment_status);
              const fulfillmentBadge = getFulfillmentBadge(
                order.fulfillment_method
              );
              const hasPendingChange = (order.change_requests || []).some(
                (r) => r.status === "pending"
              );

              return (
                <tr
                  key={order.id}
                  className="hover:bg-crumb-surface-alt/40 transition-colors group"
                >
                  {/* Status & Badges */}
                  <td className="py-3.5 px-4 align-top">
                    <div className="space-y-1.5">
                      <Badge
                        variant={getStatusBadgeVariant(order.status)}
                        dot
                      >
                        {statusBadge.label}
                      </Badge>
                      {hasPendingChange && (
                        <div>
                          <Badge variant="warning" size="sm">
                            Pending Change
                          </Badge>
                        </div>
                      )}
                      {order.is_demo && (
                        <div>
                          <Badge variant="demo">Demo Sample</Badge>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Customer & Product */}
                  <td className="py-3.5 px-4 align-top">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-crumb-espresso block text-sm">
                        {order.product || (
                          <span className="text-crumb-subtle italic">
                            Unspecified Product
                          </span>
                        )}
                      </span>
                      <div className="text-xs text-crumb-muted flex items-center gap-2">
                        <span>{order.customer_name || "Unknown customer"}</span>
                        {order.dietary_preference && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-crumb-surface-alt border border-crumb-border font-medium text-crumb-espresso">
                            {order.dietary_preference}
                          </span>
                        )}
                      </div>
                      {order.missing_or_unverified &&
                        order.missing_or_unverified.length > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-amber-700 mt-1">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                            <span>
                              {order.missing_or_unverified.length} item(s) unverified
                            </span>
                          </div>
                        )}
                    </div>
                  </td>

                  {/* Qty & Weight */}
                  <td className="py-3.5 px-4 align-top">
                    <div className="space-y-0.5 font-medium text-crumb-espresso">
                      <div>
                        {order.quantity !== null ? (
                          <span>{order.quantity} unit(s)</span>
                        ) : (
                          <span className="text-crumb-subtle">Qty —</span>
                        )}
                      </div>
                      <div className="text-xs text-crumb-muted">
                        {order.weight ? (
                          <span>{order.weight}</span>
                        ) : (
                          <span className="text-crumb-subtle">Weight —</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Fulfillment Schedule */}
                  <td className="py-3.5 px-4 align-top">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-crumb-espresso font-medium">
                        <Calendar className="w-3.5 h-3.5 text-crumb-terracotta flex-shrink-0" />
                        <span>
                          {order.resolved_date
                            ? formatDate(order.resolved_date)
                            : order.requested_date || "Date unconfirmed"}
                        </span>
                      </div>
                      {order.requested_time && (
                        <div className="flex items-center gap-1.5 text-[11px] text-crumb-muted">
                          <Clock className="w-3.5 h-3.5 text-crumb-subtle flex-shrink-0" />
                          <span>{order.requested_time}</span>
                        </div>
                      )}
                      <div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${fulfillmentBadge.bg}`}
                        >
                          {fulfillmentBadge.label}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Payment Info */}
                  <td className="py-3.5 px-4 align-top">
                    <div className="space-y-1">
                      <div className="font-semibold text-crumb-espresso text-sm">
                        {formatCurrency(
                          order.payment_amount,
                          order.payment_currency
                        )}
                      </div>
                      <div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium inline-block ${paymentBadge.bg}`}
                          title={paymentBadge.tooltip}
                        >
                          {paymentBadge.label}
                        </span>
                      </div>
                      {order.payment_method && (
                        <div className="text-[10px] text-crumb-subtle">
                          via {order.payment_method}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 align-top text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onReview(order)}
                        leftIcon={<Edit3 className="w-3 h-3" />}
                        title="View details and review order"
                      >
                        {order.status === "needs_review" ? "Review" : "Details"}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDraftReply(order)}
                        leftIcon={
                          <MessageSquare className="w-3.5 h-3.5 text-crumb-terracotta" />
                        }
                        title="Draft customer reply"
                      />

                      {/* Quick Lifecycle progression buttons */}
                      {order.status === "needs_review" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onQuickConfirm(order)}
                          leftIcon={
                            <CheckCircle className="w-3.5 h-3.5 text-crumb-sage" />
                          }
                          title="Confirm order"
                        />
                      )}

                      {order.status === "confirmed" && onQuickTransition && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onQuickTransition(order, "in_preparation")}
                          leftIcon={
                            <Flame className="w-3.5 h-3.5 text-orange-600" />
                          }
                          title="Start preparation"
                        />
                      )}

                      {order.status === "in_preparation" && onQuickTransition && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onQuickTransition(order, "ready")}
                          leftIcon={
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          }
                          title="Mark ready"
                        />
                      )}

                      {order.status === "ready" && onQuickTransition && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onQuickTransition(order, "completed")}
                          leftIcon={
                            <Award className="w-3.5 h-3.5 text-purple-600" />
                          }
                          title="Mark completed"
                        />
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteRequest(order)}
                        leftIcon={
                          <Trash2 className="w-3.5 h-3.5 text-crumb-subtle hover:text-red-600" />
                        }
                        title="Delete order"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden divide-y divide-crumb-border">
        {orders.map((order) => {
          const statusBadge = getOrderStatusBadge(order.status);
          const paymentBadge = getPaymentStatusBadge(order.payment_status);
          const fulfillmentBadge = getFulfillmentBadge(
            order.fulfillment_method
          );
          const hasPendingChange = (order.change_requests || []).some(
            (r) => r.status === "pending"
          );

          return (
            <div key={order.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-sm text-crumb-espresso">
                    {order.product || "Unspecified Cake/Bake"}
                  </h4>
                  <p className="text-xs text-crumb-muted">
                    {order.customer_name || "Unknown customer"}
                    {order.dietary_preference ? ` • ${order.dietary_preference}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant={getStatusBadgeVariant(order.status)}
                    dot
                  >
                    {statusBadge.label}
                  </Badge>
                  {hasPendingChange && (
                    <Badge variant="warning" size="sm">
                      Pending Change
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-crumb-surface-alt/60 p-2.5 rounded-lg border border-crumb-border">
                <div>
                  <span className="text-crumb-subtle block text-[10px]">
                    QTY / WEIGHT
                  </span>
                  <span className="font-medium text-crumb-espresso">
                    {order.quantity !== null ? `${order.quantity}x ` : ""}
                    {order.weight || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-crumb-subtle block text-[10px]">
                    PAYMENT
                  </span>
                  <span className="font-medium text-crumb-espresso">
                    {formatCurrency(
                      order.payment_amount,
                      order.payment_currency
                    )}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-between pt-1 border-t border-crumb-border/40">
                  <span className="text-[11px] text-crumb-muted">
                    {order.resolved_date
                      ? formatDate(order.resolved_date)
                      : order.requested_date || "Date unconfirmed"}
                    {order.requested_time ? ` at ${order.requested_time}` : ""}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${fulfillmentBadge.bg}`}
                  >
                    {fulfillmentBadge.label}
                  </span>
                </div>
              </div>

              {order.missing_or_unverified &&
                order.missing_or_unverified.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      {order.missing_or_unverified.length} item(s) unverified
                    </span>
                  </div>
                )}

              <div className="flex items-center justify-between pt-1">
                {order.is_demo ? (
                  <Badge variant="demo">Demo Sample</Badge>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReview(order)}
                    leftIcon={<Edit3 className="w-3 h-3" />}
                  >
                    {order.status === "needs_review" ? "Review" : "Details"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDraftReply(order)}
                    leftIcon={
                      <MessageSquare className="w-3.5 h-3.5 text-crumb-terracotta" />
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteRequest(order)}
                    leftIcon={<Trash2 className="w-3.5 h-3.5 text-crumb-subtle" />}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
