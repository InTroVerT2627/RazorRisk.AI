import { NextResponse } from 'next/server';
import { OpportunityStore } from '@/core/recovery/opportunity-store';
import { RecoverySupervisorAgent } from '@/agents/recovery-supervisor';
import { RecoveryQueueStatus, RecoveryPriority, RecoverySourceType } from '@/types';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get('state') as RecoveryQueueStatus | 'ALL' | null;
    const priority = searchParams.get('priority') as RecoveryPriority | 'ALL' | null;
    const source = searchParams.get('source') as RecoverySourceType | 'ALL' | null;
    const search = searchParams.get('search')?.toLowerCase().trim() || '';

    const oppStore = OpportunityStore.getInstance();
    let opps = oppStore.getAllOpportunities();

    // Auto-discover portfolio if empty
    if (opps.length === 0) {
      const supervisor = RecoverySupervisorAgent.getInstance();
      supervisor.discoverPortfolio();
      opps = oppStore.getAllOpportunities();
    }

    if (state && state !== 'ALL') {
      opps = opps.filter((o) => o.recoveryState === state);
    }

    if (priority && priority !== 'ALL') {
      opps = opps.filter((o) => o.priority === priority);
    }

    if (source && source !== 'ALL') {
      opps = opps.filter((o) => o.sourceType === source);
    }

    if (search) {
      opps = opps.filter(
        (o) =>
          o.caseNumber.toLowerCase().includes(search) ||
          o.customerName.toLowerCase().includes(search) ||
          o.customerSegment.toLowerCase().includes(search) ||
          (o.rootCauseReason && o.rootCauseReason.toLowerCase().includes(search)) ||
          o.sourceType.toLowerCase().includes(search) ||
          (o.invoiceId && o.invoiceId.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      success: true,
      data: opps,
      totalCount: opps.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch recovery opportunities' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const oppStore = OpportunityStore.getInstance();
    
    if (body.opportunity) {
      oppStore.addOpportunity(body.opportunity);
      return NextResponse.json({ success: true, data: body.opportunity });
    }

    return NextResponse.json({ success: false, error: 'Invalid opportunity payload' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create opportunity' },
      { status: 500 }
    );
  }
}
