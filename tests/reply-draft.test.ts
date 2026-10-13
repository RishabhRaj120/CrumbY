import { describe, it, expect } from "vitest";
import { generateReplyDraft } from "@/lib/reply-draft";

describe("Deterministic Reply Draft Generator", () => {
  it("asks for missing fields when order is incomplete", () => {
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
  });

  it("produces a clean confirmation draft when all fields are known", () => {
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
      notes: [],
    });

    expect(draft).toContain("Hi Maya!");
    expect(draft).toContain("1 (500g) Red Velvet Cake");
    expect(draft).toContain("scheduled for pickup on 2026-10-18 at 18:00");
    expect(draft).toContain("confirm the payment shortly");
  });
});
