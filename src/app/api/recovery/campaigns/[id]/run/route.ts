import { NextResponse } from 'next/server';
import { RecoverySupervisorAgent } from '@/agents/recovery-supervisor';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supervisor = RecoverySupervisorAgent.getInstance();
    const result = await supervisor.runCampaign(id);

    return NextResponse.json({
      success: true,
      campaign: result.campaign,
      executedCasesCount: result.executedCasesCount,
      results: result.results,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
