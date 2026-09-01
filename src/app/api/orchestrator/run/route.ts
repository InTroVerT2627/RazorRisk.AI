import { NextResponse } from 'next/server';
import { FinOpsOrchestrator } from '@/agents/orchestrator';
import { DatasetGenerator } from '@/data/synthetic/dataset-generator';
import { GroundTruthIsolation } from '@/core/evaluation/ground-truth-isolation';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const size = body.scenarioCount || body.size || 1000;
    const seed = body.seed || 42;
    const mode = body.mode || 'STANDARD';

    const dataset = DatasetGenerator.generateDataset({ size, seed, mode });
    const orchestrator = new FinOpsOrchestrator();

    // Map to GroundTruthScenario format with ground-truth isolation
    const scenarios = dataset.cases.map((c) => {
      const pub = GroundTruthIsolation.extractPublicData(c);
      GroundTruthIsolation.assertNoGroundTruthLeakage(pub, 'Orchestrator Ingestion Route');

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

    const result = await orchestrator.runFullPipeline(scenarios);

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        profile: dataset.profile,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Orchestration pipeline failed' },
      { status: 500 }
    );
  }
}
