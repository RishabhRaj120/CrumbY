import { describe, it, expect } from "vitest";
import {
  generateReplyDraft,
  formatProductDescription,
  formatDisplayTime,
  formatDisplayDate,
} from "@/lib/reply-draft";

describe("Deterministic Reply Draft Generator", () => {
  it("asks for missing fields when order is incomplete without confusing payment questions", () => {
    const draft = generateReplyDraft({
      customer_name: "Rohan",
      product: "chocolate cake",
      quantity: 1,
      weight: "1 kg",
      requested_date: "next week",
      resolved_date: null,
      requested_time: null,
      fulfillment_method: "unknown",
      payment_status: "not_mentioned",
      notes: [],
    });

    expect(draft).toContain("Hi Rohan!");
    expect(draft).toContain("pickup or delivery");
    expect(draft).toContain("preferred");
    expect(draft).toContain("payment");
    // Strictly must NOT ask whether the customer needs payment details
    expect(draft).not.toContain("if you need our payment details");
    expect(draft).not.toContain("payment details to secure");
  });

  it("generates a natural reply for an order awaiting availability confirmation (Hacktoberfest demo message)", () => {
    // Exact scenario from the usability bug report:
    // "Hi! I'd like one 500g red velvet cake for my daughter's birthday.
    // Please make it eggless. I'll pick it up on October 17, 2026,
    // at 6 PM. I haven't made the payment yet. Could you confirm
    // whether the order is possible?"
    const draft = generateReplyDraft({
      customer_name: null,
      product: "red velvet cake",
      quantity: 1,
      weight: "500g",
      dietary_preference: "eggless",
      requested_date: "October 17, 2026",
      resolved_date: "2026-10-17",
      requested_time: "18:00",
      fulfillment_method: "pickup",
      payment_status: "customer_reported_unpaid",
      notes: [],
    });

    expect(draft).toContain("Hi! Thanks for sharing the details.");
    expect(draft).toContain(
      "I've noted your request for one 500g eggless red velvet cake for October 17 at 6 PM."
    );
    expect(draft).toContain("I'll check availability for that slot and confirm shortly.");
    expect(draft).toContain(
      "Since the order isn't confirmed yet, I'll share payment instructions once the slot is confirmed."
    );

    // Negative assertions: safety & integrity requirements
    expect(draft).not.toContain("if you need our payment details");
    expect(draft).not.toContain("is scheduled");
    expect(draft).not.toContain("order is confirmed");
    expect(draft).not.toContain("is confirmed and scheduled");
    expect(draft).not.toContain("payment received");
    expect(draft).not.toContain("1 (500g)");
  });

  it("does not falsely claim that an order is confirmed when status is unconfirmed", () => {
    const draft = generateReplyDraft({
      customer_name: "Maya",
      product: "Red Velvet Cake",
      quantity: 1,
      weight: "500g",
      requested_date: "Sunday",
      resolved_date: "2026-10-18",
      requested_time: "18:00",
      fulfillment_method: "pickup",
      payment_status: "customer_reported_paid",
      status: "needs_review", // Not confirmed yet
      notes: [],
    });

    expect(draft).toContain("Hi Maya!");
    expect(draft).toContain("one 500g Red Velvet Cake");
    expect(draft).toContain("I'll check availability for that slot and confirm shortly.");
    expect(draft).not.toContain("is scheduled");
    expect(draft).not.toContain("is confirmed and scheduled");
  });

  it("produces a scheduled confirmation draft only when order is explicitly confirmed", () => {
    const draft = generateReplyDraft({
      customer_name: "Maya",
      product: "Red Velvet Cake",
      quantity: 1,
      weight: "500g",
      requested_date: "Sunday",
      resolved_date: "2026-10-18",
      requested_time: "18:00",
      fulfillment_method: "pickup",
      payment_status: "customer_reported_paid",
      status: "confirmed", // Explicitly confirmed by baker
      notes: [],
    });

    expect(draft).toContain("Hi Maya!");
    expect(draft).toContain("one 500g Red Velvet Cake");
    expect(draft).toContain("is confirmed and scheduled for pickup on Sunday at 6 PM");
    expect(draft).toContain("confirm the payment shortly");
  });

  it("formats quantity and weight clearly and naturally without awkward parentheses", () => {
    expect(
      formatProductDescription({
        quantity: 1,
        weight: "500g",
        dietary_preference: "eggless",
        product: "red velvet cake",
      })
    ).toBe("one 500g eggless red velvet cake");

    expect(
      formatProductDescription({
        quantity: 2,
        weight: "1 kg",
        product: "chocolate truffle cake",
      })
    ).toBe("2 1 kg chocolate truffle cake");

    expect(
      formatProductDescription({
        quantity: null,
        weight: "500g",
        dietary_preference: "vegan",
        product: "carrot cake",
      })
    ).toBe("500g vegan carrot cake");
  });

  it("handles payment information genuinely not mentioned gracefully", () => {
    const draft = generateReplyDraft({
      customer_name: "Anita",
      product: "Pineapple Cake",
      quantity: 1,
      weight: "1 kg",
      requested_date: "Saturday",
      resolved_date: "2026-10-24",
      requested_time: "15:00",
      fulfillment_method: "pickup",
      payment_status: "not_mentioned",
    });

    expect(draft).toContain("Hi Anita!");
    expect(draft).toContain("one 1 kg Pineapple Cake");
    expect(draft).toContain("I'll check availability for that slot and confirm shortly.");
    expect(draft).toContain(
      "Since the order isn't confirmed yet, I'll share payment instructions once the slot is confirmed."
    );
    expect(draft).not.toContain("if you need our payment details");
  });

  it("formats display time and date accurately", () => {
    expect(formatDisplayTime("18:00")).toBe("6 PM");
    expect(formatDisplayTime("09:30")).toBe("9:30 AM");
    expect(formatDisplayTime("12:00")).toBe("12 PM");
    expect(formatDisplayTime("6 PM")).toBe("6 PM");

    expect(formatDisplayDate("October 17, 2026", "2026-10-17")).toBe("October 17");
    expect(formatDisplayDate("Sunday", null)).toBe("Sunday");
  });
});
