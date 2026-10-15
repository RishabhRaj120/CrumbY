import { Order, ExtractedOrderPayload } from "@/types/order";
import { formatDate } from "./utils";

/**
 * Formats a 24-hour time string ("18:00") into friendly 12-hour format ("6 PM").
 * Returns original text if already formatted or non-standard.
 */
export function formatDisplayTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    if (hours >= 0 && hours <= 24) {
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return minutes === "00" ? `${hours} ${ampm}` : `${hours}:${minutes} ${ampm}`;
    }
  }
  return timeStr;
}

/**
 * Formats calendar date into a natural conversational expression.
 * Prefers human-friendly month and day (e.g. "October 17" from "October 17, 2026").
 */
export function formatDisplayDate(
  requestedDate: string | null | undefined,
  resolvedDate: string | null | undefined
): string {
  if (requestedDate) {
    const m = requestedDate.match(/^([a-zA-Z]+\s+\d{1,2}(?:st|nd|rd|th)?)(?:,\s*\d{4})?$/);
    if (m) {
      return m[1];
    }
    return requestedDate;
  }
  if (resolvedDate) {
    return formatDate(resolvedDate);
  }
  return "your requested date";
}

/**
 * Formats the product description with clear, natural quantity, weight, and dietary phrasing
 * without awkward parentheses (e.g. "one 500g eggless red velvet cake").
 */
export function formatProductDescription(
  order: Partial<Order | ExtractedOrderPayload>
): string {
  const parts: string[] = [];

  // Quantity
  if (order.quantity !== null && order.quantity !== undefined) {
    if (order.quantity === 1) {
      parts.push("one");
    } else {
      parts.push(String(order.quantity));
    }
  }

  // Weight
  if (order.weight) {
    const trimmedWeight = order.weight.trim();
    if (!order.product?.toLowerCase().includes(trimmedWeight.toLowerCase())) {
      parts.push(trimmedWeight);
    }
  }

  // Dietary preference
  if (order.dietary_preference) {
    const trimmedDietary = order.dietary_preference.trim();
    if (!order.product?.toLowerCase().includes(trimmedDietary.toLowerCase())) {
      parts.push(trimmedDietary);
    }
  }

  // Product
  if (order.product) {
    parts.push(order.product.trim());
  } else {
    parts.push("order");
  }

  return parts.join(" ");
}

/**
 * Deterministically generates a polite, natural, editable customer reply draft.
 * - Does not ask if the customer needs payment details.
 * - Does not claim payment was received.
 * - Does not claim the order is confirmed unless explicitly established.
 * - Does not promise availability unless explicitly established.
 * - Preserves quantity and weight units clearly.
 */
export function generateReplyDraft(
  order: Partial<Order | ExtractedOrderPayload>
): string {
  const customerGreeting = order.customer_name
    ? `Hi ${order.customer_name}!`
    : "Hi!";

  const productDescription = formatProductDescription(order);
  const isConfirmed = "status" in order && order.status === "confirmed";

  const missingQuestions: string[] = [];

  // Check specific missing fields
  if (!order.product) {
    missingQuestions.push("what flavor or type of bake you'd like");
  }

  if (order.fulfillment_method === "unknown") {
    missingQuestions.push("whether you'd prefer pickup or delivery");
  }

  if (
    !order.resolved_date &&
    (!order.requested_date ||
      order.requested_date.toLowerCase().includes("next week") ||
      order.requested_date.toLowerCase().includes("soon"))
  ) {
    missingQuestions.push("the exact calendar date needed");
  } else if (!order.resolved_date && order.requested_date) {
    missingQuestions.push(
      `confirmation on the exact date for "${order.requested_date}"`
    );
  }

  if (!order.requested_time) {
    if (order.fulfillment_method === "delivery") {
      missingQuestions.push("your preferred delivery time window");
    } else if (order.fulfillment_method === "pickup") {
      missingQuestions.push("your preferred pickup time");
    } else {
      missingQuestions.push("your preferred pickup or delivery time");
    }
  }

  if (
    order.fulfillment_method === "delivery" &&
    (!order.notes ||
      !order.notes.some(
        (n) =>
          n.toLowerCase().includes("indiranagar") ||
          n.toLowerCase().includes("address")
      ))
  ) {
    missingQuestions.push("the full delivery address and contact number");
  }

  // Note: NEVER ask the customer whether they need payment details.
  // Payment instructions are provided once slot/order is confirmed.

  // Build the message body
  let message = "";

  if (missingQuestions.length > 0) {
    message = `${customerGreeting} Thanks for reaching out to us!\n\n`;
    if (order.product) {
      message += `I've noted your request for ${productDescription}.\n\n`;
    }
    message += "Could you please confirm:\n";
    missingQuestions.forEach((q, i) => {
      message += `${i + 1}. ${q.charAt(0).toUpperCase() + q.slice(1)}?\n`;
    });
    message +=
      "\nOnce we have these details, I'll check availability for your slot and share payment instructions once confirmed.";
    return message.trim();
  }

  // All essential specifications are accounted for
  const timeStr = formatDisplayTime(order.requested_time);
  const dateStr = formatDisplayDate(order.requested_date, order.resolved_date);
  const timing = timeStr ? ` at ${timeStr}` : "";
  const fulfillmentPhrase =
    order.fulfillment_method === "delivery"
      ? `for delivery on ${dateStr}${timing}`
      : `for ${dateStr}${timing}`;

  if (isConfirmed) {
    const fulfillmentMethodStr =
      order.fulfillment_method === "delivery"
        ? "delivery"
        : order.fulfillment_method === "pickup"
        ? "pickup"
        : "order";

    message = `${customerGreeting} Thanks for reaching out to us!\n\n`;
    message += `Your ${productDescription} is confirmed and scheduled for ${fulfillmentMethodStr} on ${dateStr}${timing}.\n\n`;

    if (order.payment_status === "customer_reported_paid") {
      message +=
        "We'll check our account and confirm the payment shortly. Looking forward to baking for you!";
    } else if (order.payment_status === "customer_reported_unpaid") {
      message +=
        "Please let us know once you're ready to complete the payment. Looking forward to baking for you!";
    } else {
      message += "Please let us know if you need anything else!";
    }
  } else {
    // Unconfirmed request awaiting availability check
    message = `${customerGreeting} Thanks for sharing the details. I've noted your request for ${productDescription} ${fulfillmentPhrase}.\n\n`;
    message += "I'll check availability for that slot and confirm shortly.\n";

    if (order.payment_status === "customer_reported_paid") {
      message +=
        "I've also noted your payment submission and will verify it once the slot is confirmed.";
    } else {
      message +=
        "Since the order isn't confirmed yet, I'll share payment instructions once the slot is confirmed.";
    }
  }

  return message.trim();
}
