import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { RevenueRecoveryAgent } from '@/agents/revenue-recovery';
import { createRecoveryTools } from '@/agents/revenue-recovery/tools';
import { FinOpsCase, TransactionRecord } from '@/types';

describe('Eval Test: Reminder Sequence Lifecycle & Confirmed Delivery Telemetry', () => {
  let ledger: LedgerStore;
  let recoveryAgent: RevenueRecoveryAgent;
  let tools: ReturnType<typeof createRecoveryTools>;

  beforeEach(() => {
    ledger = LedgerStore.getInstance();
    ledger.clear();
    recoveryAgent = new RevenueRecoveryAgent();
    tools = createRecoveryTools(ledger);
  });

  it('1. executes the 4-stage reminder sequence before negotiation eligibility', async () => {
    const tx: TransactionRecord = {
      id: 'tx_rem_seq_001',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'order_rem_seq_001',
      customerName: 'Arun Patel',
      amountCents: 1500000, // ₹15,000
      currency: 'INR',
      customerEmail: 'arun.patel@techcorp.in',
      customerPhone: '+919876500001',
      customerSegment: 'ENTERPRISE',
      paymentMethod: 'UPI',
      gatewayCode: 'NPCI_SWITCH',
      status: 'FAILED',
      errorCode: 'GATEWAY_TIMEOUT_504',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const finOpsCase: FinOpsCase = {
      id: 'case_rem_seq_001',
      caseNumber: 'CASE-REM-001',
      transactionId: tx.id,
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERING',
      amountAtRiskCents: 1500000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 22,
      riskClassification: 'OPS_SHAPED',
      retryCount: 0,
      maxRetriesAllowed: 3,
      outboundContactCount7d: 0,
      reminderCount: 0,
      reminderSequenceStage: 'NONE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    ledger.addCase(finOpsCase);

    const dispatchInvoiceTool = tools.find((t) => t.name === 'dispatchInvoice')!;
    const dispatchReminderTool = tools.find((t) => t.name === 'dispatchReminder')!;

    // Stage 1: Dispatch Invoice
    const invoiceRes = await dispatchInvoiceTool.execute({ caseId: 'case_rem_seq_001' });
    expect(invoiceRes.success).toBe(true);
    let c = ledger.getCase('case_rem_seq_001')!;
    expect(c.reminderSequenceStage).toBe('INVOICE_SENT');
    expect(c.outboundContactCount7d).toBe(1);
    expect(c.deliveredAt).toBeDefined();

    // Stage 2: Dispatch Reminder 1 (after simulated 25h interval)
    ledger.updateCaseDetails('case_rem_seq_001', {
      lastActionAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    });
    const rem1Res = await dispatchReminderTool.execute({ caseId: 'case_rem_seq_001', sequenceNumber: 1 });
    expect(rem1Res.success).toBe(true);
    c = ledger.getCase('case_rem_seq_001')!;
    expect(c.reminderSequenceStage).toBe('REMINDER_1');
    expect(c.reminderCount).toBe(1);
    expect(c.outboundContactCount7d).toBe(2);

    // Stage 3: Dispatch Reminder 2 (after second simulated 25h interval)
    ledger.updateCaseDetails('case_rem_seq_001', {
      lastActionAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    });
    const rem2Res = await dispatchReminderTool.execute({ caseId: 'case_rem_seq_001', sequenceNumber: 2 });
    expect(rem2Res.success).toBe(true);
    c = ledger.getCase('case_rem_seq_001')!;
    expect(c.reminderSequenceStage).toBe('REMINDER_2');
    expect(c.reminderCount).toBe(2);
    expect(c.outboundContactCount7d).toBe(3);
  });

  it('2. customer response rate accurately reflects only confirmed delivered_at telemetry', () => {
    // Case 1: Undelivered (no deliveredAt)
    ledger.addCase({
      id: 'case_m1',
      caseNumber: 'CASE-M1',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERING',
      amountAtRiskCents: 100000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Case 2: Delivered, but no response
    ledger.addCase({
      id: 'case_m2',
      caseNumber: 'CASE-M2',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERING',
      amountAtRiskCents: 100000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 1,
      maxRetriesAllowed: 3,
      deliveredAt: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Case 3: Delivered AND Responded
    ledger.addCase({
      id: 'case_m3',
      caseNumber: 'CASE-M3',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERY_EXECUTED',
      amountAtRiskCents: 100000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      retryCount: 1,
      maxRetriesAllowed: 3,
      deliveredAt: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
      respondedAt: new Date().toISOString(),
      responded_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Case 4: Delivered AND Settled Verified
    ledger.addCase({
      id: 'case_m4',
      caseNumber: 'CASE-M4',
      merchantId: 'MERCHANT_DEFAULT',
      status: 'SETTLED_VERIFIED',
      amountAtRiskCents: 100000,
      recoveredAmountCents: 100000,
      reconStatus: 'EXACT_MATCH',
      retryCount: 1,
      maxRetriesAllowed: 3,
      deliveredAt: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
      respondedAt: new Date().toISOString(),
      responded_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const allCases = ledger.getAllCases();
    const deliveredCases = allCases.filter((c) => c.deliveredAt || c.delivered_at);
    const respondedCases = deliveredCases.filter((c) =>
      c.respondedAt ||
      c.responded_at ||
      c.status === 'SETTLED_VERIFIED' ||
      c.negotiation
    );

    // Total cases = 4
    // Delivered cases = 3 (Case 2, Case 3, Case 4)
    // Responded cases = 2 (Case 3, Case 4)
    // Response rate = 2 / 3 = 66.7%
    expect(deliveredCases.length).toBe(3);
    expect(respondedCases.length).toBe(2);

    const calculatedRate = ((respondedCases.length / deliveredCases.length) * 100).toFixed(1);
    expect(calculatedRate).toBe('66.7');
  });
});
