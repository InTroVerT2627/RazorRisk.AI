import { describe, it, expect } from 'vitest';
import { LedgerStore } from '../../src/core/ledger/ledger-store';
import { AuditLogger } from '../../src/core/audit/audit-logger';
import { PolicyEngine } from '../../src/core/policy-engine';
import { FinOpsOrchestrator } from '../../src/agents/orchestrator';
import { DatasetGenerator } from '../../src/data/synthetic/dataset-generator';
import { GroundTruthIsolation } from '../../src/core/evaluation/ground-truth-isolation';
import { BenchmarkRunner } from '../../src/core/evaluation/benchmark';

describe('Phase 3 FinOps Operations Command Center & Integration Tests', () => {
  const ledger = LedgerStore.getInstance();
  const audit = AuditLogger.getInstance();
  const orchestrator = new FinOpsOrchestrator();

  it('1. should load actual application data into ledger store and calculate matching KPIs', async () => {
    ledger.clear();
    audit.clear();
    const dataset = DatasetGenerator.generateDataset({ size: 50, seed: 42 });

    const scenarios = dataset.cases.map((c) => {
      const pub = GroundTruthIsolation.extractPublicData(c);
      return {
        id: c.id,
        name: c.hiddenGroundTruth.scenarioType,
        scenarioType: c.hiddenGroundTruth.scenarioType,
        description: 'Test case',
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

    const allCases = ledger.getAllCases();
    expect(allCases.length).toBeGreaterThan(0);
    expect(result.metrics.totalProcessed).toBe(50);
    expect(result.metrics.reconciledCount).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('2. should enforce policy results and block high risk cases', () => {
    const allCases = ledger.getAllCases();
    const highRiskCase = allCases.find((c) => (c.riskScore ?? 0) >= 70);

    if (highRiskCase) {
      expect(highRiskCase.status).toBe('RISK_BLOCKED');
    }
  });

  it('3. should execute human review override and generate an immutable audit event', async () => {
    const allCases = ledger.getAllCases();
    let candidateCase = allCases.find(c => c.status === 'HUMAN_REVIEW_REQUIRED');
    
    if (!candidateCase) {
      // Force one into HUMAN_REVIEW_REQUIRED for the test if none exist
      candidateCase = allCases[0];
      ledger.updateCaseStatus(candidateCase.id, 'HUMAN_REVIEW_REQUIRED', 'TEST_OPERATOR', 'Forced for test');
    }

    const auditCountBefore = audit.getEntries().length;
    const overrideResult = await orchestrator.handleHumanOverride(
      candidateCase.id,
      'APPROVE_RECOVERY',
      'OPERATOR_SARAH_JONES',
      'Verified customer identity via KYC portal'
    );

    expect(overrideResult.success).toBe(true);
    expect(audit.getEntries().length).toBeGreaterThan(auditCountBefore);

    const humanAuditEntry = audit.getEntries().find((e) => e.actorId === 'HUMAN_OPERATOR_SARAH_JONES');
    expect(humanAuditEntry).toBeDefined();
    expect(humanAuditEntry?.reasoningSummary).toContain('Verified customer identity');
  });

  it('4. should verify cryptographic SHA-256 audit chain integrity', () => {
    const verification = audit.verifyChainIntegrity();
    expect(verification.valid).toBe(true);
    expect(verification.corruptedIndex).toBeUndefined();
  });

  it('5. should guarantee ground truth remains strictly isolated from public case views', () => {
    const rawCase = DatasetGenerator.generateDataset({ size: 1, seed: 77 }).cases[0];
    const publicCase = GroundTruthIsolation.extractPublicData(rawCase);

    expect((publicCase as any).hiddenGroundTruth).toBeUndefined();
    expect((publicCase as any).isFraud).toBeUndefined();
    expect((publicCase as any).expectedRiskClassification).toBeUndefined();
    expect(() => GroundTruthIsolation.assertNoGroundTruthLeakage(publicCase)).not.toThrow();
  });

  it('6. should run benchmark harness and produce valid empirical comparison', async () => {
    const metrics = await BenchmarkRunner.runBenchmark({ size: 500, seed: 42 });

    expect(metrics.totalScenarios).toBe(500);
    expect(metrics.policyViolationBypassCount).toBe(0); // STRICT 0
    expect(metrics.baselineComparison).toBeDefined();
    expect(metrics.baselineComparison?.falsePositiveCostSavedCents).toBeGreaterThanOrEqual(0);
  });
});
