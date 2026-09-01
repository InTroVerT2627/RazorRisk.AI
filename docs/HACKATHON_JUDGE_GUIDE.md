# Buildathon Judge & Evaluation Guide — RazorRisk.AI

Welcome to the **RazorRisk.AI** judging walkthrough. This guide explains how to quickly evaluate the key technical innovations, agent interactions, and operational consoles of the platform.

---

## 1. Quick Setup (2 Minutes)

```bash
# 1. Install dependencies
npm install

# 2. Run the automated test suite (427 tests across 34 suites)
npm run test

# 3. Verify TypeScript type safety (0 errors)
npx tsc --noEmit

# 4. Start the application
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 2. Top 5 Demonstrations to Experience

### Demo 1: The 10 Recovery Operating Centers (`/recovery`)
* Navigate to `/recovery`.
* Observe the **11-KPI portfolio bar** and the **9-stage operational funnel**.
* Switch between dedicated centers:
  - **Promise-to-Pay**: Grace periods, upcoming promises, auto-recycle on breach.
  - **Partial Collections**: Ledger preserving $V_{\text{col}} + R_{\text{rem}} = O_{\text{orig}}$.
  - **Invoices**: Commercial B2B invoice generation with embedded Razorpay links.
  - **Negotiation Center**: Bounded 2-round discount negotiation with hard policy clamping.
  - **Voice Simulator**: Simulated Hinglish phone collections (*"Friday ko kar dunga"*).

### Demo 2: Zero-AI-Cost Reconciliation & Fee Netting (`/reconciliation`)
* Navigate to `/reconciliation`.
* View 1:1 exact matching (resolved instantly with zero LLM API calls).
* View MDR fee netting (1.5%–2.5% + 18% GST) calculated and matched automatically.

### Demo 3: Multi-Signal Continuous Risk Radar (`/risk`)
* Navigate to `/risk`.
* Observe the continuous 0–100 risk score distribution.
* Inspect cases with velocity bursts, device clusters, and card probing signals.
* Observe that high-risk cases ($\ge 70$) are blocked by policy and never enter recovery.

### Demo 4: FinOps Human Escalation Queue (`/human-review`)
* Navigate to `/human-review`.
* View evidence packets for borderline cases ($40–69$ risk score).
* Test operator controls: **Approve**, **Block**, **Override**, or **Write-Off**.

### Demo 5: Cryptographic SHA-256 Audit Trail (`/audit`)
* Navigate to `/audit`.
* Inspect the sequential hash chain linking every decision from the Genesis block.
* Click **Verify Audit Integrity** to cryptographically validate the chain.

---

## 3. Why RazorRisk.AI Wins on Hackathon Criteria

| Judging Criterion | Implementation in RazorRisk.AI |
|---|---|
| **Technical Innovation** | Zero-AI-cost exact matching short-circuit, continuous 0–100 multi-signal risk scoring, invariant partial collection accounting. |
| **Real-World Impact** | Solves high-friction payment failures, involuntary churn, and B2B overdue receivables for modern fintechs like Razorpay. |
| **Security & Safety** | 12 deterministic programmatic policy guardrails, prompt injection sanitization, and tamper-evident SHA-256 hash chains. |
| **Completeness & Polish** | 10 fully functional UI consoles, 14 REST APIs, 427 passing automated tests, clean Next.js 15 production build. |
