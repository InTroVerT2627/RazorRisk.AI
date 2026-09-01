# RazorRisk.AI — Complete Project Walkthrough & Technical Documentation
**Autonomous FinOps & Revenue Recovery Platform for the Razorpay AI Buildathon**

---

## 1. Executive Summary

**RazorRisk.AI** is a production-grade autonomous financial operations (FinOps) platform. It unifies three core fintech pillars:
1. **Automated Multi-Channel Reconciliation** (Track 04 — Finance Controller Agent)
2. **Multi-Signal Anomaly & Fraud Risk Radar** (Track 02 — Risk Manager Agent)
3. **Adaptive Revenue Recovery & Bounded Negotiation** (Track 03 — Revenue Recovery Agent)

The platform is designed around a zero-tolerance financial principle:
> **"LLM DECIDES. CODE ENFORCES. LEDGER STORES STATE. RECONCILIATION VERIFIES REAL OUTCOMES. AUDIT LOG RECORDS EVERYTHING."**

- **Deterministic Code Guardrails**: Programmatic Policy Engine, strict Finite State Machine, and immutable SHA-256 cryptographic audit chain.
- **Multi-Agent Intelligence**: Domain-specialized agents communicating via structured tool-calling protocols with Zod validation.
- **Empirical Rigor**: Held-out benchmark testing across 48 synthetic financial scenario families with 100% ground-truth isolation.
- **Test Suite**: **299 / 299 passing tests** across 20 test files, 0 TypeScript errors, 19/19 Next.js routes compiled.

---

## 2. High-Level System Architecture

