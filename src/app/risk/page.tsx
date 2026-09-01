'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, 
  AlertOctagon, 
  CheckCircle2, 
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { FinOpsCase, EvaluationMetrics } from '@/types';
import {
  RRCard,
  RRBadge,
  RRButton,
  RRKpiCard,
  RRSection,
  RRFilterBar,
  RREmptyState
} from '@/components/ui';

export default function RiskRadarPage() {
  const [cases, setCases] = useState<FinOpsCase[]>([]);
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeQueue, setActiveQueue] = useState<'ALL' | 'CRITICAL' | 'HUMAN_REVIEW' | 'SAFE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('ALL');

  const fetchRiskData = async () => {
    try {
      setLoading(true);
      const [casesRes, evalRes] = await Promise.all([
        fetch('/api/cases'),
        fetch('/api/evaluation/run'),
      ]);
      const casesJson = await casesRes.json();
      const evalJson = await evalRes.json();

      if (casesJson.success) setCases(casesJson.data);
      if (evalJson.success) setMetrics(evalJson.data);
    } catch (e) {
      console.error('Failed to load risk console data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
  }, []);

  const { criticalCases, humanReviewCases, safeCases } = useMemo(() => {
    const critical = cases.filter((c) => (c.riskScore ?? 0) >= 70 || c.status === 'RISK_BLOCKED');
    const human = cases.filter((c) => ((c.riskScore ?? 0) >= 45 && (c.riskScore ?? 0) < 70) || c.status === 'HUMAN_REVIEW_REQUIRED');
    const safe = cases.filter((c) => (c.riskScore ?? 0) < 45 && c.status !== 'RISK_BLOCKED');
    return { criticalCases: critical, humanReviewCases: human, safeCases: safe };
  }, [cases]);

  // Filtered cases for list
  const filteredCases = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return cases.filter((c) => {
      const score = c.riskScore ?? 0;
      let matchesQueue = true;
      if (activeQueue === 'CRITICAL') matchesQueue = score >= 70 || c.status === 'RISK_BLOCKED';
      else if (activeQueue === 'HUMAN_REVIEW') matchesQueue = (score >= 45 && score < 70) || c.status === 'HUMAN_REVIEW_REQUIRED';
      else if (activeQueue === 'SAFE') matchesQueue = score < 45 && c.status !== 'RISK_BLOCKED';

      if (!matchesQueue) return false;

      const matchesClass = classificationFilter === 'ALL' || c.riskClassification === classificationFilter;
      if (!matchesClass) return false;

      if (!q) return true;

      return (
        c.caseNumber.toLowerCase().includes(q) ||
        c.reconStatus.toLowerCase().includes(q) ||
        (c.scenarioType && c.scenarioType.toLowerCase().includes(q))
      );
    });
  }, [cases, activeQueue, classificationFilter, searchQuery]);

  return (
    <div className="page-enter p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Top Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--rr-text)] flex items-center gap-3">
            Risk Manager & Anomaly Radar
            <RRBadge variant="info">Track 02 Core</RRBadge>
          </h1>
          <p className="text-sm text-[var(--rr-text-secondary)] mt-1">
            Multi-signal triage distinguishing operational glitches (`OPS_SHAPED`) from risk/fraud vectors (`RISK_SHAPED`).
          </p>
        </div>

        <RRButton
          onClick={fetchRiskData}
          loading={loading}
          icon={<RefreshCw className="w-4 h-4" />}
          variant="secondary"
        >
          Refresh Triage State
        </RRButton>
      </div>

      {/* 3-Tier Queue Overview Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Critical Risk / Hard Blocked */}
        <button
          onClick={() => setActiveQueue(activeQueue === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
          className={`p-5 rounded-[var(--rr-radius-xl)] border text-left transition-all space-y-2 border-l-4 ${
            activeQueue === 'CRITICAL'
              ? 'bg-[var(--rr-risk-soft)] border-[var(--rr-risk)] shadow-[var(--rr-shadow-md)]'
              : 'bg-[var(--rr-surface)] border-[var(--rr-border)] border-l-[var(--rr-risk)] hover:bg-[var(--rr-surface-subtle)] hover:shadow-[var(--rr-shadow-sm)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--rr-risk)] font-semibold text-xs uppercase tracking-wider">
              <AlertOctagon className="w-4 h-4" />
              <span>Critical Risk (&gt;=70)</span>
            </div>
            <span className="px-2 py-0.5 rounded-[var(--rr-radius-sm)] text-xs font-mono font-bold bg-[var(--rr-risk-soft)] text-[var(--rr-risk)] border border-[var(--rr-risk)]/20">
              {criticalCases.length}
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-[var(--rr-text)]">
            ₹{(criticalCases.reduce((s, c) => s + c.amountAtRiskCents, 0) / 100).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-[var(--rr-text-muted)]">
            Coordinated velocity attacks and card testing blocked by Policy Gate.
          </p>
        </button>

        {/* Human Review Queue */}
        <button
          onClick={() => setActiveQueue(activeQueue === 'HUMAN_REVIEW' ? 'ALL' : 'HUMAN_REVIEW')}
          className={`p-5 rounded-[var(--rr-radius-xl)] border text-left transition-all space-y-2 border-l-4 ${
            activeQueue === 'HUMAN_REVIEW'
              ? 'bg-[var(--rr-warning-soft)] border-[var(--rr-warning)] shadow-[var(--rr-shadow-md)]'
              : 'bg-[var(--rr-surface)] border-[var(--rr-border)] border-l-[var(--rr-warning)] hover:bg-[var(--rr-surface-subtle)] hover:shadow-[var(--rr-shadow-sm)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--rr-warning)] font-semibold text-xs uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              <span>Human Review (45-70)</span>
            </div>
            <span className="px-2 py-0.5 rounded-[var(--rr-radius-sm)] text-xs font-mono font-bold bg-[var(--rr-warning-soft)] text-[var(--rr-warning)] border border-[var(--rr-warning)]/20">
              {humanReviewCases.length}
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-[var(--rr-text)]">
            ₹{(humanReviewCases.reduce((s, c) => s + c.amountAtRiskCents, 0) / 100).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-[var(--rr-text-muted)]">
            Borderline risk scores & duplicate transactions awaiting FinOps authorization.
          </p>
        </button>

        {/* Safe Operational Queue */}
        <button
          onClick={() => setActiveQueue(activeQueue === 'SAFE' ? 'ALL' : 'SAFE')}
          className={`p-5 rounded-[var(--rr-radius-xl)] border text-left transition-all space-y-2 border-l-4 ${
            activeQueue === 'SAFE'
              ? 'bg-[var(--rr-success-soft)] border-[var(--rr-success)] shadow-[var(--rr-shadow-md)]'
              : 'bg-[var(--rr-surface)] border-[var(--rr-border)] border-l-[var(--rr-success)] hover:bg-[var(--rr-surface-subtle)] hover:shadow-[var(--rr-shadow-sm)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--rr-success)] font-semibold text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>Operational / Safe (&lt;45)</span>
            </div>
            <span className="px-2 py-0.5 rounded-[var(--rr-radius-sm)] text-xs font-mono font-bold bg-[var(--rr-success-soft)] text-[var(--rr-success)] border border-[var(--rr-success)]/20">
              {safeCases.length}
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-[var(--rr-text)]">
            ₹{(safeCases.reduce((s, c) => s + c.amountAtRiskCents, 0) / 100).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-[var(--rr-text-muted)]">
            Benign network drops and abandoned carts cleared for automated recovery.
          </p>
        </button>
      </div>

      {/* Cross-Track Recovery Triage Values */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <RRCard padding="sm" className="bg-emerald-50/40 border-emerald-200">
          <div className="text-xs text-emerald-700 font-semibold uppercase">Recovery Eligible Value</div>
          <div className="text-xl font-bold font-mono text-emerald-900 mt-1">
            ₹{(cases.filter((c) => c.recoveryEligible || c.recoveryEligibilityStatus === 'ELIGIBLE' || c.status === 'RECOVERY_ELIGIBLE' || c.status === 'OPS_APPROVED').reduce((s, c) => s + c.amountAtRiskCents, 0) / 100).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">
            {cases.filter((c) => c.recoveryEligible || c.recoveryEligibilityStatus === 'ELIGIBLE' || c.status === 'RECOVERY_ELIGIBLE' || c.status === 'OPS_APPROVED').length} cases routed to Recovery
          </div>
        </RRCard>

        <RRCard padding="sm" className="bg-red-50/40 border-red-200">
          <div className="text-xs text-red-700 font-semibold uppercase">Recovery Blocked Value</div>
          <div className="text-xl font-bold font-mono text-red-900 mt-1">
            ₹{(cases.filter((c) => c.status === 'RISK_BLOCKED' || c.recoveryEligibilityStatus === 'BLOCKED').reduce((s, c) => s + c.amountAtRiskCents, 0) / 100).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-red-600 mt-0.5">
            {cases.filter((c) => c.status === 'RISK_BLOCKED' || c.recoveryEligibilityStatus === 'BLOCKED').length} fraud cases isolated
          </div>
        </RRCard>

        <RRCard padding="sm" className="bg-amber-50/40 border-amber-200">
          <div className="text-xs text-amber-700 font-semibold uppercase">Human Review Value</div>
          <div className="text-xl font-bold font-mono text-amber-900 mt-1">
            ₹{(cases.filter((c) => c.status === 'HUMAN_REVIEW_REQUIRED' || c.recoveryEligibilityStatus === 'HUMAN_REVIEW').reduce((s, c) => s + c.amountAtRiskCents, 0) / 100).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-amber-600 mt-0.5">
            {cases.filter((c) => c.status === 'HUMAN_REVIEW_REQUIRED' || c.recoveryEligibilityStatus === 'HUMAN_REVIEW').length} cases awaiting operator
          </div>
        </RRCard>

        <RRCard padding="sm" className="bg-blue-50/40 border-blue-200">
          <div className="text-xs text-blue-700 font-semibold uppercase">Safe Operational Value</div>
          <div className="text-xl font-bold font-mono text-blue-900 mt-1">
            ₹{(cases.filter((c) => (c.riskScore ?? 0) < 45).reduce((s, c) => s + c.amountAtRiskCents, 0) / 100).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-blue-600 mt-0.5">
            {cases.filter((c) => (c.riskScore ?? 0) < 45).length} cases with clean risk
          </div>
        </RRCard>
      </div>

      {/* Risk Analytics Section */}
      {metrics && (
        <RRSection 
          title="Empirical Risk Manager Analytics & Performance" 
          subtitle={`Precision: ${metrics.riskPrecision}% • Recall: ${metrics.riskRecall}% • Specificity: ${metrics.riskSpecificity}%`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <RRKpiCard
              label="Risk F1 Score"
              value={metrics.riskF1Score.toString()}
              context="Harmonic mean of P & R"
            />
            <RRKpiCard
              label="False-Positive Cost"
              value={`₹${(metrics.falsePositiveCostCents / 100).toLocaleString('en-IN')}`}
              context="Lost revenue from false blocks"
            />
            <RRKpiCard
              label="False-Negative Exposure"
              value={`₹${(metrics.falseNegativeExposureCents / 100).toLocaleString('en-IN')}`}
              context="Uncaught fraud exposure"
            />
            <RRKpiCard
              label="False-Positive Rate"
              value={`${metrics.falsePositiveRate}%`}
              context="FP / (TN + FP)"
            />
          </div>
        </RRSection>
      )}

      {/* Filter Controls & Case Table */}
      <div className="space-y-4">
        <RRFilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search risk cases by number, scenario, or anomaly..."
          filters={[
            { label: 'All Classifications', value: 'ALL' },
            { label: 'CRITICAL_FRAUD', value: 'CRITICAL_FRAUD' },
            { label: 'RISK_SHAPED', value: 'RISK_SHAPED' },
            { label: 'BORDERLINE_REVIEW', value: 'BORDERLINE_REVIEW' },
            { label: 'BENIGN_DELAY', value: 'BENIGN_DELAY' },
            { label: 'OPS_SHAPED', value: 'OPS_SHAPED' },
          ]}
          activeFilter={classificationFilter}
          onFilterChange={setClassificationFilter}
        />

        {/* Risk Operational Table */}
        <RRCard 
          padding="none" 
          header={
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-[var(--rr-text)] uppercase tracking-wider">
                Risk Assessment Records ({filteredCases.length})
              </span>
              {activeQueue !== 'ALL' && (
                <button
                  onClick={() => setActiveQueue('ALL')}
                  className="text-xs text-[var(--rr-primary)] font-mono hover:underline"
                >
                  Clear Queue Filter
                </button>
              )}
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs bg-[var(--rr-surface)]">
              <thead className="bg-[var(--rr-surface-subtle)] text-[var(--rr-text-secondary)] border-b border-[var(--rr-border)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Case #</th>
                  <th className="py-3 px-4">Scenario Category</th>
                  <th className="py-3 px-4 text-right">Amount at Risk</th>
                  <th className="py-3 px-4">Risk Score</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">AI Recommendation</th>
                  <th className="py-3 px-4">Current State</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rr-border)] font-mono">
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8">
                      <RREmptyState
                        icon={<ShieldAlert className="w-8 h-8 text-[var(--rr-text-muted)]" />}
                        title="No risk cases found"
                        description="No risk cases match filter criteria."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredCases.slice(0, 20).map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--rr-surface-subtle)] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[var(--rr-primary)]">
                        <Link href={`/cases/${c.id}`} className="hover:underline">
                          {c.caseNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--rr-text-secondary)] font-sans font-medium">
                        {c.scenarioType || 'RISK_TRIAGE'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[var(--rr-text)] text-right">
                        ₹{(c.amountAtRiskCents / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`font-bold ${
                          (c.riskScore ?? 0) >= 70 ? 'text-[var(--rr-risk)]' : (c.riskScore ?? 0) >= 45 ? 'text-[var(--rr-warning)]' : 'text-[var(--rr-success)]'
                        }`}>
                          {c.riskScore ?? 0} / 100
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--rr-text)] font-semibold text-[11px]">
                        {c.riskClassification || 'OPS_SHAPED'}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--rr-text-secondary)] text-[11px] font-sans">
                        {(c.riskScore ?? 0) >= 70 ? 'BLOCK_AND_BLACKLIST' : (c.riskScore ?? 0) >= 45 ? 'REQUIRE_HUMAN_REVIEW' : 'PROCEED_TO_RECOVERY'}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--rr-text-secondary)] text-[11px]">
                        {c.status}
                      </td>
                      <td className="py-3.5 px-4 text-right font-sans">
                        <Link
                          href={`/cases/${c.id}`}
                          className="px-2.5 py-1 rounded-[var(--rr-radius)] bg-[var(--rr-surface)] hover:bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] text-[var(--rr-text)] text-[11px] font-medium inline-flex items-center gap-1 transition-all shadow-[var(--rr-shadow-sm)]"
                        >
                          Inspect <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </RRCard>
      </div>
    </div>
  );
}
