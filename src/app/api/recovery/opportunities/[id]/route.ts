import { NextResponse } from 'next/server';
import { OpportunityStore } from '@/core/recovery/opportunity-store';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const oppStore = OpportunityStore.getInstance();
    const opp = oppStore.getOpportunity(id) || oppStore.getOpportunityByCaseId(id);

    if (!opp) {
      return NextResponse.json({ success: false, error: `Opportunity ${id} not found` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: opp,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch opportunity' },
      { status: 500 }
    );
  }
}
