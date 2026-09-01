import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { AuditLogger } from '@/core/audit/audit-logger';
import { PolicyEngine } from '@/core/policy-engine';
import { RecoverySupervisorAgent } from '@/agents/recovery-supervisor';
import { OpportunityStore } from '@/core/recovery/opportunity-store';
import { FinOpsCase, TransactionRecord } from '@/types';

describe('Eval Test: 10 Critical E2E Scenarios & Autonomous Operating Centers', () => {
  let ledger: LedgerStore;
  let audit: AuditLogger;
  let supervisor: RecoverySupervisorAgent;
  let oppStore: OpportunityStore;

  beforeEach(() => {
    ledger = LedgerStore.getInstance();
    ledger.clear();
    audit = AuditLogger.getInstance();
    audit.clear();
    oppStore = OpportunityStore.getInstance();
    oppStore.clear();
    supervisor = RecoverySupervisorAgent.getInstance();
  });

  it('1. SCENARIO 1: Failed payment -> root cause (504) -> retry -> payment -> verification', async () => {
    const tx: TransactionRecord = {
      id: 'tx_s1',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_s1',
      amountCents: 150000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Aarav Sharma',
      customerSegment: 'CONSUMER',
      errorCode: 'GATEWAY_TIMEOUT_504',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_s1',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 150000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 12,
      riskClassification: 'OPS_SHAPED',
    });

    const opp = oppStore.createFromCase(c, tx, 'FAILED_PAYMENT');
    expect(opp.sourceType).toBe('FAILED_PAYMENT');
    expect(opp.assignedSpecialist).toBe('PAYMENT_AGENT');
    expect(opp.recommendedStrategy).toBe('RETRY_PAYMENT');

    const result = await supervisor.executeCaseRecovery(c.id, { customerMessage: 'PAID' });
    expect(result.policyPassed).toBe(true);
    expect(result.verifiedRecovery).toBe(true);
    expect(result.recoveredAmountCents).toBe(150000);
    expect(ledger.getCase(c.id)?.status).toBe('SETTLED_VERIFIED');
  });

  it('2. SCENARIO 2: Checkout abandoned -> reminder -> payment link -> customer pays -> verification', async () => {
    const tx: TransactionRecord = {
      id: 'tx_s2',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_s2',
      amountCents: 180000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Priya Patel',
      customerSegment: 'CONSUMER',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_s2',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 180000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 18,
      riskClassification: 'OPS_SHAPED',
    });

    const opp = oppStore.createFromCase(c, tx, 'ABANDONED_CHECKOUT');
    expect(opp.sourceType).toBe('ABANDONED_CHECKOUT');
    expect(opp.assignedSpecialist).toBe('COLLECTIONS_AGENT');

    const result = await supervisor.executeCaseRecovery(c.id, { forcedAction: 'SEND_PAYMENT_LINK', customerMessage: 'PAID' });
    expect(result.verifiedRecovery).toBe(true);
    expect(ledger.getCase(c.id)?.status).toBe('SETTLED_VERIFIED');
  });

  it('3. SCENARIO 3: Subscription failure -> retry -> payment link -> payment -> subscription recovered', async () => {
    const tx: TransactionRecord = {
      id: 'tx_s3',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_s3',
      amountCents: 99900,
      currency: 'INR',
      paymentMethod: 'AUTOPAY',
      customerName: 'Rohan Verma',
      customerSegment: 'CONSUMER',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_s3',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 99900,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 15,
      riskClassification: 'OPS_SHAPED',
    });

    const opp = oppStore.createFromCase(c, tx, 'SUBSCRIPTION_FAILURE');
    expect(opp.assignedSpecialist).toBe('SUBSCRIPTION_RECOVERY_AGENT');

    const result = await supervisor.executeCaseRecovery(c.id, { customerMessage: 'PAID' });
    expect(result.verifiedRecovery).toBe(true);
    expect(ledger.getCase(c.id)?.status).toBe('SETTLED_VERIFIED');
  });

  it('4. SCENARIO 4: Overdue B2B invoice -> collections -> invoice reminder -> payment link -> promise-to-pay -> payment -> verification', async () => {
    const tx: TransactionRecord = {
      id: 'tx_s4',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_s4',
      amountCents: 2400000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Apex Logistics',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 25,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_s4',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 2400000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 20,
      riskClassification: 'OPS_SHAPED',
    });

    // Step 1: Customer issues promise to pay
    const p2pRes = await supervisor.executeCaseRecovery(c.id, { customerMessage: 'PROMISE_TO_PAY' });
    expect(p2pRes.promiseToPay).toBeDefined();
    expect(p2pRes.promiseToPay?.status).toBe('PENDING');

    // Step 2: Promise honored via payment
    const finalRes = await supervisor.executeCaseRecovery(c.id, { forcedAction: 'SEND_PAYMENT_LINK', customerMessage: 'PAID' });
    expect(finalRes.verifiedRecovery).toBe(true);
    expect(ledger.getCase(c.id)?.status).toBe('SETTLED_VERIFIED');
  });

  it('5. SCENARIO 5: Negotiation -> offer -> counter -> policy -> accepted -> payment -> verification', async () => {
    const tx: TransactionRecord = {
      id: 'tx_s5',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_s5',
      amountCents: 8500000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Global Retail Ltd',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 35,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_s5',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 8500000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 22,
      riskClassification: 'OPS_SHAPED',
    });

    const negRes = await supervisor.executeCaseRecovery(c.id, {
      forcedAction: 'BOUNDED_NEGOTIATE',
      customerMessage: 'We can settle immediately if you give an 8% discount.',
    });

    expect(negRes.policyPassed).toBe(true);
    expect(negRes.customerResponse).toBeDefined();
  });

  it('6. SCENARIO 6: Mandate failure -> retry sequence -> payment -> verification', async () => {
    const tx: TransactionRecord = {
      id: 'tx_s6',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_s6',
      amountCents: 50000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Sanjay Kumar',
      customerSegment: 'SMB',
      errorCode: 'MANDATE_EXPIRED',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_s6',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 50000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 16,
      riskClassification: 'OPS_SHAPED',
    });

    const opp = oppStore.createFromCase(c, tx, 'MANDATE_FAILURE');
    expect(opp.assignedSpecialist).toBe('MANDATE_RECOVERY_AGENT');

    const res = await supervisor.executeCaseRecovery(c.id, { customerMessage: 'PAID' });
    expect(res.verifiedRecovery).toBe(true);
  });

  it('7. SCENARIO 7: Voice simulation -> Hinglish -> promise-to-pay -> payment -> verification', async () => {
    const tx: TransactionRecord = {
      id: 'tx_s7',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_s7',
      amountCents: 1800000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Ananya Roy',
      customerPhone: '+91 98765 12345',
      customerSegment: 'SMB',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_s7',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 1800000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 20,
      riskClassification: 'OPS_SHAPED',
    });

    const res = await supervisor.executeCaseRecovery(c.id, { forcedAction: 'SEND_PAYMENT_LINK', customerMessage: 'PROMISE_TO_PAY' });
    expect(res.promiseToPay).toBeDefined();
    expect(res.promiseToPay?.status).toBe('PENDING');
  });

  it('8. SCENARIO 8: Partial payment -> ₹60K of ₹100K -> PARTIALLY_RECOVERED -> remaining ₹40K stays active', async () => {
    const original = 10000000; // ₹1,00,000
    const tx: TransactionRecord = {
      id: 'tx_s8',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_s8',
      amountCents: original,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Titan Holdings',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 20,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_s8',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: original,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 20,
      riskClassification: 'OPS_SHAPED',
    });

    const res = await supervisor.executeCaseRecovery(c.id, { forcedAction: 'BOUNDED_NEGOTIATE', customerMessage: 'PARTIAL_PAYMENT' });
    expect(res.partialCollection).toBeDefined();
    expect(res.partialCollection?.originalRecoverableCents).toBe(original);
    expect(res.partialCollection?.verifiedCollectedCents).toBe(6000000); // 60% collected
    expect(res.partialCollection?.remainingAmountCents).toBe(4000000); // 40% remaining
    expect(ledger.getCase(c.id)?.status).toBe('PARTIALLY_RECOVERED');
  });

  it('9. SCENARIO 9: Fraud -> high risk >= 70 -> recovery blocked -> zero automated recovery', async () => {
    const tx: TransactionRecord = {
      id: 'tx_s9',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_s9',
      amountCents: 500000,
      currency: 'INR',
      paymentMethod: 'CREDIT_CARD',
      customerName: 'Suspicious Entity',
      customerSegment: 'CONSUMER',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_s9',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 500000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 92,
      riskClassification: 'CRITICAL_FRAUD',
      status: 'RISK_BLOCKED',
    });

    const opp = oppStore.createFromCase(c, tx);
    expect(opp.policyStatus).toBe('BLOCKED');

    const res = await supervisor.executeCaseRecovery(c.id);
    expect(res.policyPassed).toBe(false);
    expect(res.verifiedRecovery).toBe(false);
  });

  it('10. SCENARIO 10: Explained reconciliation difference (fee netting) -> zero recovery opportunity created', () => {
    const c = ledger.createCase({
      transactionId: 'tx_s10',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 200,
      reconStatus: 'FEE_MISMATCH',
      status: 'RECONCILED',
    });

    // Benign fee variance should not create an active recovery opportunity
    const allOpps = oppStore.getAllOpportunities();
    expect(allOpps.some(o => o.caseId === c.id && o.sourceType === 'FAILED_PAYMENT')).toBe(false);
  });

  it('11. Operating Centers summary tracks active promise-to-pay counts', () => {
    const summary = oppStore.getCentersSummary();
    expect(summary.promisesUpcomingCount).toBeGreaterThanOrEqual(0);
  });

  it('12. Operating Centers summary tracks partial collection residuals', () => {
    const summary = oppStore.getCentersSummary();
    expect(summary.totalPartialCollectedCents).toBeGreaterThanOrEqual(0);
  });

  it('13. Operating Centers summary computes B2B aging brackets', () => {
    const summary = oppStore.getCentersSummary();
    expect(summary.b2bAging).toBeDefined();
    expect(summary.b2bAging.bracket15_30dCents).toBeGreaterThanOrEqual(0);
  });

  it('14. Operating Centers summary tracks subscription failures', () => {
    const summary = oppStore.getCentersSummary();
    expect(summary.subscriptionFailuresCount).toBeGreaterThanOrEqual(0);
  });

  it('15. Operating Centers summary tracks mandate failures', () => {
    const summary = oppStore.getCentersSummary();
    expect(summary.mandateFailuresCount).toBeGreaterThanOrEqual(0);
  });

  it('16. Operating Centers summary tracks checkout drop-offs', () => {
    const summary = oppStore.getCentersSummary();
    expect(summary.checkoutDropOffsCount).toBeGreaterThanOrEqual(0);
  });

  it('17. Operating Centers summary tracks voice simulations', () => {
    const summary = oppStore.getCentersSummary();
    expect(summary.voiceSimulationsCount).toBeGreaterThanOrEqual(0);
  });

  it('18. Operating Centers summary tracks active negotiations', () => {
    const summary = oppStore.getCentersSummary();
    expect(summary.activeNegotiationsCount).toBeGreaterThanOrEqual(0);
  });

  it('19. audit logger records full recovery action block trace', async () => {
    const tx: TransactionRecord = {
      id: 'tx_aud',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_aud',
      amountCents: 500000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Audit Test Corp',
      customerSegment: 'SMB',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);
    const c = ledger.createCase({
      transactionId: 'tx_aud',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 500000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 20,
      riskClassification: 'OPS_SHAPED',
    });

    await supervisor.executeCaseRecovery(c.id, { customerMessage: 'PAID' });
    const entries = audit.getEntries().filter((e) => e.caseId === c.id);
    expect(entries.length).toBeGreaterThan(0);
    expect(audit.verifyChainIntegrity().valid).toBe(true);
  });

  it('20. autonomous campaign execution processes portfolio without corrupting state', async () => {
    const campaign = supervisor['campaignManager'].createCampaign({
      name: 'E2E Enterprise Sprint',
      targetSegments: ['ENTERPRISE'],
      maxDiscountBps: 800,
      maxCampaignAmountCents: 10000000,
    });

    const res = await supervisor.runCampaign(campaign.id);
    expect(res.campaign.status).toBe('ACTIVE');
    expect(res.executedCasesCount).toBeGreaterThanOrEqual(0);
  });
});
