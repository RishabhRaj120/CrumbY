import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Configuration
const APP_URL = "http://localhost:3000";
const OUTPUT_DIR =
  process.env.CRUMBDESK_OUTPUT_DIR ||
  path.resolve(process.cwd(), "..", "CrumbDesk-submission-output");
const FINAL_VIDEO_PATH = path.join(OUTPUT_DIR, "crumbdesk-demo.webm");
const TEMP_VIDEO_DIR = path.join(OUTPUT_DIR, "raw-recordings");

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_VIDEO_DIR)) {
  fs.mkdirSync(TEMP_VIDEO_DIR, { recursive: true });
}

console.log("==================================================");
console.log("  CRUMBDESK 90-SECOND DEMO RECORDER");
console.log(`  Target Output: ${FINAL_VIDEO_PATH}`);
console.log(`  App Target:    ${APP_URL}`);
console.log("==================================================");

/**
 * Injects or updates the clean, non-intrusive on-screen caption overlay.
 */
async function setCaption(page, titleText, bodyText, durationMs = 2000) {
  console.log(`[CAPTION] ${titleText} — ${bodyText} (${durationMs}ms)`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.evaluate(
        ({ title, body }) => {
          let overlay = document.getElementById("demo-caption-overlay");
          if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "demo-caption-overlay";
            overlay.style.position = "fixed";
            overlay.style.bottom = "24px";
            overlay.style.left = "50%";
            overlay.style.transform = "translateX(-50%)";
            overlay.style.zIndex = "999999";
            overlay.style.maxWidth = "860px";
            overlay.style.width = "90%";
            overlay.style.padding = "13px 24px";
            overlay.style.borderRadius = "16px";
            overlay.style.background = "rgba(24, 18, 16, 0.94)";
            overlay.style.backdropFilter = "blur(12px)";
            overlay.style.webkitBackdropFilter = "blur(12px)";
            overlay.style.border = "1px solid rgba(226, 114, 91, 0.45)";
            overlay.style.boxShadow = "0 12px 35px -5px rgba(0, 0, 0, 0.55)";
            overlay.style.fontFamily =
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            overlay.style.textAlign = "center";
            overlay.style.pointerEvents = "none";
            overlay.style.transition = "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)";

            const titleEl = document.createElement("div");
            titleEl.id = "demo-caption-title";
            titleEl.style.fontSize = "12.5px";
            titleEl.style.fontWeight = "700";
            titleEl.style.color = "#E2725B";
            titleEl.style.letterSpacing = "0.75px";
            titleEl.style.textTransform = "uppercase";
            titleEl.style.marginBottom = "2px";

            const textEl = document.createElement("div");
            textEl.id = "demo-caption-text";
            textEl.style.fontSize = "13.5px";
            textEl.style.lineHeight = "1.35";
            textEl.style.fontWeight = "500";
            textEl.style.color = "#FFFFFF";

            overlay.appendChild(titleEl);
            overlay.appendChild(textEl);
            document.body.appendChild(overlay);
          }

          const titleEl = document.getElementById("demo-caption-title");
          const textEl = document.getElementById("demo-caption-text");
          if (titleEl) titleEl.innerText = title;
          if (textEl) textEl.innerText = body;
        },
        { title: titleText, body: bodyText }
      );
      break;
    } catch {
      await page.waitForTimeout(300);
    }
  }

  if (durationMs > 0) {
    await page.waitForTimeout(durationMs);
  }
}

/**
 * Injects a visual cursor indicator for smooth pointer visualization.
 */
async function injectVirtualCursor(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.evaluate(() => {
        if (document.getElementById("demo-virtual-cursor")) return;
        const cursor = document.createElement("div");
        cursor.id = "demo-virtual-cursor";
        cursor.style.position = "fixed";
        cursor.style.top = "0px";
        cursor.style.left = "0px";
        cursor.style.width = "22px";
        cursor.style.height = "22px";
        cursor.style.borderRadius = "50%";
        cursor.style.border = "2.5px solid rgba(226, 114, 91, 0.95)";
        cursor.style.backgroundColor = "rgba(226, 114, 91, 0.35)";
        cursor.style.boxShadow = "0 0 10px rgba(226, 114, 91, 0.5)";
        cursor.style.pointerEvents = "none";
        cursor.style.zIndex = "9999999";
        cursor.style.transition =
          "transform 0.28s cubic-bezier(0.2, 0, 0.2, 1), background-color 0.15s ease, scale 0.15s ease";
        cursor.style.transform = "translate(-100px, -100px)";
        document.body.appendChild(cursor);
      });
      return;
    } catch {
      await page.waitForTimeout(300);
    }
  }
}

