# RazorRisk.AI — REST API Reference Manual

Base URL: `http://localhost:3000`

All responses follow a standard JSON envelope:
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

---

## 1. Case Management APIs

### `GET /api/cases`
Fetch paginated FinOps cases with multi-factor filtering.
* **Query Parameters**:
  * `status`: Filter by `CaseStatus` (e.g. `NEW`, `RECOVERING`, `SETTLED_VERIFIED`, `RISK_BLOCKED`, etc.)
  * `reconStatus`: Filter by `ReconStatus` (e.g. `EXACT_MATCH`, `FEE_MISMATCH`, `UNMATCHED_TRANSACTION`)
  * `risk`: Filter by `RiskClassification` (`OPS_SHAPED`, `BORDERLINE_REVIEW`, `CRITICAL_FRAUD`)
  * `search`: Keyword search across case number, customer name, transaction ref
  * `page`: Page number (default: 1)
  * `limit`: Items per page (default: 15)

### `GET /api/cases/[id]`
Fetch 360-degree case detail with linked transactions, settlements, and SHA-256 audit events.

### `POST /api/cases`
Create a manual financial exception case.
* **Body**:
  ```json
  {
    "transactionId": "tx_example_01",
    "amountAtRiskCents": 500000,
    "merchantId": "MERCHANT_DEFAULT",
    "reconStatus": "UNMATCHED_TRANSACTION"
  }
  ```

---

## 2. Revenue Recovery & Operating Centers APIs

### `GET /api/recovery/opportunities`
List all first-class recovery opportunities.
* **Query Parameters**:
  * `state`: Filter by `RecoveryQueueStatus` (e.g. `READY_FOR_RECOVERY`, `ACTIVE`, `NEGOTIATING`, `PARTIALLY_RECOVERED`, `VERIFIED`)
  * `priority`: Filter by priority tier (`P0`, `P1`, `P2`, `P3`)
  * `source`: Filter by source (`OVERDUE_INVOICE`, `FAILED_PAYMENT`, `ABANDONED_CHECKOUT`, `SUBSCRIPTION_FAILURE`, `MANDATE_FAILURE`, `PARTIAL_COLLECTION`)
  * `search`: Search query string

### `GET /api/recovery/opportunities/[id]`
Get a single recovery opportunity by ID.

### `POST /api/recovery/opportunities/[id]/action`
Execute a recovery action on an opportunity.
* **Body**:
  ```json
  {
    "action": "SEND_PAYMENT_LINK",
    "customerMessage": "PAID",
    "notes": "Triggering instant UPI link"
  }
  ```

### `GET /api/recovery/centers`
Fetch summary statistics across all 10 Operating Centers.
* **Response**: Returns metrics for Promises due today, Residual partial balances, Active invoices, Payment links, B2B aging buckets (15-30d, 31-60d, 61-90d, 90+d), and center counts.

### `GET /api/recovery/campaigns`
List all autonomous recovery campaigns.

### `POST /api/recovery/campaigns`
Create a new autonomous recovery campaign.

### `POST /api/recovery/campaigns/[id]/run`
Execute an autonomous campaign run with atomic case-claim mutex locking.

---

## 3. Orchestration & Human Review APIs

### `POST /api/orchestrator/run`
Run the autonomous FinOps pipeline on a synthetic dataset.
* **Body**:
  ```json
  {
    "datasetSize": 50,
    "scenarioFamily": "ALL"
  }
  ```

### `POST /api/orchestrator/human-action`
Execute a human operator decision on an escalated case.
* **Body**:
  ```json
  {
    "caseId": "c_12345",
    "action": "APPROVE",
    "operatorNotes": "Verified legitimate customer exception"
  }
  ```

---

## 4. Audit, Policy & Evaluation APIs

### `GET /api/audit`
Fetch sequential SHA-256 hash-chained audit events with cryptographic integrity check (`chainValid: true`).

### `POST /api/evaluation/run`
Execute an empirical benchmark run against hidden ground truth.

### `GET /api/policies` & `POST /api/policies`
Fetch or update active merchant policy guardrails.

### `GET /api/health`
System diagnostic health monitor.
