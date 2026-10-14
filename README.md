# CrumbDesk
> **A Local-First AI Order Management Tool for Independent Home Bakers**  
> *Built for the Hacktoberfest 2026 Open-Source AI Challenge*

---

## 1. Project Description
**CrumbDesk** is an open-source, local-first web application designed for independent micro-bakers and cottage pastry chefs. It transforms raw, unstructured customer messages from WhatsApp, Instagram DMs, or SMS into reviewable, structured bakery orders.

By running the open-weight **Gemma 3 4B** model locally via **Ollama**, CrumbDesk extracts essential baking parameters (flavors, item counts, weights, requested schedules, pickup/delivery methods, and customer-reported payment details) entirely on the baker's machine. No customer message ever leaves the computer, avoiding cloud inference subscriptions and protecting customer privacy.

---

## 2. The Problem
Independent home bakers run their entire sales pipeline through chat apps like WhatsApp and Instagram. Customers send unstructured messages such as:

> *"Heyy, need a 1kg chocolate truffle cake for Sunday evening. Eggless please. It is for my sister's birthday. Can I pick it up around 6? Paid 1200 through GPay."*

The baker has to manually parse, track, and remember:
- Specific product & flavor requested
- Distinct quantity vs cake weight (e.g., 1 cake vs 1 kg)
- Stated requested day vs actual calendar date
- Pickup vs delivery time window
- Dietary restrictions (eggless, gluten-free, vegan)
- Fulfillment method
- Customer-reported payment amount & mode (vs what has actually been bank-verified)
- Missing details requiring clarification before baking

When multiple orders arrive each week, messages get buried, dietary restrictions are easily overlooked, and dates get mixed up. CrumbDesk eliminates this manual administrative burden through an accountable, human-in-the-loop review pipeline.

---

## 3. Target Users
- **Independent Home Bakers & Pastry Chefs:** Operating custom-order bakeries from home kitchens.
- **Micro-Bakery Businesses:** Small artisanal bread and cake shops taking pre-orders via WhatsApp or Instagram.
- **Cottage Food Producers:** Makers balancing ingredient procurement, baking timelines, and order fulfillment.

---

## 4. Core Features
- **One-Click Message Import:** Paste any unstructured customer chat message (supports up to 5,000 characters).
- **Local Gemma 3 4B Extraction:** Extracts structured fields using an on-device model without third-party cloud APIs.
- **Strict Payment Data Integrity:** Never extracts or accepts negative, NaN, or non-finite payment amounts. When the customer does not mention payment, the application ensures `payment_amount: null`, `payment_method: null`, and `payment_status: "not_mentioned"`. It strictly prohibits inventing payment methods (e.g. Cash, GPay, UPI) or assuming bank verification.
- **Weight Unit Preservation:** Weights are stored and displayed with explicit units (`1 kg`, `500g`, `2 lbs`). Proposing changes (e.g. `500g -> 1 kg`) preserves units and normalizes bare inputs so bare numbers like `1000` never appear.
- **Quantity & Weight Separation:** Disallows confusing cake weight (e.g. 500g) with count (e.g. 1 cake).
- **Verbatim Date Preservation:** Preserves original customer expressions (`"Sunday evening"`) and only resolves ISO dates when unambiguous calendar context exists.
- **Strict Payment Classification:** Differentiates customer-reported payment (`customer_reported_paid`) from actual bank verification. Never claims unverified transactions are bank-verified.
- **Interactive Order Review Panel:** Full editable form allowing the baker to correct any AI mistakes or fill gaps before confirming, with client-side and domain validation.
- **Order Lifecycle Progression:** Enforces a controlled lifecycle (`needs_review -> confirmed -> in_preparation -> ready -> completed`, plus `cancelled`) with backwards transition guards.
- **Configurable Change Window Cutoff:** Configurable cutoff (default 24h; options 12h, 24h, 48h, 72h, custom) calculated in the browser's local timezone.
- **Schedule Resolution Guard:** Calculates deadlines only when both an exact calendar date (`YYYY-MM-DD`) and fulfillment time (`HH:mm`) are resolved; never invents dates.
- **Manual Change Request Workflow:** Customers request changes via chat; the baker manually records change proposals in CrumbDesk without silent overwrites. Pending proposals never mutate accepted order data.
- **Field-Level Diff Comparison:** Compares accepted order vs proposed changes side-by-side, rendering only changed fields with explicit units preserved.
- **Preparation Lock & Exception Rules:** Transitioning to *In Preparation* immediately locks ordinary changes. Late or in-prep changes require an explicit exception approval, a non-empty baker reason (whitespace-only rejected), and deliberate checkbox confirmation.
- **Stale Change Protection:** Automatically rejects stale proposals if the accepted order was modified after the request was created.
- **Persistent Order History:** Records lifecycle milestones, field-level modifications, previous/new values with units, timestamps, and baker reasons across browser refreshes.
- **Visual Warning Flags:** Highlights missing fields (e.g., unresolved dates, unspecified fulfillment) before confirmation.
- **Deterministic Customer Reply Drafter:** Generates polite reply templates to ask for missing information in 1 click, with copy-to-clipboard functionality.
- **Live Order Management Dashboard:** Filter by review status, payment status, and fulfillment method; instant search across customer names, products, and notes.
- **RFC 4180 CSV Export:** Exports `crumbdesk-orders.csv` with escaped commas, quotes, and newlines; suppresses invalid payment values.
- **Local Browser Persistence:** Orders survive refreshes via validated `localStorage` with safe sanitization of corrupt or negative payment amounts without deleting records.
- **Sample Demo Dataset:** Optional, clearly tagged demo orders (`[DEMO SAMPLE]`) that can be loaded and wiped in 1 click.