```
                                  RazorRisk.AI ARCHITECTURE
                                  
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                                   INCOMING FINANCIAL FLOW                              │
 │            Bank Settlements (MT940/CAMT.053/NEFT)  •  Gateway Transactions (Razorpay)   │
 └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │
                                             ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │ 1. FINANCE CONTROLLER AGENT (Track 04)                                                 │
 │    Deterministic Exact Match First (Zero AI Cost) ──► MATCH ──► RECONCILED             │
 │    Discrepancy / Fee Variance / Drop              ──► AI Tool Investigation ──► CASE   │
 └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ [FinOpsCase: EXCEPTION_DETECTED]
                                             ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │ 2. RISK MANAGER AGENT (Track 02)                                                       │
 │    Multi-Signal Feature Extractor (Velocity, Device Clusters, Disputes, Card Probing)  │
 │    Continuous Risk Score (0-100)                                                       │
 │    ├── Score ≥ 70 (or CRITICAL_FRAUD)  ──► RISK_BLOCKED (Cease Recovery)              │
 │    ├── Score 40-69 (Borderline/Review) ──► HUMAN_REVIEW_REQUIRED (Escalate to Ops)     │
 │    └── Score < 40 (OPS_SHAPED)         ──► OPS_APPROVED (Safe to Recover)              │
 └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ [FinOpsCase: OPS_APPROVED]
                                             ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │ 3. REVENUE RECOVERY AGENT (Track 03)                                                   │
 │    History-Aware Adaptive Strategy (Smart Retry, WhatsApp UPI Link, B2B Negotiation)  │
 │    Deterministic Policy Engine Check (Max 10% Discount, Min 85% Settlement, Cooldown) │
 │    Payment Provider Execution (Razorpay Adapter / Simulation Adapter)                  │
 └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ [FinOpsCase: VERIFYING]
                                             ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │ 4. RE-RECONCILIATION VERIFICATION                                                      │
 │    Finance Controller matches actual Bank Settlement UTR with recovered amount         │
 │    Verified Settlement Credit ──► SETTLED_VERIFIED (Real Money in Bank)                │
 └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │
                                             ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │ 5. IMMUTABLE CRYPTOGRAPHIC AUDIT LOG                                                   │
 │    Sequential SHA-256 Hash Chain: PrevHash ──► Action ──► StateDiff ──► CurrentHash    │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. End-to-End Phase Evolution

### Phase 1 — Deterministic Financial Core & Foundational State Machine
- **In-Memory Ledger Store** (`src/core/ledger/ledger-store.ts`): Thread-safe financial double-entry data store tracking transactions, settlement records, risk assessments, recovery actions, and cases.
- **Reconciliation Engine** (`src/core/reconciliation/index.ts`): Sub-millisecond deterministic matching on external references (UTR/RRN), MDR fee netting calculations, amount variance detection, and fuzzy customer name joins.
- **Policy Engine** (`src/core/policy-engine/index.ts`): 12 programmatic guardrail rules (max discount 10% / 1000 bps, min settlement floor 85% / 8500 bps, max 3 retries, 4-hour retry cooldown, ₹50,000 auto-recovery cap).
- **Cryptographic Audit Logger** (`src/core/audit/audit-logger.ts`): Tamper-evident SHA-256 hash chain linking every state change from genesis `0000000000000000...`.
- **State Machine** (`src/core/state-machine/index.ts`): Strict directed acyclic graph transitions prohibiting illegal jumps (e.g. `NEW -> SETTLED_VERIFIED`).

### Phase 2 — 50,000+ Synthetic World & Ground Truth Isolation
- **Entity Generator** (`src/data/synthetic/entity-generator.ts`): Synthesized realistic merchant graphs, customer populations, fraud syndicates, and shared device clusters.
- **48 Scenario Families** (`src/data/synthetic/scenario-definitions.ts`): Standard and adversarial scenarios covering exact matches, timing lags, MDR variances, gateway timeouts, abandoned checkouts, and coordinated card probing.
- **Ground Truth Isolation** (`src/core/evaluation/ground-truth-isolation.ts`): Strict boundary preventing agents from reading hidden labels during evaluation.
- **Benchmark Runner** (`src/core/evaluation/benchmark.ts`): Mathematical validation calculating precision, recall, F1, false-positive cost, and baseline comparison.

### Phase 3 — Operations Command Center (9 Interactive Consoles)
- Built a modern, dark-mode Next.js App Router user interface with 9 operational consoles:
  - `/` — FinOps Command Center Dashboard
  - `/cases` — Case Explorer Console
  - `/cases/[id]` — Master-Detail Case Investigation & Timeline
  - `/reconciliation` — Reconciliation Analytics Console
  - `/risk` — Risk Manager Radar & 3-Tier Queue
  - `/recovery` — Revenue Recovery & 10-Step Negotiation Timeline
  - `/human-review` — Human Escalation & Override Queue
  - `/evaluation` — Empirical Benchmark & Trust Scorecard
  - `/policies` — Dynamic Policy Guardrails Configurator

### Phase 4 — Multi-Agent Intelligence & Structured Tool Calling
- **FinOps Orchestrator** (`src/agents/orchestrator.ts`): Closed-loop coordinator executing pipeline stages.
- **Finance Controller Agent** (`src/agents/finance-controller/`): Evaluates settlement candidates and netting variances.
- **Risk Manager Agent** (`src/agents/risk-manager/`): Multi-signal tool calling (`getCustomerRiskHistory`, `getVelocitySignals`, `getDeviceReputation`).
- **Revenue Recovery Agent** (`src/agents/revenue-recovery/`): Formulates adaptive recovery plans bounded by policy.
- **FinOps AI Provider** (`src/core/ai/provider.ts`): Gemini 2.5 Pro / Flash support with a high-fidelity deterministic fallback synthesizer.

### Phase 5 — Adversarial Hardening & Red Team Defenses
- Defenses against prompt injection attacks embedded in customer notes and bank narrations.
- Boundary penetration testing (10.01% discount rejection, risk score 69.9 vs 70.0 transitions).
- Cryptographic tamper detection and illegal state transition blocking.

### Phase 6 — Adaptive Recovery & Bounded Negotiation
- History-aware strategy adaptation: switches from gateway retry to WhatsApp UPI link upon repeated drops.
- Bounded 2-round negotiation for B2B invoices ($\ge$ ₹50,000) with strict floor enforcement (min 85% settlement).
- Economic metrics tracking (incentives granted, net cash yield, customer response rate).

### Phase 7 — Razorpay Integration & Production Hardening
- **Payment Provider Abstraction** (`src/core/payment-provider/types.ts`): Standardized interfaces for orders, payment links, and refunds.
- **Razorpay Sandbox Adapter** (`src/core/payment-provider/razorpay-adapter.ts`): Sandbox API integration with strict test-mode validation.
- **Simulation Adapter** (`src/core/payment-provider/simulation-adapter.ts`): Fault injection engine (timeouts, 5xx errors, network delays).
- **Webhook Security** (`src/core/payment-provider/webhook-handler.ts`): Constant-time HMAC SHA-256 signature verification and deduplication.
- **PII Masking** (`src/core/security/pii-masker.ts`): Card number, Indian phone (+91), email masking, and prompt sanitization.
- **Reliability Engine** (`src/core/reliability/retry-policy.ts`): Exponential backoff with jitter and stable idempotency keys.
- **Health Check** (`src/core/health/health-check.ts`): `/api/health` 4-subsystem monitoring.

### Phase 8 & 9 Overhaul — Operational Realism, Continuous Risk & 299 Tests
- **Fixed Race Condition**: Removed destructive `ledger.clear()` in benchmark that wiped operational cases on dashboard load.
- **Continuous Risk Scoring Engine**: Replaced discrete 4-value model with continuous feature-weighted scoring function ($0\text{--}100$).
- **High-Diversity Dataset**: Adjusted normal ratio to 40% (yielding 60% active exceptions), populated `customerSegment` across all records, and integrated 15+ real-world banking decline error codes.
- **Lifecycle State Friction**: Realistic multi-outcome distribution (`SETTLED_VERIFIED`, `RECOVERING`, `HUMAN_REVIEW_REQUIRED`, `CLOSED_UNRESOLVED`).
- **Case Explorer Redesign**: Added pagination, sorting by 4 columns, and dynamic state chips (`BYPASSED (EXACT)`, `PENDING TRIAGE`).
- **Test Suite Expansion**: Increased test coverage from 86 to **299 passing tests** across 20 test suites.

---

## 4. 9-Page UI Overview & Operations Manual

| Route | Name | Key Functionality | Actions Available |
|---|---|---|---|
| `/` | FinOps Command Center | Top 6 KPI summary cards, 9-stage pipeline flow, live audit activity stream. | Run 1,000 Batch, filter cases by pipeline stage, inspect cases. |
| `/cases` | Case Explorer | Searchable and sortable table of all reconciliation exceptions. | Ingest 500 Batch, filter by status, sort by risk/amount/date, paginate (15-100/page), deep-link to `/cases/[id]`. |
| `/cases/[id]` | Case Investigation | Detailed case view with timeline, risk score breakdown, raw telemetry, and audit history. | Inspect audit blocks, review recovery steps, view raw bank settlement payload. |
| `/reconciliation` | Reconciliation Console | Match rate analytics, fee netting breakdown, un-reconciled exceptions. | Filter by confidence score ($\ge 80\%, 90\%, 95\%$), search by UTR, paginate records. |
| `/risk` | Risk Manager Radar | 3-tier queue (Critical Risk $\ge 70$, Human Review $40\text{--}69$, Operational Safe $< 40$). | Click queue cards to filter, review AI recommendations, inspect anomaly signals. |
| `/recovery` | Revenue Recovery Console | Economic metrics (net cash recovered, discount cost), 10-step negotiation timeline. | Refresh state, review settlement-verified cases, review recovery tactics. |
| `/human-review` | Human Escalation Queue | Master-detail review interface for borderline risk scores and high-value exceptions. | Authorize **Approve & Dispatch Recovery**, **Confirm Risk & Block**, or **Write-Off Ledger** with mandatory audit notes. |
| `/evaluation` | Ground Truth Benchmark | Empirical benchmark on held-out test splits, confusion matrices, failure analysis. | Select split (Test/Val), Mode (Standard/Adversarial), Scale (1K-100K), Run Benchmark. |
| `/policies` | Policy Guardrails Config | Real-time editable form configuring risk score thresholds, retry limits, and discount caps. | Edit policy values and click **Save Changes** (syncs live with active `PolicyEngine` singleton). |

---

## 5. Complete Codebase Structure

```
RazorRisk.AI/
├── src/
│   ├── agents/                     # Multi-Agent Layer
│   │   ├── orchestrator.ts         # Closed-loop agent coordinator
│   │   ├── finance-controller/     # Track 04: Reconciliation agent & tools
│   │   ├── risk-manager/           # Track 02: Multi-signal risk triage agent & tools
│   │   └── revenue-recovery/       # Track 03: Adaptive recovery & bounded negotiation
│   ├── core/                       # Deterministic Financial & Safety Core
│   │   ├── ledger/                 # LedgerStore (in-memory double-entry store)
│   │   ├── reconciliation/         # ReconciliationEngine (exact, fee, fuzzy matching)
│   │   ├── policy-engine/          # PolicyEngine (12 immutable programmatic guardrails)
│   │   ├── state-machine/          # FinOpsStateMachine (validated transitions)
│   │   ├── audit/                  # AuditLogger (immutable SHA-256 chain)
│   │   ├── ai/                     # FinOpsAIProvider (Gemini + fallback synthesizer)
│   │   ├── payment-provider/       # Razorpay & Simulation adapters, Webhook HMAC
│   │   ├── security/               # PIIMasker & prompt injection sanitizer
│   │   ├── reliability/            # ReliabilityEngine (backoff, jitter, idempotency)
│   │   ├── health/                 # HealthCheckService (/api/health)
│   │   ├── metrics/                # Formal KPI mathematical definitions
│   │   └── evaluation/             # BenchmarkRunner & GroundTruthIsolation
│   ├── data/synthetic/             # Large-scale synthetic financial world generator
│   │   ├── dataset-generator.ts    # Configurable dataset generation & splitting
│   │   ├── scenario-definitions.ts # 48 financial scenario family definitions
│   │   ├── entity-generator.ts     # Merchant, customer, device, and fraud ring generator
│   │   ├── noise-engine.ts         # Fee calculations, timestamp jitter, corruptions
│   │   └── profiler.ts             # Dataset statistical distribution profiler
│   ├── app/                        # Next.js 15 App Router & API routes
│   │   ├── page.tsx                # FinOps Command Center
│   │   ├── cases/                  # Case Explorer & Case Detail [id]
│   │   ├── reconciliation/         # Reconciliation Console
│   │   ├── risk/                   # Risk Radar
│   │   ├── recovery/               # Revenue Recovery Console
│   │   ├── human-review/           # Human Review & Escalation Queue
│   │   ├── evaluation/             # Ground Truth Benchmark & Trust Scorecard
│   │   ├── audit/                  # SHA-256 Audit Trail
│   │   ├── policies/               # Policy Engine Guardrails Config
│   │   └── api/                    # 7 REST API endpoints
│   └── types/                      # Complete TypeScript domain definitions
└── tests/                          # 20 Test Suites (299 Tests)
    ├── unit/                       # Unit tests (Ledger, Policy, State, Audit, AI, Security, etc.)
    ├── eval/                       # Evaluation & Benchmark tests (Multi-Agent, Red Team, Razorpay)
    └── integration/                # API Route integration tests
```

---

## 6. Trust & Release Scorecard

| Guardrail | Benchmark Target | Measured Outcome | Status |
|---|---|---|---|
| Policy Engine Bypasses | 0 | **0** | PASS |
| Unauthorized Fund Movements | 0 | **0** | PASS |
| Ground Truth Data Leaks | 0 | **0** | PASS |
| Unverified Recoveries Counted | 0 | **0** | PASS |
| Illegal State Transitions | 0 | **0** | PASS |
| SHA-256 Tamper Evident Chain | Verified | **100% Chain Valid** | PASS |
| Test Suite Passing | $\ge 250$ | **299 Tests** | PASS |
| TypeScript Compiler Errors | 0 | **0 Errors** | PASS |
| Production Build Routes | All | **19 / 19 Compiled** | PASS |

---

## 7. Commands & Run Instructions

```bash
# 1. Start development server
npm run dev

# 2. Run full 299-test suite
npx vitest run

# 3. Check TypeScript compilation
npx tsc --noEmit

# 4. Create optimized production build
npm run build
```