/**
 * Moves the virtual cursor to an element and clicks it.
 */
async function smoothMoveAndClick(page, locatorOrSelector, delayAfter = 1000) {
  const locator =
    typeof locatorOrSelector === "string"
      ? page.locator(locatorOrSelector).first()
      : locatorOrSelector;

  await locator.waitFor({ state: "visible", timeout: 12000 });
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();

  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;

    await page.evaluate(
      ({ x, y }) => {
        const cursor = document.getElementById("demo-virtual-cursor");
        if (cursor) {
          cursor.style.transform = `translate(${x - 11}px, ${y - 11}px)`;
        }
      },
      { x: targetX, y: targetY }
    ).catch(() => {});

    await page.waitForTimeout(220);

    // Click pulse effect
    await page.evaluate(() => {
      const cursor = document.getElementById("demo-virtual-cursor");
      if (cursor) {
        cursor.style.transform += " scale(0.85)";
        cursor.style.backgroundColor = "rgba(226, 114, 91, 0.85)";
      }
    }).catch(() => {});

    await locator.click();

    await page.waitForTimeout(120);
    await page.evaluate(() => {
      const cursor = document.getElementById("demo-virtual-cursor");
      if (cursor) {
        cursor.style.backgroundColor = "rgba(226, 114, 91, 0.35)";
      }
    }).catch(() => {});
  } else {
    await locator.click();
  }

  if (delayAfter > 0) {
    await page.waitForTimeout(delayAfter);
  }
}

/**
 * Moves cursor to an element without clicking.
 */
async function smoothMoveTo(page, locatorOrSelector, pauseMs = 1000) {
  const locator =
    typeof locatorOrSelector === "string"
      ? page.locator(locatorOrSelector).first()
      : locatorOrSelector;

  await locator.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  const box = await locator.boundingBox().catch(() => null);
  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    await page.evaluate(
      ({ x, y }) => {
        const cursor = document.getElementById("demo-virtual-cursor");
        if (cursor) {
          cursor.style.transform = `translate(${x - 11}px, ${y - 11}px)`;
        }
      },
      { x: targetX, y: targetY }
    ).catch(() => {});
  }
  if (pauseMs > 0) {
    await page.waitForTimeout(pauseMs);
  }
}

/**
 * Types text smoothly with realistic pacing.
 */
async function smoothType(page, selector, text, delayAfter = 1000) {
  const locator = page.locator(selector).first();
  await smoothMoveAndClick(page, locator, 200);
  await locator.fill("");
  await locator.pressSequentially(text, { delay: 9 });
  if (delayAfter > 0) {
    await page.waitForTimeout(delayAfter);
  }
}

