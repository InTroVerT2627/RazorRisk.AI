import { NextResponse } from 'next/server';
import { RecoveryCampaignManager } from '@/core/recovery/campaign-manager';
import { RecoverySupervisorAgent } from '@/agents/recovery-supervisor';

export async function GET() {
  try {
    const campaignManager = RecoveryCampaignManager.getInstance();
    const supervisor = RecoverySupervisorAgent.getInstance();
    const portfolio = supervisor.discoverPortfolio();
    const campaigns = campaignManager.getAllCampaigns();

    return NextResponse.json({
      success: true,
      data: campaigns,
      campaigns,
      portfolio,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const campaignManager = RecoveryCampaignManager.getInstance();
    const campaign = campaignManager.createCampaign({
      name: body.name,
      merchantId: body.merchantId,
      targetSegments: body.targetSegments || ['ENTERPRISE', 'MID_MARKET'],
      minDaysOverdue: body.minDaysOverdue,
      maxDaysOverdue: body.maxDaysOverdue,
      maxRiskScore: body.maxRiskScore,
      maxDiscountBps: body.maxDiscountBps,
      maxContacts: body.maxContacts,
      cooldownHours: body.cooldownHours,
      allowedChannels: body.allowedChannels,
      maxCampaignAmountCents: body.maxCampaignAmountCents,
    });

    return NextResponse.json({
      success: true,
      campaign,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
