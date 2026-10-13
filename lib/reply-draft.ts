import { Order, ExtractedOrderPayload } from "@/types/order";

/**
 * Deterministically generates a polite customer reply message
 * requesting missing details or confirming reviewed details.
 * Avoids any unnecessary AI model calls.
 */
export function generateReplyDraft(order: Partial<Order | ExtractedOrderPayload>): string {
  const customerGreeting = order.customer_name
    ? `Hi ${order.customer_name}!`
    : "Hi there!";

  const productDescription = [
    order.quantity ? `${order.quantity}` : null,
    order.weight ? `(${order.weight})` : null,
    order.product ? order.product : "order",
  ]
    .filter(Boolean)
    .join(" ");

  const missingQuestions: string[] = [];

  // Check specific missing fields
  if (!order.product) {
    missingQuestions.push("what flavor or type of bake you'd like");
  }

  if (order.fulfillment_method === "unknown") {
    missingQuestions.push("whether you'd prefer pickup or delivery");
  }

  if (!order.resolved_date && (!order.requested_date || order.requested_date.toLowerCase().includes("next week") || order.requested_date.toLowerCase().includes("soon"))) {
    missingQuestions.push("the exact calendar date needed");
  } else if (!order.resolved_date && order.requested_date) {
    missingQuestions.push(`confirmation on the exact date for "${order.requested_date}"`);
  }

  if (!order.requested_time) {
    missingQuestions.push(
      order.fulfillment_method === "delivery"
        ? "your preferred delivery time window"
        : "your preferred pickup time"
    );
  }

  if (order.fulfillment_method === "delivery" && (!order.notes || !order.notes.some(n => n.toLowerCase().includes("indiranagar") || n.toLowerCase().includes("address")))) {
    missingQuestions.push("the full delivery address and contact number");
  }

  if (order.payment_status === "not_mentioned") {
    if (order.payment_amount) {
      missingQuestions.push(`if you'd like to pay the ${order.payment_currency || "₹"}${order.payment_amount} now via UPI/GPay`);
    } else {
      missingQuestions.push("if you need our payment details to secure the order slot");
    }
  } else if (order.payment_status === "customer_reported_paid") {
    // Acknowledge reported payment with safe verification wording
    // Do NOT claim it's already verified if baker hasn't confirmed
  }

  // Build the message body
  let message = `${customerGreeting} Thanks for reaching out to us!\n\n`;

  if (order.product) {
    message += `We've noted your interest in the ${productDescription}.\n\n`;
  }

  if (missingQuestions.length > 0) {
    message += "Could you please confirm:\n";
    missingQuestions.forEach((q, i) => {
      message += `${i + 1}. ${q.charAt(0).toUpperCase() + q.slice(1)}?\n`;
    });
    message += "\nOnce we have these details, we'll lock in your order and get baking!";
  } else {
    // All essential details are accounted for
    const timing = order.requested_time ? ` at ${order.requested_time}` : "";
    const dateStr = order.resolved_date || order.requested_date || "your date";
    const fulfillmentStr =
      order.fulfillment_method === "delivery"
        ? "delivery"
        : order.fulfillment_method === "pickup"
        ? "pickup"
        : "order";

    message += `Your ${productDescription} is scheduled for ${fulfillmentStr} on ${dateStr}${timing}.\n\n`;
    if (order.payment_status === "customer_reported_paid") {
      message += "We'll check our account and confirm the payment shortly. Looking forward to baking for you!";
    } else {
      message += "Please let us know if you need anything else!";
    }
  }

  return message.trim();
}
