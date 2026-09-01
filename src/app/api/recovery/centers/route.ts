import { NextResponse } from 'next/server';
import { OpportunityStore } from '@/core/recovery/opportunity-store';
import { RecoverySupervisorAgent } from '@/agents/recovery-supervisor';

export async function GET(req: Request) {
  try {
    const oppStore = OpportunityStore.getInstance();
    let opps = oppStore.getAllOpportunities();

    if (opps.length === 0) {
      const supervisor = RecoverySupervisorAgent.getInstance();
      supervisor.discoverPortfolio();
      opps = oppStore.getAllOpportunities();
    }

    const summary = oppStore.getCentersSummary();

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch operating centers data' },
      { status: 500 }
    );
  }
}
