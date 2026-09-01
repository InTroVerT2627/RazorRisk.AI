import { describe, it, expect, beforeEach } from 'vitest';
import { RECOVERY_PLAYBOOKS, selectPlaybookForCase } from '@/core/recovery/playbooks';
import { RecoveryCampaignManager } from '@/core/recovery/campaign-manager';
import { ChannelPerformanceTracker } from '@/core/recovery/channel-performance';
import { RecoveryPriorityEngine } from '@/core/recovery/priority-engine';
import { RecoveryEligibilityEngine } from '@/core/recovery/eligibility-engine';
import { PolicyEngine } from '@/core/policy-engine';
import { FinOpsCase, TransactionRecord, MerchantPolicy } from '@/types';

describe('Unit Test: Recovery Playbooks, Budgets & Channel Optimizers (Phase 10)', () => {
  const campaignManager = RecoveryCampaignManager.getInstance();
  const channelTracker = ChannelPerformanceTracker.getInstance();
  const priorityEngine = RecoveryPriorityEngine.getInstance();
  const eligibilityEngine = RecoveryEligibilityEngine.getInstance();
  const policyEngine = PolicyEngine.getInstance();

  beforeEach(() => {
    campaignManager.clear();
    channelTracker.clear();
  });

  it('1. FAILED_PAYMENT_PLAYBOOK has 3 sequential bounded steps', () => {
    const pb = RECOVERY_PLAYBOOKS.FAILED_PAYMENT_PLAYBOOK;
    expect(pb.steps.length).toBe(3);
    expect(pb.steps[0].actionType).toBe('RETRY_PAYMENT');
    expect(pb.steps[1].actionType).toBe('SEND_PAYMENT_LINK');
    expect(pb.steps[2].actionType).toBe('SEND_NUDGE');
  });

  it('2. B2B_OVERDUE_PLAYBOOK has 4 sequential bounded steps with discount caps', () => {
    const pb = RECOVERY_PLAYBOOKS.B2B_OVERDUE_PLAYBOOK;
    expect(pb.steps.length).toBe(4);
    expect(pb.steps[0].actionType).toBe('DISPATCH_INVOICE');
    expect(pb.steps[2].discountCapBps).toBe(1000); // 10% max
  });

  it('3. SUBSCRIPTION_DUNNING_PLAYBOOK handles recurring mandate retries', () => {
    const pb = RECOVERY_PLAYBOOKS.SUBSCRIPTION_DUNNING_PLAYBOOK;
    expect(pb.steps[0].actionType).toBe('RETRY_MANDATE');
    expect(pb.steps[1].actionType).toBe('SEND_PAYMENT_LINK');
  });

  it('4. NEGOTIATION_PLAYBOOK enforces 2-round bounded negotiation', () => {
    const pb = RECOVERY_PLAYBOOKS.NEGOTIATION_PLAYBOOK;
    expect(pb.maxRounds).toBe(2);
    expect(pb.steps[0].discountCapBps).toBe(500); // 5% round 1
    expect(pb.steps[1].discountCapBps).toBe(1000); // 10% round 2
  });

  it('5. selects SUBSCRIPTION_DUNNING_PLAYBOOK for AUTOPAY failures', () => {
    const c: FinOpsCase = {
      id: 'c_sub',
      caseNumber: 'CASE-SUB',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 99900,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const tx: TransactionRecord = {
      id: 'tx_sub',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_sub',
      amountCents: 99900,
      currency: 'INR',
      paymentMethod: 'AUTOPAY',
      customerName: 'Subscriber User',
      customerSegment: 'CONSUMER',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };

    expect(selectPlaybookForCase(c, tx)).toBe('SUBSCRIPTION_DUNNING_PLAYBOOK');
  });

  it('6. selects MANDATE_FAILURE_PLAYBOOK for mandate expired error', () => {
    const c: FinOpsCase = {
      id: 'c_man',
      caseNumber: 'CASE-MAN',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 50000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const tx: TransactionRecord = {
      id: 'tx_man',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_man',
      amountCents: 50000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Mandate User',
      customerSegment: 'SMB',
      status: 'FAILED',
      errorCode: 'MANDATE_EXPIRED',
      createdAt: new Date().toISOString(),
    };

    expect(selectPlaybookForCase(c, tx)).toBe('MANDATE_FAILURE_PLAYBOOK');
  });

  it('7. selects PROMISE_TO_PAY_PLAYBOOK when pending commitment exists', () => {
    const c: FinOpsCase = {
      id: 'c_p2p',
      caseNumber: 'CASE-P2P',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_ELIGIBLE',
      amountAtRiskCents: 2000000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      promiseToPay: {
        id: 'p2p_01',
        caseId: 'c_p2p',
        promisedAmountCents: 2000000,
        promisedDate: '2026-09-15',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      },
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(selectPlaybookForCase(c, undefined)).toBe('PROMISE_TO_PAY_PLAYBOOK');
  });

  it('8. channel tracker ranks channels by observed conversion yield for Enterprise', () => {
    const rankings = channelTracker.getSegmentChannelRanking('ENTERPRISE', ['WHATSAPP', 'EMAIL', 'SMS']);
    expect(rankings.length).toBe(3);
    expect(rankings[0].deliveryRate).toBeGreaterThan(0.85);
  });

  it('9. selects optimal fresh channel when previous channel was already used', () => {
    const opt = channelTracker.selectOptimalChannel('SMB', ['WHATSAPP', 'EMAIL', 'SMS'], ['WHATSAPP']);
    expect(opt).not.toBe('WHATSAPP');
    expect(['EMAIL', 'SMS']).toContain(opt);
  });

  it('10. calculates Opportunity Score with exact communication unit costs', () => {
    const c: FinOpsCase = {
      id: 'c_opp',
      caseNumber: 'CASE-OPP',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 5000000, // ₹50,000
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 1,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const tx: TransactionRecord = {
      id: 'tx_opp',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_opp',
      amountCents: 5000000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Opportunity Corp',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 25,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };

    const opp = eligibilityEngine.computeOpportunityScore(c, tx, 0.85);
    expect(opp.recoverableAmountCents).toBe(5000000);
    expect(opp.expectedCommunicationCostCents).toBe(80); // 2 remaining attempts * 40 cents
    expect(opp.expectedNetRecoveryCents).toBeGreaterThan(3000000);
  });

  it('11. priority engine weights are fully configurable and influence score', () => {
    const c: FinOpsCase = {
      id: 'c_w',
      caseNumber: 'CASE-W',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 1000000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 20,
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const customWeights = {
      wAmount: 0.80, // Heavy weight on amount
      wAge: 0.05,
      wProbability: 0.05,
      wSegment: 0.05,
      wRisk: 0.05,
    };

    const result = priorityEngine.evaluatePriority(c, undefined, customWeights);
    expect(result.priorityScore).toBeGreaterThan(0);
    expect(result.dominantFactors).toBeDefined();
  });

  it('12. campaign manager budget cap stops enrolling once amount ceiling is reached', () => {
    const camp = campaignManager.createCampaign({
      name: 'Small Cap Sprint',
      targetSegments: ['SMB'],
      maxCampaignAmountCents: 500000, // ₹5,000 max budget
    });

    const c1: FinOpsCase = {
      id: 'c_b1',
      caseNumber: 'C-B1',
      transactionId: 'tx_b1',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_ELIGIBLE',
      amountAtRiskCents: 350000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      recoveryEligible: true,
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const c2: FinOpsCase = {
      id: 'c_b2',
      caseNumber: 'C-B2',
      transactionId: 'tx_b2',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_ELIGIBLE',
      amountAtRiskCents: 350000, // Would exceed 500,000 cap
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      recoveryEligible: true,
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const txMap = new Map<string, TransactionRecord>([
      ['tx_b1', { id: 'tx_b1', merchantId: 'MERCHANT_DEFAULT', externalRef: 'e1', amountCents: 350000, currency: 'INR', paymentMethod: 'UPI', customerName: 'SMB Client 1', customerSegment: 'SMB', status: 'FAILED', createdAt: new Date().toISOString() }],
      ['tx_b2', { id: 'tx_b2', merchantId: 'MERCHANT_DEFAULT', externalRef: 'e2', amountCents: 350000, currency: 'INR', paymentMethod: 'UPI', customerName: 'SMB Client 2', customerSegment: 'SMB', status: 'FAILED', createdAt: new Date().toISOString() }],
    ]);

    const matched = campaignManager.filterEligibleCasesForCampaign(camp.id, [c1, c2], txMap);
    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe(c1.id);
  });

  it('13. handles broken promise to pay when promise date has passed', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const c: FinOpsCase = {
      id: 'c_broken',
      caseNumber: 'CASE-BROKEN',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_ELIGIBLE',
      amountAtRiskCents: 1500000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      promiseToPay: {
        id: 'p2p_past',
        caseId: 'c_broken',
        promisedAmountCents: 1500000,
        promisedDate: pastDate,
        status: 'PENDING',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
      retryCount: 1,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = eligibilityEngine.evaluateCase(c, undefined, undefined);
    expect(res.isEligible).toBe(true);
    expect(res.checks.some((chk) => chk.name === 'PROMISE_TO_PAY_GRACE')).toBe(false);
  });

  it('14. calculates net expected yield for high-ticket Enterprise case', () => {
    const c: FinOpsCase = {
      id: 'c_ent_yield',
      caseNumber: 'CASE-YIELD',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 10000000, // ₹1,00,000
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const tx: TransactionRecord = {
      id: 'tx_y',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_y',
      amountCents: 10000000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Enterprise Yield Corp',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 35,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };

    const score = eligibilityEngine.computeOpportunityScore(c, tx, 0.90);
    expect(score.expectedDiscountCostCents).toBe(500000); // 5% discount = ₹5,000
    expect(score.expectedNetRecoveryCents).toBeGreaterThan(8000000);
  });

  it('15. verifies CHECKOUT_RECOVERY_PLAYBOOK has WhatsApp and Email steps', () => {
    const pb = RECOVERY_PLAYBOOKS.CHECKOUT_RECOVERY_PLAYBOOK;
    expect(pb.steps.length).toBe(2);
    expect(pb.steps[0].channel).toBe('WHATSAPP');
    expect(pb.steps[1].channel).toBe('EMAIL');
  });

  it('16. selects FAILED_PAYMENT_PLAYBOOK as standard default for consumer gateway drops', () => {
    const c: FinOpsCase = {
      id: 'c_std',
      caseNumber: 'CASE-STD',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 150000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const tx: TransactionRecord = {
      id: 'tx_std',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_std',
      amountCents: 150000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Consumer Standard',
      customerSegment: 'CONSUMER',
      status: 'FAILED',
      errorCode: 'UPI_COLLECT_TIMEOUT',
      createdAt: new Date().toISOString(),
    };

    expect(selectPlaybookForCase(c, tx)).toBe('FAILED_PAYMENT_PLAYBOOK');
  });

  it('17. channel performance tracker handles zero prior observations gracefully', () => {
    const stats = channelTracker.getStats('CONSUMER', 'VOICE_BOT');
    expect(stats.deliveryRate).toBeGreaterThan(0);
    expect(stats.responseRate).toBeGreaterThan(0);
  });

  it('18. updates recovery campaign metrics correctly after execution', () => {
    const camp = campaignManager.createCampaign({
      name: 'Metrics Test Sprint',
      targetSegments: ['MID_MARKET'],
    });

    const cases: FinOpsCase[] = [{
      id: 'c_m1',
      caseNumber: 'CASE-M1',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'SETTLED_VERIFIED',
      amountAtRiskCents: 500000,
      recoveredAmountCents: 500000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 1,
      maxRetriesAllowed: 3,
      respondedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];

    camp.targetCaseIds = ['c_m1'];
    campaignManager.refreshCampaignMetrics(camp.id, cases);

    const refreshed = campaignManager.getCampaign(camp.id);
    expect(refreshed?.metrics.verifiedRecoveredCents).toBe(500000);
    expect(refreshed?.metrics.recoveryRate).toBe('100.0%');
  });

  it('19. enforces non-overlapping campaign claims across concurrent requests', () => {
    const claim1 = campaignManager.claimCaseForCampaign('c_alpha', 'case_x', 'SEND_LINK');
    expect(claim1.success).toBe(true);

    const claim2 = campaignManager.claimCaseForCampaign('c_beta', 'case_x', 'SEND_LINK');
    expect(claim2.success).toBe(false);
  });

  it('20. releases case claim cleanly allowing subsequent campaign enrollment', () => {
    campaignManager.claimCaseForCampaign('c_first', 'case_y', 'SEND_LINK');
    campaignManager.releaseCaseClaim('case_y');

    const secondClaim = campaignManager.claimCaseForCampaign('c_second', 'case_y', 'SEND_LINK');
    expect(secondClaim.success).toBe(true);
  });
});
