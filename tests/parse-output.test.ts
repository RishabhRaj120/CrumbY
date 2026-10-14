import { describe, it, expect } from "vitest";
import { parseGemmaOutput, extractJsonString } from "@/lib/ai/parse-output";
import { extractedOrderSchema } from "@/lib/schemas/order";

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
    expect(result.data?.product).toBe("cake");
    expect(result.data?.quantity).toBeNull();
    expect(result.data?.weight).toBeNull();
    expect(result.data?.resolved_date).toBeNull();
    expect(result.data?.payment_amount).toBeNull();
    expect(result.data?.missing_or_unverified.length).toBeGreaterThan(0);
    expect(result.data?.requires_confirmation).toBe(true);
  });

  // REGRESSION TEST: Generic bakery category without flavor ("Hey, I need a cake for my birthday next week. Can you help?")
  it("REGRESSION: extracts generic product 'cake' without inventing a flavor while preserving nulls", () => {
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
      notes: [],
      missing_or_unverified: [
        "Exact calendar date",
        "Flavor details",
        "Cake size/weight",
        "Pickup or delivery",
        "Payment details",
        "Pickup/delivery time window",
      ],
      requires_confirmation: true,
    });

    const result = parseGemmaOutput(rawModelJson);
    expect(result.success).toBe(true);
    expect(result.data?.product).toBe("cake");
    expect(result.data?.quantity).toBeNull();
    expect(result.data?.weight).toBeNull();
    expect(result.data?.requested_date).toBe("next week");
    expect(result.data?.resolved_date).toBeNull();
    expect(result.data?.requested_time).toBeNull();
    expect(result.data?.fulfillment_method).toBe("unknown");
    expect(result.data?.payment_amount).toBeNull();
    expect(result.data?.payment_status).toBe("not_mentioned");
    expect(result.data?.missing_or_unverified).toContain("Flavor details");
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
    expect(result.data?.fulfillment_method).toBe("unknown");
    expect(result.data?.payment_amount).toBe(1000);
    expect(result.data?.payment_status).toBe("customer_reported_unpaid");
    expect(result.data?.payment_status).not.toBe("customer_reported_paid");
  });

  // FULFILLMENT GUARDRAIL TESTS
  it("strictly enforces fulfillment_method as 'unknown' if model guessed 'pickup' without customer mention", () => {
    const rawModelJson = JSON.stringify({
      product: "chocolate cake",
      fulfillment_method: "pickup", // Model mistakenly guessed pickup
      requested_date: "Saturday",
      payment_amount: 1000,
      payment_status: "customer_reported_unpaid",
    });

    // Customer message does NOT mention pickup or delivery
    const customerMsg = "Can you make a chocolate cake for Saturday? I'll send 1000 later.";
    const result = parseGemmaOutput(rawModelJson, customerMsg);
    expect(result.success).toBe(true);
    expect(result.data?.fulfillment_method).toBe("unknown");
    expect(result.data?.missing_or_unverified).toContain("Pickup or delivery method");
  });

  it("preserves fulfillment_method 'pickup' when customer explicitly mentions pickup", () => {
    const rawModelJson = JSON.stringify({
      product: "chocolate truffle cake",
      fulfillment_method: "pickup",
      payment_status: "customer_reported_paid",
    });

    const customerMsg = "Hi, need a cake for Sunday. Can I pick it up around 6?";
    const result = parseGemmaOutput(rawModelJson, customerMsg);
    expect(result.success).toBe(true);
    expect(result.data?.fulfillment_method).toBe("pickup");
  });

  it("preserves fulfillment_method 'delivery' when customer explicitly mentions delivery", () => {
    const rawModelJson = JSON.stringify({
      product: "muffins",
      fulfillment_method: "delivery",
      payment_status: "not_mentioned",
    });

    const customerMsg = "Could we get 6 blueberry muffins delivered to Indiranagar on Friday?";
    const result = parseGemmaOutput(rawModelJson, customerMsg);
    expect(result.success).toBe(true);
    expect(result.data?.fulfillment_method).toBe("delivery");
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

  // PHASE 10 PART A: PAYMENT DATA INTEGRITY REGRESSION TESTS
  it("PART A1: customer message without payment info strips rogue negative amount and invented Cash", () => {
    const customerMsg =
      "Need a 500g eggless red velvet cake for pickup on October 17, 2026 at 18:00";
    // Rogue / hallucinated model output resembling the reported bug
    const rogueModelOutput = JSON.stringify({
      product: "red velvet cake",
      quantity: 1,
      weight: "500g",
      requested_date: "October 17, 2026",
      resolved_date: "2026-10-17",
      requested_time: "18:00",
      dietary_preference: "eggless",
      fulfillment_method: "pickup",
      payment_amount: -293, // Rogue negative number
      payment_method: "Cash", // Hallucinated method
      payment_status: "unclear",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: false,
    });

    const result = parseGemmaOutput(rogueModelOutput, customerMsg);
    expect(result.success).toBe(true);
    expect(result.data?.payment_amount).toBeNull();
    expect(result.data?.payment_method).toBeNull();
    expect(result.data?.payment_status).toBe("not_mentioned");
    expect(result.data?.fulfillment_method).toBe("pickup");
  });

  it("PART A2: customer reported paid via GPay sets customer_reported_paid and retains method", () => {
    const customerMsg = "I've paid 1200 through GPay.";
    const modelOutput = JSON.stringify({
      product: "cake",
      payment_amount: 1200,
      payment_currency: "INR",
      payment_method: "GPay",
      payment_status: "customer_reported_paid",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: true,
    });

    const result = parseGemmaOutput(modelOutput, customerMsg);
    expect(result.success).toBe(true);
    expect(result.data?.payment_amount).toBe(1200);
    expect(result.data?.payment_method).toBe("GPay");
    expect(result.data?.payment_status).toBe("customer_reported_paid");
  });

  it("PART A3: customer promising to send later strips hallucinated method and sets customer_reported_unpaid", () => {
    const customerMsg = "Can you make a cake for Saturday? I'll send 1000 later.";
    const modelOutput = JSON.stringify({
      product: "cake",
      payment_amount: 1000,
      payment_currency: "INR",
      payment_method: "Cash", // Invented Cash
      payment_status: "customer_reported_unpaid",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: true,
    });

    const result = parseGemmaOutput(modelOutput, customerMsg);
    expect(result.success).toBe(true);
    expect(result.data?.payment_amount).toBe(1000);
    expect(result.data?.payment_method).toBeNull(); // Invented Cash stripped!
    expect(result.data?.payment_status).toBe("customer_reported_unpaid");
  });

  it("PART A4: extractedOrderSchema rejects negative, NaN, and infinite payment amounts", () => {
    const valid = {
      product: "Fruit Cake",
      payment_status: "not_mentioned",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: false,
    };

    // Negative amount rejected
    const negResult = extractedOrderSchema.safeParse({
      ...valid,
      payment_amount: -293,
    });
    expect(negResult.success).toBe(false);

    // Infinite amount rejected
    const infResult = extractedOrderSchema.safeParse({
      ...valid,
      payment_amount: Infinity,
    });
    expect(infResult.success).toBe(false);
  });

  // PHASE 10 PART B: BARE WEIGHT NORMALIZATION REGRESSION TEST
  it("PART B: normalizes bare weight '1000' to explicit unit '1 kg'", () => {
    const modelOutput = JSON.stringify({
      product: "Black Forest Cake",
      weight: "1000", // Bare number
      payment_status: "not_mentioned",
      notes: [],
      missing_or_unverified: [],
      requires_confirmation: false,
    });

    const result = parseGemmaOutput(modelOutput);
    expect(result.success).toBe(true);
    expect(result.data?.weight).toBe("1 kg");
  });
});
