import { extractedOrderSchema, type ExtractedOrderSchemaType } from "../schemas/order";
import { normalizeWeightValue } from "../change-policy";

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
 * Detects whether the customer message contains an explicit statement
 * that payment has not yet been made or will be made later.
 */
export function isExplicitlyUnpaidMessage(message: string): boolean {
  if (!message || typeof message !== "string") return false;
  const msg = message.toLowerCase();

  // Pattern 1: Negative payment action (haven't / have not / didn't / not / yet to) + (paid / made payment / sent payment / transferred / done payment)
  const negativePaid =
    /\b(?:have\s+not|haven'?t|has\s+not|hasn'?t|did\s+not|didn'?t|had\s+not|hadn'?t|not|yet\s+to)\s+(?:yet\s+)?paid\b/i.test(msg) ||
    /\bnot\s+paid\s+yet\b/i.test(msg) ||
    /\byet\s+to\s+pay\b/i.test(msg) ||
    /\b(?:have\s+not|haven'?t|has\s+not|hasn'?t|did\s+not|didn'?t|not|yet\s+to)\s+(?:yet\s+)?(?:make|made|do|done|completed?|given?)\s+(?:the\s+|any\s+|a\s+)?pay(?:ment)?\b/i.test(msg) ||
    /\b(?:have\s+not|haven'?t|has\s+not|hasn'?t|did\s+not|didn'?t|not|yet\s+to)\s+(?:yet\s+)?(?:send|sent|transfer|transferred)\s+(?:the\s+|any\s+)?(?:pay(?:ment)?|money|amount|advance)\b/i.test(msg) ||
    /\b(?:have\s+not|haven'?t|did\s+not|didn'?t)\s+(?:send|sent|transfer|transferred)\s+(?:it|anything)\s+yet\b/i.test(msg);

  // Pattern 2: Future payment intent (will pay later, pay later, will send later, pay on pickup)
  const futurePay =
    /\b(?:i'?ll|i\s+will|will|shall|can|to)\s+pay\s+(?:later|afterwards|after|on\s+pickup|on\s+delivery|at\s+pickup|upon\s+pickup|upon\s+delivery)\b/i.test(msg) ||
    /\bpay(?:ing)?\s+later\b/i.test(msg) ||
    /\b(?:i'?ll|i\s+will|will|shall)\s+send\s+(?:(?:the\s+)?pay(?:ment)?|\d+|it)?\s*later\b/i.test(msg);

  // Pattern 3: Passive payment status (payment not made / not done / pending)
  const passivePending =
    /\bpay(?:ment)?\s+(?:is\s+)?(?:not\s+(?:made|done|sent|completed)|pending|due|yet\s+to\s+be\s+made)\b/i.test(msg) ||
    /\bhasn'?t\s+been\s+paid\b/i.test(msg);

  return negativePaid || futurePay || passivePending;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const daysInMonth = [0, 31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month];
}

function formatIsoDate(year: number, month: number, day: number): string {
  const y = String(year);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Resolves an explicitly stated, unambiguous calendar date into an ISO date string "YYYY-MM-DD".
 * Supports formats such as:
 * - "October 17, 2026", "October 17th, 2026", "Oct 17 2026", "Oct. 17, 2026"
 * - "17 October 2026", "17th October 2026", "17th of October, 2026", "17-Oct-2026"
 * - "2026-10-17", "2026/10/17"
 *
 * Returns null for relative or ambiguous expressions (e.g. "Sunday", "next week", "tomorrow", "this weekend")
 * or expressions without a specific year or month.
 * Formats strings directly without Date.toISOString() to guarantee zero timezone shifts.
 */
export function resolveExplicitCalendarDate(text: string | null | undefined): string | null {
  if (!text || typeof text !== "string") {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Check ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      return formatIsoDate(year, month, day);
    }
  }

  // 2. Pattern: Month Day Year (e.g. "October 17, 2026", "October 17th, 2026", "Oct 17 2026")
  const mdyMatch = trimmed.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})\b/i
  );
  if (mdyMatch) {
    const monthKey = mdyMatch[1].toLowerCase();
    const month = MONTH_NAMES[monthKey];
    const day = parseInt(mdyMatch[2], 10);
    const year = parseInt(mdyMatch[3], 10);
    if (month && isValidCalendarDate(year, month, day)) {
      return formatIsoDate(year, month, day);
    }
  }

  // 3. Pattern: Day Month Year (e.g. "17 October 2026", "17th October 2026", "17th of October, 2026", "17-Oct-2026")
  const dmyMatch = trimmed.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?[\s-]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?(?:,)?[\s-]+(\d{4})\b/i
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthKey = dmyMatch[2].toLowerCase();
    const month = MONTH_NAMES[monthKey];
    const year = parseInt(dmyMatch[3], 10);
    if (month && isValidCalendarDate(year, month, day)) {
      return formatIsoDate(year, month, day);
    }
  }

  return null;
}

