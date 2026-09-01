# Policy Engine Specification — The 12 Immutable Guardrails

The **Policy Engine** (`src/core/policy-engine/index.ts`) is the deterministic programmatic foundation of RazorRisk.AI. It guarantees that AI agent decisions can never violate merchant financial policies or risk boundaries.

---

## The 12 Programmatic Guardrail Rules

| Rule # | Name | Condition / Limit | Action if Violated | Affected Subsystem |
|---|---|---|---|---|
| **Rule 1** | **Hard Risk Threshold** | Risk Score $\ge 70$ or `CRITICAL_FRAUD` | Execution **BLOCKED**; case prohibited from recovery | All Recovery Agents |
| **Rule 2** | **Maximum Retry Ceiling** | $\le 3$ retries per case | Subsequent retries **REJECTED**; case closed/escalated | Payment / Retry Agents |
| **Rule 3** | **Contact Cooldown Enforcement** | Minimum 4 hours between automated customer contacts | Outreach **BLOCKED** until cooldown expires | Collections / Messaging |
| **Rule 4** | **Maximum Discount Ceiling** | Clamped strictly to $\le 10.0\%$ ($1000$ bps) | Offer automatically **CLAMPED** or **REJECTED** | Negotiation Agent |
| **Rule 5** | **Minimum Settlement Floor** | Minimum recovery amount $\ge 85.0\%$ of original | Counter-offer **REJECTED** | Negotiation Agent |
| **Rule 6** | **Auto-Recovery Exposure Cap** | Single cases $>$ ₹50,000 | **ESCALATED** to human review queue | Autonomous Orchestrator |
| **Rule 7** | **Channel Authorization** | Contact only via merchant-enabled channels (WhatsApp/SMS/Email) | Unauthorized channel **BLOCKED** | Messaging Provider |
| **Rule 8** | **Daily Contact Frequency Cap** | Maximum 2 outbound contacts per customer per 24h | Subsequent contacts **BLOCKED** | Collections Agent |
| **Rule 9** | **Campaign Budget Ceiling** | Total campaign discount $\le$ merchant allocated budget | Campaign paused; further discounts **BLOCKED** | Campaign Manager |
| **Rule 10** | **Bounded Negotiation Rounds** | Maximum 2 rounds of counter-offers | Negotiation finalized; further rounds **BLOCKED** | Negotiation Agent |
| **Rule 11** | **Promise-to-Pay Grace Lock** | Active promise date not yet reached | Aggressive dunning **PAUSED** | Collections Agent |
| **Rule 12** | **Human Sovereign Override** | Human operator decision overrides autonomous AI | AI agent prohibited from reversing human action | Orchestrator & All Agents |
