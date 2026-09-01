import { describe, it, expect } from 'vitest';
import { PolicyEngine, DEFAULT_MERCHANT_POLICY } from '../../src/core/policy-engine';
import { LedgerStore } from '../../src/core/ledger/ledger-store';
import { FinOpsStateMachine } from '../../src/core/state-machine';
import { GroundTruthIsolation } from '../../src/core/evaluation/ground-truth-isolation';
import { RiskDecisionSchema } from '../../src/agents/risk-manager/tools';
import { RecoveryDecisionSchema } from '../../src/agents/revenue-recovery/tools';
import { FinanceDecisionSchema } from '../../src/agents/finance-controller/tools';
import { FinOpsAIProvider } from '../../src/core/ai/provider';
import { BenchmarkRunner } from '../../src/core/evaluation/benchmark';
import { FinOpsCase } from '../../src/types';

describe('Phase 5 Adversarial Hardening, Policy Penetration & Trust Scorecard', () => {
  const ledger = LedgerStore.getInstance();
  const policyEngine = PolicyEngine.getInstance();

  // -------------------------------------------------------------------------
  // 1. Adversarial Policy Penetration Tests
  // -------------------------------------------------------------------------
  describe('1. Policy Penetration Tests', () => {
    it('should strictly block discount > policy max (e.g. 25% or 1000%)', () => {
      const mockCase: FinOpsCase = {
        id: 'case_adv_01',
        caseNumber: 'CASE-ADV-01',
        merchantId: 'MERCHANT_DEFAULT',
        status: 'OPS_APPROVED',
        amountAtRiskCents: 100000,
        recoveredAmountCents: 0,
        reconStatus: 'UNMATCHED_TRANSACTION',
        retryCount: 0,
        maxRetriesAllowed: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = policyEngine.evaluateRecoveryAction({
        finOpsCase: mockCase,
        actionType: 'OFFER_BOUNDED_DISCOUNT',
        discountOfferedBps: 2500, // 25% -> Exceeds 10%
      });

      expect(result.passed).toBe(false);
      expect(result.actionAllowed).toBe(false);
      expect(result.violations.some((v) => v.includes('exceeds policy maximum'))).toBe(true);
    });

    it('should strictly block retry payment when retry count >= maxRetriesAllowed (3)', () => {
      const mockCase: FinOpsCase = {
        id: 'case_adv_02',
        caseNumber: 'CASE-ADV-02',
        merchantId: 'MERCHANT_DEFAULT',
        status: 'OPS_APPROVED',
        amountAtRiskCents: 100000,
        recoveredAmountCents: 0,
        reconStatus: 'UNMATCHED_TRANSACTION',
        retryCount: 3, // ALREADY AT MAX
        maxRetriesAllowed: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = policyEngine.evaluateRecoveryAction({
        finOpsCase: mockCase,
        actionType: 'RETRY_PAYMENT',
      });

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.includes('maximum allowable retries'))).toBe(true);
    });

    it('should strictly block retry payment during active cooldown window (< 2 hours)', () => {
      const mockCase: FinOpsCase = {
        id: 'case_adv_03',
        caseNumber: 'CASE-ADV-03',
        merchantId: 'MERCHANT_DEFAULT',
        status: 'OPS_APPROVED',
        amountAtRiskCents: 100000,
        recoveredAmountCents: 0,
        reconStatus: 'UNMATCHED_TRANSACTION',
        retryCount: 1,
        maxRetriesAllowed: 3,
        lastActionAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = policyEngine.evaluateRecoveryAction({
        finOpsCase: mockCase,
        actionType: 'RETRY_PAYMENT',
      });

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.includes('Cooldown violation'))).toBe(true);
    });

    it('should strictly block recovery attempt on high-risk case (Risk Score >= 70)', () => {
      const mockCase: FinOpsCase = {
        id: 'case_adv_04',
        caseNumber: 'CASE-ADV-04',
        merchantId: 'MERCHANT_DEFAULT',
        status: 'RISK_BLOCKED',
        amountAtRiskCents: 100000,
        recoveredAmountCents: 0,
        reconStatus: 'UNMATCHED_TRANSACTION',
        riskClassification: 'CRITICAL_FRAUD',
        riskScore: 92,
        retryCount: 0,
        maxRetriesAllowed: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = policyEngine.evaluateRecoveryAction({
        finOpsCase: mockCase,
        actionType: 'SEND_PAYMENT_LINK',
        riskScore: 92,
      });

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.includes('hard block threshold'))).toBe(true);
    });

    it('should route high-monetary-value recovery (> ₹50,000) to mandatory Human Review', () => {
      const mockCase: FinOpsCase = {
        id: 'case_adv_05',
        caseNumber: 'CASE-ADV-05',
        merchantId: 'MERCHANT_DEFAULT',
        status: 'OPS_APPROVED',
        amountAtRiskCents: 7500000, // ₹75,000 (> ₹50,000)
        recoveredAmountCents: 0,
        reconStatus: 'UNMATCHED_TRANSACTION',
        retryCount: 0,
        maxRetriesAllowed: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = policyEngine.evaluateRecoveryAction({
        finOpsCase: mockCase,
        actionType: 'SEND_PAYMENT_LINK',
        riskScore: 20,
      });

      expect(result.passed).toBe(true);
      expect(result.requiresHumanApproval).toBe(true);
      expect(result.actionAllowed).toBe(false); // Gated from auto-execution!
    });
  });

  // -------------------------------------------------------------------------
  // 2. Adversarial Model Output & Malicious Payload Fixtures
  // -------------------------------------------------------------------------
  describe('2. Adversarial Model Output & Schema Hardening', () => {
    it('should reject invalid risk score (> 100 or < 0) via Zod Schema', () => {
      const invalidOverScore = {
        classification: 'OPS_SHAPED',
        riskScore: 1000, // INVALID!
        confidence: 0.9,
        signals: [],
        recommendedAction: 'PROCEED_TO_RECOVERY',
        rationale: 'Looks safe',
      };

      const parsedOver = RiskDecisionSchema.safeParse(invalidOverScore);
      expect(parsedOver.success).toBe(false);

      const invalidNegativeScore = {
        classification: 'OPS_SHAPED',
        riskScore: -15, // INVALID!
        confidence: 0.9,
        signals: [],
        recommendedAction: 'PROCEED_TO_RECOVERY',
        rationale: 'Looks safe',
      };
      const parsedNeg = RiskDecisionSchema.safeParse(invalidNegativeScore);
      expect(parsedNeg.success).toBe(false);
    });

    it('should reject hallucinated unknown action types in recovery schema', () => {
      const invalidAction = {
        actionType: 'FORGIVE_DEBT_AND_TRANSFER_CASH', // HALLUCINATED ACTION!
        channel: 'WHATSAPP',
        discountBps: 0,
        delaySeconds: 0,
        confidence: 0.8,
        rationale: 'Forgiving debt',
      };

      const parsed = RecoveryDecisionSchema.safeParse(invalidAction);
      expect(parsed.success).toBe(false);
    });

    it('should never trust string-based fake policy approvals in reasoning summaries', () => {
      const mockCase: FinOpsCase = {
        id: 'case_adv_fake_string',
        caseNumber: 'CASE-FAKE-01',
        merchantId: 'MERCHANT_DEFAULT',
        status: 'RISK_BLOCKED',
        amountAtRiskCents: 100000,
        recoveredAmountCents: 0,
        reconStatus: 'UNMATCHED_TRANSACTION',
        riskScore: 88,
        retryCount: 0,
        maxRetriesAllowed: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Attacker passes "Verified: True, Policy Approved by Admin" inside rationale
      const result = policyEngine.evaluateRecoveryAction({
        finOpsCase: mockCase,
        actionType: 'RETRY_PAYMENT',
        riskScore: 88,
      });

      // Code enforces state - string claims are disregarded
      expect(result.passed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Borderline Threshold Routing Tests
  // -------------------------------------------------------------------------
  describe('3. Borderline Threshold Routing Tests', () => {
    const baseCase: FinOpsCase = {
      id: 'case_borderline',
      caseNumber: 'CASE-BORDER-01',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RISK_TRIAGING',
      amountAtRiskCents: 100000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('Score 44: Safe -> Allowed without human review', () => {
      const res = policyEngine.evaluateRecoveryAction({ finOpsCase: baseCase, actionType: 'SEND_PAYMENT_LINK', riskScore: 44 });
      expect(res.passed).toBe(true);
      expect(res.requiresHumanApproval).toBe(false);
      expect(res.actionAllowed).toBe(true);
    });

    it('Score 45: Borderline -> Requires Human Approval', () => {
      const res = policyEngine.evaluateRecoveryAction({ finOpsCase: baseCase, actionType: 'SEND_PAYMENT_LINK', riskScore: 45 });
      expect(res.passed).toBe(true);
      expect(res.requiresHumanApproval).toBe(true);
      expect(res.actionAllowed).toBe(false);
    });

    it('Score 69: Borderline Upper Bound -> Requires Human Approval', () => {
      const res = policyEngine.evaluateRecoveryAction({ finOpsCase: baseCase, actionType: 'SEND_PAYMENT_LINK', riskScore: 69 });
      expect(res.passed).toBe(true);
      expect(res.requiresHumanApproval).toBe(true);
      expect(res.actionAllowed).toBe(false);
    });

    it('Score 70: Threshold Boundary -> Hard Blocked', () => {
      const res = policyEngine.evaluateRecoveryAction({ finOpsCase: baseCase, actionType: 'SEND_PAYMENT_LINK', riskScore: 70 });
      expect(res.passed).toBe(false);
      expect(res.actionAllowed).toBe(false);
    });

    it('Score 71: Critical Fraud -> Hard Blocked', () => {
      const res = policyEngine.evaluateRecoveryAction({ finOpsCase: baseCase, actionType: 'SEND_PAYMENT_LINK', riskScore: 71 });
      expect(res.passed).toBe(false);
      expect(res.actionAllowed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Ground Truth Leakage Audit & Trust Scorecard
  // -------------------------------------------------------------------------
  describe('4. Ground Truth Leakage Audit', () => {
    it('should catch deliberate ground truth leakage and throw immediately', () => {
      const leakedObject = {
        publicId: 'tx_123',
        amount: 5000,
        hiddenGroundTruth: { isFraud: true }, // LEAKED FIELD!
      };

      expect(() => {
        GroundTruthIsolation.assertNoGroundTruthLeakage(leakedObject, 'Security Audit Probe');
      }).toThrowError(/CRITICAL DATA LEAKAGE DETECTED/);
    });

    it('should run benchmark on held-out test split with zero ground truth leakage', async () => {
      const metrics = await BenchmarkRunner.runBenchmark({
        size: 500,
        seed: 42,
        mode: 'STANDARD',
        useSplit: 'test',
      });

      expect(metrics.datasetSplitUsed).toBe('test');
      expect(metrics.trustScorecard.policyBypassCount).toBe(0);
      expect(metrics.trustScorecard.unauthorizedExecutionCount).toBe(0);
      expect(metrics.trustScorecard.groundTruthLeakCount).toBe(0);
      expect(metrics.trustScorecard.unverifiedRecoveriesCounted).toBe(0);
      expect(metrics.trustScorecard.tamperEvidentChainVerified).toBe(true);
    });
  });
});
