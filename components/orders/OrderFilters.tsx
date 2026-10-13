"use client";

import React from "react";
import { Search, Filter, X } from "lucide-react";
import {
  OrderFilterStatus,
  OrderFilterPayment,
  OrderFilterFulfillment,
} from "@/types/order";

interface OrderFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: OrderFilterStatus;
  onStatusFilterChange: (s: OrderFilterStatus) => void;
  paymentFilter: OrderFilterPayment;
  onPaymentFilterChange: (p: OrderFilterPayment) => void;
  fulfillmentFilter: OrderFilterFulfillment;
  onFulfillmentFilterChange: (f: OrderFilterFulfillment) => void;
  totalFiltered: number;
  totalOrders: number;
  onReset: () => void;
}

export const OrderFilters: React.FC<OrderFiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  paymentFilter,
  onPaymentFilterChange,
  fulfillmentFilter,
  onFulfillmentFilterChange,
  totalFiltered,
  totalOrders,
  onReset,
}) => {
  const isFiltered =
    searchQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    paymentFilter !== "all" ||
    fulfillmentFilter !== "all";

  return (
    <div className="bg-crumb-surface p-4 rounded-xl border border-crumb-border space-y-3 shadow-sm">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-crumb-subtle absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search orders by product, customer, note, flavor..."
            className="w-full text-xs sm:text-sm pl-9 pr-8 py-2 rounded-lg bg-crumb-surface-alt/60 border border-crumb-border focus:border-crumb-terracotta focus:ring-1 focus:ring-crumb-terracotta/30 outline-none text-crumb-espresso placeholder:text-crumb-subtle"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-crumb-subtle hover:text-crumb-espresso p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-crumb-muted font-medium">
            <Filter className="w-3.5 h-3.5 text-crumb-terracotta" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              onStatusFilterChange(e.target.value as OrderFilterStatus)
            }
            className="text-xs px-2.5 py-2 rounded-lg bg-crumb-surface border border-crumb-border text-crumb-espresso focus:border-crumb-terracotta outline-none"
          >
            <option value="all">All Reviews</option>
            <option value="needs_review">Needs Review</option>
            <option value="confirmed">Confirmed</option>
          </select>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) =>
              onPaymentFilterChange(e.target.value as OrderFilterPayment)
            }
            className="text-xs px-2.5 py-2 rounded-lg bg-crumb-surface border border-crumb-border text-crumb-espresso focus:border-crumb-terracotta outline-none"
          >
            <option value="all">All Payments</option>
            <option value="customer_reported_paid">Reported Paid</option>
            <option value="customer_reported_unpaid">Reported Unpaid</option>
            <option value="not_mentioned">Not Mentioned</option>
            <option value="unclear">Unclear</option>
          </select>

          {/* Fulfillment Filter */}
          <select
            value={fulfillmentFilter}
            onChange={(e) =>
              onFulfillmentFilterChange(e.target.value as OrderFilterFulfillment)
            }
            className="text-xs px-2.5 py-2 rounded-lg bg-crumb-surface border border-crumb-border text-crumb-espresso focus:border-crumb-terracotta outline-none"
          >
            <option value="all">All Methods</option>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
            <option value="unknown">Unknown</option>
          </select>

          {/* Reset Filters */}
          {isFiltered && (
            <button
              onClick={onReset}
              className="text-xs text-crumb-terracotta hover:text-crumb-terracotta-hover font-medium underline px-1 py-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Filtered count subtitle */}
      <div className="flex items-center justify-between text-xs text-crumb-subtle pt-1 border-t border-crumb-border/50">
        <span>
          Showing <strong>{totalFiltered}</strong> of {totalOrders} orders
        </span>
        {isFiltered && (
          <span className="text-[11px] text-crumb-terracotta">
            Filtered view active
          </span>
        )}
      </div>
    </div>
  );
};