---

## 5. Example Input and Structured Output

### Input Message:
```text
"Hi, need one 1kg chocolate truffle cake for Sunday at 6 PM. Eggless please. Pickup. I have paid 1200 through GPay."
```

### Extracted Structured Output:
```json
{
  "customer_name": null,
  "product": "chocolate truffle cake",
  "quantity": 1,
  "weight": "1kg",
  "requested_date": "Sunday",
  "resolved_date": null,
  "requested_time": "18:00",
  "dietary_preference": "eggless",
  "fulfillment_method": "pickup",
  "payment_amount": 1200,
  "payment_currency": null,
  "payment_method": "GPay",
  "payment_status": "customer_reported_paid",
  "notes": [],
  "missing_or_unverified": [
    "Exact calendar date"
  ],
  "requires_confirmation": true
}
```

---

## 6. Technology Stack
- **Framework:** [Next.js](https://nextjs.org/) (App Router, React 19, Server Components & Route Handlers)
- **Language:** TypeScript 5.8
- **Styling:** Tailwind CSS with a bakery-inspired aesthetic (espresso, warm cream, muted terracotta, sage green)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Data Validation:** [Zod](https://zod.dev/)
- **Local AI Inference:** [Ollama](https://ollama.com/) running **Gemma 3 4B** (`gemma3:4b`)
- **Storage:** Browser `localStorage` with schema safety
- **Testing:** [Vitest](https://vitest.dev/) for fast unit tests

---

## 7. Architecture Overview

```
                      +-----------------------------+
                      |   Browser / React Client    |
                      |  (Dashboard, Review Panel)  |
                      +--------------+--------------+
                                     |
               POST /api/extract-order (Max 5,000 chars)
               GET  /api/ollama-status
                                     |
                      +--------------v--------------+
                      |     Next.js API Route       |
                      |   (Server-Side Validation)  |
                      +--------------+--------------+
                                     |
                          Local HTTP Request
                          http://127.0.0.1:11434/api/chat
                                     |
                      +--------------v--------------+
                      |        Ollama Engine        |
                      |         Gemma 3 4B          |
                      |   (Single-call, temp=0.1)   |
                      +--------------+--------------+
                                     |
                             JSON Extraction
                                     |
                      +--------------v--------------+
                      |   Zod Validation & Guard    |
                      | (Normalizes, Enforces Rules)|
                      +--------------+--------------+
                                     |
                      +--------------v--------------+
                      |  Local Browser Persistence  |
                      |  (localStorage + Sync Bus)  |
                      +-----------------------------+
```

### Architectural Principles:
1. **Never call Ollama from the browser:** Client components never connect directly to `http://127.0.0.1:11434`. All requests route through `/api/extract-order`.
2. **Single-flight model calls:** Disables duplicate extraction clicks while inference is running.
3. **No heavy orchestration:** No LangChain, CrewAI, vector databases, Redis, or Docker containers. Just one clean, reliable local model call.
4. **Deterministic draft replies:** Generating customer replies uses deterministic templates based on missing fields, saving model calls and memory.

---

## 8. Why Local Open-Weight AI is Appropriate
1. **Zero Recurring Inference Fees:** Independent bakers operate on tight margins. Paying per-token cloud AI fees for every Instagram DM is unsustainable.
2. **True Data Privacy:** Customer messages contain personal phone numbers, delivery addresses, and payment details. Local models ensure this data never leaves the baker's machine.
3. **Domain Tailoring without Cloud Lock-in:** The extraction prompt and post-processing logic are specifically tuned for bakery nuances (sponge weights vs counts, eggless substitutions).
4. **Offline Capability:** A baker with an erratic internet connection can still extract and organize customer orders locally.
5. **Human-in-the-Loop Safeguards:** Open-weight models are practical assistants, not infallible authorities. The UI explicitly flags ambiguities for human review.

---

## 9. How Gemma 3 and Ollama are Used
- **Model:** Google's **Gemma 3 4B** instruction-tuned model (`gemma3:4b`).
- **Runtime:** Ollama's local HTTP API daemon on `http://127.0.0.1:11434`.
- **Extraction Protocol:**
  - Sent with `stream: false` and `format: "json"` to minimize CPU/memory overhead.
  - Conservative temperature (`temperature: 0.1`) ensures strictly factual extraction.
  - Server-side normalization parses code fences, converts string quantities, and enforces that payments are never marked as bank-verified.

---

## 10. Prerequisites
- **Operating System:** Windows 10/11, macOS, or Linux.
- **RAM:** Minimum 8 GB RAM (Gemma 3 4B operates smoothly within ~3.4 GB of memory).
- **Node.js:** v18.18+ (tested on Node v24.16).
- **Ollama:** Installed and running locally.

---

## 11. Installation Instructions

### Step 1: Clone the Repository
```bash
git clone https://github.com/RishabhRaj120/CrumbY.git
cd CrumbY
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment (Optional)
A `.env.example` file is included. Create a local copy if your Ollama endpoint differs from defaults:
```bash
cp .env.example .env.local
```
Defaults:
```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma3:4b
OLLAMA_TIMEOUT_MS=45000
```

---

## 12. How to Download Gemma 3 4B
Open your terminal (PowerShell on Windows, Terminal on macOS/Linux) and run:
```bash
ollama pull gemma3:4b
```
This downloads the 3.4 GB quantized Gemma 3 4B model into Ollama's local model cache.

---

## 13. How to Start Ollama
Ensure Ollama is running in the background. On Windows, Ollama typically runs from the system tray. If not started, launch it from the terminal:
```bash
ollama run gemma3:4b
```
Verify Ollama is reachable:
```bash
curl http://127.0.0.1:11434/api/tags
```

---

## 14. How to Run the Application
Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

To create an optimized production build:
```bash
npm run build
npm run start
```

---

## 15. How to Run the Tests

### Fast Unit & Domain Policy Tests (Vitest)
Runs 57 focused tests covering CSV escaping, Zod schema validation, output parsing, explicit date/time resolution, payment data integrity, weight unit preservation, cutoff deadlines, lifecycle transitions, exception safeguards, and storage recovery:
```bash
npm test
```

### Live Gemma 3 4B Integration Tests
Runs all six core challenge & regression test cases against the live running Next.js server and local Ollama Gemma 3 4B model:
```bash
# Make sure 'npm run dev' or 'npm run start' is running in another terminal
npm run test:ollama
```

### TypeScript Validation
```bash
npm run lint
```

---

## 16. Order Change Control & Kitchen Governance

CrumbDesk implements a structured kitchen governance and order change control architecture designed for independent home bakery workflows:

```
[Needs Review] ──► [Confirmed] ──► [In Preparation] ──► [Ready] ──► [Completed]
       │                   │                 │
       ▼                   ▼                 ▼
  [Cancelled]         [Cancelled]       [Cancelled] (Mandatory Kitchen Reason)
```

### Core Business Rules:
1. **The Baker Retains Final Authority:** Customers contact the baker over WhatsApp, Instagram, or phone to request modifications. Customer messages do not automatically alter accepted orders, nor does CrumbDesk connect directly to WhatsApp or expose a customer-facing edit portal. The baker manually records requested modifications into CrumbDesk.
2. **Locked Accepted Orders:** Once an order is confirmed, ordinary direct editing of protected specifications (product, weight, quantity, schedule, preferences, payment) is disabled. To propose alterations, the baker records a *Change Request*.
3. **Field-Level Diff Inspection:** Before approving any change, CrumbDesk displays a clear comparison of accepted values versus proposed values, highlighting only the fields that actually changed (e.g. `Weight: 500g ➔ 1 kg`).
4. **Configurable Change Cutoff:**
   - Default: **24 hours** prior to scheduled fulfillment.
   - Configurable in Settings (presets: 12h, 24h, 48h, 72h, or custom hours).
   - Calculated in the browser's local timezone: `fulfillment datetime - cutoff hours`.
   - **Schedule Resolution Requirement:** Deadlines are only computed when both an exact calendar date (`YYYY-MM-DD`) and fulfillment time (`HH:mm`) are resolved. If either is missing, CrumbDesk displays *"Change deadline unavailable — resolve the fulfillment schedule first"* and never silently assumes an order is inside or outside the window.
5. **Preparation-Started Lock:**
   - Transitioning an order to `in_preparation` records `preparation_started_at` and immediately locks ordinary changes, even if the 24-hour cutoff has not passed.
   - Once preparation starts, any subsequent change requires an explicit exception approval, a clear warning about ingredient and schedule disruption, a mandatory baker reason, and deliberate confirmation.
6. **Stale Request Protection:** If an accepted order is modified while a change request is pending, approving the stale proposal is blocked to prevent overwriting newer accepted data.
7. **Single Pending Request Rule:** Only one pending change request is permitted per order at a time to prevent conflicting proposals.
8. **Permanent Order History:** All lifecycle transitions, customer change proposals, baker decisions, previous/new field values, timestamps, and exception reasons are permanently preserved in the order's history. *(Note: History is persisted in browser localStorage and is an operational audit record, not a tamper-proof cryptographic log).*

---

## 17. Privacy Considerations
1. **Local-Only Inference:** Customer text is sent solely to `http://127.0.0.1:11434`. No external cloud APIs are called.
2. **No Tracking or Analytics:** CrumbDesk does not include telemetry, tracking pixels, or third-party cookies.
3. **No Unencrypted Server Databases:** All order data remains in the user's browser storage.
4. **Console Privacy:** The server API route sanitizes logs and does not print complete customer messages or phone numbers to console output.
5. **No Automatic Customer Communication:** CrumbDesk provides template drafts for manual review; it never connects directly to WhatsApp or sends messages without baker consent.

---

## 18. Validation Status & Known Limitations

### Testing & Validation Scope
- **Synthetic & Representative Order Testing:** Validation has primarily used synthetic, representative customer chat messages reflecting typical informal WhatsApp and Instagram ordering patterns, combined with automated test suites (57 unit and domain policy tests, plus 6 live Ollama integration tests).
- **Feedback from Potential Users:** We engaged with cottage food makers and hobbyist bakers in Reddit baking communities to understand real-world scheduling pain points, last-minute change conflicts, and why cloud subscription tools fail micro-kitchens.
- **Pilot & Deployment Status:** We have **not** yet established a completed real-world pilot with a baker or deployed the software into a commercial bakery. CrumbDesk is an open-source functional prototype built for the Hacktoberfest 2026 challenge.

### Known Limitations
- **Browser localStorage Storage:** Data is stored in the browser's `localStorage`. Clearing browser cookies/cache will clear unexported orders. (Use the **Export CSV** button regularly).
- **Single-Device Access:** Because orders reside in browser storage, orders created on one laptop will not automatically synchronize to a mobile device.
- **Hardware-Dependent Latency:** On laptops with 8 GB RAM and no dedicated GPU, Gemma 3 4B takes approximately 2 to 5 seconds per extraction. The UI provides a live progress timer.
- **Payment Verification:** CrumbDesk intentionally cannot verify actual bank transactions or UPI settlements. It relies on the baker to check their banking app.
- **Manual Change Recording:** Because CrumbDesk does not integrate directly with WhatsApp or Instagram APIs, changes requested by customers must be manually recorded by the baker. The application cannot technically prevent a customer from sending change requests in chat apps.

---

## 19. Troubleshooting Common Ollama Errors

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"Could not reach Ollama at http://127.0.0.1:11434"** | Ollama daemon is stopped. | Run `ollama serve` or open the Ollama desktop app. |
| **"Model 'gemma3:4b' not found in Ollama"** | Model has not been pulled. | Run `ollama pull gemma3:4b` in your terminal. |
| **"Extraction timed out after 45s"** | Laptop CPU/RAM is heavily occupied. | Close background memory-heavy apps and try again. You can increase `OLLAMA_TIMEOUT_MS=60000` in `.env.local`. |
| **"Extracted data failed validation"** | Model output returned unexpected structure. | CrumbDesk's conservative parser will catch this and display a friendly message. Re-try or edit fields manually. |

---

## 20. Future Improvements
- **Local SQLite / IndexedDB Storage:** Upgrade storage to IndexedDB or OPFS (Origin Private File System) for larger order volume and attachment storage.
- **Calendar ICS Export:** Export confirmed pickup and delivery slots directly to Google Calendar or Apple Calendar.
- **Order Slip Printing:** Format 80mm thermal receipt slips for kitchen prep and cake box labeling.
- **Multi-lingual Extraction:** Support mixed-language bakery requests (e.g., Hinglish, Spanish, French cake requests).

---

## 21. Submission Checklist (Hacktoberfest 2026)
- [x] Application starts cleanly (`npm run dev`)
- [x] Responsive bakery-themed dashboard with live statistics
- [x] Real local Gemma 3 4B inference integrated via Ollama
- [x] Strict Zod schemas validating all payloads
- [x] Distinct separation of quantity vs weight
- [x] Original requested dates preserved; no invented calendar dates
- [x] Strict distinction between customer-reported payment and bank verification
- [x] Editable order review panel before confirmation
- [x] Explicit warnings for missing/unverified details
- [x] Browser persistence across page refreshes
- [x] Live search and multi-criteria filters
- [x] Safe order editing and deletion with confirmation
- [x] Template-based customer reply drafter with 1-click clipboard copy
- [x] RFC 4180 CSV export (`crumbdesk-orders.csv`)
- [x] Sample demo dataset with clear `[DEMO SAMPLE]` identification
- [x] Controlled order lifecycle (`needs_review` -> `confirmed` -> `in_preparation` -> `ready` -> `completed`, `cancelled`)
- [x] Configurable order change cutoff (default 24h; 12h, 24h, 48h, 72h, custom)
- [x] Immediate preparation-started edit locks & exceptional approval governance
- [x] Change request diff comparisons & stale proposal safeguards
- [x] Persistent order lifecycle and change history surviving page refreshes
- [x] 57 automated unit & policy tests + 6 live Ollama integration tests passing
- [x] TypeScript checks pass (`npm run lint`)
- [x] Production build succeeds (`npm run build`)
- [x] Zero cloud AI dependencies or paid services required
