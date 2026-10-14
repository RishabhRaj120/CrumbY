# CrumbDesk: Local-First AI Order Management & Kitchen Governance for Home Bakers

*This article is submitted for the Hacktoberfest 2026 Open-Source AI Challenge.*  
*Track: On-Device & Edge AI Applications*

---

## 1. The Real Kitchen Problem

If you talk to an independent cottage baker or artisanal pastry chef, you will quickly discover that their biggest operational headache isn't baking—it's **WhatsApp chaos**.

Customers place custom cake orders through informal chat messages that look like this:

> *"Heyy! Need a 1kg chocolate truffle cake for Sunday evening. Eggless please. It's for my sister's 25th birthday! Can I pick it up around 6? Paid 1200 through GPay."*

A busy baker juggling mixing bowls and hot ovens must parse this message:
- Is **1kg** the weight or the quantity? *(Weight: 1kg; Quantity: 1)*
- What day is **"Sunday"**? *(Is it this Sunday, or next Sunday? What is the calendar date?)*
- Is **"around 6"** 6 AM or 6 PM? *(18:00)*
- Is the payment claim verified? *(Customer says they paid via GPay, but did the money actually clear in the baker's bank account?)*
- What happens when the customer texts two days later: *"Hey, can we make that 500g instead of 1kg and add vanilla frosting?"*

When orders arrive across WhatsApp, Instagram DMs, and text messages, details get buried. Bakers miss dietary restrictions, mix up fulfillment dates, or start baking sponge layers only to discover the customer changed their mind late at night.

Existing commercial bakery software is built for large retail chains with multi-location inventory and costs $50 to $100 per month. Home bakers cannot afford these subscriptions, nor do they need enterprise bloat. They need an accountable, local-first assistant that keeps their kitchen organized without cloud bills or privacy risks.

That is why we built **CrumbDesk**.

---

## 2. Why Local Open-Weight AI (Gemma 3 4B)?

When designing CrumbDesk, we deliberately avoided cloud LLM APIs like OpenAI or Claude for three core reasons:

1. **Zero Recurring Costs for Micro-Businesses:** A home baker making 10 to 20 cakes a week should not be paying $20/month for an API subscription. Running **Gemma 3 4B** locally on their existing laptop costs nothing beyond electricity.
2. **Local Customer Privacy:** Customer messages contain personal phone numbers, home addresses, dietary health conditions (e.g. severe nut allergies), and personal names. Running on-device via **Ollama** ensures that inference occurs locally on the baker's computer without transmitting customer communication to third-party cloud APIs.
3. **Offline Kitchen Resilience:** Kitchen Wi-Fi can be unreliable. An order management tool that stops working during an internet hiccup is a liability. Gemma 3 4B runs 100% offline.

### Why Gemma 3 4B?
Google's **Gemma 3 4B** hits the sweet spot for structured extraction on consumer hardware:
- Small memory footprint (~3.3 GB quantized Q4_K_M) runs smoothly on standard laptops with 8 GB to 16 GB RAM.
- High instruction-following fidelity when constrained by conservative prompts and temperature control (`temp=0.1`).
- Fast inference: average extraction takes **2.5 to 4.5 seconds** on consumer hardware.

---

## 3. Architecture & Technical Implementation

CrumbDesk is built with a local-first stack designed for transparency and reliability:

```
[Customer Chat] ──(Manual Copy)──► [Next.js App Router] ──(POST /api/extract-order)
                                             │
                                     [Ollama Local Engine]
                                   (Gemma 3 4B, temp=0.1)
                                             │
                                   [Conservative Parser]
                                             │
                                  [Zod Schema Validation]
                                             │
                              [Interactive Baker Review Panel]
                                             │
                                 [Order Lifecycle Graph]
                                             │
                                  [Browser LocalStorage]
```

### Key Technical Pillars:
- **Next.js 16 (App Router) & React 19:** Server components and dynamic route handlers isolate the Ollama daemon. The browser never makes direct network calls to port 11434.
- **Strict Zod Domain Validation:** The model's JSON output is never blindly accepted. It passes through strict schemas that enforce domain rules:
  - Cake weight (e.g. `500g`) is strictly separated from item count (`1`).
  - Relative dates (e.g. `"next Friday"`) are preserved verbatim in `requested_date`; `resolved_date` is only set if an unambiguous ISO `YYYY-MM-DD` date can be computed.
  - Payment amounts must be non-negative, finite numbers.
  - Payment status is strictly restricted: customer claims (`customer_reported_paid`) are never upgraded to bank-verified.
  - If payment is not stated in the message, the parser guarantees:
    ```typescript
    payment_amount: null,
    payment_method: null,
    payment_status: "not_mentioned"
    ```
- **Weight Unit Normalization:** Proposing a weight change (e.g. `500g -> 1 kg`) preserves explicit units. Bare inputs like `1000` are normalized to `1 kg` and never displayed as bare numbers.

---

## 4. Kitchen Governance: Order Change Control

Extracting the initial order is only half the battle. In home bakery operations, **customers frequently request changes**.

If a baker is fulfilling an order for Saturday at 6 PM, they might buy ingredients on Wednesday and bake the sponge on Thursday. A change request on Friday morning ruins ingredients and disrupts baking schedules.

CrumbDesk implements a full **Order Change Control & Governance Architecture**:

### 1. Controlled Lifecycle State Machine
Orders transition along an explicit domain lifecycle:
$$\text{needs\_review} \longrightarrow \text{confirmed} \longrightarrow \text{in\_preparation} \longrightarrow \text{ready} \longrightarrow \text{completed}$$
Backwards transitions that would bypass edit restrictions are strictly prohibited.

### 2. Configurable Cutoff Deadlines
Bakers configure their change cutoff window in Settings (default **24 hours**, with options for 12h, 48h, 72h, or custom hours). The system calculates the exact cutoff timestamp in the browser's local timezone.

If an order has unresolved dates or times, CrumbDesk displays:
> *"Change deadline unavailable — resolve the fulfillment schedule first."*

### 3. Preparation Locks & Exceptional Approvals
When the baker starts baking and moves the order to `in_preparation`, all ordinary changes are **immediately locked**, even if the 24-hour cutoff has not elapsed.

If a customer insists on a late change:
- The change request is flagged with an amber **Exception Warning**.
- Approving it requires the baker to enter a **mandatory justification reason** (whitespace-only reasons are rejected).
- An explicit **confirmation checkbox** must be checked to authorize the exception.

### 4. Field-Level Diffs & Stale Protection
Before approving a change, the baker reviews a clean visual diff:
```
Weight: 500g ➔ 1 kg
Dietary: regular ➔ eggless
```
If the accepted order was modified while a change request was pending, the proposal is detected as **stale** and blocked from overwriting newer accepted data.

### 5. Persistent Order Audit Trail
Every lifecycle transition, customer proposal, baker approval, rejection reason, and field change is recorded with timestamps in the order's history timeline.

---

## 5. Verification & Testing

CrumbDesk is backed by comprehensive automated test suites:
- **57 Vitest unit and domain tests** (`npm test`):
  - Strict CSV escaping (RFC 4180).
  - Explicit calendar date resolution and relative date preservation.
  - Negative and non-finite payment amount rejection.
  - Weight unit preservation across approved/rejected proposals.
  - Cutoff deadline calculations and preparation locks.
  - Stale change detection and backward-transition guards.
  - Safe recovery of corrupted legacy storage records without data loss.
- **6 Live Local Gemma 3 4B Integration Tests** (`npm run test:ollama`):
  - Complete order extraction.
  - Incomplete detail detection.
  - Payment ambiguity resolution.
  - Weight/quantity disambiguation.
  - Generic cake category extraction.
  - Payment omission regression verification.
- **Production Build Clean:** Zero TypeScript errors (`tsc --noEmit`), clean static page generation with Next.js Turbopack.

---

## 6. Honest Disclosures & Current Limitations

In the spirit of open-source transparency, here is an honest summary of what CrumbDesk is and what it is not today:

1. **Manual WhatsApp Copying:** CrumbDesk does **not** have an official WhatsApp Business API integration or background scraper. The baker copies the customer's chat text and pastes it into CrumbDesk's Import modal.
2. **Local Browser Storage:** All order records and change histories are stored in the browser's `localStorage`. Clearing browser data will delete unexported orders. (Bakers are encouraged to use the **Export CSV** feature regularly).
3. **Operational History, Not Cryptographic Ledger:** The Order History timeline provides an accountable kitchen operational record, not a tamper-proof cryptographic blockchain.
4. **No Financial Settlement Verification:** CrumbDesk tracks customer statements (e.g. *"I sent 1000 via GPay"*); it does not integrate with banking APIs or verify actual bank clearance.
5. **Prototype Status & Testing Scope:** CrumbDesk is an open-source prototype developed for the Hacktoberfest 2026 challenge. Validation has been conducted using synthetic, representative order messages and automated test suites (57 unit and domain policy tests, plus 6 live Gemma 3 4B integration tests). We have incorporated useful workflow feedback through Reddit community discussions with cottage food makers and hobbyist bakers; however, we have not yet established a completed real-world pilot with a baker or deployed the software into a commercial bakery.

---

## 7. What's Next?

Our roadmap for future phases includes:
- **IndexedDB & OPFS Storage:** Moving beyond `localStorage` to support higher order volumes and attached cake reference images.
- **Calendar Synchronization (.ics):** 1-click export of pickup windows to Google Calendar or Apple Calendar.
- **Thermal Kitchen Slip Printing:** Formatted 80mm printable labels for cake boxes and ingredient prep lists.
- **Multilingual Support:** Extending prompt parsing to Hinglish, Spanish, and French custom cake orders.

---

## 8. Links & Resources

- **GitHub Repository:** [CrumbDesk on GitHub](https://github.com/RishabhRaj120/CrumbY)
- **Ollama:** [https://ollama.com](https://ollama.com)
- **Model:** [Gemma 3 4B on HuggingFace / Ollama](https://ollama.com/library/gemma3:4b)
- **License:** Open Source (MIT)

*Built with passion for independent bakers who make life a little sweeter.*
