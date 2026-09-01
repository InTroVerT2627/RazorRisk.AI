# RazorRisk.AI — Technical Architecture & Domain Model

## 1. Executive Conceptual Model
RazorRisk.AI operates on three independent operational workspaces governed by an immutable policy engine and cryptographic audit chain:

* **Track 04: Finance Controller / Reconciliation**: *"What happened to the money?"*
* **Track 02: Risk Manager**: *"Is this safe / legitimate?"*
* **Track 03: Revenue Recovery Operating Center**: *"How should we collect money that is legitimately owed?"*

```mermaid
flowchart TD
    subgraph Ingestion ["Financial Feeds & Gateway Ingestion"]
        TX[Transaction Telemetry]
        STL[Bank Settlements / UTR Batches]
    end

    subgraph Track04 ["Track 04: Finance Controller & Reconciliation"]
        ExactMatch{Exact 1:1 Match?}
        ExactMatch -->|Yes| RecState[RECONCILED - Zero AI Cost]
        ExactMatch -->|No| Netting{MDR Fee Netting?}
        Netting -->|Yes| FeeState[FEE_MISMATCH - Verified]
        Netting -->|No| AI_FC[Finance Controller Agent Structured Tools]
    end

    subgraph Track02 ["Track 02: Risk Manager & Multi-Signal Radar"]
        RiskEval[Continuous Scoring Engine 0-100]
        RiskEval -->|Score >= 70| RiskBlock[CRITICAL_FRAUD - Blocked]
        RiskEval -->|Score 40-69| RiskEsc[BORDERLINE_REVIEW - Escalated]
        RiskEval -->|Score < 40| RiskApprove[OPS_APPROVED - Approved]
    end

    subgraph Track03 ["Track 03: Revenue Recovery Operating Center"]
        Eligibility[Recovery Eligibility Engine]
        Priority[Recovery Priority Engine P0-P3]
        Supervisor[Recovery Supervisor Router]
        Centers[10 Operating Centers]
        Eligibility --> Priority --> Supervisor --> Centers
    end

    subgraph Safety ["Deterministic Programmatic Boundaries"]
        Policy[Policy Engine 12 Guardrails]
        StateMachine[State Machine Graph Validator]
        Audit[SHA-256 Chained Block Logger]
    end

    TX --> Track04
    STL --> Track04
    Track04 -->|Discrepancy Exception| Track02
    Track02 --> Safety
    Track03 --> Safety
    Safety -->|Approved Execution| Execution[Payment Provider & Messaging]
    Execution --> Verification[Closed-Loop UTR Verification]
    Verification --> Track04
    Verification --> Audit
```

---

## 2. The 10 Recovery Operating Centers
1. **Promise-to-Pay Center**: Manages customer payment commitments, locks grace periods, and auto-recycles broken promises into the active decision queue.
2. **Partial Collections Center**: Tracks partial collections, strictly enforcing: $\text{Verified Collected} + \text{Remaining Balance} = \text{Original Receivable}$.
3. **Invoice Operations Center**: Issues commercial B2B invoices with PDF rendering, GST calculation, and embedded payment links.
4. **Payment Links Center**: Tracks payment link lifecycle: `CREATED` $\rightarrow$ `DELIVERED` $\rightarrow$ `VIEWED` $\rightarrow$ `PAID` / `EXPIRED`.
5. **B2B Aging Center**: Categorizes overdue accounts into 15–30d, 31–60d, 61–90d, and 90+d aging brackets with automated early-settlement incentive triggers.
6. **Subscription Recovery Center**: Handles SaaS recurring drops (`AUTOPAY`, card expired `54`) with smart retries and secure card update links.
7. **Mandate Recovery Center**: Retries UPI AutoPay and e-mandates aligned with NPCI banking switch windows.
8. **Checkout Drop-Off Center**: Recovers high-intent abandoned carts with 1-click WhatsApp payment nudges and bounded incentives ($\le 5\%$).
9. **Voice Recovery Simulator**: Multi-lingual recovery dialogues in English, Hindi, and Hinglish (`"Friday ko kar dunga"`).
10. **Negotiation Center**: Executes bounded 2-round settlement protocol for B2B accounts ($\ge$ ₹50,000) enforcing policy discount caps ($\le 10\%$) and minimum settlement floors ($\ge 85\%$).

---

## 3. Formal State Machine Specification
```mermaid
stateDiagram-v2
    [*] --> NEW
    NEW --> RECONCILING
    RECONCILING --> SETTLED_VERIFIED : 1:1 Match
    RECONCILING --> EXCEPTION_DETECTED : Discrepancy

    EXCEPTION_DETECTED --> RISK_TRIAGING : Anomaly Triaging
    EXCEPTION_DETECTED --> RECOVERY_ELIGIBLE : Direct Failure
    EXCEPTION_DETECTED --> HUMAN_REVIEW_REQUIRED : Severe Anomaly

    RISK_TRIAGING --> RISK_BLOCKED : Risk Score >= 70
    RISK_TRIAGING --> HUMAN_REVIEW_REQUIRED : Risk Score 40-69
    RISK_TRIAGING --> OPS_APPROVED : Risk Score < 40

    OPS_APPROVED --> RECOVERY_ELIGIBLE : Valid Obligation

    RECOVERY_ELIGIBLE --> RECOVERING : Dispatch Strategy
    RECOVERING --> RECOVERY_EXECUTED : Action Sent

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
