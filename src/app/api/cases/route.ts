import { NextResponse } from 'next/server';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { FinOpsOrchestrator } from '@/agents/orchestrator';
import { DatasetGenerator } from '@/data/synthetic/dataset-generator';
import { GroundTruthIsolation } from '@/core/evaluation/ground-truth-isolation';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    const ledger = LedgerStore.getInstance();
    let cases = ledger.getAllCases();

    // Auto-seed initial batch if ledger is currently empty
    if (cases.length === 0) {
      const dataset = DatasetGenerator.generateDataset({ size: 80, seed: 101, mode: 'STANDARD' });
      const orchestrator = new FinOpsOrchestrator();

      const scenarios = dataset.cases.map((c) => {
        const pub = GroundTruthIsolation.extractPublicData(c);
        return {
          id: c.id,
          name: `${c.hiddenGroundTruth.scenarioType} Case`,
          scenarioType: c.hiddenGroundTruth.scenarioType,
          description: `Synthetic case for ${c.hiddenGroundTruth.scenarioType}`,
          expectedReconStatus: c.hiddenGroundTruth.expectedReconStatus,
          expectedRiskClassification: c.hiddenGroundTruth.expectedRiskClassification,
          expectedSafeToRecover: c.hiddenGroundTruth.expectedSafeToRecover,
          expectedOptimalAction: c.hiddenGroundTruth.expectedOptimalAction,
          expectedRecoverableCents: c.hiddenGroundTruth.expectedRecoverableCents,
          transaction: pub.transaction,
          settlement: pub.settlement,
          riskSignals: pub.signals,
        };
      });

      await orchestrator.runFullPipeline(scenarios);
      cases = ledger.getAllCases();
    }

    if (statusFilter && statusFilter !== 'ALL') {
      cases = ledger.getCasesByStatus(statusFilter as any);
    }

    return NextResponse.json({
      success: true,
      data: cases,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch cases' },
      { status: 500 }
    );
  }
}
