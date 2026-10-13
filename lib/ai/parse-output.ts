import { extractedOrderSchema, type ExtractedOrderSchemaType } from "../schemas/order";

export interface ParseResult {
  success: boolean;
  data?: ExtractedOrderSchemaType;
  error?: string;
  rawText?: string;
}

/**
 * Clean and extract JSON string from raw model text that may contain
 * markdown code blocks or surrounding text.
 */
export function extractJsonString(raw: string): string {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (markdownMatch && markdownMatch[1]) {
    cleaned = markdownMatch[1].trim();
  } else {
    // If no explicit fence, find first '{' and last '}'
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }

  return cleaned;
}

/**
 * Pre-processes and normalizes parsed JSON object before Zod validation.
 * Fixes common minor LLM output quirks like string quantities "1" -> 1.
 */
function normalizePayload(rawObj: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...rawObj };

  // Normalize quantity: if string like "1" or "2", parse to number
  if (typeof normalized.quantity === "string") {
    const parsedNum = parseFloat(normalized.quantity);
    normalized.quantity = isNaN(parsedNum) ? null : parsedNum;
  }

  // Normalize payment_amount: if string "$1200" or "1200", extract number
  if (typeof normalized.payment_amount === "string") {
    const cleanNum = (normalized.payment_amount as string).replace(/[^0-9.]/g, "");
    const parsedNum = parseFloat(cleanNum);
    normalized.payment_amount = isNaN(parsedNum) ? null : parsedNum;
  }

  // Normalize string fields: convert empty strings or "null" strings to null
  const stringFields = [
    "customer_name",
    "product",
    "weight",
    "requested_date",
    "requested_time",
    "dietary_preference",
    "payment_currency",
    "payment_method",
  ];
  for (const field of stringFields) {
    const val = typeof normalized[field] === "string" ? (normalized[field] as string).toLowerCase().trim() : null;
    if (
      val === "" ||
      val === "null" ||
      val === "undefined" ||
      val === "unknown" ||
      val === "none" ||
      val === "n/a"
    ) {
      normalized[field] = null;
    }
  }

  // Normalize resolved_date: MUST be valid YYYY-MM-DD or null
  if (typeof normalized.resolved_date === "string") {
    const trimmedDate = normalized.resolved_date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      normalized.resolved_date = trimmedDate;
    } else {
      // If model put non-ISO string like "Sunday" into resolved_date, preserve in requested_date if needed
      if (!normalized.requested_date && trimmedDate && trimmedDate !== "null") {
        normalized.requested_date = trimmedDate;
      }
      normalized.resolved_date = null;
    }
  } else {
    normalized.resolved_date = null;
  }

  // Strict Invariant: NEVER allow verified payment status from extraction
  const allowedStatuses = [
    "customer_reported_paid",
    "customer_reported_unpaid",
    "not_mentioned",
    "unclear",
  ];
  if (
    !normalized.payment_status ||
    !allowedStatuses.includes(String(normalized.payment_status))
  ) {
    normalized.payment_status = "not_mentioned";
  }

  // Ensure notes and missing_or_unverified are arrays
  if (!Array.isArray(normalized.notes)) {
    normalized.notes = typeof normalized.notes === "string" ? [normalized.notes] : [];
  }
  if (!Array.isArray(normalized.missing_or_unverified)) {
    normalized.missing_or_unverified =
      typeof normalized.missing_or_unverified === "string"
        ? [normalized.missing_or_unverified]
        : [];
  }

  // Ensure fulfillment_method is valid
  const allowedFulfillment = ["pickup", "delivery", "unknown"];
  if (
    !normalized.fulfillment_method ||
    !allowedFulfillment.includes(String(normalized.fulfillment_method))
  ) {
    normalized.fulfillment_method = "unknown";
  }

  // Guardrail: Do NOT let cake weight (e.g., 500g) be interpreted as quantity (500)
  if (typeof normalized.quantity === "number" && normalized.quantity > 30) {
    if (typeof normalized.weight === "string" && normalized.weight.includes(String(normalized.quantity))) {
      normalized.quantity = null;
    }
  }

  // Guardrail: Do NOT let payment amount (e.g. 1000) be interpreted as quantity
  if (
    typeof normalized.quantity === "number" &&
    typeof normalized.payment_amount === "number" &&
    normalized.quantity === normalized.payment_amount &&
    normalized.quantity >= 50
  ) {
    normalized.quantity = null;
  }

  // Auto-flag missing essential details if model left missing_or_unverified empty
  const missing = normalized.missing_or_unverified as string[];
  if (!normalized.product && !missing.some((m) => m.toLowerCase().includes("product") || m.toLowerCase().includes("flavor"))) {
    missing.push("Exact cake flavor / product");
  }
  if (!normalized.resolved_date && !missing.some((m) => m.toLowerCase().includes("date"))) {
    missing.push("Exact calendar date");
  }
  if (!normalized.requested_time && !missing.some((m) => m.toLowerCase().includes("time"))) {
    missing.push("Pickup/delivery time window");
  }
  if (normalized.fulfillment_method === "unknown" && !missing.some((m) => m.toLowerCase().includes("fulfillment") || m.toLowerCase().includes("pickup"))) {
    missing.push("Pickup or delivery method");
  }
  if (normalized.payment_status === "not_mentioned" || normalized.payment_status === "unclear" || normalized.payment_status === "customer_reported_unpaid") {
    if (!missing.some((m) => m.toLowerCase().includes("payment"))) {
      missing.push("Payment confirmation");
    }
  }

  if (missing.length > 0) {
    normalized.requires_confirmation = true;
  }

  return normalized;
}

/**
 * Conservative parser for Gemma 3 4B extraction output.
 * Uses Zod validation to ensure data integrity.
 */
export function parseGemmaOutput(rawText: string): ParseResult {
  if (!rawText || !rawText.trim()) {
    return {
      success: false,
      error: "Extraction output from model was empty.",
      rawText,
    };
  }

  const jsonString = extractJsonString(rawText);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonString);
  } catch (err: unknown) {
    return {
      success: false,
      error: `Failed to parse model response as JSON: ${err instanceof Error ? err.message : "Malformed JSON syntax"}`,
      rawText,
    };
  }

  if (typeof parsedJson !== "object" || parsedJson === null) {
    return {
      success: false,
      error: "Model output was not a valid JSON object.",
      rawText,
    };
  }

  const normalized = normalizePayload(parsedJson as Record<string, unknown>);
  const validation = extractedOrderSchema.safeParse(normalized);

  if (!validation.success) {
    const errorDetails = validation.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    return {
      success: false,
      error: `Extracted data failed validation: ${errorDetails}`,
      rawText,
    };
  }

  return {
    success: true,
    data: validation.data,
    rawText,
  };
}
