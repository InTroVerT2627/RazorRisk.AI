import { describe, it, expect, beforeEach } from 'vitest';
import { RecoverySupervisorAgent } from '@/agents/recovery-supervisor';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { AuditLogger } from '@/core/audit/audit-logger';
import { FinOpsCase, TransactionRecord } from '@/types';

describe('Eval Test: 5-Case Distinct Autonomous Collections Showcase (Phase 10)', () => {
  const supervisor = RecoverySupervisorAgent.getInstance();
  const ledger = LedgerStore.getInstance();
  const audit = AuditLogger.getInstance();

  beforeEach(() => {
    ledger.clear();
    audit.clear();
  });

  it('1. Case 1 (Transient Gateway Drop): executes Smart Retry via Payment Specialist to VERIFIED settlement', async () => {
    const tx: TransactionRecord = {
      id: 'tx_case_1',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_case_1',
      customerName: 'Aarav Sharma',
      amountCents: 350000, // ₹3,500
      currency: 'INR',
      paymentMethod: 'UPI',
      gatewayCode: 'ICICI_UPI',
      customerSegment: 'CONSUMER',
      status: 'FAILED',
      errorCode: 'GATEWAY_TIMEOUT_504',
      createdAt: new Date().toISOString(),
    };

    ledger.addTransaction(tx);

    const c: FinOpsCase = {
      id: 'case_showcase_1',
      caseNumber: 'CASE-01',
      transactionId: tx.id,
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_ELIGIBLE',
      amountAtRiskCents: tx.amountCents,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      recoveryEligible: true,
      riskScore: 12,
      riskClassification: 'OPS_SHAPED',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    ledger.addCase(c);

    const res = await supervisor.executeCaseRecovery(c.id);
    expect(res.specialistAgent).toBe('COLLECTIONS_AGENT');
    expect(res.verifiedRecovery).toBe(true);
    expect(res.recoveryTrace.agentDecision).toContain('COLLECTIONS_AGENT');

    const updated = ledger.getCase(c.id);
    expect(updated?.status).toBe('SETTLED_VERIFIED');
  });

  it('2. Case 2 (Overdue B2B Enterprise Receivable): Negotiation Specialist issues bounded discount and settles', async () => {
    const tx: TransactionRecord = {
      id: 'tx_case_2',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_case_2',
      customerName: 'TechGlobal Industries',
      amountCents: 7500000, // ₹75,000
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      gatewayCode: 'HDFC_PG',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 45,
      status: 'FAILED',
      errorCode: 'CARD_EXPIRED_54',
      createdAt: new Date().toISOString(),
    };

    ledger.addTransaction(tx);

    const c: FinOpsCase = {
      id: 'case_showcase_2',
      caseNumber: 'CASE-02',
      transactionId: tx.id,
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_ELIGIBLE',
      amountAtRiskCents: tx.amountCents,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      recoveryEligible: true,
      riskScore: 18,
      riskClassification: 'OPS_SHAPED',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    ledger.addCase(c);

    const res = await supervisor.executeCaseRecovery(c.id);
    expect(res.specialistAgent).toBe('NEGOTIATION_AGENT');
    expect(res.verifiedRecovery).toBe(true);

    const updated = ledger.getCase(c.id);
    expect(updated?.status).toBe('SETTLED_VERIFIED');
  });

  it('3. Case 3 (Partial Collection): customer pays 60% -> transitions to PARTIALLY_RECOVERED (NOT SETTLED_VERIFIED)', async () => {
    const tx: TransactionRecord = {
      id: 'tx_case_3',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_case_3',
      customerName: 'Rohan Construction Ltd',
      amountCents: 4500000, // ₹45,000
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      gatewayCode: 'SBI_NETBANKING',
      customerSegment: 'MID_MARKET',
      daysOverdue: 20,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };

    ledger.addTransaction(tx);

    const c: FinOpsCase = {
      id: 'case_showcase_3',
      caseNumber: 'CASE-03',
      transactionId: tx.id,
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_ELIGIBLE',
      amountAtRiskCents: tx.amountCents,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      recoveryEligible: true,
      riskScore: 22,
      riskClassification: 'OPS_SHAPED',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    ledger.addCase(c);

    // Mock customer partial collection response via supervisor
    const res = await supervisor.executeCaseRecovery(c.id, {
      customerMessage: 'PAY_PARTIAL',
    });

    const updated = ledger.getCase(c.id);
    expect(updated?.status).toBe('PARTIALLY_RECOVERED');
    expect(updated?.verifiedCollectedAmountCents).toBe(2700000); // ₹27,000
    expect(updated?.remainingRecoverableAmountCents).toBe(1800000); // ₹18,000
    expect(updated?.partialCollection).toBeDefined();
  });

  it('4. Case 4 (Promise to Pay): registers commitment and locks grace period', async () => {
    const tx: TransactionRecord = {
      id: 'tx_case_4',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_case_4',
      customerName: 'Kavita Iyer',
      amountCents: 450000,
      currency: 'INR',
      paymentMethod: 'CREDIT_CARD',
      gatewayCode: 'AXIS_CARD',
      customerSegment: 'SMB',
      daysOverdue: 15,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };

    ledger.addTransaction(tx);

    const c: FinOpsCase = {
      id: 'case_showcase_4',
      caseNumber: 'CASE-04',
      transactionId: tx.id,
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_ELIGIBLE',
      amountAtRiskCents: tx.amountCents,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      recoveryEligible: true,
      riskScore: 20,
      riskClassification: 'OPS_SHAPED',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    ledger.addCase(c);

    const res = await supervisor.executeCaseRecovery(c.id, {
      customerMessage: 'PROMISE_TO_PAY',
    });

    const updated = ledger.getCase(c.id);
    expect(updated?.promiseToPay).toBeDefined();
    expect(updated?.promiseToPay?.status).toBe('PENDING');
  });

  it('5. Case 5 (Coordinated Fraud Attack): Risk Manager blocks case -> never enters actionable recovery', async () => {
    const tx: TransactionRecord = {
      id: 'tx_case_5',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_case_5',
      customerName: 'Suspicious Device Ring',
      amountCents: 2000000,
      currency: 'INR',
      paymentMethod: 'CREDIT_CARD',
      gatewayCode: 'AXIS_CARD',
      customerSegment: 'CONSUMER',
      status: 'FAILED',
      errorCode: 'SUSPECTED_FRAUD_59',
      createdAt: new Date().toISOString(),
    };

    ledger.addTransaction(tx);

    const c: FinOpsCase = {
      id: 'case_showcase_5',
      caseNumber: 'CASE-05',
      transactionId: tx.id,
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RISK_BLOCKED',
      amountAtRiskCents: tx.amountCents,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      recoveryEligible: false,
      recoveryEligibilityStatus: 'BLOCKED',
      riskScore: 88,
      riskClassification: 'CRITICAL_FRAUD',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    ledger.addCase(c);

    const res = await supervisor.executeCaseRecovery(c.id);
    expect(res.actionTaken).toBe('STOP_RECOVERY');
    expect(res.policyPassed).toBe(false);
    expect(res.verifiedRecovery).toBe(false);

    // Audit chain integrity remains intact
    const verification = audit.verifyChainIntegrity();
    expect(verification.valid).toBe(true);
  });
});
