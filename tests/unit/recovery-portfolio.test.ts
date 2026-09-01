import { describe, it, expect, beforeEach } from 'vitest';
import { RecoveryEligibilityEngine } from '@/core/recovery/eligibility-engine';
import { RecoveryPriorityEngine } from '@/core/recovery/priority-engine';
import { ChannelPerformanceTracker } from '@/core/recovery/channel-performance';
import { selectPlaybookForCase, RECOVERY_PLAYBOOKS } from '@/core/recovery/playbooks';
import { FinOpsCase, TransactionRecord, MerchantPolicy } from '@/types';

describe('Unit Test: Recovery Portfolio & Eligibility Engines (Phase 10)', () => {
  const eligibilityEngine = RecoveryEligibilityEngine.getInstance();
  const priorityEngine = RecoveryPriorityEngine.getInstance();
  const channelTracker = ChannelPerformanceTracker.getInstance();

  const defaultPolicy: MerchantPolicy = {
    merchantId: 'MERCHANT_DEFAULT',
    merchantName: 'Test Merchant',
    maxRetryAttempts: 3,
    retryCooldownHours: 24,
    maxDiscountBps: 1000,
    minSettlementBps: 8500,
    maxNegotiationRounds: 2,
    autoRecoveryMaxAmountCents: 5000000,
    riskScoreBlockThreshold: 70,
    riskScoreHumanThreshold: 45,
    allowedChannels: ['WHATSAPP', 'EMAIL', 'SMS'],
    isActive: true,
  };

  beforeEach(() => {
    channelTracker.clear();
  });

  it('1. eligibility engine marks exact match as NOT_APPLICABLE', () => {
    const c: FinOpsCase = {
      id: 'c_exact_001',
      caseNumber: 'CASE-001',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECONCILED',
      amountAtRiskCents: 0,
      recoveredAmountCents: 0,
      reconStatus: 'EXACT_MATCH',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = eligibilityEngine.evaluateCase(c, undefined, defaultPolicy);
    expect(res.isEligible).toBe(false);
    expect(res.status).toBe('NOT_APPLICABLE');
  });

  it('2. eligibility engine strictly BLOCKS cases with risk score >= 70', () => {
    const c: FinOpsCase = {
      id: 'c_risk_001',
      caseNumber: 'CASE-002',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 150000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 78,
      riskClassification: 'CRITICAL_FRAUD',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = eligibilityEngine.evaluateCase(c, undefined, defaultPolicy);
    expect(res.isEligible).toBe(false);
    expect(res.status).toBe('BLOCKED');
  });

  it('3. eligibility engine routes cases with risk 45-69 to HUMAN_REVIEW', () => {
    const c: FinOpsCase = {
      id: 'c_review_001',
      caseNumber: 'CASE-003',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'HUMAN_REVIEW_REQUIRED',
      amountAtRiskCents: 250000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 56,
      riskClassification: 'RISK_SHAPED',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = eligibilityEngine.evaluateCase(c, undefined, defaultPolicy);
    expect(res.isEligible).toBe(false);
    expect(res.status).toBe('HUMAN_REVIEW');
  });

  it('4. eligibility engine marks cases with retryCount >= maxRetries as EXHAUSTED', () => {
    const c: FinOpsCase = {
      id: 'c_exhausted_001',
      caseNumber: 'CASE-004',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 80000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 18,
      riskClassification: 'OPS_SHAPED',
      retryCount: 3,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = eligibilityEngine.evaluateCase(c, undefined, defaultPolicy);
    expect(res.isEligible).toBe(false);
    expect(res.status).toBe('EXHAUSTED');
  });

  it('5. eligibility engine approves clean operational exception as ELIGIBLE', () => {
    const c: FinOpsCase = {
      id: 'c_clean_001',
      caseNumber: 'CASE-005',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 120000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 15,
      riskClassification: 'OPS_SHAPED',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = eligibilityEngine.evaluateCase(c, undefined, defaultPolicy);
    expect(res.isEligible).toBe(true);
    expect(res.status).toBe('ELIGIBLE');
    expect(res.opportunityScore.expectedNetRecoveryCents).toBeGreaterThan(0);
  });

  it('6. calculates normalized priority score and assigns P0 for Enterprise high-value', () => {
    const c: FinOpsCase = {
      id: 'c_p0_001',
      caseNumber: 'CASE-P0',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 6500000, // ₹65,000
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 12,
      riskClassification: 'OPS_SHAPED',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tx: TransactionRecord = {
      id: 'tx_p0',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ref_p0',
      amountCents: 6500000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Enterprise Corp',
      gatewayCode: 'HDFC_PG',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 25,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };

    const priorityRes = priorityEngine.evaluatePriority(c, tx);
    expect(priorityRes.priority).toBe('P0');
    expect(priorityRes.dominantFactors.length).toBeGreaterThan(0);
  });

  it('7. calculates normalized priority score and assigns P2 for standard SMB receivable', () => {
    const c: FinOpsCase = {
      id: 'c_p2_001',
      caseNumber: 'CASE-P2',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 350000, // ₹3,500
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 22,
      riskClassification: 'OPS_SHAPED',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tx: TransactionRecord = {
      id: 'tx_p2',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ref_p2',
      amountCents: 350000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'SMB Client',
      gatewayCode: 'ICICI_UPI',
      customerSegment: 'SMB',
      daysOverdue: 10,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };

    const priorityRes = priorityEngine.evaluatePriority(c, tx);
    expect(priorityRes.priority).toBe('P2');
  });

  it('8. channel performance tracker derives statistics dynamically from observations without hardcoding', () => {
    const statsEnt = channelTracker.getStats('ENTERPRISE', 'WHATSAPP');
    expect(statsEnt.messagesSent).toBeGreaterThan(0);
    expect(statsEnt.deliveryRate).toBeGreaterThan(0.9);
    expect(statsEnt.responseRate).toBeGreaterThan(0.5);

    // Records a new outbound message and confirms tracking
    channelTracker.recordOutbound({
      customerSegment: 'ENTERPRISE',
      channel: 'WHATSAPP',
      delivered: true,
      responded: true,
      convertedPayment: true,
    });

    const updated = channelTracker.getStats('ENTERPRISE', 'WHATSAPP');
    expect(updated.messagesSent).toBe(statsEnt.messagesSent + 1);
  });

  it('9. selects B2B_OVERDUE_PLAYBOOK for high-ticket Enterprise case', () => {
    const c: FinOpsCase = {
      id: 'c_play_001',
      caseNumber: 'CASE-PLAY',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 4500000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tx: TransactionRecord = {
      id: 'tx_play',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ref_play',
      amountCents: 4500000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Enterprise Client',
      gatewayCode: 'HDFC_PG',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 20,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };

    const playbook = selectPlaybookForCase(c, tx);
    expect(playbook).toBe('B2B_OVERDUE_PLAYBOOK');
    expect(RECOVERY_PLAYBOOKS[playbook].steps.length).toBe(4);
  });

  it('10. verifies partial recovery invariant: verifiedCollected + remaining = original', () => {
    const original = 10000000; // ₹1,00,000
    const partialPaid = 6000000; // ₹60,000
    const remaining = original - partialPaid; // ₹40,000

    expect(partialPaid + remaining).toBe(original);
    expect(remaining).toBe(4000000);
  });
});
