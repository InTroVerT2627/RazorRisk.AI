import { NextResponse } from 'next/server';
import { BenchmarkRunner } from '@/core/evaluation/benchmark';
import { DatasetConfig } from '@/types';

export async function POST(req: Request) {
  try {
    const body: Partial<DatasetConfig> = await req.json().catch(() => ({}));
    const metrics = await BenchmarkRunner.runBenchmark(body);
    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Evaluation benchmark failed' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') === 'ADVERSARIAL' ? 'ADVERSARIAL' : 'STANDARD';
    const size = parseInt(searchParams.get('size') || '100'); // Fast sample for initial GET
    const metrics = await BenchmarkRunner.runBenchmark({ mode, size });
    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch benchmark metrics' },
      { status: 500 }
    );
  }
}
