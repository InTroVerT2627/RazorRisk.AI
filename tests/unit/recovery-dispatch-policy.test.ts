import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { PolicyEngine } from '@/core/policy-engine';
import { AuditLogger } from '@/core/audit/audit-logger';
import { createRecoveryTools } from '@/agents/revenue-recovery/tools';
import { FinOpsCase, TransactionRecord } from '@/types';

describe('Unit Test: Recovery Agent Dispatch Tools & Policy Contact Caps', () => {
  let ledger: LedgerStore;
  let policyEngine: PolicyEngine;
  let audit: AuditLogger;
  let tools: ReturnType<typeof createRecoveryTools>;

  beforeEach(() => {
    ledger = LedgerStore.getInstance();
    ledger.clear();
    policyEngine = PolicyEngine.getInstance();
    audit = AuditLogger.getInstance();
    tools = createRecoveryTools(ledger);
  });

  const setupCase = (overrides?: Partial<FinOpsCase>): FinOpsCase => {
    const tx: TransactionRecord = {
      id: 'tx_dispatch_001',
      merchantId: 'MERCHANT_DEFAULT',
      externalRef: 'order_disp_001',
      customerName: 'Enterprise Client',
      amountCents: 500000,
      currency: 'INR',
      customerEmail: 'finance@enterprise.com',
      customerPhone: '+919876543210',
      customerSegment: 'ENTERPRISE',
      paymentMethod: 'UPI',
      gatewayCode: 'ICICI_UPI',
      status: 'FAILED',
      errorCode: 'GATEWAY_TIMEOUT_504',
      createdAt: new Date().toISOString(),
    };
    ledger.addTransaction(tx);

    const finOpsCase: FinOpsCase = {
      id: 'case_dispatch_001',
      caseNumber: 'CASE-DISP-001',
      transactionId: tx.id,
      merchantId: 'MERCHANT_DEFAULT',
      status: 'RECOVERING',
      amountAtRiskCents: 500000,
      recoveredAmountCents: 0,
      reconStatus: 'UNMATCHED_TRANSACTION',
      riskScore: 20,
      riskClassification: 'OPS_SHAPED',
      retryCount: 0,
      maxRetriesAllowed: 3,
      outboundContactCount7d: 0,
      reminderCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    ledger.addCase(finOpsCase);
    return finOpsCase;
  };

  it('1. dispatchInvoice generates PDF invoice and sends via messaging provider', async () => {
    setupCase();
    const tool = tools.find((t) => t.name === 'dispatchInvoice')!;
    expect(tool).toBeDefined();

    const result = await tool.execute({ caseId: 'case_dispatch_001' });
    expect(result.success).toBe(true);
    expect(result.invoiceNumber).toMatch(/^INV-CASE-DISP-001-/);
    expect(['DELIVERED', 'READ']).toContain(result.deliveryStatus);
    expect(result.deliveredAt).toBeDefined();

    // Verify ledger updated
    const updatedCase = ledger.getCase('case_dispatch_001');
    expect(updatedCase?.outboundContactCount7d).toBe(1);
    expect(updatedCase?.reminderSequenceStage).toBe('INVOICE_SENT');
    expect(updatedCase?.deliveredAt).toBeDefined();

    // Verify audit log
    const auditLogs = audit.getTrailForCase('case_dispatch_001');
    const invoiceLog = auditLogs.find((l) => l.action === 'DISPATCH_INVOICE_SUCCESS');
    expect(invoiceLog).toBeDefined();
    expect(invoiceLog?.policyEvaluation?.passed).toBe(true);
  });

  it('2. dispatchReminder succeeds and transitions sequence stage to REMINDER_1', async () => {
    setupCase({
      reminderSequenceStage: 'INVOICE_SENT',
      outboundContactCount7d: 1,
      // 25 hours ago to satisfy cooldown
      lastActionAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    });

    const tool = tools.find((t) => t.name === 'dispatchReminder')!;
    const result = await tool.execute({ caseId: 'case_dispatch_001', sequenceNumber: 1 });

    expect(result.success).toBe(true);
    expect(result.sequenceNumber).toBe(1);

    const updatedCase = ledger.getCase('case_dispatch_001');
    expect(updatedCase?.reminderCount).toBe(1);
    expect(updatedCase?.reminderSequenceStage).toBe('REMINDER_1');
    expect(updatedCase?.outboundContactCount7d).toBe(2);
  });

  it('3. policy engine strictly blocks dispatch when weekly contact cap is exceeded', async () => {
    // 3 contacts already sent this week (cap = 3)
    setupCase({
      outboundContactCount7d: 3,
      lastActionAt: new Date(Date.now() - 30 * 3600 * 1000).toISOString(),
    });

    const tool = tools.find((t) => t.name === 'dispatchReminder')!;
    const result = await tool.execute({ caseId: 'case_dispatch_001', sequenceNumber: 2 });

    expect(result.success).toBe(false);
    expect(result.blockedByPolicy).toBe(true);
    expect(result.violations[0]).toContain('Weekly outbound contact cap');

    // Contact count should not increment on block
    const updatedCase = ledger.getCase('case_dispatch_001');
    expect(updatedCase?.outboundContactCount7d).toBe(3);

    // Audit log should record blocked attempt
    const auditLogs = audit.getTrailForCase('case_dispatch_001');
    const blockedLog = auditLogs.find((l) => l.action.includes('BLOCKED'));
    expect(blockedLog).toBeDefined();
    expect(blockedLog?.policyEvaluation?.passed).toBe(false);
  });

  it('4. policy engine blocks reminder when reminder cooldown interval is violated', async () => {
    // Only 2 hours elapsed since last contact (required: 24h)
    setupCase({
      outboundContactCount7d: 1,
      lastActionAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    });

    const tool = tools.find((t) => t.name === 'dispatchReminder')!;
    const result = await tool.execute({ caseId: 'case_dispatch_001', sequenceNumber: 1 });

    expect(result.success).toBe(false);
    expect(result.blockedByPolicy).toBe(true);
    expect(result.violations[0]).toContain('Reminder interval cooldown violation');
  });

  it('5. dispatchNegotiationOffer dispatches bounded offer within merchant discount limits', async () => {
    setupCase({
      outboundContactCount7d: 1,
    });

    const tool = tools.find((t) => t.name === 'dispatchNegotiationOffer')!;
    const result = await tool.execute({
      caseId: 'case_dispatch_001',
      offer: {
        discountBps: 800, // 8% discount (within 10% policy cap)
        expiryHours: 48,
      },
    });

    expect(result.success).toBe(true);
    expect(result.discountBpsApplied).toBe(800);
    expect(result.settlementAmountCents).toBe(460000); // ₹5,000 - 8% = ₹4,600

    const updatedCase = ledger.getCase('case_dispatch_001');
    expect(updatedCase?.negotiation?.status).toBe('SETTLEMENT_AGREED');
    expect(updatedCase?.respondedAt).toBeDefined();
  });
});
