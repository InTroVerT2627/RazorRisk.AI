# Contributing to RazorRisk.AI

Thank you for your interest in contributing to **RazorRisk.AI**! As an enterprise-grade autonomous FinOps, risk assessment, and revenue recovery platform, we welcome contributions from developers, security researchers, and fintech engineers worldwide.

---

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to `security@razorrisk.ai`.

---

## Development Setup

### 1. Prerequisites
- **Node.js**: $\ge 18.17.0$ (LTS recommended)
- **npm**: $\ge 9.0.0$
- **Git**: $\ge 2.30.0$

### 2. Fork and Clone
```bash
git clone https://github.com/InTroVerT2627/RazorRisk.AI.git
cd RazorRisk.AI
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment
```bash
cp .env.example .env.local
```
*(No API keys are required for offline development; deterministic simulation mode is active by default.)*

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Quality & Verification Standards

Before submitting any Pull Request, you MUST verify that your changes satisfy all quality gates:

```bash
# 1. Run all 427+ automated unit, integration, and E2E tests
npm run test

# 2. Verify static TypeScript types (0 errors required)
npx tsc --noEmit

# 3. Verify production Next.js compilation (22 routes)
npm run build
```

---

## Core Architectural Invariants

When contributing code to any operational track, remember the **Core Fintech Law**:

> **LLM Decides. Code Enforces. Ledger Stores State. Reconciliation Verifies Real Outcomes. Audit Log Records Everything.**

1. **Deterministic Guardrails**: AI agents may propose recovery actions, but the programmatic `PolicyEngine` (`src/core/policy-engine/index.ts`) must authorize every financial mutation.
2. **Partial Collection Accounting**: If a partial collection occurs ($V_{\text{col}} < O_{\text{orig}}$), state MUST transition to `PARTIALLY_RECOVERED` (never prematurely `SETTLED_VERIFIED`), preserving the invariant:
   $$\text{Verified Collected} + \text{Remaining Balance} = \text{Original Receivable}$$
3. **Closed-Loop Verification**: A payment request or customer agreement does NOT increase verified recovered cash until bank settlement UTR matching is confirmed.
4. **Cryptographic Audit**: All state mutations and agent actions must be appended to the sequential SHA-256 hash chain in `AuditLogger`.

---

## Pull Request Guidelines

1. Create a descriptive topic branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Follow Conventional Commits:
   - `feat(...)`: New feature or capability
   - `fix(...)`: Bug fix or patch
   - `docs(...)`: Documentation changes
   - `test(...)`: Adding or updating test suites
   - `refactor(...)`: Code changes that neither fix a bug nor add a feature
   - `ci(...)`: GitHub Actions or DevOps changes
3. Ensure all tests pass (`npm run test`) and typecheck passes (`npx tsc --noEmit`).
4. Submit your PR using the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).

---

## Questions & Support
Join our GitHub Discussions or open an issue using the [Issue Templates](.github/ISSUE_TEMPLATE/).
