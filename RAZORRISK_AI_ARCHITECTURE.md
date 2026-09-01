# RAZORRISK.AI — SYSTEM ARCHITECTURE & DIAGRAM SPECIFICATION

> **Document Purpose**: Visual architectural reference, data-flow diagrams, state progression models, agent relationships, and closed-loop verification graphs for RazorRisk.AI.

---

## 1. HIGH-LEVEL SYSTEM ARCHITECTURE

```mermaid
graph TD
    subgraph Browser ["Client Presentation Layer (Next.js 15 App Router)"]
        UI_Dash["Command Center (/)"]
        UI_Cases["Case Explorer (/cases & /cases/[id])"]
        UI_Recon["Finance Reconciliation (/reconciliation)"]
        UI_Risk["Risk Radar (/risk)"]
        UI_Recovery["Revenue Recovery Operating Center (/recovery)"]
        UI_Human["Human Escalation Queue (/human-review)"]
        UI_Eval["Ground Truth Benchmark (/evaluation)"]
        UI_Audit["SHA-256 Audit Trail (/audit)"]
        UI_Policy["Policy Guardrails (/policies)"]
    end

    subgraph API ["REST API Layer"]
        API_Cases["/api/cases/*"]
        API_Orch["/api/orchestrator/*"]
        API_Rec["/api/recovery/opportunities/*"]
        API_Centers["/api/recovery/centers"]
        API_Camp["/api/recovery/campaigns/*"]
        API_Audit["/api/audit"]
        API_Eval["/api/evaluation/run"]
        API_Health["/api/health"]
        API_Policy["/api/policies"]
    end

    subgraph Orchestration ["Autonomous Agent Layer"]
        Orchestrator["Orchestrator (orchestrator.ts)"]
        FinanceAgent["FinanceControllerAgent (Track 04)"]
        RiskAgent["RiskManagerAgent (Track 02)"]
        RecoverySupervisor["RecoverySupervisorAgent (Track 03)"]
        RevenueRecoveryAgent["RevenueRecoveryAgent (Track 03)"]
    end

    subgraph Engines ["Deterministic Core Engines"]
        ReconEngine["ReconciliationEngine"]
        EligibilityEngine["RecoveryEligibilityEngine"]
        PriorityEngine["RecoveryPriorityEngine"]
        PolicyEngine["PolicyEngine (12 Programmatic Rules)"]
        StateMachine["StateMachine (Transition Validator)"]
        CampaignMgr["RecoveryCampaignManager (Mutex Locking)"]
        InvoiceGen["InvoiceEngine (PDF & Line Items)"]
        PIIMasker["PIIMasker (Prompt & Data Sanitizer)"]
        Reliability["ReliabilityEngine (Backoff & Idempotency)"]
    end

    subgraph State ["Single Source of Truth (State & Persistence)"]
        LedgerStore["LedgerStore (In-Memory Singleton)"]
        OpportunityStore["OpportunityStore (28-Field Assets)"]
        AuditLogger["AuditLogger (SHA-256 Chained Blocks)"]
    end

    subgraph Adapters ["External & Simulation Adapters"]
        PayAdapter["PaymentProvider (Simulation / Razorpay Test)"]
        MsgAdapter["MessagingProvider (WhatsApp / SMS / Email)"]
        AIProvider["FinOpsAIProvider (Gemini / Continuous Model)"]
    end

    Browser --> API
    API --> Orchestration
    API --> Engines
    API --> State

    Orchestrator --> FinanceAgent
    Orchestrator --> RiskAgent
    Orchestrator --> RecoverySupervisor
    Orchestrator --> PolicyEngine

    FinanceAgent --> ReconEngine
    FinanceAgent --> AIProvider
    RiskAgent --> AIProvider
    RecoverySupervisor --> EligibilityEngine
    RecoverySupervisor --> PriorityEngine
    RecoverySupervisor --> RevenueRecoveryAgent

    RevenueRecoveryAgent --> PolicyEngine
    RevenueRecoveryAgent --> PayAdapter
    RevenueRecoveryAgent --> MsgAdapter

    PolicyEngine --> LedgerStore
    ReconEngine --> LedgerStore
    PayAdapter --> LedgerStore
    LedgerStore --> AuditLogger
    OpportunityStore --> LedgerStore
```

---

## 2. AGENT RELATIONSHIPS & SPECIALIST ROLES

