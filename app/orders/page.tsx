"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { OrderFilters } from "@/components/orders/OrderFilters";
import { OrderTable } from "@/components/orders/OrderTable";
import { ImportOrderModal } from "@/components/forms/ImportOrderModal";
import { OrderReviewPanel } from "@/components/orders/OrderReviewPanel";
import { DraftReplyModal } from "@/components/orders/DraftReplyModal";
import { DeleteConfirmModal } from "@/components/orders/DeleteConfirmModal";
import {
  Order,
  ExtractedOrderPayload,
  OrderFilterStatus,
  OrderFilterPayment,
  OrderFilterFulfillment,
} from "@/types/order";
import {
  getStoredOrders,
  addOrder,
  updateOrder,
  deleteOrder,
  loadDemoOrders,
  removeDemoOrders,
  ORDERS_CHANGED_EVENT,
} from "@/lib/storage/orders";
import { downloadOrdersCsv } from "@/lib/csv";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderFilterStatus>("all");
  const [paymentFilter, setPaymentFilter] = useState<OrderFilterPayment>("all");
  const [fulfillmentFilter, setFulfillmentFilter] =
    useState<OrderFilterFulfillment>("all");

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<{
    data: ExtractedOrderPayload | Order;
    rawMessage: string;
    isExisting: boolean;
  } | null>(null);
  const [draftReplyOrder, setDraftReplyOrder] = useState<Partial<Order> | null>(
    null
  );
  const [deleteTargetOrder, setDeleteTargetOrder] = useState<Order | null>(null);

  useEffect(() => {
    const refresh = () => setOrders(getStoredOrders());
    refresh();
    window.addEventListener(ORDERS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(ORDERS_CHANGED_EVENT, refresh);
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesProduct = order.product?.toLowerCase().includes(q);
        const matchesCustomer = order.customer_name?.toLowerCase().includes(q);
        const matchesNotes = order.notes?.some((n) =>
          n.toLowerCase().includes(q)
        );
        const matchesRaw = order.raw_message?.toLowerCase().includes(q);
        if (!matchesProduct && !matchesCustomer && !matchesNotes && !matchesRaw) {
          return false;
        }
      }
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (paymentFilter !== "all" && order.payment_status !== paymentFilter)
        return false;
      if (
        fulfillmentFilter !== "all" &&
        order.fulfillment_method !== fulfillmentFilter
      )
        return false;
      return true;
    });
  }, [orders, searchQuery, statusFilter, paymentFilter, fulfillmentFilter]);

  const hasDemoData = useMemo(() => orders.some((o) => o.is_demo), [orders]);

  const handleExtracted = (payload: ExtractedOrderPayload, rawMessage: string) => {
    setReviewOrder({ data: payload, rawMessage, isExisting: false });
  };

  const handleSaveReviewedOrder = (orderToSave: Order) => {
    addOrder(orderToSave);
    setReviewOrder(null);
  };

  return (
    <div>
      <Header
        title="All Orders"
        subtitle="Search, filter, edit, and confirm customer bakery orders"
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onExportCsv={() => downloadOrdersCsv(orders)}
        onLoadDemoData={loadDemoOrders}
        onRemoveDemoData={removeDemoOrders}
        hasDemoData={hasDemoData}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        <OrderFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          paymentFilter={paymentFilter}
          onPaymentFilterChange={setPaymentFilter}
          fulfillmentFilter={fulfillmentFilter}
          onFulfillmentFilterChange={setFulfillmentFilter}
          totalFiltered={filteredOrders.length}
          totalOrders={orders.length}
          onReset={() => {
            setSearchQuery("");
            setStatusFilter("all");
            setPaymentFilter("all");
            setFulfillmentFilter("all");
          }}
        />

        <OrderTable
          orders={filteredOrders}
          onReview={(order) =>
            setReviewOrder({
              data: order,
              rawMessage: order.raw_message,
              isExisting: true,
            })
          }
          onDraftReply={(order) => setDraftReplyOrder(order)}
          onQuickConfirm={(order) =>
            updateOrder(order.id, { status: "confirmed" })
          }
          onDeleteRequest={(order) => setDeleteTargetOrder(order)}
          onOpenImport={() => setIsImportModalOpen(true)}
          onLoadDemoData={loadDemoOrders}
        />
      </div>

      <ImportOrderModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onExtracted={handleExtracted}
      />

      {reviewOrder && (
        <OrderReviewPanel
          initialData={reviewOrder.data}
          rawMessage={reviewOrder.rawMessage}
          isExistingOrder={reviewOrder.isExisting}
          onSave={handleSaveReviewedOrder}
          onCancel={() => setReviewOrder(null)}
          onOpenDraftReply={(order) => setDraftReplyOrder(order)}
        />
      )}

      <DraftReplyModal
        isOpen={Boolean(draftReplyOrder)}
        onClose={() => setDraftReplyOrder(null)}
        order={draftReplyOrder}
      />

      <DeleteConfirmModal
        isOpen={Boolean(deleteTargetOrder)}
        order={deleteTargetOrder}
        onConfirm={(id) => {
          deleteOrder(id);
          setDeleteTargetOrder(null);
        }}
        onCancel={() => setDeleteTargetOrder(null)}
      />
    </div>
  );
}
