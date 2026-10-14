export type FulfillmentMethod = "pickup" | "delivery" | "unknown";

export type PaymentStatus =
  | "customer_reported_paid"
  | "customer_reported_unpaid"
  | "not_mentioned"
  | "unclear";

export type OrderStatus =
  | "needs_review"
  | "confirmed"
  | "in_preparation"
  | "ready"
  | "completed"
  | "cancelled";

export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export type DeadlineEvaluationStatus =
  | "within_window"
  | "past_deadline"
  | "prep_started"
  | "ready"
  | "unresolved_schedule"
  | "terminal";

export interface FieldChange<T = unknown> {
  field: string;
  field_label: string;
  old_value: T;
  new_value: T;
}

export interface ChangeRequest {
  id: string;
  order_id: string;
  created_at: string; // ISO
  status: ChangeRequestStatus;
  proposed_changes: Partial<ExtractedOrderPayload>;
  original_values: Partial<ExtractedOrderPayload>;
  request_notes?: string;
  deadline_status_at_request: DeadlineEvaluationStatus;
  deadline_at_request: string | null; // ISO
  decided_at?: string | null;
  decision_reason?: string | null;
  is_exception?: boolean;
}

export type OrderHistoryEventType =
  | "order_created"
  | "order_confirmed"
  | "preparation_started"
  | "order_ready"
  | "order_completed"
  | "order_cancelled"
  | "change_requested"
  | "change_approved"
  | "change_rejected"
  | "exception_approved"
  | "baker_note_updated";

export interface OrderHistoryEvent {
  id: string;
  timestamp: string; // ISO
  type: OrderHistoryEventType;
  summary: string;
  actor?: "baker" | "system";
  change_request_id?: string;
  reason?: string;
  field_changes?: FieldChange[];
}

export interface OrderPolicySettings {
  cutoff_hours: number; // default 24
}

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
  // Phase 10 Change Control additions
  preparation_started_at?: string | null;
  cancellation_reason?: string | null;
  change_requests?: ChangeRequest[];
  history?: OrderHistoryEvent[];
}

export type OrderFilterStatus = "all" | OrderStatus;
export type OrderFilterPayment = "all" | PaymentStatus;
export type OrderFilterFulfillment = "all" | FulfillmentMethod;

export interface DashboardStats {
  totalOrders: number;
  needsReview: number;
  confirmed: number;
  inPreparation?: number;
  ready?: number;
  completed?: number;
  cancelled?: number;
  pendingChanges?: number;
  upcomingFulfillments: number;
}