```mermaid
graph TD
    Supervisor["Recovery Supervisor Agent"]
    
    Supervisor -->|Transient Drops & Links| PaymentSpecialist["Payment Specialist Agent\n(Smart Gateway Retry / WhatsApp Link)"]
    Supervisor -->|Overdue SMB / Cart Drops| CollectionsSpecialist["Collections Specialist Agent\n(Multi-channel Dunning Nudges)"]
    Supervisor -->|B2B Invoices| InvoiceSpecialist["Invoice Specialist Agent\n(PDF Invoicing & Reminders)"]
    Supervisor -->|High-Value Accounts >= ₹50K| NegotiationSpecialist["Negotiation Specialist Agent\n(2-Round Bounded Discount Protocol)"]
    Supervisor -->|Recurring SaaS Charges| SubscriptionSpecialist["Subscription Recovery Agent\n(Card Update Links & Dunning)"]
    Supervisor -->|UPI AutoPay & e-Mandates| MandateSpecialist["Mandate Recovery Agent\n(Switch Window Retry Scheduling)"]
    Supervisor -->|High-Ticket Phone Collections| VoiceSpecialist["Voice Recovery Agent\n(Simulated EN/HI/Hinglish Voice)"]

    PaymentSpecialist --> PolicyGate["Deterministic Policy Engine (12 Rules)"]
    CollectionsSpecialist --> PolicyGate
    InvoiceSpecialist --> PolicyGate
    NegotiationSpecialist --> PolicyGate
    SubscriptionSpecialist --> PolicyGate
    MandateSpecialist --> PolicyGate
    VoiceSpecialist --> PolicyGate

    PolicyGate -->|Approved| Execution["Payment Provider / Messaging Dispatch"]
    PolicyGate -->|Violated| BlockAudit["Block Execution & Log to SHA-256 Chain"]
```

---

## 3. CASE LIFECYCLE & STATE MACHINE GRAPH

```mermaid
stateDiagram-v2
    [*] --> NEW : Ingestion
    NEW --> RECONCILING : Ingest Settlement
    RECONCILING --> SETTLED_VERIFIED : 1:1 Match (Track 04)
    RECONCILING --> EXCEPTION_DETECTED : Discrepancy

    EXCEPTION_DETECTED --> RISK_TRIAGING : Anomaly Triaging
    EXCEPTION_DETECTED --> RECOVERY_ELIGIBLE : Direct Failure
    EXCEPTION_DETECTED --> HUMAN_REVIEW_REQUIRED : Severe Anomaly

    RISK_TRIAGING --> RISK_BLOCKED : Risk Score >= 70
    RISK_TRIAGING --> HUMAN_REVIEW_REQUIRED : Risk Score 40-69
    RISK_TRIAGING --> OPS_APPROVED : Risk Score < 40

    OPS_APPROVED --> RECOVERY_ELIGIBLE : Valid Obligation

    RECOVERY_ELIGIBLE --> RECOVERING : Dispatch Strategy
    RECOVERING --> RECOVERY_EXECUTED : Action Sent (Link/PDF/Retry)

    RECOVERY_EXECUTED --> WAITING_FOR_CUSTOMER : P2P Grace Lock
    RECOVERY_EXECUTED --> PARTIALLY_RECOVERED : Partial Payment Received
    RECOVERY_EXECUTED --> VERIFYING : Customer Paid

    PARTIALLY_RECOVERED --> RECOVERING : Next Action for Residual Balance

    VERIFYING --> SETTLED_VERIFIED : Bank Settlement UTR Verified

    HUMAN_REVIEW_REQUIRED --> OPS_APPROVED : Operator Approve
    HUMAN_REVIEW_REQUIRED --> RISK_BLOCKED : Operator Block
    HUMAN_REVIEW_REQUIRED --> CLOSED_WRITTEN_OFF : Operator Write-off

    RECOVERING --> CLOSED_UNRESOLVED : Retries Exceeded
    RISK_BLOCKED --> CLOSED_WRITTEN_OFF

    SETTLED_VERIFIED --> [*]
    CLOSED_UNRESOLVED --> [*]
    CLOSED_WRITTEN_OFF --> [*]
```

---

## 4. TRACK 03 AUTONOMOUS RECOVERY WORKFLOW

```mermaid
flowchart TD
    A[Unmatched Recoverable Exception] --> B[RecoveryEligibilityEngine]
    B -->|Check Risk, Exclusions & Terminal States| C{Is Eligible?}
    C -->|No| D[Mark Ineligible / Blocked]
    C -->|Yes| E[OpportunityStore.createFromCase]
    
    E --> F[RecoveryPriorityEngine (P0-P3)]
    F --> G[Root Cause & Specialist Resolver]
    G --> H[Generate 4-Phase Action Plan\n(CURRENT, NEXT, FALLBACK, STOP)]
    
    H --> I[AI / Specialist Agent Proposal]
    I --> J[Policy Engine Evaluation]
    
    J -->|Pass| K[Dispatch via Provider\n(WhatsApp / SMS / Invoice / Retry)]
    J -->|Block / Clamped| L[Reject Action / Clamp Discount]
    
    K --> M[Customer Response Simulation]
    M -->|Payment Full| N[Transition to VERIFYING]
    M -->|Partial Payment (60%)| O[Record Partial UTR & Invariant\nKeep 40% Remaining Active in Queue]
    M -->|Promise to Pay| P[Lock Grace Period in WAITING_FOR_CUSTOMER]
    M -->|Counter Offer| Q[Negotiation Agent Evaluates Round 2]
    M -->|No Response| R[Switch to Fallback Strategy on Next Cycle]
    
    N --> S[Reconciliation Engine Bank Settlement Check]
    S -->|UTR Matched| T[Transition to SETTLED_VERIFIED\nIncrease Verified Recovered Revenue]
    
    T --> U[Immutable SHA-256 Audit Block]
```

---

