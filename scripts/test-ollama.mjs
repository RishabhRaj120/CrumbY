/**
 * Real-world integration test runner for Gemma 3 4B via Ollama.
 * Tests the live Next.js /api/extract-order endpoint against realistic customer messages.
 */

const BASE_URL = process.env.TEST_APP_URL || "http://localhost:3000";

async function testExtraction(name, message) {
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
    "Hi, need one 1kg chocolate truffle cake for Sunday at 6 PM. Eggless please. Pickup. I have paid 1200 through GPay."
  );

  const t2 = await testExtraction(
    "TEST B: Incomplete Order",
    "Need a cake for my birthday next week."
  );

  const t3 = await testExtraction(
    "TEST C: Ambiguous Payment",
    "Can you make a chocolate cake for Saturday? I'll send 1000 later."
  );

  const t4 = await testExtraction(
    "TEST D: Dietary & Weight",
    "Can I get a 500g eggless red velvet cake on Friday for pickup?"
  );

  console.log(`\n========================================`);
  if (t1 && t2 && t3 && t4) {
    console.log("🎉 ALL REAL GEMMA 3 4B EXTRACTION TESTS PASSED!");
  } else {
    console.log("⚠️ Some tests failed or Ollama was unavailable.");
  }
}

run();
