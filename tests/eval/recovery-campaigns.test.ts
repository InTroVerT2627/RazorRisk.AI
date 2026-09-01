import { describe, it, expect, beforeEach } from 'vitest';
import { RecoveryCampaignManager } from '@/core/recovery/campaign-manager';
import { RecoverySupervisorAgent } from '@/agents/recovery-supervisor';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { AuditLogger } from '@/core/audit/audit-logger';
import { FinOpsCase, TransactionRecord } from '@/types';

describe('Eval Test: Autonomous Recovery Campaigns & Concurrency Locking (Phase 10)', () => {
  const campaignManager = RecoveryCampaignManager.getInstance();
  const supervisor = RecoverySupervisorAgent.getInstance();
  const ledger = LedgerStore.getInstance();
  const audit = AuditLogger.getInstance();

  beforeEach(() => {
    ledger.clear();
    audit.clear();
    campaignManager.clear();
  });

  it('1. creates a new Recovery Campaign with structured criteria and default metrics', () => {
    const camp = campaignManager.createCampaign({
      name: 'Mid-Market Sprint',
      targetSegments: ['MID_MARKET'],
      minDaysOverdue: 10,
      maxDaysOverdue: 45,
      maxRiskScore: 40,
      maxDiscountBps: 500, // 5%
      maxCampaignAmountCents: 10000000, // ₹1,00,000
    });

    expect(camp.id).toBeDefined();
    expect(camp.status).toBe('DRAFT');
    expect(camp.targetSegments).toEqual(['MID_MARKET']);
    expect(camp.metrics.costPerRecoveredRupee).toBe('₹0.00');
  });

  it('2. filters and matches only eligible cases matching campaign segment and overdue bounds', () => {
    // Ingest 3 transactions
    const tx1: TransactionRecord = {
      id: 'tx_camp_1',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_1',
      amountCents: 2000000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      customerName: 'Enterprise Corp',
      gatewayCode: 'HDFC_PG',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 25,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };

    const tx2: TransactionRecord = {
      id: 'tx_camp_2',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_2',
      amountCents: 500000,
      currency: 'INR',
      paymentMethod: 'UPI',
      customerName: 'Consumer User',
      gatewayCode: 'ICICI_UPI',
      customerSegment: 'CONSUMER', // Not targeted
      daysOverdue: 10,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
    };

    ledger.addTransaction(tx1);
    ledger.addTransaction(tx2);

    const c1: FinOpsCase = {
      id: 'case_camp_1',
      caseNumber: 'CASE-C1',
      transactionId: tx1.id,
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_ELIGIBLE',
      amountAtRiskCents: tx1.amountCents,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      recoveryEligible: true,
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const c2: FinOpsCase = {
      id: 'case_camp_2',
      caseNumber: 'CASE-C2',
      transactionId: tx2.id,
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_ELIGIBLE',
      amountAtRiskCents: tx2.amountCents,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      recoveryEligible: true,
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    ledger.addCase(c1);
    ledger.addCase(c2);

    const camp = campaignManager.createCampaign({
      name: 'Enterprise Only Sprint',
      targetSegments: ['ENTERPRISE'],
      minDaysOverdue: 15,
      maxDaysOverdue: 60,
      maxRiskScore: 45,
    });

    const txMap = new Map<string, TransactionRecord>([
      [tx1.id, tx1],
      [tx2.id, tx2],
    ]);

    const matched = campaignManager.filterEligibleCasesForCampaign(
      camp.id,
      [c1, c2],
      txMap
    );

    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe(c1.id);
  });

  it('3. enforces simulation-local atomic case claim locking and rejects conflicting claim from second campaign', () => {
    const claim1 = campaignManager.claimCaseForCampaign('camp_alpha', 'case_999', 'SEND_PAYMENT_LINK');
    expect(claim1.success).toBe(true);

    // Second campaign tries to claim the same case
    const claim2 = campaignManager.claimCaseForCampaign('camp_beta', 'case_999', 'SEND_REMINDER');
    expect(claim2.success).toBe(false);
    expect(claim2.reason).toContain('already actively claimed by Campaign camp_alpha');

    // Release and re-claim
    campaignManager.releaseCaseClaim('case_999');
    const claim3 = campaignManager.claimCaseForCampaign('camp_beta', 'case_999', 'SEND_REMINDER');
    expect(claim3.success).toBe(true);
  });

  it('4. executes an entire autonomous campaign and refreshes campaign metrics and audit chain', async () => {
    const tx: TransactionRecord = {
      id: 'tx_exec_1',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'ext_exec_1',
      customerName: 'Acme Global Corp',
      customerEmail: 'finance@acmeglobal.com',
      amountCents: 3000000,
      currency: 'INR',
      paymentMethod: 'NET_BANKING',
      gatewayCode: 'HDFC_PG',
      customerSegment: 'ENTERPRISE',
      daysOverdue: 20,
      status: 'FAILED',
      errorCode: 'GATEWAY_TIMEOUT_504',
      createdAt: new Date().toISOString(),
    };

    ledger.addTransaction(tx);

    const c: FinOpsCase = {
      id: 'case_exec_1',
      caseNumber: 'CASE-EXEC-1',
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

    const camp = campaignManager.createCampaign({
      name: 'Q4 Enterprise Run',
      targetSegments: ['ENTERPRISE'],
      minDaysOverdue: 10,
      maxDaysOverdue: 60,
    });

    const runResult = await supervisor.runCampaign(camp.id);
    expect(runResult.executedCasesCount).toBe(1);
    expect(runResult.campaign.status).toBe('ACTIVE');
    expect(runResult.results[0].verifiedRecovery).toBe(true);

    // Verify audit chain
    const verification = audit.verifyChainIntegrity();
    expect(verification.valid).toBe(true);
  });
});
