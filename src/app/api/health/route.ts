import { NextResponse } from 'next/server';
import { HealthCheckService } from '@/core/health/health-check';

export async function GET() {
  try {
    const report = await HealthCheckService.runHealthCheck();
    return NextResponse.json(report, { status: report.status === 'HEALTHY' ? 200 : 503 });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'UNHEALTHY', error: error.message || 'Health check failed' },
      { status: 500 }
    );
  }
}
