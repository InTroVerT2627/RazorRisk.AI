import { describe, it, expect } from 'vitest';
import { BenchmarkRunner } from '../../src/core/evaluation/benchmark';

describe('Ground Truth FinOps Benchmark Evaluation', () => {
  it('should run full closed-loop pipeline across synthetic scenarios and evaluate realistic metrics', async () => {
    const metrics = await BenchmarkRunner.runBenchmark({ size: 100, seed: 42 });

    expect(metrics.totalScenarios).toBe(100);
    expect(metrics.processedCount).toBe(100);
    expect(metrics.reconMatchAccuracy).toBeGreaterThanOrEqual(50);
    expect(metrics.riskPrecision).toBeGreaterThanOrEqual(60);
    expect(metrics.riskRecall).toBeGreaterThanOrEqual(70);
    expect(metrics.verifiedRecoveredCents).toBeGreaterThan(0);
    expect(metrics.policyViolationBypassCount).toBe(0);
  });
});
