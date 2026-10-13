export type FulfillmentMethod = "pickup" | "delivery" | "unknown";

export type PaymentStatus =
  | "customer_reported_paid"
  | "customer_reported_unpaid"
  | "not_mentioned"
  | "unclear";

export type OrderStatus = "needs_review" | "confirmed";

/**
 * Raw structured extraction payload returned by Gemma 3 / Ollama
 */
export interface ExtractedOrderPayload {
  customer_name: string | null;
  product: string | null;
  quantity: number | null;
  weight: string | null;
  requested_date: string | null;
  resolved_date: string | null; // ISO YYYY-MM-DD or null
  requested_time: string | null; // HH:mm or original phrase or null
  dietary_preference: string | null; // eggless, vegan, etc.
  fulfillment_method: FulfillmentMethod;
  payment_amount: number | null;
  payment_currency: string | null; // INR, USD, etc.
  payment_method: string | null; // GPay, UPI, cash, etc.
  payment_status: PaymentStatus;
  notes: string[];
  missing_or_unverified: string[];
  requires_confirmation: boolean;
}

/**
 * Full Order record persisted in CrumbDesk
 */
export interface Order extends ExtractedOrderPayload {
  id: string;
  created_at: string;
  updated_at: string;
  status: OrderStatus;
  raw_message: string;
  is_demo?: boolean;
  baker_notes?: string;
}

export type OrderFilterStatus = "all" | OrderStatus;
export type OrderFilterPayment = "all" | PaymentStatus;
export type OrderFilterFulfillment = "all" | FulfillmentMethod;

export interface DashboardStats {
  totalOrders: number;
  needsReview: number;
  confirmed: number;
  upcomingFulfillments: number;
}
