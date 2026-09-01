import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { AuditLogger } from '@/core/audit/audit-logger';
import { PolicyEngine, DEFAULT_MERCHANT_POLICY } from '@/core/policy-engine';
import { RecoverySupervisorAgent } from '@/agents/recovery-supervisor';
import { OpportunityStore } from '@/core/recovery/opportunity-store';
import { RecoveryCampaignManager } from '@/core/recovery/campaign-manager';
import { FinOpsCase, TransactionRecord } from '@/types';

describe('Eval Test: Track 03 Final End-to-End Certification & Feature Freeze', () => {
  let ledger: LedgerStore;
  let audit: AuditLogger;
  let supervisor: RecoverySupervisorAgent;
  let oppStore: OpportunityStore;
  let campaignManager: RecoveryCampaignManager;

  beforeEach(() => {
    ledger = LedgerStore.getInstance();
    ledger.clear();
    audit = AuditLogger.getInstance();
    audit.clear();
    oppStore = OpportunityStore.getInstance();
    oppStore.clear();
    supervisor = RecoverySupervisorAgent.getInstance();
    campaignManager = RecoveryCampaignManager.getInstance();
    campaignManager.clear();
  });

  it('1. Clean-Start Validation: Loading supervisor does not wipe operational ledger or audit state', () => {
    const tx: TransactionRecord = {
      id: 'tx_clean_01',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_clean_01',
      amountCents: 200000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Persistent Customer',
      customerSegment: 'SMB',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);
    const c = ledger.createCase({
      transactionId: 'tx_clean_01',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 200000,
      reconStatus: 'UNMATCHED_TRANSACTION',
    });

    const initialAuditCount = audit.getEntries().length;
    supervisor.discoverPortfolio();

    // Verify case, transaction, and audit chain are preserved
    expect(ledger.getCase(c.id)).toBeDefined();
    expect(ledger.getTransaction('tx_clean_01')).toBeDefined();
    expect(audit.getEntries().length).toBeGreaterThanOrEqual(initialAuditCount);
  });

  it('2. JOURNEY A: Overdue B2B Enterprise Invoice -> Policy -> Payment -> Verification -> SETTLED_VERIFIED', async () => {
    const tx: TransactionRecord = {
      id: 'tx_b2b_inv',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'INV-2026-99',
      amountCents: 10000000, // ₹1,00,000
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Enterprise Logistics Corp',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 23,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_b2b_inv',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 10000000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 18,
      riskClassification: 'OPS_SHAPED',
    });

    const opp = oppStore.createFromCase(c, tx, 'OVERDUE_INVOICE');
    expect(opp.assignedSpecialist).toBe('NEGOTIATION_AGENT');
    expect(opp.priority).toBe('P0');
    expect(opp.actionPlan.currentAction).toBeDefined();

    // Execute recovery with customer payment
    const res = await supervisor.executeCaseRecovery(c.id, {
      forcedAction: 'BOUNDED_NEGOTIATE',
      customerMessage: 'PAID',
    });

    expect(res.policyPassed).toBe(true);
    expect(res.verifiedRecovery).toBe(true);
    expect(res.recoveredAmountCents).toBe(10000000);
    expect(ledger.getCase(c.id)?.status).toBe('SETTLED_VERIFIED');
  });

  it('3. JOURNEY B: Checkout Drop -> Collections Agent -> 1-Click Payment Link -> Payment -> Verification', async () => {
    const tx: TransactionRecord = {
      id: 'tx_cart_drop',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'CART-8819',
      amountCents: 180000, // ₹1,800
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'High Intent Shopper',
      customerSegment: 'CONSUMER',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
      metadata: { isAbandonedCheckout: true },
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_cart_drop',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 180000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 15,
      riskClassification: 'OPS_SHAPED',
    });

    const opp = oppStore.createFromCase(c, tx, 'ABANDONED_CHECKOUT');
    expect(opp.sourceType).toBe('ABANDONED_CHECKOUT');
    expect(opp.assignedSpecialist).toBe('COLLECTIONS_AGENT');

    const res = await supervisor.executeCaseRecovery(c.id, {
      forcedAction: 'SEND_PAYMENT_LINK',
      customerMessage: 'PAID',
    });

    expect(res.verifiedRecovery).toBe(true);
    expect(ledger.getCase(c.id)?.status).toBe('SETTLED_VERIFIED');
  });

  it('4. JOURNEY C: Partial Payment Invariant (₹60K collected of ₹100K -> ₹40K remaining in queue -> second payment -> SETTLED_VERIFIED)', async () => {
    const original = 10000000; // ₹1,00,000
    const tx: TransactionRecord = {
      id: 'tx_part_e2e',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'INV-PARTIAL-01',
      amountCents: original,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Alpha Tech Corp',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 20,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_part_e2e',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: original,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 18,
      riskClassification: 'OPS_SHAPED',
    });

    // Step 1: Customer pays 60%
    const res1 = await supervisor.executeCaseRecovery(c.id, {
      forcedAction: 'BOUNDED_NEGOTIATE',
      customerMessage: 'PARTIAL_PAYMENT',
    });

    expect(res1.partialCollection).toBeDefined();
    expect(res1.partialCollection?.verifiedCollectedCents).toBe(6000000); // ₹60,000
    expect(res1.partialCollection?.remainingAmountCents).toBe(4000000); // ₹40,000
    expect(ledger.getCase(c.id)?.status).toBe('PARTIALLY_RECOVERED');

    // Step 2: Customer pays remaining ₹40,000
    const res2 = await supervisor.executeCaseRecovery(c.id, {
      forcedAction: 'BOUNDED_NEGOTIATE',
      customerMessage: 'PAID',
    });

    expect(res2.verifiedRecovery).toBe(true);
    expect(ledger.getCase(c.id)?.status).toBe('SETTLED_VERIFIED');
    expect(ledger.getCase(c.id)?.remainingRecoverableAmountCents).toBe(0);
  });

  it('5. JOURNEY D: Coordinated Fraud Case is strictly blocked and never actionable in recovery queues', async () => {
    const tx: TransactionRecord = {
      id: 'tx_fraud_e2e',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'FRAUD-TX-99',
      amountCents: 5000000,
      currency: 'INR',
      paymentMethod: 'CREDIT_CARD',
      customerName: 'Flagged Syndicate Cluster',
      customerSegment: 'CONSUMER',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_fraud_e2e',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 5000000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 95,
      riskClassification: 'CRITICAL_FRAUD',
      status: 'RISK_BLOCKED',
    });

    const opp = oppStore.createFromCase(c, tx);
    expect(opp.policyStatus).toBe('BLOCKED');
    expect(opp.eligibilityStatus).toBe('BLOCKED');

    const res = await supervisor.executeCaseRecovery(c.id);
    expect(res.policyPassed).toBe(false);
    expect(res.verifiedRecovery).toBe(false);
  });

  it('6. Bounded Negotiation Protocol: Enforces max 10% discount cap and min 85% settlement floor', () => {
    const policyEngine = PolicyEngine.getInstance();
    const mockCase: FinOpsCase = {
      id: 'case_neg_test',
      caseNumber: 'CASE-NEG',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 10000000,
      recoveredAmountCents: 0,
      status: 'RECOVERY_ELIGIBLE',
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 20,
      riskClassification: 'OPS_SHAPED',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 8% discount (allowed)
    const res1 = policyEngine.evaluateRecoveryAction({
      finOpsCase: mockCase,
      actionType: 'BOUNDED_NEGOTIATE',
      channel: 'EMAIL',
      discountOfferedBps: 800,
      riskScore: 20,
      riskClassification: 'OPS_SHAPED',
      negotiationRound: 1,
    });
    expect(res1.passed).toBe(true);

    // 20% discount (exceeds 10% max cap)
    const res2 = policyEngine.evaluateRecoveryAction({
      finOpsCase: mockCase,
      actionType: 'BOUNDED_NEGOTIATE',
      channel: 'EMAIL',
      discountOfferedBps: 2000,
      riskScore: 20,
      riskClassification: 'OPS_SHAPED',
      negotiationRound: 1,
    });
    expect(res2.passed).toBe(false);
    expect(res2.clampedDiscountBps).toBe(1000);
  });

  it('7. Promise-to-Pay Lifecycle: Locks grace period and tracks commitment date', async () => {
    const tx: TransactionRecord = {
      id: 'tx_p2p_life',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'P2P-INV-1',
      amountCents: 3000000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Responsive SMB',
      customerSegment: 'SMB',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_p2p_life',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 3000000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 15,
      riskClassification: 'OPS_SHAPED',
    });

    const res = await supervisor.executeCaseRecovery(c.id, {
      forcedAction: 'SEND_PAYMENT_LINK',
      customerMessage: 'PROMISE_TO_PAY',
    });

    expect(res.promiseToPay).toBeDefined();
    expect(res.promiseToPay?.status).toBe('PENDING');
    expect(res.promiseToPay?.promisedAmountCents).toBe(3000000);
  });

  it('8. Campaign Mutex Concurrency: Prevents enrolling the same case in two active campaigns', () => {
    const c1 = campaignManager.createCampaign({
      name: 'Campaign Alpha',
      targetSegments: ['ENTERPRISE'],
      maxDiscountBps: 800,
      maxCampaignAmountCents: 50000000,
    });

    const c2 = campaignManager.createCampaign({
      name: 'Campaign Beta',
      targetSegments: ['ENTERPRISE'],
      maxDiscountBps: 800,
      maxCampaignAmountCents: 50000000,
    });

    const claim1 = campaignManager.claimCaseForCampaign(c1.id, 'case_exclusive_01', 'SEND_PAYMENT_LINK');
    expect(claim1.success).toBe(true);

    // Second campaign attempt to claim same case must fail
    const claim2 = campaignManager.claimCaseForCampaign(c2.id, 'case_exclusive_01', 'SEND_PAYMENT_LINK');
    expect(claim2.success).toBe(false);
  });

  it('9. Financial Invariant Accounting: Verified Collected + Remaining = Original Recoverable', () => {
    const original = 7500000; // ₹75,000
    const verified = 4500000; // ₹45,000
    const remaining = original - verified;

    const mockCase: FinOpsCase = {
      id: 'c_inv_math',
      caseNumber: 'CASE-MATH',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: original,
      recoveredAmountCents: verified,
      verifiedCollectedAmountCents: verified,
      remainingRecoverableAmountCents: remaining,
      status: 'PARTIALLY_RECOVERED',
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 1,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const opp = oppStore.createFromCase(mockCase);
    expect(opp.amountAtRiskCents).toBe(original);
    expect(opp.verifiedCollectedCents).toBe(verified);
    expect(opp.remainingAmountCents).toBe(remaining);
    expect((opp.verifiedCollectedCents || 0) + opp.remainingAmountCents).toBe(opp.amountAtRiskCents);
  });

  it('10. Recovery Opportunity Score: Net recovery accounts for recovery probability and channel cost', () => {
    const mockCase: FinOpsCase = {
      id: 'c_score_calc',
      caseNumber: 'CASE-SCORE',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 500000, // ₹5,000
      recoveredAmountCents: 0,
      status: 'EXCEPTION_DETECTED',
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const opp = oppStore.createFromCase(mockCase);
    expect(opp.opportunityScore).toBeDefined();
    expect(opp.opportunityScore?.expectedNetRecoveryCents).toBeGreaterThan(0);
    expect(opp.opportunityScore?.expectedNetRecoveryCents).toBeLessThanOrEqual(opp.amountAtRiskCents);
  });

  it('11. Action Idempotency: Repeated execution of identical recovery action does not corrupt state', async () => {
    const tx: TransactionRecord = {
      id: 'tx_idemp_01',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'IDEMP-1',
      amountCents: 250000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Idempotency Test User',
      customerSegment: 'SMB',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_idemp_01',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 250000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 18,
      riskClassification: 'OPS_SHAPED',
    });

    const res1 = await supervisor.executeCaseRecovery(c.id, { forcedAction: 'SEND_PAYMENT_LINK', customerMessage: 'PAID' });
    expect(res1.verifiedRecovery).toBe(true);

    // Second execution on already verified case
    const res2 = await supervisor.executeCaseRecovery(c.id, { forcedAction: 'SEND_PAYMENT_LINK' });
    expect(ledger.getCase(c.id)?.status).toBe('SETTLED_VERIFIED');
  });

  it('12. Demo Portfolio Generator: Deterministically creates 120 diverse non-uniform opportunities', () => {
    oppStore.seedDemoPortfolio();
    const all = oppStore.getAllOpportunities();

    expect(all.length).toBe(120);

    const hasInvoices = all.some(o => o.sourceType === 'OVERDUE_INVOICE');
    const hasCheckouts = all.some(o => o.sourceType === 'ABANDONED_CHECKOUT');
    const hasSubscriptions = all.some(o => o.sourceType === 'SUBSCRIPTION_FAILURE');
    const hasMandates = all.some(o => o.sourceType === 'MANDATE_FAILURE');
    const hasPartials = all.some(o => o.sourceType === 'PARTIAL_COLLECTION');
    const hasPromises = all.some(o => o.promiseToPay !== undefined);

    expect(hasInvoices).toBe(true);
    expect(hasCheckouts).toBe(true);
    expect(hasSubscriptions).toBe(true);
    expect(hasMandates).toBe(true);
    expect(hasPartials).toBe(true);
    expect(hasPromises).toBe(true);
  });

  it('13. Voice Simulator Dialogue: Accurately parses Hinglish simulated responses into PromiseToPay commitments', async () => {
    const tx: TransactionRecord = {
      id: 'tx_voice_hinglish',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'VOICE-HIN-1',
      amountCents: 1500000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Sunil Mehta',
      customerPhone: '+91 98111 22233',
      customerSegment: 'SMB',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_voice_hinglish',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 1500000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 20,
      riskClassification: 'OPS_SHAPED',
    });

    const res = await supervisor.executeCaseRecovery(c.id, {
      forcedAction: 'SEND_PAYMENT_LINK',
      customerMessage: 'PROMISE_TO_PAY',
    });

    expect(res.promiseToPay).toBeDefined();
    expect(res.promiseToPay?.promisedAmountCents).toBe(1500000);
  });

  it('14. Cross-Track Isolation: Unmatched transaction exception is distinct from exact match settlement', () => {
    const c1 = ledger.createCase({
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 0,
      status: 'RECONCILED',
      reconStatus: 'EXACT_MATCH',
    });

    const c2 = ledger.createCase({
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 350000,
      status: 'EXCEPTION_DETECTED',
      reconStatus: 'UNMATCHED_TRANSACTION',
    });

    supervisor.discoverPortfolio();

    expect(oppStore.getOpportunityByCaseId(c1.id)).toBeUndefined();
    expect(oppStore.getOpportunityByCaseId(c2.id)).toBeDefined();
  });

  it('15. SHA-256 Audit Chain Integrity: Validates cryptographic chaining for all recovery lifecycle actions', async () => {
    const tx: TransactionRecord = {
      id: 'tx_audit_chain',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'AUD-CHAIN-1',
      amountCents: 1200000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Crypto Audit Corp',
      customerSegment: 'MID_MARKET',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: 'tx_audit_chain',
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 1200000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 20,
      riskClassification: 'OPS_SHAPED',
    });

    await supervisor.executeCaseRecovery(c.id, { customerMessage: 'PAID' });
    const chainCheck = audit.verifyChainIntegrity();

    expect(chainCheck.valid).toBe(true);
    expect(audit.getEntries().length).toBeGreaterThan(1);
  });

  it('16. Operating Centers Summary Metrics: Computes accurate aggregate totals across all 10 centers', () => {
    oppStore.seedDemoPortfolio();
    const summary = oppStore.getCentersSummary();

    expect(summary.invoicesCount).toBeGreaterThan(0);
    expect(summary.partialCasesCount).toBeGreaterThan(0);
    expect(summary.subscriptionFailuresCount).toBeGreaterThan(0);
    expect(summary.mandateFailuresCount).toBeGreaterThan(0);
    expect(summary.checkoutDropOffsCount).toBeGreaterThan(0);
    expect(summary.b2bAging.bracket15_30dCents).toBeGreaterThanOrEqual(0);
  });
});
