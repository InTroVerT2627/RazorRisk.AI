# Security Policy — RazorRisk.AI

RazorRisk.AI takes the security of financial transactions, AI agent boundaries, and operational ledger integrity seriously.

---

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability in RazorRisk.AI (such as a prompt injection bypass, policy evasion, ledger state tampering, or PII leak), please report it responsibly:

1. **Email**: Send vulnerability reports to `security@razorrisk.ai`.
2. **Details to Include**:
   - Description of the vulnerability and attack vector.
   - Exact steps to reproduce or proof-of-concept payload.
   - Potential impact on financial state, AI agents, or policy limits.
3. **Response Time**: Our maintainers will acknowledge receipt within 24 hours and provide a fix timeline within 72 hours.
4. **Public Disclosure**: We request that you refrain from public disclosure until a security advisory and patch have been published.

---

## Security Architecture & Defense-in-Depth

RazorRisk.AI enforces several layers of cryptographic and deterministic security:

### 1. Zero Direct Financial Execution for LLMs
No LLM is permitted to directly mutate financial balances or execute refunds/discounts without passing through the programmatic `PolicyEngine` (`src/core/policy-engine/index.ts`).

### 2. Prompt Injection & Red-Team Sanitization
Customer inputs and simulated messages pass through `PIIMasker` (`src/core/security/pii-masker.ts`) before being included in agent contexts, preventing prompt injection attacks attempting to alter merchant policy.

### 3. Cryptographic SHA-256 Hash Chain
Every decision, mutation, and state transition is sealed in a tamper-evident sequential SHA-256 hash chain from genesis (`src/core/audit/audit-logger.ts`). Any offline alteration of historical entries results in immediate cryptographic validation failure.

### 4. Strict Ground Truth Isolation
Evaluation benchmarks enforce cryptographic isolation (`src/core/evaluation/ground-truth-isolation.ts`), stripping hidden ground truth scenario labels from public telemetry to prevent benchmark leakage.

### 5. Webhook HMAC-SHA256 Verification
All inbound payment gateway webhooks (e.g. Razorpay) verify HMAC-SHA256 signatures before processing payload events.
