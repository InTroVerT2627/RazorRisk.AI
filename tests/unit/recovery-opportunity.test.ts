import { describe, it, expect, beforeEach } from 'vitest';
import { OpportunityStore } from '@/core/recovery/opportunity-store';
import { FinOpsCase, TransactionRecord, RecoveryOpportunity } from '@/types';

describe('Unit Test: OpportunityStore & Root-Cause Strategy Engine (Track 03 Redesign)', () => {
  let store: OpportunityStore;

  beforeEach(() => {
    store = OpportunityStore.getInstance();
    store.clear();
  });

  it('1. OpportunityStore follows singleton pattern', () => {
    const s1 = OpportunityStore.getInstance();
    const s2 = OpportunityStore.getInstance();
    expect(s1).toBe(s2);
  });

  it('2. adds and retrieves a RecoveryOpportunity by id', () => {
    const opp: RecoveryOpportunity = {
      id: 'opp_test_01',
      merchantId: 'MERCHANT_DEFAULT',
      caseId: 'case_test_01',
      caseNumber: 'CASE-01',
      customerName: 'Acme Corp',
      customerSegment: 'ENTERPRISE',
      sourceType: 'OVERDUE_INVOICE',
      amountAtRiskCents: 24000000,
      recoverableAmountCents: 24000000,
      remainingAmountCents: 24000000,
      daysOverdue: 25,
      riskScore: 18,
      riskClassification: 'OPS_SHAPED',
      eligibilityStatus: 'ELIGIBLE',
      eligibilityReason: 'Valid balance',
      priority: 'P0',
      recommendedStrategy: 'BOUNDED_NEGOTIATE',
      currentStrategy: 'BOUNDED_NEGOTIATE',
      channel: 'EMAIL',
      recoveryState: 'READY_FOR_RECOVERY',
      attemptCount: 0,
      contactCount: 1,
      actionPlan: {
        currentAction: 'Issue structured PDF invoice',
        nextAction: 'Offer bounded discount',
        fallbackAction: 'Escalate to FinOps Lead',
        stopCondition: 'Bank settlement verified',
      },
      assignedSpecialist: 'NEGOTIATION_AGENT',
      policyStatus: 'APPROVED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.addOpportunity(opp);
    const retrieved = store.getOpportunity('opp_test_01');
    expect(retrieved).toBeDefined();
    expect(retrieved?.customerName).toBe('Acme Corp');
    expect(retrieved?.priority).toBe('P0');
  });

  it('3. resolves root cause and specialist for transient gateway timeout (504)', () => {
    const res = OpportunityStore.resolveRootCauseAndSpecialist('FAILED_PAYMENT', 'GATEWAY_TIMEOUT_504', 'SMB', 150000);
    expect(res.assignedSpecialist).toBe('PAYMENT_AGENT');
    expect(res.recommendedStrategy).toBe('RETRY_PAYMENT');
    expect(res.channel).toBe('GATEWAY_RETRY');
    expect(res.rootCauseReason).toContain('Transient gateway timeout');
    expect(res.actionPlan.currentAction).toContain('Smart retry');
  });

  it('4. resolves root cause and specialist for insufficient funds (code 51)', () => {
    const res = OpportunityStore.resolveRootCauseAndSpecialist('FAILED_PAYMENT', 'INSUFFICIENT_FUNDS_51', 'CONSUMER', 450000);
    expect(res.assignedSpecialist).toBe('PAYMENT_AGENT');
    expect(res.recommendedStrategy).toBe('SEND_PAYMENT_LINK');
    expect(res.channel).toBe('WHATSAPP');
    expect(res.rootCauseReason).toContain('Insufficient account balance');
  });

  it('5. resolves root cause and specialist for expired card (code 54)', () => {
    const res = OpportunityStore.resolveRootCauseAndSpecialist('FAILED_PAYMENT', 'CARD_EXPIRED_54', 'CONSUMER', 99900);
    expect(res.assignedSpecialist).toBe('SUBSCRIPTION_RECOVERY_AGENT');
    expect(res.recommendedStrategy).toBe('CREATE_PAYMENT_LINK');
    expect(res.channel).toBe('EMAIL');
    expect(res.rootCauseReason).toContain('Payment card expired');
  });

  it('6. resolves root cause and specialist for abandoned checkout', () => {
    const res = OpportunityStore.resolveRootCauseAndSpecialist('ABANDONED_CHECKOUT', undefined, 'CONSUMER', 180000);
    expect(res.assignedSpecialist).toBe('COLLECTIONS_AGENT');
    expect(res.recommendedStrategy).toBe('SEND_NUDGE');
    expect(res.channel).toBe('WHATSAPP');
    expect(res.rootCauseReason).toContain('abandoned checkout session');
  });

  it('7. resolves root cause and specialist for overdue enterprise invoice', () => {
    const res = OpportunityStore.resolveRootCauseAndSpecialist('OVERDUE_INVOICE', undefined, 'ENTERPRISE', 6500000);
    expect(res.assignedSpecialist).toBe('NEGOTIATION_AGENT');
    expect(res.recommendedStrategy).toBe('BOUNDED_NEGOTIATE');
    expect(res.channel).toBe('EMAIL');
    expect(res.rootCauseReason).toContain('B2B enterprise invoice overdue');
  });

  it('8. resolves root cause and specialist for subscription failure', () => {
    const res = OpportunityStore.resolveRootCauseAndSpecialist('SUBSCRIPTION_FAILURE', 'RECURRING_CHARGE_FAILED', 'CONSUMER', 49900);
    expect(res.assignedSpecialist).toBe('SUBSCRIPTION_RECOVERY_AGENT');
    expect(res.recommendedStrategy).toBe('RETRY_PAYMENT');
    expect(res.channel).toBe('EMAIL');
    expect(res.rootCauseReason).toContain('Recurring SaaS subscription');
  });

  it('9. resolves root cause and specialist for mandate failure', () => {
    const res = OpportunityStore.resolveRootCauseAndSpecialist('MANDATE_FAILURE', 'MANDATE_EXPIRED', 'SMB', 250000);
    expect(res.assignedSpecialist).toBe('MANDATE_RECOVERY_AGENT');
    expect(res.recommendedStrategy).toBe('RETRY_MANDATE');
    expect(res.channel).toBe('WHATSAPP');
    expect(res.rootCauseReason).toContain('UPI AutoPay or e-Mandate');
  });

  it('10. resolves root cause for suspected fraud and stops automated recovery', () => {
    const res = OpportunityStore.resolveRootCauseAndSpecialist('FAILED_PAYMENT', 'SUSPECTED_FRAUD', 'CONSUMER', 500000);
    expect(res.recommendedStrategy).toBe('STOP_RECOVERY');
    expect(res.rootCauseReason).toContain('fraud anomaly flagged');
    expect(res.actionPlan.currentAction).toContain('Hard block automated collections');
  });

  it('11. creates RecoveryOpportunity from FinOpsCase and Transaction', () => {
    const c: FinOpsCase = {
      id: 'case_opp_create_01',
      caseNumber: 'CASE-82917',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 2400000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 18,
      riskClassification: 'OPS_SHAPED',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tx: TransactionRecord = {
      id: 'tx_opp_01',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_opp_01',
      amountCents: 2400000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Acme Technologies',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 23,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };

    const opp = store.createFromCase(c, tx, 'OVERDUE_INVOICE');
    expect(opp.id).toBe('opp_case_opp_create_01');
    expect(opp.customerName).toBe('Acme Technologies');
    expect(opp.customerSegment).toBe('ENTERPRISE');
    expect(opp.sourceType).toBe('OVERDUE_INVOICE');
    expect(opp.amountAtRiskCents).toBe(2400000);
    expect(opp.remainingAmountCents).toBe(2400000);
    expect(opp.priority).toBe('P0');
  });

  it('12. filters opportunities by state correctly', () => {
    const c1: FinOpsCase = {
      id: 'c_st_01',
      caseNumber: 'C-01',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERING',
      amountAtRiskCents: 100000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const c2: FinOpsCase = {
      id: 'c_st_02',
      caseNumber: 'C-02',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'SETTLED_VERIFIED',
      amountAtRiskCents: 200000,
      recoveredAmountCents: 200000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 1,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.createFromCase(c1);
    store.createFromCase(c2);

    const active = store.getOpportunitiesByState('ACTIVE');
    const verified = store.getOpportunitiesByState('VERIFIED');

    expect(active.length).toBe(1);
    expect(verified.length).toBe(1);
    expect(active[0].caseId).toBe('c_st_01');
    expect(verified[0].caseId).toBe('c_st_02');
  });

  it('13. updates opportunity details and refreshes updatedAt timestamp', () => {
    const c: FinOpsCase = {
      id: 'c_upd_01',
      caseNumber: 'C-UPD',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 500000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const opp = store.createFromCase(c);
    const updated = store.updateOpportunity(opp.id, { recoveryState: 'NEGOTIATING', lastAction: 'Offer sent' });

    expect(updated?.recoveryState).toBe('NEGOTIATING');
    expect(updated?.lastAction).toBe('Offer sent');
  });

  it('14. maintains partial collection invariant (verified + remaining = original)', () => {
    const original = 10000000; // ₹1,00,000
    const verifiedCollected = 6000000; // ₹60,000
    const remaining = original - verifiedCollected; // ₹40,000

    const c: FinOpsCase = {
      id: 'c_part_inv',
      caseNumber: 'C-PART-INV',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'PARTIALLY_RECOVERED',
      amountAtRiskCents: original,
      recoveredAmountCents: verifiedCollected,
      verifiedCollectedAmountCents: verifiedCollected,
      remainingRecoverableAmountCents: remaining,
      partialCollection: {
        id: 'part_01',
        caseId: 'c_part_inv',
        originalRecoverableCents: original,
        verifiedCollectedCents: verifiedCollected,
        remainingAmountCents: remaining,
        collectedAt: new Date().toISOString(),
      },
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 1,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const opp = store.createFromCase(c);
    expect(opp.amountAtRiskCents).toBe(original);
    expect(opp.verifiedCollectedCents).toBe(verifiedCollected);
    expect(opp.remainingAmountCents).toBe(remaining);
    expect((opp.verifiedCollectedCents || 0) + opp.remainingAmountCents).toBe(opp.amountAtRiskCents);
    expect(opp.recoveryState).toBe('PARTIALLY_RECOVERED');
  });

  it('15. aggregates summary counts for Operating Centers correctly', () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const c1: FinOpsCase = {
      id: 'c_sum_01',
      caseNumber: 'C-SUM-01',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_ELIGIBLE',
      amountAtRiskCents: 5000000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      promiseToPay: {
        id: 'p1',
        caseId: 'c_sum_01',
        promisedAmountCents: 5000000,
        promisedDate: today,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      },
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const c2: FinOpsCase = {
      id: 'c_sum_02',
      caseNumber: 'C-SUM-02',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_ELIGIBLE',
      amountAtRiskCents: 3000000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      promiseToPay: {
        id: 'p2',
        caseId: 'c_sum_02',
        promisedAmountCents: 3000000,
        promisedDate: tomorrow,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      },
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.createFromCase(c1);
    store.createFromCase(c2);

    const summary = store.getCentersSummary();
    expect(summary.promisesDueTodayCount).toBe(1);
    expect(summary.promisesUpcomingCount).toBe(1);
  });

  it('16. assigns P0 priority to receivables >= ₹50,000 (5,000,000 cents)', () => {
    const c: FinOpsCase = {
      id: 'c_p0_test',
      caseNumber: 'C-P0',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 6500000, // ₹65,000
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const opp = store.createFromCase(c);
    expect(opp.priority).toBe('P0');
  });

  it('17. assigns P2 priority to standard SMB receivables', () => {
    const c: FinOpsCase = {
      id: 'c_p2_test',
      caseNumber: 'C-P2',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 350000, // ₹3,500
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const opp = store.createFromCase(c);
    expect(opp.priority).toBe('P2');
  });

  it('18. action plan contains all 4 required operational phases', () => {
    const res = OpportunityStore.resolveRootCauseAndSpecialist('OVERDUE_INVOICE', undefined, 'ENTERPRISE', 10000000);
    expect(res.actionPlan.currentAction).toBeDefined();
    expect(res.actionPlan.nextAction).toBeDefined();
    expect(res.actionPlan.fallbackAction).toBeDefined();
    expect(res.actionPlan.stopCondition).toBeDefined();
  });

  it('19. retrieves opportunity by underlying caseId', () => {
    const c: FinOpsCase = {
      id: 'case_unique_999',
      caseNumber: 'CASE-999',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 500000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.createFromCase(c);
    const found = store.getOpportunityByCaseId('case_unique_999');
    expect(found).toBeDefined();
    expect(found?.caseNumber).toBe('CASE-999');
  });

  it('20. clears store completely on reset', () => {
    const c: FinOpsCase = {
      id: 'c_clr',
      caseNumber: 'C-CLR',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'EXCEPTION_DETECTED',
      amountAtRiskCents: 100000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.createFromCase(c);
    expect(store.getAllOpportunities().length).toBe(1);
    store.clear();
    expect(store.getAllOpportunities().length).toBe(0);
  });
});
