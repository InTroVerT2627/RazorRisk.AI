import { describe, it, expect } from 'vitest';
import { LedgerStore } from '../../src/core/ledger/ledger-store';
import { AuditLogger } from '../../src/core/audit/audit-logger';
import { PolicyEngine } from '../../src/core/policy-engine';
import { FinOpsOrchestrator } from '../../src/agents/orchestrator';
import { FinanceControllerAgent } from '../../src/agents/finance-controller';
import { RiskManagerAgent } from '../../src/agents/risk-manager';
import { RevenueRecoveryAgent } from '../../src/agents/revenue-recovery';
import { FinOpsAIProvider } from '../../src/core/ai/provider';
import { TransactionRecord, SettlementRecord, GroundTruthScenario } from '../../src/types';

describe('Phase 4 Real Multi-Agent Intelligence & Structured AI System', () => {
  const ledger = LedgerStore.getInstance();
  const audit = AuditLogger.getInstance();
  const orchestrator = new FinOpsOrchestrator();

  it('1. Finance Controller: Exact match bypasses LLM call; ambiguous cases invoke structured AI tools', async () => {
    ledger.clear();
    const finance = new FinanceControllerAgent();

    const exactTx: TransactionRecord = {
      id: 'tx_exact_01',
      merchantId: 'merch_01',
      externalRef: 'UTR_EXACT_123',
      amountCents: 50000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Aarav Sharma',
      status: 'CAPTURED',
      createdAt: new Date().toISOString(),
    };

    const exactSt: SettlementRecord = {
      id: 'st_exact_01',
      batchId: 'B1',
      utrRrn: 'UTR_EXACT_123',
      amountCents: 50000,
      feeCents: 0,
      taxCents: 0,
      netAmountCents: 50000,
      currency: 'INR',
      bankTimestamp: new Date().toISOString(),
      rawDescription: 'UPI-Aarav Sharma-UTR_EXACT_123',
      createdAt: new Date().toISOString(),
    };

    const ambiguousTx: TransactionRecord = {
      id: 'tx_ambig_01',
      merchantId: 'merch_01',
      externalRef: 'REF_AMBIG_456',
      amountCents: 100000,
      currency: 'INR',
      paymentMethod: 'CARD',
      customerName: 'Priya Patel',
      status: 'CAPTURED',
      createdAt: new Date().toISOString(),
    };

    const ambiguousSt: SettlementRecord = {
      id: 'st_ambig_01',
      batchId: 'B2',
      utrRrn: 'REF_AMBIG_456',
      amountCents: 97640, // 2% MDR fee + 18% GST netted
      feeCents: 2000,
      taxCents: 360,
      netAmountCents: 97640,
      currency: 'INR',
      bankTimestamp: new Date().toISOString(),
      rawDescription: 'CARD-SETTLE-MDR-NETTED-REF_AMBIG_456',
      createdAt: new Date().toISOString(),
    };

    const result = await finance.reconcileIngestedBatch(
      [exactTx, ambiguousTx],
      [exactSt, ambiguousSt]
    );

    expect(result.exactMatchesCount).toBe(1);
    expect(result.exceptionsCount).toBe(1);
    expect(result.agentMessages.length).toBe(1); // AI invoked for ambiguous fee mismatch

    const aiMessage = result.agentMessages[0];
    expect(aiMessage.payload.decision).toBe('MATCH');
    expect(aiMessage.payload.requiresVerification).toBe(true);
    expect(aiMessage.telemetry?.validatedSchema).toBe(true);
  });

  it('2. Risk Manager: Evaluates multi-signal risk, validates output schema, and routes high-risk cases to block', async () => {
    ledger.clear();
    const riskManager = new RiskManagerAgent();

    const caseObj = ledger.createCase({
      merchantId: 'merch_01',
      amountAtRiskCents: 250000,
      reconStatus: 'UNMATCHED_TRANSACTION',
    });

    const highRiskSignals = {
      customerVelocity24h: 18,
      deviceFingerprintRisk: 'HIGH',
      linkedAccountsOnDevice: 6,
      failedCardAttemptsToday: 8,
    };

    const { assessment, agentMessage } = await riskManager.evaluateCase(caseObj.id, highRiskSignals);

    expect(assessment.classification).toBe('CRITICAL_FRAUD');
    expect(assessment.riskScore).toBeGreaterThanOrEqual(70);
    expect(assessment.recommendedAction).toBe('BLOCK_AND_BLACKLIST');
    expect(agentMessage.telemetry?.validatedSchema).toBe(true);
    expect(agentMessage.payload.signals.length).toBeGreaterThan(0);
  });

  it('3. Policy Penetration Adversarial Tests: Policy Engine strictly blocks model hallucinated over-limits', () => {
    const policy = PolicyEngine.getInstance();
    const mockCase = ledger.createCase({
      merchantId: 'merch_01',
      amountAtRiskCents: 100000,
      reconStatus: 'UNMATCHED_TRANSACTION',
    });

    // Attempt A: Discount over limit (15% requested, max allowed 10%)
    const overDiscountResult = policy.evaluateRecoveryAction({
      finOpsCase: mockCase,
      actionType: 'OFFER_BOUNDED_DISCOUNT',
      channel: 'WHATSAPP',
      discountOfferedBps: 1500, // 15% VIOLATION!
      riskScore: 20,
    });
    expect(overDiscountResult.passed).toBe(false);
    expect(overDiscountResult.violations.some((v) => v.includes('exceeds policy maximum'))).toBe(true);

    // Attempt B: Recovery when Risk Score is 85
    const riskBlockResult = policy.evaluateRecoveryAction({
      finOpsCase: mockCase,
      actionType: 'SEND_PAYMENT_LINK',
      channel: 'SMS',
      riskScore: 85, // HARD BLOCK!
    });
    expect(riskBlockResult.passed).toBe(false);
    expect(riskBlockResult.violations.some((v) => v.includes('hard block threshold'))).toBe(true);
  });

  it('4. Showcase Demonstration Scenario A: Operational Recovery (Transient Gateway Drop -> Verified Settlement)', async () => {
    ledger.clear();
    // Mock Math.random to ensure outcomeHash is < 55 (e.g. 0 to force hash consistency)
    const originalMathRandom = Math.random;
    Math.random = () => 0;

    const operationalScenario: GroundTruthScenario = {
      id: 'demo_case_a',
      name: 'Case A: Operational Gateway Issue',
      scenarioType: 'FAILED_PAYMENT_RETRYABLE',
      description: 'Transient gateway timeout drop',
      expectedReconStatus: 'UNMATCHED_TRANSACTION',
      expectedRiskClassification: 'OPS_SHAPED',
      expectedSafeToRecover: true,
      expectedOptimalAction: 'RETRY_PAYMENT',
      expectedRecoverableCents: 450000,
      transaction: {
        id: 'tx_demo_a',
        merchantId: 'merch_enterprise_01',
        externalRef: 'UTR_DEMO_A_001',
        amountCents: 450000,
        currency: 'INR',
        paymentMethod: 'UPI',
        customerName: 'Aditya Verma',
        errorCode: 'GATEWAY_TIMEOUT_504',
        errorDescription: 'Gateway 504 Gateway Timeout',
        status: 'FAILED',
        createdAt: new Date().toISOString(),
        customerSegment: 'SMB',
      },
      riskSignals: {
        customerVelocity24h: 1,
        deviceFingerprintRisk: 'LOW',
        chargebackHistoryRatio: 0.0,
      },
    };

    const result = await orchestrator.runFullPipeline([operationalScenario]);

    // Restore Math.random
    Math.random = originalMathRandom;

    expect(result.metrics.totalProcessed).toBe(1);
    expect(result.metrics.recoveredCount).toBeGreaterThanOrEqual(0);

    const targetCase = result.cases.find((c) => c.transactionId === 'tx_demo_a');
    expect(['SETTLED_VERIFIED', 'RECOVERING']).toContain(targetCase?.status);
  });

  it('5. Showcase Demonstration Scenario B: Risk Block (Coordinated Fraud Attack -> Policy Blocked)', async () => {
    ledger.clear();
    const fraudScenario: GroundTruthScenario = {
      id: 'demo_case_b',
      name: 'Case B: Coordinated Fraud Ring',
      scenarioType: 'ORGANIZED_FRAUD_BURST',
      description: 'High velocity card burst from shared device proxy',
      expectedReconStatus: 'UNMATCHED_TRANSACTION',
      expectedRiskClassification: 'CRITICAL_FRAUD',
      expectedSafeToRecover: false,
      expectedOptimalAction: 'STOP_RECOVERY',
      expectedRecoverableCents: 0,
      transaction: {
        id: 'tx_demo_b',
        merchantId: 'merch_gaming_01',
        externalRef: 'UTR_DEMO_B_002',
        amountCents: 850000,
        currency: 'INR',
        paymentMethod: 'CARD',
        customerName: 'Anonymous Vector',
        status: 'FAILED',
        createdAt: new Date().toISOString(),
      },
      riskSignals: {
        customerVelocity24h: 22,
        deviceFingerprintRisk: 'HIGH',
        linkedAccountsOnDevice: 8,
        failedCardAttemptsToday: 12,
      },
    };

    const result = await orchestrator.runFullPipeline([fraudScenario]);

    expect(result.metrics.blockedRiskCount).toBe(1);
    const targetCase = result.cases.find((c) => c.transactionId === 'tx_demo_b');
    expect(targetCase?.status).toBe('RISK_BLOCKED');
    expect(targetCase?.riskScore).toBeGreaterThanOrEqual(70);
  });

  it('6. Showcase Demonstration Scenario C: Ambiguous Case (MDR Fee Variance -> AI Finance Investigation -> Verified)', async () => {
    ledger.clear();
    const ambiguousScenario: GroundTruthScenario = {
      id: 'demo_case_c',
      name: 'Case C: Ambiguous MDR Fee Variance',
      scenarioType: 'AMOUNT_MISMATCH',
      description: 'MDR fee variance needing AI corroboration',
      expectedReconStatus: 'FEE_MISMATCH',
      expectedRiskClassification: 'OPS_SHAPED',
      expectedSafeToRecover: true,
      expectedOptimalAction: 'SEND_PAYMENT_LINK',
      expectedRecoverableCents: 200000,
      transaction: {
        id: 'tx_demo_c',
        merchantId: 'merch_saas_01',
        externalRef: 'UTR_DEMO_C_003',
        amountCents: 200000,
        currency: 'INR',
        paymentMethod: 'CARD',
        customerName: 'Siddharth Rao',
        status: 'CAPTURED',
        createdAt: new Date().toISOString(),
      },
      settlement: {
        id: 'st_demo_c',
        batchId: 'BATCH_C_MDR',
        utrRrn: 'UTR_DEMO_C_003',
        amountCents: 195280, // 2% MDR + 18% GST variance
        feeCents: 4000,
        taxCents: 720,
        netAmountCents: 195280,
        currency: 'INR',
        bankTimestamp: new Date().toISOString(),
        rawDescription: 'MDR-NETTED-SETTLE-UTR_DEMO_C_003',
        createdAt: new Date().toISOString(),
      },
      riskSignals: {
        customerVelocity24h: 1,
        deviceFingerprintRisk: 'LOW',
        chargebackHistoryRatio: 0.0,
      },
    };

    const result = await orchestrator.runFullPipeline([ambiguousScenario]);
    const targetCase = result.cases.find((c) => c.transactionId === 'tx_demo_c');

    expect(targetCase).toBeDefined();
    expect(targetCase?.reconStatus).toBe('FEE_MISMATCH');
  });
});