/**
 * Pre-processes and normalizes parsed JSON object before Zod validation.
 * Fixes common minor LLM output quirks like string quantities "1" -> 1.
 */
function normalizePayload(
  rawObj: Record<string, unknown>,
  customerMessage?: string
): Record<string, unknown> {
  const normalized = { ...rawObj };

  // Normalize quantity: if string like "1" or "2", parse to number
  if (typeof normalized.quantity === "string") {
    const parsedNum = parseFloat(normalized.quantity);
    normalized.quantity = isNaN(parsedNum) ? null : parsedNum;
  }

  // Normalize payment_amount: if string "$1200" or "1200", extract number
  if (typeof normalized.payment_amount === "string") {
    const trimmedAmount = (normalized.payment_amount as string).trim();
    if (trimmedAmount.startsWith("-")) {
      // Discard negative string numbers
      normalized.payment_amount = null;
    } else {
      const cleanNum = trimmedAmount.replace(/[^0-9.]/g, "");
      const parsedNum = parseFloat(cleanNum);
      normalized.payment_amount = isNaN(parsedNum) ? null : parsedNum;
    }
  }

  // Reject negative, non-finite or NaN payment amounts
  if (typeof normalized.payment_amount === "number") {
    if (
      isNaN(normalized.payment_amount) ||
      !isFinite(normalized.payment_amount) ||
      normalized.payment_amount < 0
    ) {
      normalized.payment_amount = null;
    }
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

  // Normalize weight: if model returned a bare number like "1000", convert to explicit units like "1kg"
  if (typeof normalized.weight === "string") {
    const trimmedWeight = (normalized.weight as string).trim();
    if (/^\d+(?:\.\d+)?$/.test(trimmedWeight)) {
      normalized.weight = normalizeWeightValue(trimmedWeight);
    }
  }

  // Invariant: PAYMENT RULES
  // 1. If customer message does NOT mention payment, payment MUST be null / not_mentioned
  if (customerMessage) {
    const hasPaymentMention = /\b(pa(?:id|y(?:ing|ment|s)?)|sen[dt](?:ing)?|advance|deposit|upi|gpay|google\s*pay|phonepe|paytm|cash|cod|transfer|bank|rs\.?|inr|₹|dollars?|\$|euros?|€|bucks|cost|price|bill|due|balance)\b/i.test(
      customerMessage
    );

    if (!hasPaymentMention) {
      normalized.payment_amount = null;
      normalized.payment_currency = null;
      normalized.payment_method = null;
      normalized.payment_status = "not_mentioned";
    } else {
      // If customer explicitly states they haven't paid or will pay later:
      if (isExplicitlyUnpaidMessage(customerMessage)) {
        normalized.payment_status = "customer_reported_unpaid";
      }

      // If payment was mentioned, ensure payment_method wasn't hallucinated (e.g. "Cash" for pickup)
      if (normalized.payment_method) {
        const methodStr = String(normalized.payment_method).toLowerCase();
        const msgLower = customerMessage.toLowerCase();
        let methodFound = false;

        if (methodStr.includes("cash") && /\bcash\b/i.test(msgLower)) {
          methodFound = true;
        } else if (
          (methodStr.includes("gpay") || methodStr.includes("google")) &&
          /\b(gpay|google\s*pay)\b/i.test(msgLower)
        ) {
          methodFound = true;
        } else if (methodStr.includes("upi") && /\bupi\b/i.test(msgLower)) {
          methodFound = true;
        } else if (methodStr.includes("phonepe") && /\bphone\s*pe\b/i.test(msgLower)) {
          methodFound = true;
        } else if (methodStr.includes("paytm") && /\bpaytm\b/i.test(msgLower)) {
          methodFound = true;
        } else if (methodStr.includes("card") && /\b(card|credit|debit)\b/i.test(msgLower)) {
          methodFound = true;
        } else if (
          (methodStr.includes("transfer") || methodStr.includes("bank")) &&
          /\b(transfer|bank|neft|rtgs|imps)\b/i.test(msgLower)
        ) {
          methodFound = true;
        } else if (msgLower.includes(methodStr)) {
          methodFound = true;
        }

        if (!methodFound) {
          normalized.payment_method = null;
        }
      }

      // Guardrail: Ensure payment_amount is supported by customer message and not confused with weight, date, or time
      if (typeof normalized.payment_amount === "number") {
        const amtStr = String(normalized.payment_amount);
        const paymentAmountRegex = new RegExp(
          `(?:(?:₹|rs\\.?|inr|\\$|€|bucks|rupees|amount|pay(?:ment)?|advance|deposit|send|sent|paid)\\s*[:=-]?\\s*${amtStr}\\b|\\b${amtStr}\\s*(?:₹|rs\\.?|inr|\\$|€|bucks|rupees|advance|deposit|later))`,
          "i"
        );
        const hasPaymentContext = paymentAmountRegex.test(customerMessage);

        if (!hasPaymentContext) {
          const isWeightNumber = typeof normalized.weight === "string" && normalized.weight.includes(amtStr);
          const isYearNumber = normalized.payment_amount >= 2020 && normalized.payment_amount <= 2100;
          const isDateNumber = typeof normalized.requested_date === "string" && new RegExp(`\\b${amtStr}\\b`).test(normalized.requested_date);
          const isTimeNumber = typeof normalized.requested_time === "string" && normalized.requested_time.includes(amtStr);
          const isExplicitUnpaid = isExplicitlyUnpaidMessage(customerMessage);

          if (isWeightNumber || isYearNumber || isDateNumber || isTimeNumber || isExplicitUnpaid) {
            normalized.payment_amount = null;
          }
        }
      }
    }
  }

  // Date resolution:
  // Normalize resolved_date: MUST be valid YYYY-MM-DD or null
  let resolved: string | null = null;
  if (typeof normalized.resolved_date === "string") {
    resolved = resolveExplicitCalendarDate(normalized.resolved_date);
  }

  // If resolved_date is not yet determined, check requested_date for explicit calendar date
  if (!resolved && typeof normalized.requested_date === "string") {
    resolved = resolveExplicitCalendarDate(normalized.requested_date);
  }

  // If still not determined, check the raw customer message for explicit calendar date
  if (!resolved && customerMessage) {
    resolved = resolveExplicitCalendarDate(customerMessage);
  }

  normalized.resolved_date = resolved;

  // Preserve customer's wording for requested_date if model placed it in resolved_date
  if (!normalized.requested_date && typeof rawObj.resolved_date === "string" && !resolved) {
    const rawVal = (rawObj.resolved_date as string).trim();
    if (rawVal && rawVal !== "null" && rawVal !== "undefined") {
      normalized.requested_date = rawVal;
    }
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

  // Invariant: fulfillment_method MUST be "unknown" unless the customer explicitly states pickup or delivery
  if (
    customerMessage &&
    (normalized.fulfillment_method === "pickup" || normalized.fulfillment_method === "delivery")
  ) {
    const hasExplicitPickup = /\b(pick(?:ing)?\s*(?:it\s*|them\s*)?up|pick-?up|collect(?:ing|ion|ed|s)?|carryout|takeaway)\b/i.test(
      customerMessage
    );
    const hasExplicitDelivery = /\b(deliver(?:ed|y|ing|s)?|drop\s*off|ship(?:ping)?|courier|send\s+to|address)\b/i.test(
      customerMessage
    );

    if (normalized.fulfillment_method === "pickup" && !hasExplicitPickup) {
      normalized.fulfillment_method = "unknown";
    } else if (normalized.fulfillment_method === "delivery" && !hasExplicitDelivery) {
      normalized.fulfillment_method = "unknown";
    }
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
  let missing = normalized.missing_or_unverified as string[];
  if (!normalized.product && !missing.some((m) => m.toLowerCase().includes("product") || m.toLowerCase().includes("flavor"))) {
    missing.push("Exact cake flavor / product");
  }
  if (!normalized.resolved_date && !missing.some((m) => m.toLowerCase().includes("date"))) {
    missing.push("Exact calendar date");
  } else if (normalized.resolved_date) {
    // If resolved_date is successfully established, ensure "Exact calendar date" is not falsely flagged
    missing = missing.filter(
      (m) =>
        !/^(?:exact\s+)?calendar\s+date$/i.test(m.trim()) &&
        !/^exact\s+date$/i.test(m.trim())
    );
  }
  if (!normalized.requested_time && !missing.some((m) => m.toLowerCase().includes("time"))) {
    missing.push("Pickup/delivery time window");
  }
  if (
    normalized.fulfillment_method === "unknown" &&
    !missing.some((m) => m.toLowerCase().includes("fulfillment") || m.toLowerCase().includes("pickup or delivery"))
  ) {
    missing.push("Pickup or delivery method");
  }
  if (normalized.payment_status === "not_mentioned" || normalized.payment_status === "unclear" || normalized.payment_status === "customer_reported_unpaid") {
    if (!missing.some((m) => m.toLowerCase().includes("payment"))) {
      missing.push("Payment confirmation");
    }
  }

  normalized.missing_or_unverified = missing;

  if (missing.length > 0) {
    normalized.requires_confirmation = true;
  }

  return normalized;
}

/**
 * Conservative parser for Gemma 3 4B extraction output.
 * Uses Zod validation to ensure data integrity.
 */
export function parseGemmaOutput(rawText: string, customerMessage?: string): ParseResult {
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

  const normalized = normalizePayload(parsedJson as Record<string, unknown>, customerMessage);
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
