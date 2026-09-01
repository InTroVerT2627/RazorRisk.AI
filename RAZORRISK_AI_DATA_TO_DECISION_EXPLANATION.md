# RazorRisk.AI: From Raw Financial Data to Verified Cash Recovery

> **Authoritative Technical & Presentation Specification**  
> **Core Fintech Law**: *LLM Decides. Code Enforces. Ledger Stores State. Reconciliation Verifies Real Outcomes. Audit Log Records Everything.*  
> **Document Purpose**: Complete technical reference and presentation guide for the RazorRisk.AI architecture, feature engineering, risk scoring, collections engines, and closed-loop verification.

---

## 1. Executive Overview

Modern payment ecosystems (such as Razorpay, UPI, Net Banking, Cards, and B2B Invoicing) generate millions of fragmented events across payment gateways, merchant ledgers, and banking networks. When payments fail, invoices age, or settlements mismatch, organizations typically suffer from manual reconciliation delays, disconnected fraud risk assessments, and uncontrolled collection attempts.

**RazorRisk.AI** transforms fragmented payment telemetry into verified recovered revenue through a deterministic, policy-governed multi-agent pipeline:

$$\text{Raw Financial Feeds} \longrightarrow \text{Reconciliation} \longrightarrow \text{Risk Scoring} \longrightarrow \text{Eligibility Gate} \longrightarrow \text{Adaptive Recovery} \longrightarrow \text{Policy Boundaries} \longrightarrow \text{Execution} \longrightarrow \text{Bank UTR Verification} \longrightarrow \text{Immutable SHA-256 Audit}$$

```mermaid
flowchart TD
    RAW[Raw Ingestion:\nTransactions, Bank Settlements, Gateway Codes]
    
    FEAT[Feature Engineering & Context Extraction]
    
    subgraph Operations ["Three Independent Operational Workspaces"]
        T04[Track 04: Finance Controller\nDeterministic Reconciliation & Fee Netting]
        T02[Track 02: Risk Manager\nContinuous Multi-Signal Scoring 0-100]
        T03[Track 03: Revenue Recovery\n10 Specialized Operating Centers]
    end
    
    POLICY[Deterministic Policy Engine\n12 Programmatic Guardrails]
    
    EXEC[Execution Layer\nRazorpay Sandbox / Simulation / Messaging]
    
    VERIF[Closed-Loop Verification\nReconciliation Engine Bank UTR Match]
    
    AUDIT[Immutable SHA-256 Hash Chain\nTamper-Evident Ledger Storage]
    
    RAW --> FEAT
    FEAT --> T04
    FEAT --> T02
    FEAT --> T03
    
    T04 -->|Discrepancies & Candidates| POLICY
    T02 -->|Risk Classifications| POLICY
    T03 -->|Action Proposals| POLICY
    
    POLICY -->|Authorized Actions Only| EXEC
    EXEC --> VERIF
    VERIF -->|SETTLED_VERIFIED| AUDIT
```

---

## 2. What Data Does RazorRisk.AI Use?

The platform ingests and correlates 13 distinct data classes:

