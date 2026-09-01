import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { FinOpsOrchestrator } from '@/agents/orchestrator';
import { FinanceControllerAgent } from '@/agents/finance-controller';
import { RiskManagerAgent } from '@/agents/risk-manager';
import { RevenueRecoveryAgent } from '@/agents/revenue-recovery';
import { PolicyEngine } from '@/core/policy-engine';
import { TransactionRecord, SettlementRecord, GroundTruthScenario } from '@/types';

describe('Eval Test: Cross-Track Live Workflow (Reconciliation -> Risk -> Recovery -> Verification)', () => {
  let ledger: LedgerStore;
  let orchestrator: FinOpsOrchestrator;
  let financeController: FinanceControllerAgent;
  let riskManager: RiskManagerAgent;
  let revenueRecovery: RevenueRecoveryAgent;
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    ledger = LedgerStore.getInstance();
    ledger.clear();
    orchestrator = new FinOpsOrchestrator();
    financeController = new FinanceControllerAgent();
    riskManager = new RiskManagerAgent();
    revenueRecovery = new RevenueRecoveryAgent();
    policyEngine = PolicyEngine.getInstance();
  });

  it('1. Scenario A: FAILED_PAYMENT_RETRYABLE travels through the complete live cross-track pipeline to VERIFIED', async () => {
    const tx: TransactionRecord = {
      id: 'tx_scen_a_001',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ord_retry_001',
      customerName: 'Kunal Shah',
      customerEmail: 'kunal@cread.in',
      customerPhone: '+919876500001',
      customerSegment: 'SMB',
      amountCents: 500000, // ₹5,000
      currency: 'INR',
      paymentMethod: 'UPI',
      gatewayCode: 'ICICI_UPI',
      status: 'FAILED',
      errorCode: 'GATEWAY_TIMEOUT_504',
      errorDescription: 'Upstream gateway timed out',
      createdAt: new Date().toISOString(),
    };

    const scenario: GroundTruthScenario = {
      id: 'scen_a_001',
      name: 'Transient Gateway Drop Scenario',
      scenarioType: 'TRANSIENT_GATEWAY_TIMEOUT',
      description: 'Network drop recoverable via retry',
      transaction: tx,
      riskSignals: {},
      expectedReconStatus: 'UNMATCHED_TRANSACTION',
      expectedRiskClassification: 'OPS_SHAPED',
      expectedSafeToRecover: true,
      expectedOptimalAction: 'RETRY_PAYMENT',
      expectedRecoverableCents: 500000,
    };

    const result = await orchestrator.runFullPipeline([scenario]);

    expect(result.cases.length).toBe(1);
    const c = result.cases[0];

    // Check complete cross-track lifecycle state
    expect(c.status).toBe('SETTLED_VERIFIED');
    expect(c.recoveryEligible).toBe(true);
    expect(c.recoveryEligibilityStatus).toBe('VERIFIED');
    expect(c.riskClassification).toBe('OPS_SHAPED');
    expect(c.riskScore).toBeLessThan(45);
    expect(c.recoveredAmountCents).toBe(500000);

    // Verify recovery case record exists and is marked VERIFIED
    const recCase = ledger.getRecoveryCase(c.id);
    expect(recCase).toBeDefined();
    expect(recCase?.status).toBe('VERIFIED');
    expect(recCase?.eligibilityStatus).toBe('VERIFIED');
  });

  it('2. Scenario B: OVERDUE_B2B_INVOICE gets P0 priority, negotiates discount, and settles', async () => {
    const tx: TransactionRecord = {
      id: 'tx_scen_b_001',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'inv_b2b_001',
      customerName: 'Acme MegaCorp India',
      customerEmail: 'ap@acmemegacorp.in',
      customerPhone: '+919876500002',
      customerSegment: 'ENTERPRISE',
      amountCents: 6000000, // ₹60,000 (B2B exposure)
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      gatewayCode: 'HDFC_PG',
      status: 'FAILED',
      errorCode: 'CARD_EXPIRED_54',
      daysOverdue: 45,
      createdAt: new Date().toISOString(),
    };

    const scenario: GroundTruthScenario = {
      id: 'scen_b_001',
      name: 'Overdue Enterprise Receivable',
      scenarioType: 'CUSTOMER_REQUESTS_NEGOTIATION',
      description: 'High-value enterprise overdue invoice',
      transaction: tx,
      riskSignals: {},
      expectedReconStatus: 'UNMATCHED_TRANSACTION',
      expectedRiskClassification: 'OPS_SHAPED',
      expectedSafeToRecover: true,
      expectedOptimalAction: 'BOUNDED_NEGOTIATE',
      expectedRecoverableCents: 6000000,
    };

    const result = await orchestrator.runFullPipeline([scenario]);
    const c = result.cases[0];

    expect(c.status).toBe('SETTLED_VERIFIED');
    expect(c.recoveryPriority).toBe('P0');
    expect(c.recoveryEligible).toBe(true);

    const recCase = ledger.getRecoveryCase(c.id);
    expect(recCase?.priority).toBe('P0');
    expect(recCase?.customerSegment).toBe('ENTERPRISE');
  });

  it('3. Scenario C: FRAUD is strictly BLOCKED by Risk Manager and NEVER enters actionable recovery', async () => {
    const tx: TransactionRecord = {
      id: 'tx_scen_c_001',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'fraud_tx_001',
      customerName: 'Suspicious Device Cluster',
      customerEmail: 'burner@tempmail.xyz',
      customerPhone: '+919000000000',
      customerSegment: 'CONSUMER',
      amountCents: 1500000, // ₹15,000
      currency: 'INR',
      paymentMethod: 'CREDIT_CARD',
      gatewayCode: 'AXIS_CARD',
      status: 'FAILED',
      errorCode: 'SUSPECTED_FRAUD_59',
      createdAt: new Date().toISOString(),
    };

    const scenario: GroundTruthScenario = {
      id: 'scen_c_001',
      name: 'Coordinated Velocity Attack',
      scenarioType: 'ORGANIZED_FRAUD_BURST',
      description: 'High velocity probing on shared device',
      transaction: tx,
      riskSignals: {
        customerVelocity24h: 22, // Critical velocity
        deviceFingerprintRisk: 'HIGH',
        linkedAccountsOnDevice: 8,
        chargebackHistoryRatio: 0.55,
      },
      expectedReconStatus: 'UNMATCHED_TRANSACTION',
      expectedRiskClassification: 'CRITICAL_FRAUD',
      expectedSafeToRecover: false,
      expectedOptimalAction: 'STOP_RECOVERY',
      expectedRecoverableCents: 0,
    };

    const result = await orchestrator.runFullPipeline([scenario]);
    const c = result.cases[0];

    expect(c.status).toBe('RISK_BLOCKED');
    expect(c.recoveryEligible).toBe(false);
    expect(c.recoveryEligibilityStatus).toBe('BLOCKED');
    expect(c.riskScore).toBeGreaterThanOrEqual(70);

    // Blocked cases never enter active recovery
    const recCase = ledger.getRecoveryCase(c.id);
    expect(recCase).toBeUndefined();
  });

  it('4. Scenario D: EXACT_MATCH is auto-resolved in Reconciliation with NOT_APPLICABLE and does not trigger recovery', async () => {
    const tx: TransactionRecord = {
      id: 'tx_scen_d_001',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'order_exact_001',
      customerName: 'Verified Merchant Client',
      amountCents: 100000,
      currency: 'INR',
      paymentMethod: 'UPI',
      gatewayCode: 'NPCI_SWITCH',
      status: 'CAPTURED',
      createdAt: new Date().toISOString(),
    };

    const st: SettlementRecord = {
      id: 'st_scen_d_001',
      batchId: 'BATCH_001',
      utrRrn: 'order_exact_001',
      amountCents: 100000,
      feeCents: 0,
      taxCents: 0,
      netAmountCents: 100000,
      currency: 'INR',
      bankTimestamp: new Date().toISOString(),
      rawDescription: 'UPI-MATCH-001',
      createdAt: new Date().toISOString(),
    };

    const scenario: GroundTruthScenario = {
      id: 'scen_d_001',
      name: 'Exact 1:1 Match',
      scenarioType: 'CLEAN_EXACT_MATCH',
      description: 'Standard 1:1 match',
      transaction: tx,
      settlement: st,
      riskSignals: {},
      expectedReconStatus: 'EXACT_MATCH',
      expectedRiskClassification: 'OPS_SHAPED',
      expectedSafeToRecover: false,
      expectedOptimalAction: 'STOP_RECOVERY',
      expectedRecoverableCents: 0,
    };

    const result = await orchestrator.runFullPipeline([scenario]);

    // Exact matches do not create exceptions
    expect(result.metrics.reconciledCount).toBe(1);
    expect(result.metrics.exceptionsCount).toBe(0);
    expect(result.cases.length).toBe(0);
  });

  it('5. Human Review override re-evaluates eligibility, marks case ELIGIBLE, and triggers recovery execution', async () => {
    const finOpsCase = ledger.createCase({
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 250000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      status: 'HUMAN_REVIEW_REQUIRED',
      riskScore: 50,
      riskClassification: 'BORDERLINE_REVIEW',
    });

    ledger.evaluateAndSetRecoveryEligibility(
      finOpsCase.id,
      false,
      'HUMAN_REVIEW',
      'Borderline risk score 50/100 escalated to operator'
    );

    let c = ledger.getCase(finOpsCase.id)!;
    expect(c.recoveryEligible).toBe(false);
    expect(c.recoveryEligibilityStatus).toBe('HUMAN_REVIEW');

    // Human approves recovery
    const overrideResult = await orchestrator.handleHumanOverride(
      finOpsCase.id,
      'APPROVE_RECOVERY',
      'OP_LEAD_01',
      'Customer verified via telephone; approved for payment link'
    );

    expect(overrideResult.success).toBe(true);
    c = ledger.getCase(finOpsCase.id)!;
    expect(c.recoveryEligible).toBe(true);
    expect(c.recoveryEligibilityStatus).toBe('ELIGIBLE');
    expect(c.status).toBe('RECOVERY_EXECUTED');
  });

  it('6. Priority scoring accurately ranks P0, P1, P2, and P3 cases', () => {
    // Enterprise high ticket -> P0
    const p0 = ledger.calculateRecoveryPriority({
      amountAtRiskCents: 7500000, // ₹75,000
      customerSegment: 'ENTERPRISE',
      riskScore: 18,
    });
    expect(p0.priority).toBe('P0');

    // Mid-Market -> P1
    const p1 = ledger.calculateRecoveryPriority({
      amountAtRiskCents: 1500000, // ₹15,000
      customerSegment: 'MID_MARKET',
      riskScore: 25,
    });
    expect(p1.priority).toBe('P1');

    // SMB -> P2
    const p2 = ledger.calculateRecoveryPriority({
      amountAtRiskCents: 300000, // ₹3,000
      customerSegment: 'SMB',
      riskScore: 20,
    });
    expect(p2.priority).toBe('P2');

    // Micro Consumer -> P3
    const p3 = ledger.calculateRecoveryPriority({
      amountAtRiskCents: 45000, // ₹450
      customerSegment: 'CONSUMER',
      riskScore: 20,
    });
    expect(p3.priority).toBe('P3');
  });
});