## 5. CAMPAIGN CONCURRENCY & MUTEX LOCKING WORKFLOW

```mermaid
flowchart TD
    A[Campaign Manager Trigger] --> B[Filter Eligible Portfolio]
    B --> C[Iterate Candidate Cases]
    
    C --> D{Is Case Already Claimed by\nAnother Active Campaign?}
    D -->|Yes| E[Reject Claim & Skip Case\n(Collision Prevented)]
    D -->|No| F[Acquire Atomic Lock (caseClaims.set)]
    
    F --> G[Execute Specialist Recovery Action]
    G --> H[Update Campaign Metrics\n(Targeted, Recovered, Net, ROI)]
    H --> I[Release Lock on Terminal Resolution]
```

---

## 6. CLOSED-LOOP PAYMENT VERIFICATION PIPELINE

```mermaid
flowchart LR
    A[Customer Action:\nPay via UPI / Card] --> B[Payment Provider:\nPayment Captured]
    B --> C[Case State:\nVERIFYING\n(Not Yet Recovered Cash)]
    C --> D[Bank Settlement Feed:\nIngest Settlement Batch & UTR]
    D --> E[Reconciliation Engine:\nreconcilePair(tx, settlement)]
    E --> F{UTR & Amount Match?}
    F -->|No| G[Hold in VERIFYING\nAlert Finance Queue]
    F -->|Yes| H[Transition to SETTLED_VERIFIED\nAttribute Recovered Revenue]
    H --> I[Append SHA-256 Audit Block]
```

---

## 7. PAGE & NAVIGATION MAP

```mermaid
graph TD
    Root["/ (Command Center Dashboard)"]
    
    Root --> Cases["/cases (Case Explorer)"]
    Cases --> CaseDetail["/cases/[id] (Case 360 Detail View)"]
    
    Root --> Recon["/reconciliation (Track 04: Finance Controller)"]
    Root --> Risk["/risk (Track 02: Risk Radar & Multi-Signal Triage)"]
    
    Root --> Recovery["/recovery (Track 03: Collections Operating Center)"]
    Recovery --> SubPromises["Center: Promise-to-Pay"]
    Recovery --> SubPartials["Center: Partial Collections Ledger"]
    Recovery --> SubInvoices["Center: Invoice Operations"]
    Recovery --> SubLinks["Center: Payment Links"]
    Recovery --> SubAging["Center: B2B Aging Dunning"]
    Recovery --> SubSubs["Center: Subscriptions"]
    Recovery --> SubMandates["Center: UPI Mandates"]
    Recovery --> SubDrops["Center: Checkout Drop-Offs"]
    Recovery --> SubVoice["Center: Voice Simulator"]
    Recovery --> SubNego["Center: Negotiation Protocol"]
    Recovery --> SubCamp["Center: Autonomous Campaigns"]
    
    Root --> Human["/human-review (FinOps Escalation Queue)"]
    Root --> Eval["/evaluation (Ground Truth Benchmark)"]
    Root --> Audit["/audit (Cryptographic Hash Explorer)"]
    Root --> Policies["/policies (Deterministic Guardrails)"]
```

---

## 8. COMPONENT DEPENDENCY MATRIX

```mermaid
graph TD
    subgraph UI Components ["Shared Component Library (src/components/ui/)"]
        RRCard["RRCard"]
        RRButton["RRButton"]
        RRBadge["RRBadge"]
        RRKpiCard["RRKpiCard"]
        RRSection["RRSection"]
        RRFilterBar["RRFilterBar"]
        RRPagination["RRPagination"]
        RREmptyState["RREmptyState"]
    end

    subgraph Pages ["Application Pages"]
        Page_Home["Command Center (/)"]
        Page_Cases["Case Explorer (/cases)"]
        Page_Detail["Case 360 (/cases/[id])"]
        Page_Recon["Reconciliation (/reconciliation)"]
        Page_Risk["Risk Radar (/risk)"]
        Page_Recovery["Recovery Operating Center (/recovery)"]
        Page_Human["Human Review (/human-review)"]
        Page_Audit["Audit Log (/audit)"]
        Page_Eval["Evaluation (/evaluation)"]
        Page_Policies["Policies (/policies)"]
    end

    RRCard --> Page_Home
    RRCard --> Page_Cases
    RRCard --> Page_Detail
    RRCard --> Page_Recon
    RRCard --> Page_Risk
    RRCard --> Page_Recovery
    RRCard --> Page_Human
    RRCard --> Page_Audit
    RRCard --> Page_Eval
    RRCard --> Page_Policies

    RRKpiCard --> Page_Home
    RRKpiCard --> Page_Recon
    RRKpiCard --> Page_Risk
    RRKpiCard --> Page_Recovery
    RRKpiCard --> Page_Eval

    RRButton --> Page_Cases
    RRButton --> Page_Detail
    RRButton --> Page_Recovery
    RRButton --> Page_Human
    RRButton --> Page_Eval
    RRButton --> Page_Policies

    RRBadge --> Page_Cases
    RRBadge --> Page_Detail
    RRBadge --> Page_Recovery
    RRBadge --> Page_Human
    RRBadge --> Page_Risk
```
