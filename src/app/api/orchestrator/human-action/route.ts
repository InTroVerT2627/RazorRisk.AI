import { NextResponse } from 'next/server';
import { FinOpsOrchestrator } from '@/agents/orchestrator';

export async function POST(req: Request) {
  try {
    const { caseId, action, humanOperatorId = 'FINOPS_LEAD_01', notes = '' } = await req.json();

    if (!caseId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing caseId or action' },
        { status: 400 }
      );
    }

    const orchestrator = new FinOpsOrchestrator();
    const result = await orchestrator.handleHumanOverride(caseId, action, humanOperatorId, notes);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Human action override failed' },
      { status: 500 }
    );
  }
}
