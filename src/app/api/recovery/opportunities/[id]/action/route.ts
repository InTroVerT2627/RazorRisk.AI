import { NextResponse } from 'next/server';
import { OpportunityStore } from '@/core/recovery/opportunity-store';
import { RecoverySupervisorAgent } from '@/agents/recovery-supervisor';
import { AuditLogger } from '@/core/audit/audit-logger';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { RecoveryActionType } from '@/types';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const action = body.action as RecoveryActionType;
    const customerMessage = body.customerMessage as string | undefined;

    const oppStore = OpportunityStore.getInstance();
    const opp = oppStore.getOpportunity(id) || oppStore.getOpportunityByCaseId(id);

    if (!opp) {
      return NextResponse.json({ success: false, error: `Opportunity ${id} not found` }, { status: 404 });
    }

    const supervisor = RecoverySupervisorAgent.getInstance();
    const executionResult = await supervisor.executeCaseRecovery(opp.caseId, {
      forcedAction: action,
      customerMessage,
    });

    AuditLogger.getInstance().record({
      caseId: opp.caseId,
      actorType: 'RECOVERY_SUPERVISOR',
      actorId: 'RECOVERY_OPERATING_CENTER',
      action: 'EXECUTE_OPPORTUNITY_ACTION',
      decision: `Executed action '${action}' on opportunity '${opp.id}' via '${opp.assignedSpecialist}'`,
      stateBefore: { ...opp },
      stateAfter: { ...oppStore.getOpportunity(opp.id) },
      confidence: 0.95,
      reasoningSummary: `Operator/Autonomous action triggered on opportunity: ${action}`,
    });

    const updatedOpp = oppStore.getOpportunity(opp.id);

    return NextResponse.json({
      success: true,
      data: {
        opportunity: updatedOpp,
        executionResult,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute opportunity action' },
      { status: 500 }
    );
  }
}
