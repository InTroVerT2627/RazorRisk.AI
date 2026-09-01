import { NextResponse } from 'next/server';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { AuditLogger } from '@/core/audit/audit-logger';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ledger = LedgerStore.getInstance();
    const audit = AuditLogger.getInstance();

    const finOpsCase = ledger.getCase(id);
    if (!finOpsCase) {
      return NextResponse.json({ success: false, error: 'Case not found' }, { status: 404 });
    }

    const transaction = finOpsCase.transactionId ? ledger.getTransaction(finOpsCase.transactionId) : null;
    const settlement = finOpsCase.settlementId ? ledger.getSettlement(finOpsCase.settlementId) : null;
    const riskAssessments = ledger.getRiskAssessments(id);
    const recoveryActions = ledger.getRecoveryActions(id);
    const auditEntries = audit.getEntries(id);

    return NextResponse.json({
      success: true,
      data: {
        case: finOpsCase,
        transaction,
        settlement,
        riskAssessments,
        recoveryActions,
        auditEntries,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch case details' },
      { status: 500 }
    );
  }
}