| # | Data Category | Primary Source | Key Attributes | Subsystem Consumer |
|---|---|---|---|---|
| **A** | **Transaction Telemetry** | Gateway API / Webhooks | `id`, `amountCents`, `paymentMethod`, `errorCode`, `customerSegment` | Ingestion, Reconciliation, Risk, Recovery |
| **B** | **Settlement & Bank Records** | Bank Nodal Feed / UTR File | `utrRrn`, `batchId`, `netAmountCents`, `feeCents`, `taxCents`, `rawDescription` | Reconciliation Engine, Verification |
| **C** | **Customer Profile** | CRM / Identity Store | `customerId`, `segment` (Enterprise/SMB), `accountTenureMonths`, `phone`, `email` | Risk Radar, Priority Engine, Routing |
| **D** | **Payment Behavior** | Gateway History | `attemptCount`, `lastPaymentDate`, `preferredChannel`, `autopayStatus` | Recovery Supervisor, Playbooks |
| **E** | **Multi-Signal Risk Telemetry** | Device & Network Sensors | `velocity24h`, `deviceFingerprint`, `linkedAccounts`, `failedCardAttempts` | Risk Manager, AI Provider |
| **F** | **Recovery History** | Opportunity Store | `attemptCount`, `contactCount`, `lastActionAt`, `cooldownUntil`, `channelPerformance` | Eligibility Engine, Playbooks |
| **G** | **Invoice Records** | ERP / Billing Engine | `invoiceNumber`, `dueDate`, `daysOverdue`, `lineItems`, `gstin`, `pdfPath` | Invoice Operations Center |
| **H** | **Subscription Telemetry** | SaaS Billing Engine | `planId`, `cadence`, `nextBillingDate`, `mandateStatus`, `dunningStep` | Subscription Recovery Center |
| **I** | **Mandate Telemetry** | NPCI / UPI AutoPay Hub | `mandateId`, `umn`, `bankCode`, `switchWindow`, `executionAttempts` | Mandate Recovery Center |
| **J** | **Checkout Telemetry** | E-commerce Storefront | `cartId`, `cartValueCents`, `dropoffStage`, `itemCount`, `abandonedAt` | Checkout Drop-Off Center |
| **K** | **Campaign Configuration** | Growth / FinOps Console | `targetSegments`, `maxDiscountBps`, `budgetCapCents`, `concurrencyLock` | Campaign Manager |
| **L** | **Policy Configuration** | Merchant Rules Store | `maxDiscountBps`, `minSettlementFloorBps`, `maxRetries`, `cooldownHours` | Programmatic Policy Engine |
| **M** | **Audit Trail** | Internal Cryptographic Store | `blockId`, `prevHash`, `currentHash`, `event`, `actor`, `timestamp` | SHA-256 Audit Logger |

---

## 3. Transaction Data Model (`TransactionRecord`)

The core transaction structure (`src/types/index.ts` lines 8–31) captures the full financial and technical lifecycle of a payment:

```typescript
export interface TransactionRecord {
  id: string;                                    // Unique transaction identifier (e.g. "tx_94821")
  merchantId: string;                            // Multi-tenant merchant ID (e.g. "MERCHANT_DEFAULT")
  externalRef: string;                           // Gateway Order ID or external UTR (e.g. "order_HDFC_91283")
  amountCents: number;                           // Gross transaction amount in paise/cents (e.g. 500000 = ₹5,000.00)
  currency: string;                              // ISO currency code (e.g. "INR")
  paymentMethod: string;                         // Instrument: "UPI" | "CREDIT_CARD" | "DEBIT_CARD" | "NET_BANKING" | "WALLET"
  customerName: string;                          // Customer legal or registered name
  customerEmail?: string;                        // Customer contact email
  customerPhone?: string;                        // Customer contact telephone (masked in AI contexts)
  customerSegment?: CustomerSegment;             // "ENTERPRISE" | "MID_MARKET" | "SMB" | "CONSUMER"
  gatewayCode?: string;                          // Routing switch (e.g. "HDFC_PG", "NPCI_SWITCH", "ICICI_UPI")
  errorCode?: string;                            // Gateway failure code (e.g. "504_GATEWAY_TIMEOUT", "CARD_EXPIRED_54")
  errorDescription?: string;                     // Human-readable technical error explanation
  daysOverdue?: number;                          // Days past original due date (for commercial invoices)
  status: TransactionStatus;                     // "CAPTURED" | "FAILED" | "REFUNDED" | "DISPUTED" | "SUCCESS" | "PENDING"
  metadata?: Record<string, any>;                // Extensible key-value telemetry (device fingerprint, IP, cart metadata)
  createdAt: string;                             // ISO-8601 creation timestamp
}
```

---

## 4. Settlement & Bank Data Model (`SettlementRecord`)

The settlement structure (`src/types/index.ts` lines 33–50) represents actual bank cash movements credited to the nodal account:

```typescript
export interface SettlementRecord {
  id: string;                                    // Internal settlement UUID (e.g. "stl_39104")
  batchId: string;                               // Bank clearance batch identifier (e.g. "BATCH_20260901_01")
  utrRrn: string;                                // Unique Transaction Reference from Bank (e.g. "UTR9182374619")
  amountCents: number;                           // Gross settlement amount in paise (e.g. 200000 = ₹2,000.00)
  feeCents: number;                              // MDR fee deducted by switch/gateway (e.g. 4000 = ₹40.00)
  taxCents: number;                              // 18% GST applicable on fee (e.g. 720 = ₹7.20)
  netAmountCents: number;                        // Net money credited to bank account: Gross - (Fee + Tax) = ₹1,952.80
  currency: string;                              // ISO currency code (e.g. "INR")
  bankTimestamp: string;                         // Bank clearance ISO-8601 timestamp
  rawDescription: string;                        // Raw unstructured bank narration (e.g. "CMS/HDFC/UTR9182374619/AcmeCorp")
  reconciledStatus?: ReconStatus;                // "EXACT_MATCH" | "FEE_MISMATCH" | "UNMATCHED_TRANSACTION"
  createdAt: string;                             // Ingestion timestamp
}
```

