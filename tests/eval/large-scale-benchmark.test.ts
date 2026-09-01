import { describe, it, expect } from 'vitest';
import { DatasetGenerator } from '../../src/data/synthetic/dataset-generator';
import { BenchmarkRunner } from '../../src/core/evaluation/benchmark';

describe('Phase 2 Large-Scale Synthetic Financial World & Benchmark Evaluation', () => {
  it('should generate exactly reproducible datasets with the same seed (Seed 42)', () => {
    const ds1 = DatasetGenerator.generateDataset({ size: 200, seed: 42 });
    const ds2 = DatasetGenerator.generateDataset({ size: 200, seed: 42 });

    expect(ds1.cases.length).toBe(200);
    expect(ds2.cases.length).toBe(200);
    expect(ds1.cases[0].publicData.transaction.id).toBe(ds2.cases[0].publicData.transaction.id);
    expect(ds1.cases[0].publicData.transaction.amountCents).toBe(ds2.cases[0].publicData.transaction.amountCents);
    expect(ds1.cases[50].publicData.transaction.externalRef).toBe(ds2.cases[50].publicData.transaction.externalRef);
  });

  it('should generate different datasets with different seeds (Seed 42 vs Seed 123)', () => {
    const ds1 = DatasetGenerator.generateDataset({ size: 100, seed: 42 });
    const ds2 = DatasetGenerator.generateDataset({ size: 100, seed: 123 });

    expect(ds1.cases[0].publicData.transaction.amountCents).not.toBe(ds2.cases[0].publicData.transaction.amountCents);
  });

  it('should respect requested scale and class imbalance (e.g. 10,000 cases)', () => {
    const ds = DatasetGenerator.generateDataset({ size: 10000, seed: 42 });

    expect(ds.cases.length).toBe(10000);
    expect(ds.profile.totalRecords).toBe(10000);

    // Verify class imbalance: Normal should be the majority (~40%)
    const normalPct = ds.profile.classDistribution.normalSettled.percentage;
    expect(normalPct).toBeGreaterThanOrEqual(35);
    expect(normalPct).toBeLessThanOrEqual(55);

    // Verify fraud is a controlled minority (~1-6%)
    const fraudPct = ds.profile.classDistribution.riskAndFraud.percentage;
    expect(fraudPct).toBeGreaterThanOrEqual(1);
    expect(fraudPct).toBeLessThanOrEqual(20);
  });

  it('should generate distinct outliers (Legitimate, Risk, and Operational)', () => {
    const ds = DatasetGenerator.generateDataset({ size: 5000, seed: 42 });
    const outliers = ds.profile.outlierStats;

    expect(outliers.totalOutliers).toBeGreaterThan(0);
    expect(outliers.legitimateOutliers).toBeGreaterThan(0);
    expect(outliers.riskOutliers).toBeGreaterThan(0);
  });

  it('should generate coordinated fraud rings and multi-account graphs', () => {
    const ds = DatasetGenerator.generateDataset({ size: 5000, seed: 42 });
    const rings = ds.profile.fraudRingStats;

    expect(rings.totalRings).toBeGreaterThan(0);
    expect(rings.largestRingSize).toBeGreaterThanOrEqual(3);
    expect(rings.totalRingMembers).toBeGreaterThan(0);
  });

  it('should run standard benchmark and maintain strict zero policy bypasses', async () => {
    const metrics = await BenchmarkRunner.runBenchmark({ size: 1000, seed: 42, mode: 'STANDARD' });

    expect(metrics.totalScenarios).toBe(1000);
    expect(metrics.policyViolationBypassCount).toBe(0); // STRICT ZERO TOLERANCE
    expect(metrics.riskPrecision).toBeGreaterThanOrEqual(60);
    expect(metrics.riskRecall).toBeGreaterThanOrEqual(70);
    expect(metrics.baselineComparison).toBeDefined();
    expect(metrics.baselineComparison?.sentinelRiskF1).toBeGreaterThanOrEqual(metrics.baselineComparison?.baselineRiskF1 || 0);
  });

  it('should support adversarial benchmark mode with elevated challenge vectors', async () => {
    const metrics = await BenchmarkRunner.runBenchmark({ size: 1000, seed: 1337, mode: 'ADVERSARIAL' });

    expect(metrics.benchmarkMode).toBe('ADVERSARIAL');
    expect(metrics.policyViolationBypassCount).toBe(0); // Still 0 bypasses
    expect(metrics.confusionMatrix.truePositives).toBeGreaterThan(0);
  });
});
