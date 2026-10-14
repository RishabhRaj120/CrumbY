# CrumbDesk — 90-Second Demonstration Script
> **Hacktoberfest 2026 Open-Source AI Challenge**  
> *Track: On-Device & Edge AI Applications*

---

## Overview
- **Product:** CrumbDesk (Local-First AI Bakery Order Management)
- **Model:** Gemma 3 4B running on-device via Ollama
- **Total Duration:** Exactly 90 seconds (1 minute, 30 seconds)
- **Presenter Role:** Independent Home Baker & Software Creator

---

## Timeline & Scene Breakdown

### [0:00 - 0:12] The Kitchen Problem
- **Screen:** Show messy WhatsApp chat or Instagram DM screenshot filled with informal messages:
  *"Heyy, need a 1kg chocolate truffle cake for Sunday evening. Eggless please. It is for my sister's birthday. Can I pick it up around 6? Paid 1200 through GPay."*
- **Spoken Audio:**
  > "Independent home bakers receive dozens of unstructured orders through WhatsApp and Instagram every week. Flavors, weights, dietary restrictions, and pickup times get lost in chat threads, and unverified customer payment claims can easily mislead a busy baker."

---

### [0:12 - 0:26] Local Gemma 3 4B Processing
- **Screen:** Open CrumbDesk dashboard (`http://localhost:3000`). Click **"Import Message"**, paste the customer's text, and click **"Extract Order with Gemma 3 4B"**.
- **Visual Cue:** Show the live inference timer ticking (~2 to 3 seconds) and the Ollama model badge (`gemma3:4b (Local Engine)`).
- **Spoken Audio:**
  > "Instead of sending customer phone numbers or private messages to an expensive cloud API, CrumbDesk processes the order locally using Google's open-weight Gemma 3 4B model running on-device via Ollama. It extracts every detail in under 3 seconds with zero external data transfer."

---

### [0:26 - 0:40] Structured Extraction & Uncertainty Handling
- **Screen:** The **Order Review Panel** opens:
  - Product: `chocolate truffle cake`
  - Count: `1` vs Weight: `1 kg` (strictly separated)
  - Requested Time: `18:00`
  - Dietary: `eggless`
  - Fulfillment: `pickup`
  - Payment: `₹1200` marked as `Customer Reported Paid` (clearly flagged with warning: *"Customer claim — verify in banking app before baking"*).
  - Amber banner: *"Calendar date unresolved (Sunday) — confirm exact date"*.
- **Spoken Audio:**
  > "CrumbDesk extracts structured specifications while enforcing strict kitchen invariants: cake weight is never confused with quantity, payment claims are never falsely upgraded to bank-verified, and ambiguous relative dates like 'Sunday' are flagged for human confirmation."

---

### [0:40 - 0:52] Clarification & Baker Confirmation
- **Screen:** 
  - Click **"Draft Reply"** to see an auto-generated polite WhatsApp clarification message.
  - Select calendar date `2026-10-18`, review the form, and click **"Confirm Order"**.
  - Dashboard shows the order move to **Confirmed** with an active change window deadline.
- **Spoken Audio:**
  > "With 1-click reply drafting, the baker clarifies missing details, assigns the resolved calendar date, and confirms the order into the active kitchen queue."

---

### [0:52 - 1:08] Controlled Order Change & Diff Governance
- **Screen:**
  - Customer sends a follow-up WhatsApp: *"Can we make that 500g instead of 1kg and add 'Happy Birthday Sis'?"*
  - Baker clicks **"Record Change Request"** on the confirmed order.
  - Modifies weight: `1 kg` to `500g` and adds inscription notes.
  - Show the live **Field Modification Diff**: `Weight: 1 kg ➔ 500g`.
  - Show the policy badge: `Within Policy (~36.2h remaining before 24h cutoff)`.
- **Spoken Audio:**
  > "When a customer requests changes later, CrumbDesk prevents silent, chaotic overwrites. The baker records a formal change proposal, inspects a clean visual diff, and checks the configurable 24-hour cutoff deadline."

---

### [1:08 - 1:20] Baker Decision & History Audit Trail
- **Screen:**
  - Baker clicks **"Approve Change"**.
  - Show the updated order specs and scroll to the **Order Change & Lifecycle History** timeline.
  - Demonstrate the recorded events: `Order Created` ➔ `Order Confirmed` ➔ `Change Requested` ➔ `Change Approved`.
  - Click **"Export CSV"** to demonstrate download of `crumbdesk-orders.csv`.
- **Spoken Audio:**
  > "Approving the change updates the accepted order specifications, preserves the previous values in a permanent audit timeline, and exports an RFC-compliant CSV for offline kitchen prep or accounting."

---

### [1:20 - 1:30] Why Local Open-Weight AI Matters
- **Screen:** Show the dashboard header with the active Ollama status indicator (`● Gemma 3 4B Local Engine`), and disconnect the internet (or show flight mode) to prove it runs 100% offline.
- **Spoken Audio:**
  > "CrumbDesk proves that small, open-weight models like Gemma 3 4B running on consumer laptops can deliver reliable structured extraction, privacy, and resilient kitchen governance for small business owners—completely free of subscriptions. Thank you!"

---

## Production Checklist for Recording
- [ ] Next.js server running locally (`npm run dev` or `npm run start`)
- [ ] Local Ollama running with `gemma3:4b` (`ollama serve`)
- [ ] Browser window sized to 1920x1080 (100% zoom)
- [ ] Test message copied to clipboard beforehand for smooth pasting
- [ ] Microphone calibrated for crisp audio without kitchen background noise
- [ ] Total recorded video trimmed to 88-90 seconds max
