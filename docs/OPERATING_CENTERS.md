# Track 03: The 10 Specialized Revenue Recovery Operating Centers

In **RazorRisk.AI**, revenue recovery is organized into **10 specialized operating centers**, each tailored to a specific financial obligation type and handled by a dedicated specialist agent role.

---

## 1. Promise-to-Pay Center
* **Specialist Agent**: `COLLECTIONS_AGENT`
* **Trigger**: Customer expresses commitment to settle outstanding invoice on a future date (*"I will pay on Friday"*).
* **Behavior**:
  - Automatically extracts amount and promised date.
  - Locks the case in `WAITING_FOR_CUSTOMER` status.
  - Pauses outbound dunning during active grace period.
  - If paid: transitions to `VERIFIED` and marks promise `HONORED`.
  - If breached: marks promise `BROKEN` and auto-recycles the case into active recovery.

---

## 2. Partial Collections Center
* **Specialist Agent**: `COLLECTIONS_AGENT`
* **Trigger**: Customer makes a partial settlement payment (e.g. ₹60,000 against a ₹1,00,000 receivable).
* **Invariant Enforced**:
  $$\text{Verified Collected} + \text{Remaining Balance} = \text{Original Receivable}$$
* **Behavior**:
  - Automatically pairs the bank UTR for ₹60,000.
  - Transitions case state to `PARTIALLY_RECOVERED`.
  - Prohibits premature transition to `SETTLED_VERIFIED`.
  - Leaves the residual ₹40,000 active in the recovery queue for subsequent follow-up.

---

## 3. Invoice Operations Center
* **Specialist Agent**: `INVOICE_AGENT`
* **Trigger**: Overdue B2B commercial accounts with unpaid invoices.
* **Behavior**:
  - Issues commercial tax invoices with GSTIN, line items, and terms.
  - Generates downloadable PDF invoices with embedded Razorpay B2B payment links.
  - Dispatches automated dunning notices at 15d, 30d, 45d intervals.

---

## 4. Payment Links Center
* **Specialist Agent**: `PAYMENT_AGENT`
* **Trigger**: Failed consumer/SMB online checkouts and transient gateway drops.
* **Behavior**:
  - Generates idempotent, instant 1-click payment links (UPI / Web).
  - Tracks full lifecycle states: `CREATED` $\rightarrow$ `DELIVERED` $\rightarrow$ `VIEWED` $\rightarrow$ `PAID` / `EXPIRED`.
  - Enforces a 2-hour cooldown window to prevent link spam.

---

## 5. B2B Aging Center
* **Specialist Agent**: `INVOICE_AGENT`
* **Trigger**: Aging commercial receivables across overdue brackets.
* **Brackets**:
  - **15–30 Days**: Soft reminder + embedded payment link.
  - **31–60 Days**: Urgent notice + early payment incentive option.
  - **61–90 Days**: Executive escalation + automated 2-round negotiation.
  - **90+ Days**: Legal notice trigger or human review write-off evaluation.

---

## 6. Subscription Recovery Center
* **Specialist Agent**: `SUBSCRIPTION_RECOVERY_AGENT`
* **Trigger**: Recurring SaaS drops (`AUTOPAY` decline, expired card error `54`).
* **Behavior**:
  - Dispatches smart recurring payment retries.
  - Sends secure card instrument update links to prevent involuntary churn.
  - Executes multi-day dunning cadence (Days 1, 3, 5, 7).

---

## 7. Mandate Recovery Center
* **Specialist Agent**: `MANDATE_RECOVERY_AGENT`
* **Trigger**: UPI AutoPay and e-mandate execution drops.
* **Behavior**:
  - Analyzes NPCI switch timeout error codes.
  - Re-schedules retries aligned with issuing bank processing windows.
  - Falls back to instant 1-click UPI collection links upon repeated mandate failure.

---

## 8. Checkout Drop-Off Center
* **Specialist Agent**: `COLLECTIONS_AGENT`
* **Trigger**: High-intent cart abandonments and drop-offs.
* **Behavior**:
  - Dispatches timely 1-click WhatsApp cart recovery nudges.
  - Offers bounded incentives ($\le 5\%$) within merchant policy limits.

---

## 9. Voice Recovery Simulator
* **Specialist Agent**: `VOICE_RECOVERY_AGENT`
* **Mode**: Clearly labeled **SIMULATED VOICE**.
* **Behavior**:
  - Simulates natural phone collection dialogues in English, Hindi, and Hinglish.
  - Parses colloquial commitments (*"Friday ko payment kar dunga"*) and records structured `PromiseToPay` records.

---

## 10. Negotiation Center
* **Specialist Agent**: `NEGOTIATION_AGENT`
* **Trigger**: High-value commercial accounts ($\ge$ ₹50,000).
* **Protocol**: Bounded 2-round negotiation.
* **Hard Guardrails**:
  - Maximum discount: Clamped to $\le 10.0\%$ ($1000$ bps).
  - Minimum settlement floor: Enforced at $\ge 85.0\%$.
  - Counter-offers exceeding policy limits are automatically rejected or clamped.
