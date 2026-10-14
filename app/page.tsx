"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { OrderFilters } from "@/components/orders/OrderFilters";
import { OrderTable } from "@/components/orders/OrderTable";
import { ImportOrderModal } from "@/components/forms/ImportOrderModal";
import { OrderReviewPanel } from "@/components/orders/OrderReviewPanel";
import { DraftReplyModal } from "@/components/orders/DraftReplyModal";
import { DeleteConfirmModal } from "@/components/orders/DeleteConfirmModal";
import {
  Order,
  OrderStatus,
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
  transitionOrderStatus,
  loadDemoOrders,
  removeDemoOrders,
  calculateDashboardStats,
  ORDERS_CHANGED_EVENT,
} from "@/lib/storage/orders";
import { downloadOrdersCsv } from "@/lib/csv";

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderFilterStatus>("all");
  const [paymentFilter, setPaymentFilter] = useState<OrderFilterPayment>("all");
  const [fulfillmentFilter, setFulfillmentFilter] =
    useState<OrderFilterFulfillment>("all");

  // Modals state
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

  // Load orders on client mount and register event listener
  useEffect(() => {
    const refreshOrders = () => {
      setOrders(getStoredOrders());
    };

    refreshOrders();
    setIsInitialized(true);

    window.addEventListener(ORDERS_CHANGED_EVENT, refreshOrders);
    return () => window.removeEventListener(ORDERS_CHANGED_EVENT, refreshOrders);
  }, []);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Search matching
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

      // Status filter
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }

      // Payment filter
      if (paymentFilter !== "all" && order.payment_status !== paymentFilter) {
        return false;
      }

      // Fulfillment filter
      if (
        fulfillmentFilter !== "all" &&
        order.fulfillment_method !== fulfillmentFilter
      ) {
        return false;
      }

      return true;
    });
  }, [orders, searchQuery, statusFilter, paymentFilter, fulfillmentFilter]);

  // Dynamic Dashboard Statistics
  const stats = useMemo(() => calculateDashboardStats(orders), [orders]);
  const hasDemoData = useMemo(() => orders.some((o) => o.is_demo), [orders]);

  // Modal Handlers
  const handleExtracted = (payload: ExtractedOrderPayload, rawMessage: string) => {
    // Open the OrderReviewPanel with extracted data
    setReviewOrder({
      data: payload,
      rawMessage,
      isExisting: false,
    });
  };

  const handleSaveReviewedOrder = (orderToSave: Order) => {
    addOrder(orderToSave);
    setReviewOrder(null);
  };

  const handleOpenReview = (order: Order) => {
    setReviewOrder({
      data: order,
      rawMessage: order.raw_message,
      isExisting: true,
    });
  };

  const handleQuickConfirm = (order: Order) => {
    transitionOrderStatus(order.id, "confirmed");
  };

  const handleQuickTransition = (order: Order, newStatus: OrderStatus) => {
    transitionOrderStatus(order.id, newStatus);
  };

  const handleDeleteConfirm = (orderId: string) => {
    deleteOrder(orderId);
    setDeleteTargetOrder(null);
  };

  const handleStatsFilterClick = (
    type: "all" | "needs_review" | "confirmed" | "upcoming"
  ) => {
    if (type === "upcoming") {
      setFulfillmentFilter("all");
      setStatusFilter("all");
    } else {
      setStatusFilter(type);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setFulfillmentFilter("all");
  };

  const handleExportCsv = () => {
    downloadOrdersCsv(orders);
  };

  return (
    <div>
      {/* Header */}
      <Header
        title="Bakehouse Dashboard"
        subtitle="Manage and clarify home bakery orders with local Gemma 3 4B AI"
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onExportCsv={handleExportCsv}
        onLoadDemoData={loadDemoOrders}
        onRemoveDemoData={removeDemoOrders}
        hasDemoData={hasDemoData}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Statistics Cards */}
        <StatsOverview
          stats={stats}
          onFilterClick={handleStatsFilterClick}
        />

        {/* Order Filters & Search */}
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
          onReset={handleResetFilters}
        />

        {/* Order Table / Cards */}
        <OrderTable
          orders={filteredOrders}
          onReview={handleOpenReview}
          onDraftReply={(order) => setDraftReplyOrder(order)}
          onQuickConfirm={handleQuickConfirm}
          onQuickTransition={handleQuickTransition}
          onDeleteRequest={(order) => setDeleteTargetOrder(order)}
          onOpenImport={() => setIsImportModalOpen(true)}
          onLoadDemoData={loadDemoOrders}
        />
      </div>

      {/* Import Modal */}
      <ImportOrderModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onExtracted={handleExtracted}
      />

      {/* Review & Edit Order Panel */}
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

      {/* Draft Customer Reply Modal */}
      <DraftReplyModal
        isOpen={Boolean(draftReplyOrder)}
        onClose={() => setDraftReplyOrder(null)}
        order={draftReplyOrder}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTargetOrder)}
        order={deleteTargetOrder}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTargetOrder(null)}
      />
    </div>
  );
}
