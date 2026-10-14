# CrumbDesk — Hacktoberfest 2026 Submission Checklist

This document tracks all submission requirements, verification results, documentation artifacts, and honest disclosures for the **Hacktoberfest 2026 Open-Source AI Challenge**.

---

## 1. Repository & Codebase Readiness

- [x] **Clean Git Status:** Working tree clean, zero uncommitted stray edits, no destructive git operations used.
- [x] **No Leaked Secrets:** Zero API keys, passwords, or personal credentials in code or commits (Ollama runs locally without API keys).
- [x] **TypeScript Compliance:** Strict TypeScript configuration (`npm run lint` passes with 0 errors or warnings).
- [x] **Production Bundle Build:** Next.js App Router Turbopack build succeeds (`npm run build`).
- [x] **Environment Configuration:** Clean `.env.example` provided with documented variables (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS`).
- [x] **Accurate Documentation:** `README.md` fully up-to-date with architectural diagrams, installation guides, governance rules, and troubleshooting tables.

---

## 2. Automated Test Verification

| Test Suite | Scope | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Unit & Schema Tests** (`npm test`) | 52 automated tests in Vitest across 5 test suites | **PASSED** (52/52) | Covers CSV escaping, Zod schemas, output parsing, date resolution, payment integrity, weight normalization, and policy invariants. |
| **Linter Check** (`npm run lint`) | Full project TypeScript check (`tsc --noEmit`) | **PASSED** (0 errors) | Strict type safety enforced across all components and server routes. |
| **Production Build** (`npm run build`) | Static prerendering & route compilation | **PASSED** | Compiled in 4.9s, static pages generated cleanly. |
| **Live Local AI Suite** (`npm run test:ollama`) | 6 live integration tests with Gemma 3 4B | **PASSED** (6/6) | Verifies complete orders, incomplete orders, payment ambiguity, dietary/weight, generic products, and payment omissions. |

---

## 3. Manual Workflow Verification

The following workflows have been verified end-to-end:
- [x] **Message Extraction:** Pasting customer messages triggers local Gemma 3 4B inference; returns structured JSON in 2–4 seconds.
- [x] **Payment Omission Safeguard:** Messages with dates, times, and pickup requests but NO payment information correctly result in `payment_amount: null`, `payment_method: null`, and `payment_status: "not_mentioned"`.
- [x] **Payment Method Hallucination Guard:** Disallows inventing "Cash", "UPI", or "GPay" when the customer did not state them.
- [x] **Negative Payment Rejection:** UI input and domain schema reject negative amounts (e.g. `-293`) and display an explicit error message.
- [x] **Weight Unit Preservation:** Proposed weight modifications (e.g. `500g -> 1 kg`) preserve explicit units across modal diffs, accepted orders, and order history; bare numbers like `1000` are normalized with units and never displayed bare.
- [x] **Human-in-the-Loop Review:** Baker can edit any field in the Order Review Panel prior to confirmation.
- [x] **Missing Data Warnings:** Amber alerts appear for unresolved relative dates (e.g. "Sunday") or unspecified fulfillment methods.
- [x] **Customer Reply Drafter:** 1-click generation of polite clarification messages with copy-to-clipboard functionality.
- [x] **Cutoff Policy Deadlines:** Calculates exact cutoff timestamps in browser local time (scheduled fulfillment minus configured cutoff hours).
- [x] **Schedule Resolution Check:** Orders lacking an exact calendar date or time display *"Change deadline unavailable — resolve the fulfillment schedule first"*.
- [x] **Controlled Order Changes:** Baker manually records customer change proposals; pending changes never mutate accepted orders.
- [x] **Preparation-Started Locks:** Orders in `in_preparation` lock ordinary changes immediately; requires explicit exception approval with a mandatory reason.
- [x] **Whitespace Reason Guard:** Blank or whitespace-only exception reasons are rejected with an explicit error.
- [x] **Stale Proposal Guard:** Modifying accepted order values invalidates earlier pending change proposals.
- [x] **Permanent Order History:** All lifecycle transitions, customer proposals, and baker decisions are logged with timestamps and diffs.
- [x] **CSV Export:** RFC 4180 compliant CSV export downloads with escaped fields and suppressed negative values.
- [x] **Corrupted Record Recovery:** Legacy storage records with negative payment amounts are preserved safely with flagged manual review notices instead of crashing or being deleted.

---

## 4. Screenshots to Capture for Submission

Capture high-resolution screenshots (1920x1080) for the repository and DEV submission article:

- [ ] 1. **Dashboard Overview:** Active kitchen queue with status cards, search filter bar, and Ollama status indicator (`docs/screenshots/01-dashboard-overview.png`).
- [ ] 2. **Message Import Modal:** Unstructured WhatsApp message pasted in dialog with live local inference timer (`docs/screenshots/02-message-import.png`).
- [ ] 3. **Structured Review Panel:** Extracted order specs showing weight/quantity separation, payment claim warnings, and missing calendar date alerts (`docs/screenshots/03-review-panel.png`).
- [ ] 4. **Customer Reply Drafter:** Generated clarification text for missing fulfillment details with copy button (`docs/screenshots/04-reply-drafter.png`).
- [ ] 5. **Change Request Proposal Modal:** Field-level diff preview showing `Weight: 500g ➔ 1 kg` with policy deadline evaluation badge (`docs/screenshots/05-change-request-diff.png`).
- [ ] 6. **Exception Approval Safeguard:** Late change approval warning requiring mandatory justification reason and confirmation checkbox (`docs/screenshots/06-exception-approval.png`).
- [ ] 7. **Order History Timeline:** Visual audit trail with lifecycle milestones and field modification diffs (`docs/screenshots/07-order-history-timeline.png`).
- [ ] 8. **Kitchen Policy Settings:** Configurable change cutoff window options (12h, 24h, 48h, 72h, custom) (`docs/screenshots/08-policy-settings.png`).

---

## 5. Video Demonstration (90-Second Limit)

- [ ] Record according to `docs/hacktoberfest-demo-script.md`.
- [ ] Verify runtime is strictly between 80 and 90 seconds.
- [ ] Demonstrate local offline execution (disconnect Wi-Fi during inference or show Ollama local endpoint).
- [ ] Upload video to YouTube or Vimeo as Unlisted/Public; record the URL in the submission form.

---

## 6. DEV Article Requirements

- [x] Draft article prepared in `docs/dev-post-draft.md`.
- [x] Cover: Background & real problem of independent micro-bakers.
- [x] Cover: Why local open-weight AI (Gemma 3 4B) is fundamentally superior to cloud subscriptions for micro-businesses.
- [x] Cover: Architecture overview (Next.js App Router + Ollama + Zod + LocalStorage).
- [x] Cover: Kitchen governance model (Order Change Control, Preparation locks, diffs, exceptions).
- [x] Honest Disclosures: Explicitly note prototype limitations, manual WhatsApp copying, single-device storage, and synthetic validation scope.
- [x] Links: Link to GitHub repository and Ollama installation instructions.
- [ ] Embed final recorded demo video URL and captured screenshot images once ready.
- [ ] Publish draft article to DEV.to for the Hacktoberfest 2026 challenge entry.

---

## 7. Honest Disclosures & Reality Check

To uphold complete technical integrity and open-source transparency:
1. **No Direct WhatsApp Scraping:** CrumbDesk does NOT automatically intercept or scrape WhatsApp/Instagram. The baker manually copies and pastes customer messages into the Import modal.
2. **Browser LocalStorage:** Order data is stored in the browser's `localStorage`. Orders are not currently stored in an external cloud database or synchronized across multiple devices automatically.
3. **Audit History Scope:** The Order History timeline is an operational tracking log for the baker, NOT a cryptographic, tamper-proof blockchain ledger.
4. **No Financial Settlement Verification:** CrumbDesk tracks customer-reported payment statements (e.g. *"Paid via GPay"*); it does NOT connect to bank APIs or verify whether funds actually cleared.
5. **Testing & Validation Scope:** The application has been validated using synthetic, representative customer order messages and automated test suites (52 unit/policy tests + 6 live Ollama integration tests). We have received valuable workflow feedback through Reddit discussions with cottage food makers and hobbyist bakers; however, we have not yet established a completed real-world pilot with a baker or deployed the app in a commercial kitchen.
6. **Zero Fabricated Claims:** No fake user testimonials, invented paying customers, or artificial business benchmarks are used anywhere in this submission.
