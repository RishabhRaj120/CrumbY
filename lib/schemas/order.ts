import { z } from "zod";

export const fulfillmentMethodSchema = z.enum(["pickup", "delivery", "unknown"]);

export const paymentStatusSchema = z.enum([
  "customer_reported_paid",
  "customer_reported_unpaid",
  "not_mentioned",
  "unclear",
]);

export const orderStatusSchema = z.enum(["needs_review", "confirmed"]);

export const extractedOrderSchema = z.object({
  customer_name: z.string().nullable().default(null),
  product: z.string().nullable().default(null),
  quantity: z.number().nullable().default(null),
  weight: z.string().nullable().default(null),
  requested_date: z.string().nullable().default(null),
  resolved_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO YYYY-MM-DD")
    .nullable()
    .default(null),
  requested_time: z.string().nullable().default(null),
  dietary_preference: z.string().nullable().default(null),
  fulfillment_method: fulfillmentMethodSchema.default("unknown"),
  payment_amount: z.number().nullable().default(null),
  payment_currency: z.string().nullable().default(null),
  payment_method: z.string().nullable().default(null),
  payment_status: paymentStatusSchema.default("not_mentioned"),
  notes: z.array(z.string()).default([]),
  missing_or_unverified: z.array(z.string()).default([]),
  requires_confirmation: z.boolean().default(true),
});

export const orderSchema = extractedOrderSchema.extend({
  id: z.string().min(1),
  created_at: z.string().datetime().or(z.string()),
  updated_at: z.string().datetime().or(z.string()),
  status: orderStatusSchema.default("needs_review"),
  raw_message: z.string().default(""),
  is_demo: z.boolean().optional().default(false),
  baker_notes: z.string().optional().default(""),
});

export const extractRequestSchema = z.object({
  message: z
    .string({ required_error: "Message is required" })
    .min(1, "Message cannot be empty")
    .max(5000, "Message exceeds 5,000 character limit")
    .transform((val) => val.trim()),
  referenceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(), // e.g., today's date in YYYY-MM-DD for resolving relative days like 'tomorrow' or 'Sunday'
});

export type ExtractedOrderSchemaType = z.infer<typeof extractedOrderSchema>;
export type OrderSchemaType = z.infer<typeof orderSchema>;
export type ExtractRequestSchemaType = z.infer<typeof extractRequestSchema>;
