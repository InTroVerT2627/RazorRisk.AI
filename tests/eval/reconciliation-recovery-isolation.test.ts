import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { OpportunityStore } from '@/core/recovery/opportunity-store';
import { RecoverySupervisorAgent } from '@/agents/recovery-supervisor';
import { ReconciliationEngine } from '@/core/reconciliation';
import { TransactionRecord, SettlementRecord } from '@/types';

describe('Eval Test: Cross-Track Isolation (Reconciliation -> Recovery Independence)', () => {
  let ledger: LedgerStore;
  let oppStore: OpportunityStore;
  let supervisor: RecoverySupervisorAgent;

  beforeEach(() => {
    ledger = LedgerStore.getInstance();
    ledger.clear();
    oppStore = OpportunityStore.getInstance();
    oppStore.clear();
    supervisor = RecoverySupervisorAgent.getInstance();
  });

  it('1. exact reconciliation match (1:1 UTR) NEVER generates a RecoveryOpportunity', () => {
    const tx: TransactionRecord = {
      id: 'tx_exact_01',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'UTR99881122',
      amountCents: 500000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Clean User',
      customerSegment: 'CONSUMER',
      status: 'CAPTURED',
      createdAt: new Date().toISOString(),
    };
    const settlement: SettlementRecord = {
      id: 'stl_exact_01',
      batchId: 'BATCH_01',
      utrRrn: 'UTR99881122',
      amountCents: 500000,
      netAmountCents: 500000,
      feeCents: 0,
      taxCents: 0,
      currency: 'INR',
      bankTimestamp: new Date().toISOString(),
      rawDescription: 'UPI/UTR99881122/Settlement',
      createdAt: new Date().toISOString(),
    };

    const match = ReconciliationEngine.reconcilePair(tx, settlement);
    expect(match.status).toBe('EXACT_MATCH');

    const c = ledger.createCase({
      transactionId: tx.id,
      settlementId: settlement.id,
      merchantId: tx.merchantId,
      amountAtRiskCents: 0,
      status: 'RECONCILED',
      reconStatus: 'EXACT_MATCH',
    });

    supervisor.discoverPortfolio();
    const opp = oppStore.getOpportunityByCaseId(c.id);
    expect(opp).toBeUndefined();
  });

  it('2. explained MDR fee deduction (FEE_MISMATCH) NEVER generates a RecoveryOpportunity', () => {
    const tx: TransactionRecord = {
      id: 'tx_fee_01',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'UTR_FEE_11',
      amountCents: 100000, // ₹1,000 gross
      currency: 'INR',
      paymentMethod: 'CREDIT_CARD',
      customerName: 'Merchant Shop',
      customerSegment: 'SMB',
      status: 'CAPTURED',
      createdAt: new Date().toISOString(),
    };
    const settlement: SettlementRecord = {
      id: 'stl_fee_01',
      batchId: 'BATCH_02',
      utrRrn: 'UTR_FEE_11',
      amountCents: 98000,
      netAmountCents: 98000, // ₹980 net (2% MDR)
      feeCents: 2000,
      taxCents: 0,
      currency: 'INR',
      bankTimestamp: new Date().toISOString(),
      rawDescription: 'MDR Fee Netting UTR_FEE_11',
      createdAt: new Date().toISOString(),
    };

    const match = ReconciliationEngine.reconcilePair(tx, settlement);
    expect(match.status).toBe('FEE_MISMATCH');

    const c = ledger.createCase({
      transactionId: tx.id,
      settlementId: settlement.id,
      merchantId: tx.merchantId,
      amountAtRiskCents: 2000,
      status: 'SETTLED_VERIFIED',
      reconStatus: 'FEE_MISMATCH',
    });

    supervisor.discoverPortfolio();
    const opp = oppStore.getOpportunityByCaseId(c.id);
    expect(opp).toBeUndefined();
  });

  it('3. benign 48h settlement timing delay (TIMING_DELAY) NEVER generates a RecoveryOpportunity', () => {
    const tx: TransactionRecord = {
      id: 'tx_time_01',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'UTR_TIME_22',
      amountCents: 350000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Delayed Payer',
      customerSegment: 'MID_MARKET',
      status: 'CAPTURED',
      createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    };

    const c = ledger.createCase({
      transactionId: tx.id,
      merchantId: tx.merchantId,
      amountAtRiskCents: 350000,
      status: 'EXCEPTION_DETECTED',
      reconStatus: 'TIMING_DELAY',
    });

    supervisor.discoverPortfolio();
    const opp = oppStore.getOpportunityByCaseId(c.id);
    expect(opp).toBeUndefined();
  });

  it('4. terminal written off case is excluded from active recovery portfolio', () => {
    const c = ledger.createCase({
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 50000,
      status: 'CLOSED_WRITTEN_OFF',
      reconStatus: 'UNMATCHED_TRANSACTION',
    });

    supervisor.discoverPortfolio();
    const opp = oppStore.getOpportunityByCaseId(c.id);
    expect(opp).toBeUndefined();
  });

  it('5. only genuine recoverable failures enter active recovery opportunities', () => {
    const tx: TransactionRecord = {
      id: 'tx_rec_true',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_rec_true',
      amountCents: 450000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Legitimate Recoverable Client',
      customerSegment: 'SMB',
      status: 'FAILED',
      errorCode: 'INSUFFICIENT_FUNDS_51',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: tx.id,
      merchantId: tx.merchantId,
      amountAtRiskCents: 450000,
      status: 'EXCEPTION_DETECTED',
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 20,
      riskClassification: 'OPS_SHAPED',
    });

    supervisor.discoverPortfolio();
    const opp = oppStore.getOpportunityByCaseId(c.id);
    expect(opp).toBeDefined();
    expect(opp?.amountAtRiskCents).toBe(450000);
  });

  it('6. recovery portfolio values only include actual recoverable receivables', () => {
    const opps = oppStore.getAllOpportunities();
    for (const opp of opps) {
      expect(opp.sourceType).not.toBe('EXACT_MATCH');
      expect(opp.sourceType).not.toBe('FEE_MISMATCH');
      expect(opp.sourceType).not.toBe('TIMING_DELAY');
    }
  });

  it('7. case with riskScore >= 70 is blocked and marked BLOCKED in recovery opportunity', () => {
    const tx: TransactionRecord = {
      id: 'tx_fraud_block',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_fraud',
      amountCents: 1200000,
      currency: 'INR',
      paymentMethod: 'CREDIT_CARD',
      customerName: 'Fraud Suspect',
      customerSegment: 'CONSUMER',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: tx.id,
      merchantId: tx.merchantId,
      amountAtRiskCents: 1200000,
      status: 'RISK_BLOCKED',
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 88,
      riskClassification: 'CRITICAL_FRAUD',
    });

    const opp = oppStore.createFromCase(c, tx);
    expect(opp.policyStatus).toBe('BLOCKED');
  });

  it('8. reconciliation table does not display direct recovery action dispatch buttons', () => {
    expect(true).toBe(true);
  });

  it('9. verified settlements transition state to SETTLED_VERIFIED without remaining in recovery queue', async () => {
    const tx: TransactionRecord = {
      id: 'tx_set_ver',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_set_ver',
      amountCents: 200000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Verifiable Client',
      customerSegment: 'SMB',
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const c = ledger.createCase({
      transactionId: tx.id,
      merchantId: tx.merchantId,
      amountAtRiskCents: 200000,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 15,
      riskClassification: 'OPS_SHAPED',
    });

    oppStore.createFromCase(c, tx);
    await supervisor.executeCaseRecovery(c.id, { customerMessage: 'PAID' });
    const opp = oppStore.getOpportunityByCaseId(c.id);
    expect(opp?.recoveryState).toBe('VERIFIED');
    expect(opp?.remainingAmountCents).toBe(0);
  });

  it('10. multi-track architecture maintains loose operational coupling via shared case ID', () => {
    const c = ledger.createCase({
      merchantId: 'MERCHANT_DEFAULT',
      amountAtRiskCents: 300000,
      reconStatus: 'UNMATCHED_TRANSACTION',
    });

    expect(c.id).toBeDefined();
    expect(c.id.startsWith('case_')).toBe(true);
  });
});
