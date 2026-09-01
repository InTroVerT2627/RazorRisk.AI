# Changelog

All notable changes to the **RazorRisk.AI** platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-01

### Added
- **Track 04: Finance Controller & Reconciliation**:
  - Deterministic 1:1 exact matching with zero LLM inference cost.
  - Automatic MDR fee netting (1.5%–2.5%) and 18% GST calculation.
  - Structured AI exception triage tools (`getSettlementCandidates`, `computeFeeDeductions`).
  - Re-reconciliation verification of recovered settlements.
- **Track 02: Risk Manager & Multi-Signal Radar**:
  - Continuous feature-weighted risk scoring engine (0–100).
  - Multi-signal evaluation: Velocity bursts, device clusters, dispute ratios, card probing.
  - Programmatic policy routing: Score $\ge 70$ blocks; $40–69$ escalates; $< 40$ clears for recovery.
- **Track 03: Autonomous Revenue Recovery Operating Center**:
  - First-class `RecoveryOpportunity` domain model with 28 structured fields.
  - 10 Specialized Operating Centers:
    1. Promise-to-Pay Center (grace lock & broken promise auto-recycle).
    2. Partial Collections Center ($V_{\text{col}} + R_{\text{rem}} = O_{\text{orig}}$ invariant).
    3. Invoice Operations (B2B PDF invoice generation & Razorpay links).
    4. Payment Links Center (Created, Delivered, Viewed, Paid, Expired).
    5. B2B Aging Center (15–30d, 31–60d, 61–90d, 90+d brackets).
    6. Subscription Recovery Center (Smart retries & card update portals).
    7. Mandate Recovery Center (UPI AutoPay & switch window alignment).
    8. Checkout Recovery Center (1-click WhatsApp cart recovery nudges).
    9. Voice Recovery Simulator (Simulated English, Hindi, Hinglish dialogues).
    10. Negotiation Center (2-round bounded discount settlement protocol).
  - Autonomous Campaigns Engine with atomic case-claim mutex locks.
- **Core Fintech Infrastructure**:
  - Deterministic 12-rule Policy Engine enforcing hard merchant boundaries.
  - Immutable sequential SHA-256 cryptographic hash-chained audit logger.
  - Formal State Machine with transition graph validation.
  - Pluggable Payment Provider abstraction (Razorpay Sandbox Test Adapter + Fault Injection Simulation).
  - High-fidelity synthetic financial universe (48 scenario families, 50,000+ cases).
  - Cryptographic Ground Truth Isolation and empirical benchmark runner.
- **Frontend Consoles (Next.js 15 App Router)**:
  - 10 Interactive operational pages: `/`, `/cases`, `/cases/[id]`, `/reconciliation`, `/risk`, `/recovery`, `/human-review`, `/evaluation`, `/audit`, `/policies`.
  - Reusable component library (`RRCard`, `RRButton`, `RRBadge`, `RRKpiCard`, etc.).
- **DevOps & Testing**:
  - Automated test suite containing **427 tests across 34 test files** (100% pass rate).
  - GitHub Actions CI/CD workflow (`.github/workflows/ci.yml`).
  - Docker containerization (`Dockerfile`, `docker-compose.yml`).
