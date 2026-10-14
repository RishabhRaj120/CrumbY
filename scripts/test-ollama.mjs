/**
 * Real-world integration test runner for Gemma 3 4B via Ollama.
 * Tests the live Next.js /api/extract-order endpoint against realistic customer messages.
 */

const BASE_URL = process.env.TEST_APP_URL || "http://localhost:3000";

async function testExtraction(name, message, validator) {
  console.log(`\n========================================`);
  console.log(`TEST: ${name}`);
  console.log(`MESSAGE: "${message}"`);

  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/extract-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    const data = await res.json();
    console.log(`STATUS: ${res.status} (${duration}s)`);
    console.log(JSON.stringify(data, null, 2));

    if (!res.ok || !data.success) {
      console.error(`❌ FAILED: ${data.error || "Unknown error"}`);
      return false;
    }

    if (validator && !validator(data.data)) {
      console.error(`❌ FAILED VALIDATION ASSERTIONS`);
      return false;
    }

    console.log(`✅ PASSED`);
    return true;
  } catch (err) {
    console.error(`❌ CONNECTION FAILED: ${err.message}`);
    return false;
  }
}

async function run() {
  console.log(`Testing CrumbDesk extraction with local Gemma 3 4B at ${BASE_URL}...`);

  const t1 = await testExtraction(
    "TEST A: Complete Order",
    "Hi, need one 1kg chocolate truffle cake for Sunday at 6 PM. Eggless please. Pickup. I have paid 1200 through GPay.",
    (data) =>
      data.product === "chocolate truffle cake" &&
      data.quantity === 1 &&
      (data.weight === "1kg" || data.weight === "1 kg") &&
      data.requested_date === "Sunday" &&
      data.resolved_date === null &&
      data.requested_time === "18:00" &&
      data.dietary_preference === "eggless" &&
      data.fulfillment_method === "pickup" &&
      data.payment_amount === 1200 &&
      data.payment_method === "GPay" &&
      data.payment_status === "customer_reported_paid"
  );

  const t2 = await testExtraction(
    "TEST B: Incomplete Order",
    "Need a cake for my birthday next week.",
    (data) =>
      data.product === "cake" &&
      data.quantity === null &&
      data.weight === null &&
      data.requested_date === "next week" &&
      data.resolved_date === null &&
      data.requested_time === null &&
      data.dietary_preference === null &&
      data.fulfillment_method === "unknown" &&
      data.payment_amount === null &&
      data.payment_status === "not_mentioned" &&
      data.requires_confirmation === true
  );

  const t3 = await testExtraction(
    "TEST C: Ambiguous Payment",
    "Can you make a chocolate cake for Saturday? I'll send 1000 later.",
    (data) =>
      data.product === "chocolate cake" &&
      data.quantity === null &&
      data.weight === null &&
      data.requested_date === "Saturday" &&
      data.resolved_date === null &&
      data.fulfillment_method === "unknown" &&
      data.payment_amount === 1000 &&
      data.payment_status === "customer_reported_unpaid" &&
      data.requires_confirmation === true
  );

  const t4 = await testExtraction(
    "TEST D: Dietary & Weight",
    "Can I get a 500g eggless red velvet cake on Friday for pickup?",
    (data) =>
      data.product === "red velvet cake" &&
      (data.quantity === null || data.quantity === 1) &&
      data.weight === "500g" &&
      data.requested_date === "Friday" &&
      data.resolved_date === null &&
      data.dietary_preference === "eggless" &&
      data.fulfillment_method === "pickup" &&
      data.payment_amount === null &&
      data.payment_status === "not_mentioned" &&
      data.requires_confirmation === true
  );

  const t5 = await testExtraction(
    "REGRESSION TEST: Generic Cake Under-Extraction",
    "Hey, I need a cake for my birthday next week. Can you help?",
    (data) =>
      data.product === "cake" &&
      data.quantity === null &&
      data.weight === null &&
      data.requested_date === "next week" &&
      data.resolved_date === null &&
      data.requested_time === null &&
      data.fulfillment_method === "unknown" &&
      data.payment_amount === null &&
      data.payment_status === "not_mentioned" &&
      data.requires_confirmation === true
  );

  const t6 = await testExtraction(
    "TEST F (EXPLICIT CALENDAR DATE & PAYMENT OMISSION): Red Velvet Cake on October 17, 2026",
    "I need a 500g eggless red velvet cake for pickup on October 17, 2026 at 18:00.",
    (data) =>
      data.product === "red velvet cake" &&
      data.weight === "500g" &&
      data.requested_time === "18:00" &&
      data.fulfillment_method === "pickup" &&
      data.resolved_date === "2026-10-17" &&
      data.payment_amount === null &&
      data.payment_method === null &&
      data.payment_status === "not_mentioned"
  );

  console.log(`\n========================================`);
  if (t1 && t2 && t3 && t4 && t5 && t6) {
    console.log("🎉 ALL REAL GEMMA 3 4B EXTRACTION TESTS PASSED!");
  } else {
    console.log("⚠️ Some tests failed or Ollama was unavailable.");
  }
}

run();
