import { OrderStatus, PaymentStatus, FulfillmentMethod } from "@/types/order";

export function formatDate(isoOrString: string | null | undefined): string {
  if (!isoOrString) return "Not set";
  try {
    const d = new Date(isoOrString);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  } catch {
    // fallback
  }
  return isoOrString;
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  } catch {
    // fallback
  }
  return iso;
}

export function formatCurrency(
  amount: number | null | undefined,
  currency: string | null | undefined = "INR"
): string {
  if (amount === null || amount === undefined) return "—";
  const symbol = currency === "INR" || !currency ? "₹" : currency + " ";
  return `${symbol}${amount.toLocaleString()}`;
}

export function getOrderStatusBadge(status: OrderStatus) {
  switch (status) {
    case "confirmed":
      return {
        label: "Confirmed",
        bg: "bg-crumb-sage-light text-crumb-sage border-crumb-sage/30",
        dot: "bg-crumb-sage",
      };
    case "in_preparation":
      return {
        label: "In Preparation",
        bg: "bg-crumb-terracotta-light text-crumb-terracotta border-crumb-terracotta/30",
        dot: "bg-crumb-terracotta",
      };
    case "ready":
      return {
        label: "Ready for Pickup",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-600",
      };
    case "completed":
      return {
        label: "Completed",
        bg: "bg-purple-50 text-purple-700 border-purple-200",
        dot: "bg-purple-600",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        dot: "bg-rose-600",
      };
    case "needs_review":
    default:
      return {
        label: "Needs Review",
        bg: "bg-crumb-amber-light text-crumb-amber border-crumb-amber/30",
        dot: "bg-crumb-amber",
      };
  }
}

export function getChangeRequestStatusBadge(status: "pending" | "approved" | "rejected") {
  switch (status) {
    case "approved":
      return {
        label: "Change Approved",
        bg: "bg-crumb-sage-light text-crumb-sage border-crumb-sage/30",
        dot: "bg-crumb-sage",
      };
    case "rejected":
      return {
        label: "Change Rejected",
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        dot: "bg-rose-600",
      };
    case "pending":
    default:
      return {
        label: "Pending Change",
        bg: "bg-amber-50 text-amber-800 border-amber-300 font-semibold",
        dot: "bg-amber-600",
      };
  }
}

export function getDeadlineStatusBadge(status: string) {
  switch (status) {
    case "within_window":
      return {
        label: "Within Change Window",
        bg: "bg-crumb-sage-light text-crumb-sage border-crumb-sage/30",
        dot: "bg-crumb-sage",
      };
    case "past_deadline":
      return {
        label: "Change Window Closed",
        bg: "bg-amber-50 text-amber-800 border-amber-300",
        dot: "bg-amber-600",
      };
    case "prep_started":
      return {
        label: "Preparation Started",
        bg: "bg-crumb-terracotta-light text-crumb-terracotta border-crumb-terracotta/30",
        dot: "bg-crumb-terracotta",
      };
    case "ready":
      return {
        label: "Order Ready",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-600",
      };
    case "terminal":
      return {
        label: "Terminal Order",
        bg: "bg-crumb-surface-alt text-crumb-muted border-crumb-border",
        dot: "bg-crumb-subtle",
      };
    case "unresolved_schedule":
    default:
      return {
        label: "Schedule Unresolved",
        bg: "bg-crumb-amber-light text-crumb-amber border-crumb-amber/30",
        dot: "bg-crumb-amber",
      };
  }
}

export function getPaymentStatusBadge(status: PaymentStatus) {
  switch (status) {
    case "customer_reported_paid":
      return {
        label: "Reported Paid",
        tooltip: "Customer stated they paid. Not bank verified.",
        bg: "bg-crumb-sage-light text-crumb-sage border-crumb-sage/20",
        dot: "bg-crumb-sage",
      };
    case "customer_reported_unpaid":
      return {
        label: "Unpaid (Pending)",
        tooltip: "Customer indicated they will pay later.",
        bg: "bg-crumb-amber-light text-crumb-amber border-crumb-amber/20",
        dot: "bg-crumb-amber",
      };
    case "unclear":
      return {
        label: "Payment Unclear",
        tooltip: "Payment mention was ambiguous.",
        bg: "bg-crumb-surface-alt text-crumb-muted border-crumb-border",
        dot: "bg-crumb-subtle",
      };
    case "not_mentioned":
    default:
      return {
        label: "Not Mentioned",
        tooltip: "No payment information was found in message.",
        bg: "bg-crumb-surface-alt text-crumb-muted border-crumb-border",
        dot: "bg-crumb-subtle",
      };
  }
}

export function getFulfillmentBadge(method: FulfillmentMethod) {
  switch (method) {
    case "pickup":
      return {
        label: "Pickup",
        bg: "bg-orange-50 text-orange-700 border-orange-200",
      };
    case "delivery":
      return {
        label: "Delivery",
        bg: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "unknown":
    default:
      return {
        label: "Fulfillment Unknown",
        bg: "bg-crumb-surface-alt text-crumb-muted border-crumb-border",
      };
  }
}