async function recordDemo() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1440,900",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: TEMP_VIDEO_DIR,
      size: { width: 1440, height: 900 },
    },
    acceptDownloads: true,
  });

  // Suppress Turbopack dev auto-reload loops so React hydration executes cleanly
  await context.addInitScript(() => {
    window.location.reload = function () {
      console.log("[HMR] window.location.reload suppressed during demo recording");
    };
    const OrigWebSocket = window.WebSocket;
    window.WebSocket = function (...args) {
      const ws = new OrigWebSocket(...args);
      ws.addEventListener(
        "message",
        (event) => {
          if (typeof event.data === "string" && event.data.includes('"restart"')) {
            event.stopImmediatePropagation();
          }
        },
        true
      );
      return ws;
    };
  });

  const page = await context.newPage();
  const startTime = Date.now();

  try {
    console.log("[SCENE 1/8] Navigating to CrumbDesk Dashboard...");
    await page.goto(APP_URL, { waitUntil: "load" });
    await page.waitForSelector("h1:has-text('Bakehouse Dashboard')", { timeout: 15000 });
    await page.waitForTimeout(1000);
    await injectVirtualCursor(page);

    // ==========================================
    // SCENE 1: Introduction & Dashboard Overview (~9s)
    // ==========================================
    await setCaption(
      page,
      "CrumbDesk: Local-First AI Order Management",
      "Tailored for independent home bakers to eliminate manual order tracking.",
      2200
    );

    // Highlight Ollama & Gemma status badge in sidebar
    await smoothMoveTo(page, "aside div:has-text('Gemma 3 4B')", 800);
    await setCaption(
      page,
      "Local AI Privacy & Zero Cloud Dependency",
      "Powered by local Gemma 3 4B via Ollama. Customer data stays private on-device.",
      2200
    );

    // Populate initial orders using Load Demo Data
    const loadDemoBtn = page
      .locator("button:has-text('Load Demo Data'), button:has-text('Load Sample Orders')")
      .first();
    if (await loadDemoBtn.isVisible()) {
      await smoothMoveAndClick(page, loadDemoBtn, 1000);
    }

    await setCaption(
      page,
      "Live Operational Dashboard",
      "Real-time visibility over order statuses, payment confirmations, and kitchen deadlines.",
      2000
    );

    // ==========================================
    // SCENE 2: Customer Message Import & Live Gemma Extraction (~12s)
    // ==========================================
    const importBtn = page.locator("header button:has-text('Import Order'), button:has-text('Import Order')").first();
    await smoothMoveAndClick(page, importBtn, 800);

    await setCaption(
      page,
      "Step 1: Paste Customer Message",
      "Directly paste messy, unstructured chat messages from WhatsApp or Instagram.",
      1800
    );

    const messageText =
      "Hi! I'd like one 500g red velvet cake for my daughter's birthday. Please make it eggless. I'll pick it up on October 17, 2026, at 6 PM. I haven't made the payment yet. Could you confirm whether the order is possible?";

    await smoothType(page, "#customer-message", messageText, 1200);

    await setCaption(
      page,
      "Real Gemma 3 4B Neural Extraction",
      "Invoking local Gemma 3 4B through Ollama to structure order specifications...",
      1400
    );

    const extractBtn = page.locator("button:has-text('Extract Order')").first();
    await smoothMoveAndClick(page, extractBtn, 300);

    // Wait for the extraction API and OrderReviewPanel to open
    console.log("  Waiting for Gemma 3 4B extraction response...");
    await page.waitForSelector("h2:has-text('Review Extracted Order')", {
      timeout: 45000,
    });
    console.log("  Extraction complete!");

    // ==========================================
    // SCENE 3: Review Extracted Order & Ambiguities (~9s)
    // ==========================================
    await setCaption(
      page,
      "Step 2: Structured Review & Verification",
      "Extracted: red velvet cake, 500g, eggless, pickup at 6 PM, and explicit unpaid status.",
      2400
    );

    await setCaption(
      page,
      "Ambiguity & Invariant Protection",
      "CrumbDesk flags missing or customer-reported details before accepting orders.",
      2200
    );

    // Scroll slightly down inside modal to view fields & payment section
    await page.evaluate(() => {
      const scrollContainer = document.querySelector(".overflow-y-auto");
      if (scrollContainer) scrollContainer.scrollTop = 240;
    }).catch(() => {});

    await setCaption(
      page,
      "Payment Integrity",
      "Correctly records explicit unpaid status without assuming bank verification.",
      2200
    );

    // ==========================================
    // SCENE 4: Draft Customer Reply (~9s)
    // ==========================================
    const draftReplyBtn = page.locator("button:has-text('Draft Customer Reply')").first();
    await smoothMoveAndClick(page, draftReplyBtn, 800);

    await setCaption(
      page,
      "Step 3: Draft Customer Reply",
      "Generates deterministic clarification replies tailored to missing or unverified fields.",
      2200
    );

    const copyBtn = page.locator("button:has-text('Copy Reply')").first();
    if (await copyBtn.isVisible()) {
      await smoothMoveAndClick(page, copyBtn, 600);
    }

    await setCaption(
      page,
      "Bakers Retain Full Conversation Control",
      "CrumbDesk never auto-sends messages. Bakers review and paste directly into their chat.",
      2200
    );

    const closeDraftBtn = page
      .locator("div.fixed:has(h2:has-text('Draft Customer Reply')) button:has-text('Close')")
      .first();
    await smoothMoveAndClick(page, closeDraftBtn, 600);

    // Save as needs review
    const saveNeedsReviewBtn = page.locator("button:has-text('Save as Needs Review')").first();
    await smoothMoveAndClick(page, saveNeedsReviewBtn, 1000);

    // ==========================================
    // SCENE 5: Order Change Control & Modification (~13s)
    // ==========================================
    await setCaption(
      page,
      "Order Change Control",
      "Accepted orders are locked to protect baking schedules from untracked modifications.",
      2200
    );

    // Find Aman Verma's confirmed order and click Details
    const amanDetailsBtn = page
      .locator("tr:has-text('Aman Verma') button:has-text('Details')")
      .first();
    await smoothMoveAndClick(page, amanDetailsBtn, 1000);

    await setCaption(
      page,
      "Protected Accepted Order",
      "Direct field edits are disabled. Modifications require a formal change request.",
      2000
    );

    // Click Record Customer Change Request inside the active order details panel
    const recordChangeBtn = page
      .locator("button:has-text('Record Customer Change Request')")
      .first();
    await smoothMoveAndClick(page, recordChangeBtn, 800);

    await setCaption(
      page,
      "Record Customer Modification",
      "Proposing an upgrade from 500g to 1 kg cake size with customer context.",
      1800
    );

    // Locate elements strictly inside the newly opened OrderChangeRequestModal (z-60 child modal)
    const changeModal = page
      .locator("div.fixed:has(h3:has-text('Record Customer Change Request'))")
      .last();
    await changeModal.waitFor({ state: "visible", timeout: 8000 });

    // Update weight input to 1 kg inside the change request modal
    const weightInput = changeModal.locator("input[placeholder*='1 kg, 500g']");
    await weightInput.fill("1 kg");

    // Add context note inside the modal
    const contextNoteInput = changeModal.locator("input[placeholder*='WhatsApp']");
    if (await contextNoteInput.isVisible()) {
      await contextNoteInput.fill(
        "Customer phoned requesting to upgrade to 1 kg for party guests."
      );
    }

    await setCaption(
      page,
      "Live Proposed Diff Preview",
      "Visual diff highlights exact field modifications before baker authorization.",
      2000
    );

    const submitChangeBtn = changeModal.locator("button:has-text('Submit Change Request')");
    await smoothMoveAndClick(page, submitChangeBtn, 1000);

    // ==========================================
    // SCENE 6: Policy Enforcement & Exception Approval (~11s)
    // ==========================================
    await setCaption(
      page,
      "Change Request Recorded: Pending Badge",
      "Order returns to dashboard displaying the pending change badge.",
      1800
    );

    // Re-open Aman Verma's order details to review and decide on the proposed change
    const amanDetailsBtn2 = page
      .locator("tr:has-text('Aman Verma') button:has-text('Details')")
      .first();
    await smoothMoveAndClick(page, amanDetailsBtn2, 1000);

    await setCaption(
      page,
      "Change Request Awaiting Baker Decision",
      "A pending banner displays proposed changes without altering active order specs.",
      2000
    );

    const reviewDecideBtn = page.locator("button:has-text('Review & Decide')").first();
    await smoothMoveAndClick(page, reviewDecideBtn, 900);

    await setCaption(
      page,
      "Cutoff Deadline & Policy Checks",
      "CrumbDesk evaluates delivery proximity against configured policy rules.",
      2000
    );

    // Locate elements inside the ChangeRequestApprovalModal (z-60 child modal)
    const decisionModal = page
      .locator("div.fixed:has(button:has-text('Reject Request'))")
      .last();
    await decisionModal.waitFor({ state: "visible", timeout: 8000 });

    // Check if exception reason is required
    const exceptionTextarea = decisionModal.locator("textarea[placeholder*='Ingredients available']");
    const isExceptionRequired = await exceptionTextarea.isVisible();

    if (isExceptionRequired) {
      await exceptionTextarea.fill(
        "Ingredients available; customer agreed to additional ₹200 rush fee."
      );
      const confirmCheckbox = decisionModal.locator("input[type='checkbox']");
      await confirmCheckbox.check();
      await page.waitForTimeout(600);

      await setCaption(
        page,
        "Mandatory Exception Authorization",
        "Late changes past cutoff require explicit justification and risk acknowledgement.",
        2000
      );

      const approveExceptionBtn = decisionModal.locator("button:has-text('Approve Exception')");
      await smoothMoveAndClick(page, approveExceptionBtn, 1000);
    } else {
      const approveChangesBtn = decisionModal.locator("button:has-text('Approve Changes')");
      await smoothMoveAndClick(page, approveChangesBtn, 1000);
    }

    await setCaption(
      page,
      "Order Specifications Safely Updated",
      "Accepted order specifications updated with zero untracked alterations.",
      1600
    );

    // ==========================================
    // SCENE 7: Tamper-Evident History & Policy Settings (~10s)
    // ==========================================
    // Re-open Aman Verma's order details to view the permanent audit trail
    const amanDetailsBtn3 = page
      .locator("tr:has-text('Aman Verma') button:has-text('Details')")
      .first();
    await smoothMoveAndClick(page, amanDetailsBtn3, 1000);

    // Scroll down to Order History Timeline inside the active order details
    await page.evaluate(() => {
      const scrollContainer = document.querySelector(".overflow-y-auto");
      if (scrollContainer) scrollContainer.scrollTop = 9999;
    }).catch(() => {});

    await setCaption(
      page,
      "Tamper-Evident Audit Trail",
      "Every order status transition, change proposal, and approval is permanently logged.",
      2500
    );

    const closeReviewBtn = page
      .locator("button:has-text('Close'), button[aria-label='Close panel']")
      .first();
    await smoothMoveAndClick(page, closeReviewBtn, 600);

    // Navigate to Settings
    const settingsLink = page.locator("aside a[href='/settings']").first();
    await smoothMoveAndClick(page, settingsLink, 900);
    await injectVirtualCursor(page);

    await setCaption(
      page,
      "Configurable Change Cutoff Policy",
      "Customize operational cutoff hours (12h, 24h, 48h, 72h) to protect kitchen prep.",
      2200
    );

    // ==========================================
    // SCENE 8: CSV Export & Conclusion (~8s)
    // ==========================================
    const overviewLink = page.locator("aside a[href='/']").first();
    await smoothMoveAndClick(page, overviewLink, 900);
    await injectVirtualCursor(page);

    await setCaption(
      page,
      "Full Data Ownership: CSV Export",
      "Export your complete order ledger to CSV anytime for delivery sheets and spreadsheets.",
      2000
    );

    // Trigger CSV Export
    const exportCsvBtn = page.locator("button:has-text('Export CSV')").first();
    const downloadPromise = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await smoothMoveAndClick(page, exportCsvBtn, 400);
    const download = await downloadPromise;
    if (download) {
      console.log(`  CSV downloaded successfully: ${download.suggestedFilename()}`);
    }

    await setCaption(
      page,
      "CrumbDesk — Built for Home Bakers",
      "Local AI extraction • Change-control safety • Zero cloud dependencies.",
      2600
    );

    await page.waitForTimeout(500);

    const elapsedTotal = (Date.now() - startTime) / 1000;
    console.log(`[RECORDING COMPLETE] Total elapsed recording time: ${elapsedTotal.toFixed(1)}s`);
  } catch (err) {
    console.error("[RECORDING ERROR]", err);
    throw err;
  } finally {
    console.log("Closing browser context to finalize video encoding...");
    await context.close();
    await browser.close();
  }

  // Find the generated video file in TEMP_VIDEO_DIR
  const files = fs.readdirSync(TEMP_VIDEO_DIR).filter((f) => f.endsWith(".webm"));
  if (files.length === 0) {
    throw new Error(`No .webm video file found in ${TEMP_VIDEO_DIR}`);
  }

  // Sort by modification time to get the latest
  files.sort((a, b) => {
    return (
      fs.statSync(path.join(TEMP_VIDEO_DIR, b)).mtimeMs -
      fs.statSync(path.join(TEMP_VIDEO_DIR, a)).mtimeMs
    );
  });

  const latestVideoFile = path.join(TEMP_VIDEO_DIR, files[0]);
  console.log(`Raw video recorded: ${latestVideoFile}`);

  // Copy to final destination
  fs.copyFileSync(latestVideoFile, FINAL_VIDEO_PATH);
  console.log(`Final video saved to: ${FINAL_VIDEO_PATH}`);

  const stat = fs.statSync(FINAL_VIDEO_PATH);
  console.log(`Output file size: ${(stat.size / 1024 / 1024).toFixed(2)} MB (${stat.size} bytes)`);

  // Verify duration using Playwright's FFmpeg
  const ffmpegPath =
    "C:\\Users\\LENOVO\\AppData\\Local\\ms-playwright\\ffmpeg-1013\\ffmpeg-win64.exe";
  if (fs.existsSync(ffmpegPath)) {
    try {
      const probeOutput = execSync(`"${ffmpegPath}" -i "${FINAL_VIDEO_PATH}" 2>&1`, {
        encoding: "utf-8",
      });
      const durationMatch = probeOutput.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1], 10);
        const mins = parseInt(durationMatch[2], 10);
        const secs = parseFloat(durationMatch[3]);
        const totalDurationSecs = hours * 3600 + mins * 60 + secs;
        console.log(`Verified Video Duration: ${totalDurationSecs.toFixed(1)} seconds`);
      }
    } catch (probeErr) {
      if (probeErr.stdout) {
        const durationMatch = probeErr.stdout.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1], 10);
          const mins = parseInt(durationMatch[2], 10);
          const secs = parseFloat(durationMatch[3]);
          const totalDurationSecs = hours * 3600 + mins * 60 + secs;
          console.log(`Verified Video Duration: ${totalDurationSecs.toFixed(1)} seconds`);
        }
      }
    }
  }

  return FINAL_VIDEO_PATH;
}

recordDemo()
  .then((outputPath) => {
    console.log(`SUCCESS! Video recording verified at: ${outputPath}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Recording failed with error:", err);
    process.exit(1);
  });
