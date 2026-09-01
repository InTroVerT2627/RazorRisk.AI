# RAZORRISK.AI — BUILDATHON & DEVELOPER CHEAT SHEET

> **Executive Tagline**: *Autonomous FinOps, Multi-Signal Risk Radar & Revenue Recovery Operating Center*  
> **Core Law**: **LLM Decides. Code Enforces. Ledger Stores State. Reconciliation Verifies Real Outcomes. Audit Log Records Everything.**

---

## 1. WHAT IS RAZORRISK.AI?
RazorRisk.AI is an enterprise autonomous financial operations platform designed for high-scale payment ecosystems. It replaces fragmented, manual spreadsheets and fragile scripts with **three independent, loosely coupled operational tracks** governed by a deterministic programmatic Policy Engine, an immutable SHA-256 audit ledger, and a closed-loop verification pipeline.

---

## 2. THE THREE OPERATIONAL TRACKS AT A GLANCE

```
TRACK 04: FINANCE CONTROLLER (Reconciliation)
"What happened to the money?"
• Deterministic 1:1 exact matching (Zero AI cost, instant bypass)
• MDR fee netting (1.5%–2.5% + 18% GST)
• Structured AI tool investigation for ambiguous UTRs and fuzzy bank narrations
• Re-reconciliation verification of recovered settlements

TRACK 02: RISK MANAGER (Risk & Fraud Triage)
"Is this safe / legitimate?"
• Continuous 0–100 feature-weighted risk scoring
• Multi-signal evaluation: Velocity bursts, device clusters, dispute ratios, card probing
• Strict Policy Gate: Risk ≥ 70 strictly blocks recovery; 40–69 escalates to Human Review; < 40 approves

TRACK 03: REVENUE RECOVERY (Collections Operating Center)
"How should we collect money that is legitimately owed?"
• First-Class RecoveryOpportunity domain model (28 fields)
• 10 Dedicated Operating Centers: Promise-to-Pay, Partials, Invoices, Payment Links, B2B Aging,
  Subscriptions, Mandates, Checkout Drops, Voice Simulator, Negotiation Center
• Invariant partial collection accounting: Verified Collected + Remaining Balance = Original Receivable
• Multi-round bounded B2B negotiation (Max 10% discount cap, min 85% settlement floor)
```

---

## 3. TOP 5 TECHNICAL INNOVATIONS

1. **Zero-AI-Cost Deterministic Short-Circuiting**:
   Exact financial record matches and verified MDR fee netting bypass LLM inference completely, saving 70%+ compute cost and eliminating hallucination risk on routine transactions.
2. **Continuous Feature-Weighted Risk Scoring**:
   Replaces naive categorical labels with a mathematical 0–100 score driven by customer velocity, shared hardware clusters, dispute histories, and card probing patterns.
3. **Immutable Programmatic Policy Engine (12 Guardrail Rules)**:
   Code enforces what AI decides. No LLM can bypass the 10% discount ceiling, 85% settlement floor, 3-retry limit, 4-hour cooldown, or ₹50,000 auto-recovery cap.
4. **Strict Partial Collection Invariant Accounting**:
   When a customer pays partial funds (e.g. ₹60K of ₹100K), the system records the verified bank UTR, transitions state to `PARTIALLY_RECOVERED` (never prematurely `SETTLED_VERIFIED`), and keeps the residual ₹40K active in the recovery queue.
5. **Cryptographic SHA-256 Hash Chain & Ground Truth Isolation**:
   Every state mutation and agent action links to previous hashes from genesis. In evaluation mode, scenario labels are cryptographically stripped so agents evaluate solely on public telemetry.

---

## 4. TOP 5 DEMO SCENARIOS TO SHOWCASE

### Demo 1: Overdue B2B Enterprise Invoice Recovery
* **Setup**: Enterprise customer, ₹1,00,000 invoice, 23 days overdue, Low Risk (`18/100`).
* **Flow**: Auto-assigned to `NEGOTIATION_AGENT` $\rightarrow$ Priority `P0` $\rightarrow$ Dispatches invoice reminder with Razorpay link $\rightarrow$ Customer pays $\rightarrow$ Bank UTR confirmed $\rightarrow$ State transitions to `SETTLED_VERIFIED`.

### Demo 2: High-Risk Coordinated Fraud Block
* **Setup**: Coordinated syndicate attack, velocity burst, shared device fingerprint, Risk Score `95/100`.
* **Flow**: Risk Manager flags `CRITICAL_FRAUD` $\rightarrow$ Policy Engine strictly **BLOCKS** recovery $\rightarrow$ Case never enters actionable recovery queues $\rightarrow$ Sealed in audit log.

### Demo 3: Multi-Round B2B Negotiation with Policy Guardrail
* **Setup**: High-value invoice $\ge$ ₹50,000 enters negotiation.
* **Flow**: Agent offers 5% discount (Allowed) $\rightarrow$ Customer counters with 8% (Allowed) $\rightarrow$ Customer counters with 20% $\rightarrow$ Policy Engine **rejects and clamps to 10% max** $\rightarrow$ Customer accepts $\rightarrow$ Payment verified.

### Demo 4: Invariant Partial Collection (₹60K + ₹40K)
* **Setup**: ₹1,00,000 overdue invoice.
* **Flow**: Customer pays ₹60,000 $\rightarrow$ Verified cash collected increases to ₹60,000 $\rightarrow$ State becomes `PARTIALLY_RECOVERED` $\rightarrow$ Remaining ₹40,000 stays active in queue $\rightarrow$ Second nudge collects ₹40,000 $\rightarrow$ Fully verified to `SETTLED_VERIFIED`.

### Demo 5: Multilingual Voice Recovery Simulator (Hinglish)
* **Setup**: High-ticket SMB phone collections.
* **Flow**: Voice bot conducts dialogue in Hinglish (*"Friday ko kar dunga"*) $\rightarrow$ NLP parser extracts `PromiseToPayRecord` for Friday $\rightarrow$ Locks case in grace period $\rightarrow$ Auto-recycles if broken.

---

## 5. REPOSITORY ARCHITECTURE AT A GLANCE

```
src/
├── agents/             # Finance Controller, Risk Manager, Recovery Supervisor, Revenue Recovery, Orchestrator
├── core/               # Reconciliation Engine, Policy Engine, State Machine, LedgerStore, OpportunityStore,
│                       # CampaignManager, AuditLogger, AIProvider, HealthCheck, RetryPolicy, PIIMasker
├── data/synthetic/     # 48 Scenario Families, AleaPRNG, Entity Generator, Noise Engine (50,000+ cases)
├── app/                # 10 UI Pages (/, /cases, /risk, /reconciliation, /recovery, /human-review, /evaluation, /audit, /policies)
│   └── api/            # 14 REST API Endpoints (/api/cases, /api/recovery/*, /api/audit, /api/orchestrator/*)
└── types/              # Complete TypeScript Domain Model (986 lines)
```

---

## 6. VERIFICATION & QUALITY METRICS

* **Test Suite**: **427 / 427 tests passed** across all 34 test files in 13.27s (`vitest run`).
* **TypeScript Compilation**: **0 errors** (`npx tsc --noEmit`).
* **Production Build**: **22 static and dynamic routes compiled cleanly** (`npm run build`).

---

## 7. ESSENTIAL COMMANDS

```bash
# Run complete test suite (427 tests)
npm run test

# Typecheck
npx tsc --noEmit

# Production Build
npm run build

# Start Dev Server
npm run dev

# Start Production Server (http://localhost:3000)
npm run start
```
