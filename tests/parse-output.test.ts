import { describe, it, expect } from "vitest";
import { parseGemmaOutput, extractJsonString } from "@/lib/ai/parse-output";

describe("Gemma 3 4B Output Parsing & Invariants", () => {
  // TEST A: COMPLETE ORDER
  it("TEST A: properly validates complete order payload", () => {
    const rawModelJson = JSON.stringify({
      customer_name: null,
      product: "chocolate truffle cake",
      quantity: 1,
      weight: "1 kg",
      requested_date: "Sunday",
      resolved_date: null,
      requested_time: "18:00",
      dietary_preference: "eggless",
      fulfillment_method: "pickup",
      payment_amount: 1200,
      payment_currency: "INR",
      payment_method: "GPay",
      payment_status: "customer_reported_paid",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: false,
    });

    const result = parseGemmaOutput(rawModelJson);
    expect(result.success).toBe(true);
    expect(result.data?.product).toBe("chocolate truffle cake");
    expect(result.data?.quantity).toBe(1);
    expect(result.data?.weight).toBe("1 kg");
    expect(result.data?.requested_date).toBe("Sunday");
    expect(result.data?.resolved_date).toBeNull();
    expect(result.data?.requested_time).toBe("18:00");
    expect(result.data?.dietary_preference).toBe("eggless");
    expect(result.data?.fulfillment_method).toBe("pickup");
    expect(result.data?.payment_amount).toBe(1200);
    expect(result.data?.payment_method).toBe("GPay");
    expect(result.data?.payment_status).toBe("customer_reported_paid");
  });

  // TEST B: INCOMPLETE ORDER
  it("TEST B: preserves nulls and flags missing information without inventing", () => {
    const rawModelJson = JSON.stringify({
      customer_name: null,
      product: "cake",
      quantity: null,
      weight: null,
      requested_date: "next week",
      resolved_date: null,
      requested_time: null,
      dietary_preference: null,
      fulfillment_method: "unknown",
      payment_amount: null,
      payment_currency: null,
      payment_method: null,
      payment_status: "not_mentioned",
      notes: ["for birthday"],
      missing_or_unverified: [
        "Exact cake flavor / design",
        "Quantity and weight",
        "Exact calendar date",
        "Pickup or delivery preference",
      ],
      requires_confirmation: true,
    });

    const result = parseGemmaOutput(rawModelJson);
    expect(result.success).toBe(true);
    expect(result.data?.quantity).toBeNull();
    expect(result.data?.weight).toBeNull();
    expect(result.data?.resolved_date).toBeNull();
    expect(result.data?.payment_amount).toBeNull();
    expect(result.data?.missing_or_unverified.length).toBeGreaterThan(0);
    expect(result.data?.requires_confirmation).toBe(true);
  });

  // TEST C: AMBIGUOUS PAYMENT
  it("TEST C: handles ambiguous or future payment statements safely", () => {
    const rawModelJson = JSON.stringify({
      customer_name: null,
      product: "chocolate cake",
      quantity: null,
      weight: null,
      requested_date: "Saturday",
      resolved_date: null,
      requested_time: null,
      dietary_preference: null,
      fulfillment_method: "unknown",
      payment_amount: 1000,
      payment_currency: "INR",
      payment_method: null,
      payment_status: "customer_reported_unpaid",
      notes: ["will send later"],
      missing_or_unverified: ["Payment not completed", "Fulfillment method"],
      requires_confirmation: true,
    });

    const result = parseGemmaOutput(rawModelJson);
    expect(result.success).toBe(true);
    expect(result.data?.payment_amount).toBe(1000);
    expect(result.data?.payment_status).toBe("customer_reported_unpaid");
    expect(result.data?.payment_status).not.toBe("customer_reported_paid");
  });

  // TEST D: DIETARY RESTRICTION & WEIGHT PRESERVATION
  it("TEST D: preserves weight and dietary preference without hallucinating quantity", () => {
    const rawModelJson = JSON.stringify({
      customer_name: null,
      product: "red velvet cake",
      quantity: null,
      weight: "500g",
      requested_date: "Friday",
      resolved_date: null,
      requested_time: null,
      dietary_preference: "eggless",
      fulfillment_method: "pickup",
      payment_amount: null,
      payment_currency: null,
      payment_method: null,
      payment_status: "not_mentioned",
      notes: [],
      missing_or_unverified: ["Exact calendar date", "Pickup time"],
      requires_confirmation: true,
    });

    const result = parseGemmaOutput(rawModelJson);
    expect(result.success).toBe(true);
    expect(result.data?.product).toBe("red velvet cake");
    expect(result.data?.weight).toBe("500g");
    expect(result.data?.quantity).toBeNull();
    expect(result.data?.dietary_preference).toBe("eggless");
    expect(result.data?.fulfillment_method).toBe("pickup");
  });

  // TEST E: MALFORMED MODEL OUTPUT
  it("TEST E: handles malformed JSON without crashing and returns descriptive error", () => {
    const malformedOutputs = [
      "",
      "This is not JSON at all, sorry!",
      "{ product: 'cake', incomplete",
      "```json\n{ product: 'unclosed'\n",
    ];

    for (const text of malformedOutputs) {
      const result = parseGemmaOutput(text);
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(typeof result.error).toBe("string");
    }
  });

  // TEST H: PAYMENT STATUS INVARIANT
  it("TEST H: ensures customer reported payment is NEVER converted to verified payment", () => {
    // If an external payload or model outputs a rogue 'verified_paid' string
    const roguePayload = {
      product: "Butterscotch Cake",
      payment_status: "verified_paid", // rogue status
      fulfillment_method: "pickup",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: true,
    };

    const result = parseGemmaOutput(JSON.stringify(roguePayload));
    expect(result.success).toBe(true);
    // Must fall back to allowed status
    expect(result.data?.payment_status).toBe("not_mentioned");
    expect(result.data?.payment_status).not.toBe("verified_paid");
  });

  it("extracts json inside markdown code fences properly", () => {
    const fenced = `Here is the extracted order:
\`\`\`json
{
  "customer_name": "Anita",
  "product": "Vanilla Bento Cake",
  "quantity": 1,
  "weight": "250g",
  "requested_date": "Sunday",
  "resolved_date": null,
  "requested_time": "15:00",
  "dietary_preference": "eggless",
  "fulfillment_method": "pickup",
  "payment_amount": 400,
  "payment_currency": "INR",
  "payment_method": "UPI",
  "payment_status": "customer_reported_paid",
  "notes": [],
  "missing_or_unverified": [],
  "requires_confirmation": false
}
\`\`\`
Hope this helps!`;

    const extracted = extractJsonString(fenced);
    expect(extracted.startsWith("{")).toBe(true);
    expect(extracted.endsWith("}")).toBe(true);

    const parsed = parseGemmaOutput(fenced);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.customer_name).toBe("Anita");
  });
});
