import { NextResponse } from 'next/server';
import { PolicyEngine, DEFAULT_MERCHANT_POLICY } from '@/core/policy-engine';
import { MerchantPolicy } from '@/types';

export async function GET() {
  try {
    const engine = PolicyEngine.getInstance();
    const policy = engine.getPolicy('MERCHANT_DEFAULT');
    return NextResponse.json({
      success: true,
      data: policy,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch policy' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const updates: Partial<MerchantPolicy> = await req.json();
    const engine = PolicyEngine.getInstance();
    const current = engine.getPolicy('MERCHANT_DEFAULT');

    const updated: MerchantPolicy = {
      ...current,
      ...updates,
    };

    engine.setPolicy(updated);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update policy' },
      { status: 500 }
    );
  }
}