---

## 5. Synthetic Financial Universe & Noise Engine

To evaluate the platform against realistic enterprise conditions, RazorRisk.AI includes a deterministic **Synthetic World Generator** (`src/data/synthetic/`):

* **Seeded PRNG (`AleaPRNG`)**: Guarantees bit-level identical datasets across test runs using reproducible cryptographic seeds.
* **48 Scenario Families**:
  1. **Normal Operations (40%)**: Clean 1:1 matches, scheduled AutoPay successes, standard invoice payments.
  2. **Benign Anomalies (25%)**: MDR fee variances (1.5%–2.5%), timing drift across banking holidays, corrupted bank narrations.
  3. **Recoverable Failures (20%)**: Gateway timeouts (504), expired cards (`54`), transient UPI switch drops, overdue B2B invoices.
  4. **Adversarial Risk & Fraud (15%)**: Shared device clusters, rapid velocity bursts, card testing/probing patterns, syndicate rings.
* **Realistic Noise Injection (`NoiseEngine`)**:
  - **Narration Corruption**: Injects OCR errors, bank truncation, random token drops, and extra whitespace into bank strings.
  - **Timestamp Jitter**: Simulates $T+1$ to $T+3$ banking clearance delays and weekend cutoffs.
  - **MDR Netting & GST**: Automatically deducts variable gateway commission ($1.5\% - 2.5\%$) plus $18\%$ GST on fees.

---

## 6. Track 04: Finance Controller & Reconciliation

Reconciliation answers the core accounting question: **"What happened to the money?"**

```mermaid
flowchart TD
    TX[Transaction Record] --> EXACT{Step 1:\nExact 1:1 Match?\nexternalRef & grossAmount}
    
    EXACT -->|Yes| MATCH[Status: EXACT_MATCH\nAI Invoked: NO\nLLM Cost: $0.00\nState: RECONCILED]
    
    EXACT -->|No| FEE{Step 2:\nMDR Fee & Tax Netting?\nNet == Gross - Fee - GST}
    
    FEE -->|Yes| NET_MATCH[Status: FEE_MISMATCH\nVariance Explained\nAI Invoked: NO\nState: RECONCILED]
    
    FEE -->|No| FUZZY[Step 3:\nCandidate Search & Fuzzy Join\nExtract UTR / Name Similarity]
    
    FUZZY --> AI_FC{Confidence >= 0.85\nor Ambiguous?}
    
    AI_FC -->|Ambiguous| TOOLS[Finance Controller Agent\nCalls Structured Tools:\n- getSettlementCandidates\n- computeFeeDeductions]
    
    TOOLS --> CASE[Create FinOps Exception Case\nState: EXCEPTION_DETECTED]
```

### Reconciliation Numerical Example

$$\begin{aligned}
\text{Transaction Gross Amount} &= ₹2,000.00 \quad (200,000\text{ cents}) \\
\text{Gateway MDR Rate (2.0\%)} &= ₹40.00 \quad (4,000\text{ cents}) \\
\text{GST on MDR (18.0\%)} &= ₹7.20 \quad (720\text{ cents}) \\
\text{Total Deductions} &= ₹47.20 \quad (4,720\text{ cents}) \\
\mathbf{\text{Expected Net Bank Settlement}} &= \mathbf{₹1,952.80} \quad (195,280\text{ cents})
\end{aligned}$$

When the bank feed presents a credit of **₹1,952.80** for a **₹2,000.00** transaction, the deterministic `ReconciliationEngine` matches the mathematical variance exactly, resolves the record with **zero AI API cost**, and verifies settlement.

---

## 7. Track 02: Risk Manager & Multi-Signal Radar

The Risk Manager answers the security question: **"Is this transaction safe and legitimate?"**

