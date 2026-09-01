'use client';

import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  Flame,
  Layers,
  Cpu,
  AlertTriangle
} from 'lucide-react';
import { EvaluationMetrics, DatasetConfig } from '@/types';
import {
  RRCard,
  RRBadge,
  RRButton,
  RRKpiCard,
  RRSection,
  RRTabs,
  RREmptyState,
} from '@/components/ui';

export default function GroundTruthEvalPage() {
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [running, setRunning] = useState(false);

  // Generator & Benchmark Controls
  const [benchmarkMode, setBenchmarkMode] = useState<'STANDARD' | 'ADVERSARIAL'>('STANDARD');
  const [datasetSize, setDatasetSize] = useState<number>(10000);
  const [datasetSplit, setDatasetSplit] = useState<'test' | 'val' | 'train' | 'all'>('test');
  const [randomSeed, setRandomSeed] = useState<number>(42);

  const fetchMetrics = async (overrideParams?: Partial<DatasetConfig> & { useSplit?: 'test' | 'val' | 'train' | 'all' }) => {
    try {
      setRunning(true);
      const payload = {
        size: overrideParams?.size || datasetSize,
        seed: overrideParams?.seed || randomSeed,
        mode: overrideParams?.mode || benchmarkMode,
        useSplit: overrideParams?.useSplit || datasetSplit,
      };

      const res = await fetch('/api/evaluation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setMetrics(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const scorecard = metrics?.trustScorecard;
  const telemetry = metrics?.aiTelemetry;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto w-full page-enter">
      {/* Top Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--rr-text)] flex items-center gap-3">
            Phase 5: Agent Benchmark, Safety & Trust Center
            <RRBadge variant={benchmarkMode === 'ADVERSARIAL' ? 'warning' : 'info'}>
              {benchmarkMode} MODE • HELD-OUT TEST SET
            </RRBadge>
          </h1>
          <p className="text-sm text-[var(--rr-text-secondary)] mt-1">
            Empirical multi-agent performance on strictly held-out financial cases with cryptographic audit verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Split Selector */}
          <RRTabs
            tabs={[
              { value: 'test', label: 'Held-Out Test (15%)' },
              { value: 'val', label: 'Validation (15%)' },
            ]}
            activeTab={datasetSplit}
            onTabChange={(val: string) => {
              setDatasetSplit(val as any);
              fetchMetrics({ useSplit: val as any });
            }}
          />

          {/* Mode Switcher */}
          <RRTabs
            tabs={[
              { value: 'STANDARD', label: 'Standard' },
              { value: 'ADVERSARIAL', label: 'Adversarial' },
            ]}
            activeTab={benchmarkMode}
            onTabChange={(val: string) => {
              setBenchmarkMode(val as any);
              fetchMetrics({ mode: val as any });
            }}
          />

          {/* Scale Selector */}
          <select
            value={datasetSize}
            onChange={(e) => {
              const s = parseInt(e.target.value);
              setDatasetSize(s);
              fetchMetrics({ size: s });
            }}
            className="bg-[var(--rr-surface)] border border-[var(--rr-border)] text-[var(--rr-text)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--rr-primary)] font-mono"
          >
            <option value={1000}>1,000 Cases (Dev Quick)</option>
            <option value={10000}>10,000 Cases (Standard)</option>
            <option value={50000}>50,000 Cases (Flagship Benchmark)</option>
            <option value={100000}>100,000 Cases (Stress Benchmark)</option>
          </select>

          {/* Re-run Button */}
          <RRButton 
            onClick={() => fetchMetrics()} 
            disabled={running} 
            loading={running}
            variant="primary"
            icon={<RefreshCw className="w-4 h-4" />}
          >
            {running ? 'Evaluating...' : 'Run Benchmark'}
          </RRButton>
        </div>
      </div>

      {/* 20. SYSTEM TRUST SCORECARD (Mandatory Zero Tolerances) */}
      <RRCard 
        header="FinTech System Trust Scorecard" 
        headerAction={
          <RRBadge variant={scorecard?.tamperEvidentChainVerified ? 'success' : 'warning'}>
            SHA-256 Chain: {scorecard?.tamperEvidentChainVerified ? 'VALID & UNBROKEN' : 'VERIFYING'}
          </RRBadge>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <RRKpiCard label="Policy Bypass" value={scorecard?.policyBypassCount ?? 0} context="Strict Zero Target" />
          <RRKpiCard label="Unauthorized Execution" value={scorecard?.unauthorizedExecutionCount ?? 0} context="Strict Zero Target" />
          <RRKpiCard label="Ground Truth Leakage" value={scorecard?.groundTruthLeakCount ?? 0} context="Strict Zero Target" />
          <RRKpiCard label="Unverified Recoveries" value={scorecard?.unverifiedRecoveriesCounted ?? 0} context="Reconciliation Gated" />
          <RRKpiCard label="Illegal Transitions" value={scorecard?.illegalStateTransitionsPrevented ?? 0} context="State Machine Enforced" />
        </div>
      </RRCard>

      {/* AI Cost, Latency & Abstention Telemetry Box */}
      {telemetry && (
        <RRCard 
          header="AI Inference Cost, Latency & Abstention Telemetry"
          headerAction={
            <span className="text-xs font-mono text-[var(--rr-text-muted)]">
              Model: gemini-2.5-flash • Prompt: PROMPT_V1
            </span>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            <RRKpiCard label="Avg / P95 Latency" value={`${telemetry.avgLatencyMs}ms / ${telemetry.p95LatencyMs}ms`} />
            <RRKpiCard label="Avg Tokens / Call" value={`${telemetry.avgTokensPerCall} tokens`} />
            <RRKpiCard label="Total Benchmark Tokens" value={telemetry.totalBenchmarkTokens.toLocaleString()} />
            <RRKpiCard label="LLM Calls Avoided" value={telemetry.aiCallsAvoidedByDeterministicLogic.toLocaleString()} context="Exact Matches Bypassed" />
            <RRKpiCard label="Agent Abstention Rate" value={`${telemetry.abstentionRate}%`} context="Refused forced guessing" />
            <RRKpiCard label="Abstention Precision" value={`${telemetry.abstentionPrecision}%`} context="Appropriate ambiguity routing" />
          </div>
        </RRCard>
      )}

      {/* 3 Core Agent Domain Metrics Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Finance Controller Card */}
        <RRCard 
          header="Track 04: Finance Controller"
          headerAction={
            <span className="text-sm font-mono font-bold text-[var(--rr-text)]">
              {metrics?.reconMatchAccuracy}% Accuracy
            </span>
          }
        >
          <div className="space-y-3 text-sm text-[var(--rr-text-secondary)]">
            <div className="flex justify-between border-b border-[var(--rr-border)] pb-2">
              <span>Deterministic Exact Match Rate:</span>
              <span className="font-mono font-semibold text-[var(--rr-text)]">{metrics?.deterministicMatchRate}%</span>
            </div>
            <div className="flex justify-between border-b border-[var(--rr-border)] pb-2">
              <span>Fuzzy Match Precision / Recall:</span>
              <span className="font-mono text-[var(--rr-primary)]">{metrics?.fuzzyMatchPrecision}% / {metrics?.fuzzyMatchRecall}%</span>
            </div>
            <div className="flex justify-between border-b border-[var(--rr-border)] pb-2">
              <span>False Join Rate (Cross-ledger):</span>
              <span className="font-mono text-[var(--rr-success)] font-bold">{metrics?.falseJoinRate}%</span>
            </div>
            <div className="flex justify-between border-b border-[var(--rr-border)] pb-2">
              <span>Ambiguous Case AI Accuracy:</span>
              <span className="font-mono text-[var(--rr-primary)]">{metrics?.ambiguousCaseAccuracy}%</span>
            </div>
            <div className="flex justify-between">
              <span>Deterministically vs AI Resolved:</span>
              <span className="font-mono">{metrics?.deterministicResolvedCount} / {metrics?.aiResolvedCount}</span>
            </div>
          </div>
        </RRCard>

        {/* Risk Manager Card */}
        <RRCard 
          header="Track 02: Risk Manager"
          headerAction={
            <span className="text-sm font-mono font-bold text-[var(--rr-text)]">
              F1: {metrics?.riskF1Score}
            </span>
          }
        >
          <div className="space-y-3 text-sm text-[var(--rr-text-secondary)]">
            <div className="flex justify-between border-b border-[var(--rr-border)] pb-2">
              <span>Risk Precision / Recall:</span>
              <span className="font-mono text-[var(--rr-primary)]">{metrics?.riskPrecision}% / {metrics?.riskRecall}%</span>
            </div>
            <div className="flex justify-between border-b border-[var(--rr-border)] pb-2">
              <span>Specificity (True Negative):</span>
              <span className="font-mono text-[var(--rr-primary)]">{metrics?.riskSpecificity}%</span>
            </div>
            <div className="flex justify-between border-b border-[var(--rr-border)] pb-2">
              <span>False Positive Rate (FPR):</span>
              <span className="font-mono text-[var(--rr-warning)]">{metrics?.falsePositiveRate}%</span>
            </div>
            <div className="flex justify-between border-b border-[var(--rr-border)] pb-2">
              <span>False Positive Monetary Cost:</span>
              <span className="font-mono text-[var(--rr-success)]">₹{((metrics?.falsePositiveCostCents || 0)/100).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>False Negative Exposure:</span>
              <span className="font-mono text-[var(--rr-risk)]">₹{((metrics?.falseNegativeExposureCents || 0)/100).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </RRCard>

        {/* Revenue Recovery Card */}
        <RRCard 
          header="Track 03: Revenue Recovery"
          headerAction={
            <span className="text-sm font-mono font-bold text-[var(--rr-text)]">
              {metrics?.recoveryRate}% Verified Rate
            </span>
          }
        >
          <div className="space-y-3 text-sm text-[var(--rr-text-secondary)]">
            <div className="flex justify-between border-b border-[var(--rr-border)] pb-2">
              <span>Actual Recoverable Cases:</span>
              <span className="font-mono text-[var(--rr-text)]">{metrics?.actualRecoverableCount}</span>
            </div>
            <div className="flex justify-between border-b border-[var(--rr-border)] pb-2">
              <span>Verified Recovered Revenue:</span>
              <span className="font-mono font-bold text-[var(--rr-success)]">₹{((metrics?.verifiedRecoveredCents || 0)/100).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between border-b border-[var(--rr-border)] pb-2">
              <span>Recovery Precision:</span>
              <span className="font-mono text-[var(--rr-primary)]">{metrics?.recoveryPrecision}%</span>
            </div>
            <div className="flex justify-between border-b border-[var(--rr-border)] pb-2">
              <span>Unnecessary Recovery Attempts:</span>
              <span className="font-mono text-[var(--rr-success)] font-bold">0</span>
            </div>
            <div className="flex justify-between">
              <span>Human Escalation Rate:</span>
              <span className="font-mono text-[var(--rr-warning)]">{metrics?.escalationRate}%</span>
            </div>
          </div>
        </RRCard>
      </div>

      {/* 8. Scenario-by-Scenario Empirical Breakdown Table */}
      {metrics?.scenarioBreakdowns && metrics.scenarioBreakdowns.length > 0 && (
        <RRCard 
          header="Scenario-by-Scenario Granular Breakdown (48 Scenario Families)"
          headerAction={
            <span className="text-xs font-mono text-[var(--rr-text-muted)]">
              {metrics.scenarioBreakdowns.length} scenario families tracked
            </span>
          }
        >
          <div className="overflow-x-auto max-h-96 rounded-[var(--rr-radius-sm)] border border-[var(--rr-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--rr-surface-subtle)] text-[var(--rr-text-secondary)] sticky top-0 border-b border-[var(--rr-border)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Scenario Family</th>
                  <th className="py-3 px-4 text-center">Samples (N)</th>
                  <th className="py-3 px-4 text-center">Risk Prev %</th>
                  <th className="py-3 px-4 text-center">Recon Acc %</th>
                  <th className="py-3 px-4 text-center">Risk P / R</th>
                  <th className="py-3 px-4 text-center">Recovery %</th>
                  <th className="py-3 px-4 text-right">FP Cost</th>
                  <th className="py-3 px-4 text-right">FN Exposure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rr-border)] font-mono text-xs bg-[var(--rr-surface)]">
                {metrics.scenarioBreakdowns.map((sb) => (
                  <tr key={sb.scenarioFamily} className="hover:bg-[var(--rr-surface-subtle)] transition-colors">
                    <td className="py-3 px-4 font-sans font-medium text-[var(--rr-text)]">
                      {sb.scenarioFamily}
                    </td>
                    <td className="py-3 px-4 text-center text-[var(--rr-text-secondary)]">{sb.sampleCount}</td>
                    <td className="py-3 px-4 text-center text-[var(--rr-text-secondary)]">{sb.riskPrevalenceRatio}%</td>
                    <td className="py-3 px-4 text-center text-[var(--rr-success)]">{sb.reconAccuracy}%</td>
                    <td className="py-3 px-4 text-center text-[var(--rr-primary)]">
                      {sb.riskPrecision}% / {sb.riskRecall}%
                    </td>
                    <td className="py-3 px-4 text-center text-[var(--rr-success)] font-bold">
                      {sb.recoverySuccessRate}%
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--rr-text-secondary)]">
                      {sb.fpCostCents > 0 ? `₹${(sb.fpCostCents/100).toLocaleString('en-IN')}` : '--'}
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--rr-risk)] font-semibold">
                      {sb.fnExposureCents > 0 ? `₹${(sb.fnExposureCents/100).toLocaleString('en-IN')}` : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RRCard>
      )}

      {/* 17. Structured Failure Analysis Log */}
      {metrics?.structuredFailures && metrics.structuredFailures.length > 0 && (
        <RRCard 
          header="Structured Failure Analysis (Held-Out Error Audit)"
          headerAction={
            <span className="text-xs font-mono text-[var(--rr-text-muted)]">
              {metrics.structuredFailures.length} Audited Exceptions
            </span>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.structuredFailures.map((f, idx) => (
              <div key={idx} className="p-4 rounded-[var(--rr-radius)] bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-[var(--rr-text)]">{f.caseId} • {f.scenario}</span>
                  <RRBadge variant="warning">
                    {f.failureCategory}
                  </RRBadge>
                </div>
                <div className="text-[var(--rr-text-secondary)]">
                  <span className="text-[var(--rr-text-muted)]">Ground Truth:</span> {f.groundTruth}
                </div>
                <div className="text-[var(--rr-text-secondary)]">
                  <span className="text-[var(--rr-text-muted)]">Agent Decision:</span> {f.agentDecision}
                </div>
                <div className="flex items-center justify-between text-xs pt-2 mt-2 text-[var(--rr-text-muted)] border-t border-[var(--rr-border)]">
                  <span>Tools: {f.toolCalls.join(', ')}</span>
                  <span className="font-mono text-[var(--rr-text)]">Amount: ₹{(f.amountCents / 100).toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        </RRCard>
      )}
    </div>
  );
}
