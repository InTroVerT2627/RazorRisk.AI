# Evaluation & Synthetic Benchmark Specification

RazorRisk.AI includes an empirical evaluation framework capable of generating realistic, large-scale financial universes (50,000+ cases) to benchmark agent precision, recall, false-positive costs, and net recovery.

---

## 1. Synthetic Financial Universe
* **Seeded PRNG**: `AleaPRNG` guarantees 100% deterministic reproducibility across runs.
* **48 Scenario Families**: Covering normal operations, benign timing anomalies, recoverable failures, and coordinated fraud patterns.
* **Realistic Entities**: Merchants, customer segments (`ENTERPRISE`, `MID_MARKET`, `SMB`, `CONSUMER`), device clusters, and fraud syndicates.

---

## 2. Cryptographic Ground Truth Isolation
To evaluate AI agents objectively without data contamination, `GroundTruthIsolation` (`src/core/evaluation/ground-truth-isolation.ts`) enforces strict data sanitization:
1. Strips scenario family names, fraud labels, and ground truth metadata.
2. Passes ONLY public transaction telemetry and raw gateway error codes to agents.
3. Cryptographically asserts zero leakage before benchmark execution begins.

---

## 3. Evaluation Metrics & Confusion Matrix
The Benchmark Runner evaluates:
* **Risk Classification Accuracy**: Precision, Recall, F1-Score, Specificity.
* **Financial Impact Metrics**:
  - **False Positive Cost**: Operational cost and lost revenue from blocking legitimate high-value customers.
  - **False Negative Exposure**: Uncollected loss from failing to catch adversarial fraud attacks.
  - **Net Recovered Cash**: Gross revenue recovered minus communication and incentive discount costs.