### Continuous Feature-Weighted Scoring Model
Implemented in [`src/core/ai/provider.ts`](file:///c:/Users/musai/RazorRisk.AI/src/core/ai/provider.ts), replacing discrete categories with a continuous 0–100 mathematical risk score:

$$\text{RiskScore} = \text{Clamp}_{0}^{100}\left( \text{Base} + S_{\text{velocity}} + S_{\text{device}} + S_{\text{linked}} + S_{\text{dispute}} + S_{\text{probing}} + \text{Jitter} \right)$$

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Base Score Baseline:                      12 points                      │
│ 2. Velocity Contribution (0-30 pts):                                        │
│    • Velocity >= 15 tx / 24h:                +30 points                     │
│    • Velocity 8-14 tx / 24h:                 +15 + (velocity - 8) * 2.1     │
│    • Velocity 4-7 tx / 24h:                  +5 + (velocity - 4) * 2.5      │
│ 3. Device Cluster Risk (0-25 pts):                                          │
│    • High-Risk Fraud Cluster Fingerprint:    +25 points                     │
│    • Elevated Device Anomaly:                +18 points                     │
│    • Moderate Device Anomaly:                +8 points                      │
│ 4. Linked Accounts on Device (0-15 pts):                                    │
│    • Accounts >= 4:                          min(15, (accounts - 3) * 5)    │
│ 5. Dispute / Chargeback Ratio (0-20 pts):                                   │
│    • Ratio >= 0.40:                          +20 points                     │
│    • Ratio 0.20 - 0.39:                      +8 + (ratio - 0.20) * 60       │
│    • Ratio 0.10 - 0.19:                      +3 + (ratio - 0.10) * 50       │
│ 6. Failed Card Probing Attempts (0-12 pts):                                 │
│    • Failed Cards >= 6:                      +12 points                     │
│    • Failed Cards 3-5:                       +4 + (cards - 3) * 2.7         │
│ 7. Deterministic Jitter:                     -3 to +3 pts (prompt hash)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Risk Routing & Operational Action Gates

```mermaid
flowchart LR
    SCORE[Computed Continuous Risk Score: 0 to 100]
    
    SCORE -->|Score >= 70| BLOCK[CRITICAL_FRAUD\nAction: BLOCK_AND_BLACKLIST\nPolicy Rule 1 Triggered\nRecovery Strictly Prohibited]
    
    SCORE -->|Score 55 to 69| RISK_SHAPED[RISK_SHAPED\nAction: REQUIRE_HUMAN_REVIEW\nEscalated to FinOps Queue]
    
    SCORE -->|Score 40 to 54| BORDERLINE[BORDERLINE_REVIEW\nAction: REQUIRE_HUMAN_REVIEW\nEscalated to FinOps Queue]
    
    SCORE -->|Score < 40| CLEAR[OPS_SHAPED\nAction: PROCEED_TO_RECOVERY\nCleared for Operational Action]
```

---

## 8. Track 03: Revenue Recovery Eligibility & Operating Centers

Revenue Recovery answers the operational question: **"How should we collect money that is legitimately owed?"**

### The 10 Programmatic Eligibility Rules
Not every financial exception is eligible for recovery. The `RecoveryEligibilityEngine` (`src/core/recovery/eligibility-engine.ts`) evaluates:

1. **Risk Gate**: Case must have Risk Score $< 70$ (strictly excludes fraud).
2. **Outstanding Amount**: Recoverable balance must be $> 0$ (excludes fully settled cases).
3. **Terminal State**: Case must not be `CLOSED_UNRESOLVED` or `CLOSED_WRITTEN_OFF`.
4. **Customer Opt-Out**: Customer profile must not be marked `DO_NOT_CONTACT`.
5. **Cooldown Window**: Must be $\ge 4$ hours since last automated contact.
6. **Daily Frequency Ceiling**: Maximum 2 outbound contacts per 24-hour window.
7. **Campaign Mutex Lock**: Case must not be claimed by another active concurrent campaign.
8. **Promise-to-Pay Grace**: Active promises pause dunning until the due date expires.
9. **Economic Viability**: Expected net recovery ($Amount \times Prob - Cost$) must be positive.
10. **Invoice / Instrument Validity**: Invoice or mandate must be within legal collection tenure.

---

## 9. Priority & Opportunity Scoring

Eligible recovery opportunities are scored and tiered into **P0, P1, P2, P3** priority brackets (`RecoveryPriorityEngine`):

$$\text{PriorityScore} = \left( \frac{\text{AmountCents}}{\text{MaxAmount}} \times 0.40 \right) + \left( \frac{\text{DaysOverdue}}{\text{MaxOverdue}} \times 0.35 \right) + \left( (100 - \text{RiskScore}) \times 0.15 \right) + \left( \text{SegmentWeight} \times 0.10 \right)$$

* **Tier P0 (Critical)**: Score $\ge 80$ $\rightarrow$ Overdue Enterprise invoices or high-value cart drops ($> ₹50,000$).
* **Tier P1 (High)**: Score $60–79$ $\rightarrow$ Aging SMB receivables (15–45 days) or recurring subscription failures.
* **Tier P2 (Medium)**: Score $40–59$ $\rightarrow$ Standard checkout drop-offs or mandate switch drops.
* **Tier P3 (Low)**: Score $< 40$ $\rightarrow$ Micro-transactions with high contact costs.

### Economic Expected Net Recovery Formula

$$\mathbf{\text{ExpectedNetRecovery}} = (\text{RecoverableAmount} \times \text{P}_{\text{recovery}}) - \text{IncentiveDiscount} - \text{ChannelDeliveryCost}$$

$$\text{Example: } (₹100,000 \times 0.85) - ₹5,000\text{ (5\% discount)} - ₹2.50\text{ (WhatsApp API)} = \mathbf{₹79,997.50}$$

---

## 10. The 10 Specialized Recovery Operating Centers

```mermaid
graph TD
    Supervisor["Recovery Supervisor Agent"]
    
    Supervisor --> C1["01. Promise-to-Pay Center\n(Grace Locks & Auto-Recycle)"]
    Supervisor --> C2["02. Partial Collections Center\n(V_col + R_rem = O_orig Invariant)"]
    Supervisor --> C3["03. Invoice Operations Center\n(Commercial B2B Invoices & PDF)"]
    Supervisor --> C4["04. Payment Links Center\n(Instant UPI / 1-Click WhatsApp)"]
    Supervisor --> C5["05. B2B Aging Center\n(15d / 30d / 60d / 90+d Dunning)"]
    Supervisor --> C6["06. Subscription Recovery Center\n(Card Update Links & Dunning)"]
    Supervisor --> C7["07. Mandate Recovery Center\n(NPCI UPI AutoPay Window Retries)"]
    Supervisor --> C8["08. Checkout Drop-Off Center\n(1-Click Abandoned Cart Recovery)"]
    Supervisor --> C9["09. Voice Recovery Simulator\n(Simulated EN/HI/Hinglish Phone Nudge)"]
    Supervisor --> C10["10. Negotiation Center\n(2-Round Bounded Settlement Protocol)"]
```

---

## 11. Partial Payment Invariant & Accounting Proof

When a customer makes a partial settlement, RazorRisk.AI enforces an immutable accounting invariant:

$$\mathbf{\text{VerifiedCollectedCents}} + \mathbf{\text{RemainingAmountCents}} = \mathbf{\text{OriginalAmountCents}}$$

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Original B2B Invoice Amount:             ₹100,000.00 (10,000,000 cents)  │
│ 2. Customer Partial Payment (60%):          ₹60,000.00  (6,000,000 cents)   │
│ 3. Bank Settlement Arrives with UTR:        UTR9102834710                   │
│ 4. State Machine Update:                    PARTIALLY_RECOVERED             │
│    (Prohibits premature transition to SETTLED_VERIFIED)                     │
│ 5. Ledger State:                                                            │
│    • Verified Cash Collected:               ₹60,000.00                      │
│    • Remaining Recoverable Balance:         ₹40,000.00                      │
│ 6. Recovery Opportunity Action:             Residual ₹40,000 remains active │
│    in queue for subsequent dunning.                                         │
│ 7. Second Payment Arrives:                  ₹40,000.00 (4,000,000 cents)    │
│ 8. Final Invariant Confirmation:            ₹60,000 + ₹40,000 = ₹100,000    │
│ 9. Final State Mutation:                    SETTLED_VERIFIED                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Bounded 2-Round B2B Negotiation Protocol

For high-ticket commercial accounts ($\ge ₹50,000$), the `NegotiationAgent` executes a bounded settlement protocol strictly governed by the `PolicyEngine`:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as B2B Customer (ABC Tech)
    participant Agent as Negotiation Agent
    participant Policy as Programmatic Policy Engine
    participant Ledger as LedgerStore & Audit

    Customer->>Agent: "We cannot pay ₹100,000 due to cash flow. Can you offer 30% discount?"
    Agent->>Policy: Propose Counter-Offer: 30% Discount (₹30,000 off)
    Note over Policy: Policy Rule 4 Evaluated:<br/>Max Discount Cap = 10.0% (1,000 bps)<br/>Policy Rule 5 Evaluated:<br/>Min Settlement Floor = 85.0%
    Policy-->>Agent: REJECT & CLAMP: Max Allowed Discount = 10.0% (₹10,000 off)
    Agent->>Customer: "Our authorized maximum settlement allows a 10% discount (₹90,000 net)."
    Customer->>Agent: "Accepted. Sending ₹90,000 via RTGS."
    Agent->>Ledger: Update Agreed Settlement to ₹90,000 (Awaiting Bank UTR)
```

---

## 13. Closed-Loop Bank Settlement Verification

A payment gateway `CAPTURED` status does **NOT** constitute verified revenue. RazorRisk.AI requires closed-loop bank confirmation before counting recovered cash:

```mermaid
flowchart LR
    A[Customer Action:\nPay via UPI / Card] --> B[Payment Provider:\nPayment Captured\nStatus: CAPTURED]
    B --> C[Case State:\nVERIFYING\nVerified Cash = ₹0.00]
    C --> D[Bank Settlement Batch Ingestion:\nSettlement Record with Bank UTR]
    D --> E[Reconciliation Engine:\nreconcilePair(tx, settlement)]
    E --> F{UTR & Net Amount Match?}
    F -->|No| G[Hold in VERIFYING\nAlert Finance Queue]
    F -->|Yes| H[Transition to SETTLED_VERIFIED\nVerified Cash += Amount\nSeal in SHA-256 Audit Chain]
```

---

## 14. Master End-to-End Walkthrough Example

### The Case of ABC Technologies (₹1,00,000 Overdue Commercial Invoice)

```
1. INGESTION:
   Invoice INV-2026-0901 issued to ABC Technologies for ₹100,000. 23 days overdue.

2. TRACK 04 RECONCILIATION:
   Finance Controller checks nodal bank feed. No settlement matches INV-2026-0901.
   Discrepancy confirmed: Genuine unpaid receivable. State: EXCEPTION_DETECTED.

3. TRACK 02 RISK ASSESSMENT:
   Risk Manager extracts customer signals:
   • Customer Tenure: 24 months (Verified Corporate Account)
   • 24h Velocity: 2 transactions (Normal)
   • Dispute History: 0.0%
   • Risk Score Computed: 18 / 100 (OPS_SHAPED). Approved for recovery.

4. RECOVERY ELIGIBILITY:
   Eligibility Engine checks 10 guardrails: Risk < 70 (PASS), Amount > 0 (PASS),
   Not in cooldown (PASS), Not in active P2P (PASS). Marked ELIGIBLE.

5. PRIORITIZATION:
   Priority Engine scores opportunity: P0 Tier (High Value Corporate Receivable).

6. ROUTING & SPECIALIST SELECTION:
   Recovery Supervisor routes to INVOICE_AGENT & NEGOTIATION_AGENT.
   Action Plan generated: Phase 1 (B2B PDF + Payment Link), Phase 2 (Negotiation), Phase 3 (Stop).

7. AGENT EXECUTION & POLICY GATE:
   Agent generates commercial tax invoice with GSTIN and embedded Razorpay payment link.
   Policy Engine verifies channel authorization and contact frequency. Dispatched via WhatsApp/Email.

8. CUSTOMER INTERACTION & NEGOTIATION:
   ABC Technologies requests a 15% cash discount.
   Policy Engine clamps the offer to the mandatory 10% ceiling (₹90,000 net).
   ABC Technologies accepts and executes payment for ₹90,000.

9. CLOSED-LOOP VERIFICATION:
   Payment gateway reports CAPTURED. Case transitions to VERIFYING (Cash not yet verified).
   4 hours later, bank clearance batch arrives with UTR9182374619 for ₹90,000.
   Reconciliation Engine matches UTR and settles pair.

10. LEDGER SEAL & AUDIT:
    Case transitions to SETTLED_VERIFIED.
    Verified recovered cash credited: ₹90,000.
    Sequential SHA-256 audit block appended linking previous block hash to current state.
```

---

## 15. Data-to-Decision Mapping Table

| Raw Data Signal | Derived Feature | Consuming System | Operational Decision | System Outcome |
|---|---|---|---|---|
| Transaction Amount | Monetary Exposure | Track 03 Priority Engine | Priority Tier Assignment | High ticket ($> ₹50\text{k}$) $\rightarrow$ Tier `P0` |
| 24h Velocity Count | Transaction Burst Rate | Track 02 Risk Manager | Velocity Risk Points | Velocity $\ge 15$ $\rightarrow$ $+30$ risk points |
| Device Fingerprint | Shared Hardware Cluster | Track 02 Risk Manager | Syndicate Flag | Shared Device $\rightarrow$ $+25$ risk points |
| Chargeback History | Dispute Ratio ($> 0.20$) | Track 02 Risk Manager | Fraud Propensity | Dispute $\ge 0.40$ $\rightarrow$ $+20$ risk points |
| Bank Settlement UTR | Cash Clearance Proof | Track 04 Reconciliation | Closed-Loop Match | Matched UTR $\rightarrow$ `SETTLED_VERIFIED` |
| Days Overdue | Aging Severity | Track 03 B2B Aging Center | Dunning Stage Selection | $31–60\text{d}$ $\rightarrow$ Incentive dunning |
| Customer Promise Date | Commitment Grace Period | Track 03 P2P Center | Dunning Pause Lock | Status $\rightarrow$ `WAITING_FOR_CUSTOMER` |
| Partial Cash Credit | Residual Balance Ratio | Track 03 Partials Center | Invariant Accounting | State $\rightarrow$ `PARTIALLY_RECOVERED` |
| Discount Request | Concession Proposed | Policy Engine (Rule 4) | Programmatic Clamping | Discount $> 10\%$ clamped to $10.0\%$ |

---

## 16. What is Deterministic vs. What is AI?

| Subsystem Task | AI LLM? | Deterministic Code? | Rationale & Architectural Rule |
|---|---|---|---|
| **1:1 Exact Match Reconciliation** | **NO** | **YES** | Zero-AI-cost short-circuit. Pure hash/key comparison. |
| **MDR Fee & Tax Netting** | **NO** | **YES** | Exact mathematical calculation ($1.5\%–2.5\% + 18\%\text{ GST}$). |
| **Fuzzy Narration Discrepancy** | **YES (Tools)** | **NO** | Contextual NLP tool reasoning over corrupted strings. |
| **Continuous Risk Scoring** | **HYBRID** | **YES** | Feature-weighted continuous scoring formula. |
| **Policy Guardrail Enforcement** | **NO** | **YES** | Code strictly enforces what AI proposes. |
| **Adaptive Recovery Strategy** | **YES** | **NO** | LLM evaluates multi-channel history & failure codes. |
| **Promise-to-Pay Grace Locking** | **NO** | **YES** | State machine locks and auto-recycles on timer. |
| **Partial Collection Invariant** | **NO** | **YES** | Hard ledger invariant: $V_{\text{col}} + R_{\text{rem}} = O_{\text{orig}}$. |
| **Payment Gateway Integration** | **NO** | **YES** | Provider abstraction (Razorpay Sandbox / Simulation). |
| **Settlement UTR Verification** | **NO** | **YES** | Exact bank ledger join before revenue attribution. |
| **Cryptographic SHA-256 Hashing** | **NO** | **YES** | Sequential cryptographic block chaining from genesis. |

---

## 17. Presentation & Video Scripts

### 3-Minute Comprehensive Video Script (Spoken Cadence)

> *"High-growth payment platforms process billions in transactions daily across fragmented banking switches. When payments fail or invoices age, companies lose millions to involuntary churn, uncollected debt, and undetected fraud.*
> 
> *Enter **RazorRisk.AI**—an enterprise autonomous FinOps and Revenue Recovery platform governed by one fundamental fintech law: **LLM Decides. Code Enforces. Ledger Stores State. Reconciliation Verifies Real Outcomes. Audit Log Records Everything.***
> 
> *Here is how RazorRisk.AI turns raw financial data into verified revenue:*
> 
> *First, raw payment telemetry and bank settlement feeds enter the platform. Track 04, our Finance Controller, performs deterministic 1:1 exact matching and MDR fee netting first—resolving routine transactions with **zero AI compute cost** and zero latency.*
> 
> *When an exception occurs, Track 02—the Risk Manager—evaluates multi-signal telemetry: velocity bursts, device clusters, dispute ratios, and card probing. It computes a continuous 0 to 100 risk score. If the score is 70 or higher, the Policy Engine strictly **blocks** the case from recovery to prevent collecting on stolen instruments.*
> 
> *If the case is clean, Track 03—our Autonomous Revenue Recovery Operating Center—evaluates 10 programmatic eligibility rules and assigns the case to one of 10 specialized operating centers, including Promise-to-Pay, Invoicing, Subscriptions, Mandates, and B2B Negotiation.*
> 
> *When an agent proposes a settlement or discount, our deterministic Policy Engine enforces 12 immutable boundaries: maximum 10% discount cap, minimum 85% settlement floor, max 3 retries, and 4-hour cooldowns. No AI can bypass these guardrails.*
> 
> *When a customer pays, we enforce our strict partial payment invariant—verified cash plus remaining balance equals the original receivable. Most importantly, a gateway 'captured' status is never counted as recovered revenue until closed-loop bank UTR reconciliation confirms the actual cash credit.*
> 
> *Finally, every single decision, state mutation, and bank settlement is sealed into an immutable SHA-256 cryptographic hash chain.*
> 
> *RazorRisk.AI: Autonomous operations with mathematical certainty."*

---

### 60-Second Elevator Pitch

> *"Modern fintechs lose up to 5% of their revenue to payment failures, reconciliation overhead, and uncollected invoices. Current tools are either dumb static rules or hallucination-prone AI agents.*
> 
> *RazorRisk.AI bridges this gap with three independent operational tracks: deterministic reconciliation, continuous multi-signal risk scoring, and autonomous revenue recovery across 10 specialized operating centers.*
> 
> *Our core innovation is deterministic-first architecture: exact matches cost zero AI compute, while high-risk fraud cases are automatically blocked. When recovery agents negotiate with customers, our programmatic Policy Engine strictly clamps discounts to 10% and enforces an 85% settlement floor.*
> 
> *And unlike standard systems, we never count revenue as recovered until closed-loop bank UTR settlement confirms the cash in your account, sealed in a SHA-256 audit log.*
> 
> *RazorRisk.AI brings enterprise safety and mathematical integrity to autonomous FinOps."*

---

### 30-Second Ultra-Fast Pitch

> *"RazorRisk.AI is an autonomous FinOps and Revenue Recovery platform for modern payment ecosystems.*
> 
> *It reconciles payments with zero AI compute overhead, screens fraud with continuous 0 to 100 risk scoring, and recovers lost revenue through 10 specialized operating centers.*
> 
> *Every agent action is constrained by 12 programmatic policy rules—capping discounts at 10% and requiring closed-loop bank UTR confirmation before counting a single rupee of recovered cash.*
> 
> *LLM decides. Code enforces. Ledger stores state. Reconciliation verifies real outcomes."*

---

## 18. Verification & Inspection Confirmation

* **Source Files Inspected**: `src/types/index.ts`, `src/core/reconciliation/index.ts`, `src/core/ai/provider.ts`, `src/core/policy-engine/index.ts`, `src/core/recovery/opportunity-store.ts`, `src/core/recovery/eligibility-engine.ts`, `src/core/recovery/priority-engine.ts`, `src/core/recovery/playbooks.ts`, `src/core/recovery/campaign-manager.ts`, `src/core/audit/audit-logger.ts`, `src/data/synthetic/scenario-definitions.ts`.
* **Agents Inspected**: `FinanceControllerAgent`, `RiskManagerAgent`, `RecoverySupervisorAgent`, `RevenueRecoveryAgent`, `Orchestrator`.
* **APIs Inspected**: All 14 REST endpoints in `src/app/api/`.
* **Test Verification**: 427 / 427 tests passing cleanly across 34 test files.
* **Code Modification Status**: **Zero source files modified**.
