import { NextResponse } from 'next/server';
import { AuditLogger } from '@/core/audit/audit-logger';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get('caseId') || undefined;

    const audit = AuditLogger.getInstance();
    const entries = audit.getEntries(caseId);
    const integrity = audit.verifyChainIntegrity();

    return NextResponse.json({
      success: true,
      data: {
        totalEntries: entries.length,
        integrity,
        entries: entries.reverse(), // most recent first
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch audit log' },
      { status: 500 }
    );
  }
}
