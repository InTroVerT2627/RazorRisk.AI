'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertOctagon, 
  Search, 
  FileText,
  DollarSign,
  ChevronRight,
  TrendingUp, 
  RefreshCw,
  FileCheck2,
  AlertTriangle,
  Layers,
  Sparkles,
  SearchIcon
} from 'lucide-react';
import { FinOpsCase, ReconStatus } from '@/types';
import { 
  RRCard, 
  RRBadge, 
  RRButton, 
  RRKpiCard, 
  RRSection, 
  RRFilterBar, 
  RRPagination, 
  RREmptyState 
} from '@/components/ui';

export default function ReconciliationPage() {
  const [cases, setCases] = useState<FinOpsCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const fetchReconciliationData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cases');
      const json = await res.json();
      if (json.success) {
        setCases(json.data);
      }
    } catch (e) {
      console.error('Failed to load reconciliation data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliationData();
  }, []);

  // Compute exact metrics from actual data
  const {
    totalCount,
    exactMatches,
    fuzzyHighMatches,
    fuzzyLowMatches,
    amountMismatches,
    feeMismatches,
    timingDelays,
    duplicateSuspected,
    unmatchedTxs,
    unmatchedSettlements,
    unresolvedExceptions,
    matchRate,
    unresolvedRate,
  } = useMemo(() => {
    const totalCount = cases.length;
    const exactMatches = cases.filter((c) => c.reconStatus === 'EXACT_MATCH' || c.status === 'RECONCILED');
    const fuzzyHighMatches = cases.filter((c) => c.reconStatus === 'FUZZY_MATCH_HIGH');
    const fuzzyLowMatches = cases.filter((c) => c.reconStatus === 'FUZZY_MATCH_LOW');
    const amountMismatches = cases.filter((c) => c.reconStatus === 'AMOUNT_MISMATCH');
    const feeMismatches = cases.filter((c) => c.reconStatus === 'FEE_MISMATCH');
    const timingDelays = cases.filter((c) => c.reconStatus === 'TIMING_DELAY');
    const duplicateSuspected = cases.filter((c) => c.reconStatus === 'DUPLICATE_SUSPECTED');
    const unmatchedTxs = cases.filter((c) => c.reconStatus === 'UNMATCHED_TRANSACTION');
    const unmatchedSettlements = cases.filter((c) => c.reconStatus === 'UNMATCHED_SETTLEMENT');
    const unresolvedExceptions = cases.filter((c) => c.status === 'EXCEPTION_DETECTED' || c.status === 'HUMAN_REVIEW_REQUIRED');

    const matchRate = totalCount > 0 
      ? (((exactMatches.length + fuzzyHighMatches.length) / totalCount) * 100).toFixed(1) 
      : '0.0';
    const unresolvedRate = totalCount > 0 
      ? ((unresolvedExceptions.length / totalCount) * 100).toFixed(1) 
      : '0.0';

    return {
      totalCount,
      exactMatches,
      fuzzyHighMatches,
      fuzzyLowMatches,
      amountMismatches,
      feeMismatches,
      timingDelays,
      duplicateSuspected,
      unmatchedTxs,
      unmatchedSettlements,
      unresolvedExceptions,
      matchRate,
      unresolvedRate,
    };
  }, [cases]);

  // Filtered Table Records
  const filteredCases = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return cases.filter((c) => {
      const matchesStatus = statusFilter === 'ALL' || c.reconStatus === statusFilter;
      const matchesConfidence = (c.confidenceScore ?? 1.0) >= minConfidence;
      if (!matchesStatus || !matchesConfidence) return false;

      if (!q) return true;

      return (
        c.caseNumber.toLowerCase().includes(q) ||
        c.reconStatus.toLowerCase().includes(q) ||
        (c.scenarioType && c.scenarioType.toLowerCase().includes(q)) ||
        c.merchantId.toLowerCase().includes(q)
      );
    });
  }, [cases, searchQuery, statusFilter, minConfidence]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredCases.length / pageSize)), [filteredCases.length, pageSize]);
  const paginatedCases = useMemo(() => filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredCases, currentPage, pageSize]);

  const getReconBadge = (status: ReconStatus) => {
    switch (status) {
      case 'EXACT_MATCH':
        return <RRBadge variant="success">EXACT MATCH</RRBadge>;
      case 'FUZZY_MATCH_HIGH':
        return <RRBadge variant="info">FUZZY HIGH</RRBadge>;
      case 'FUZZY_MATCH_LOW':
        return <RRBadge variant="info">FUZZY LOW</RRBadge>;
      case 'FEE_MISMATCH':
        return <RRBadge variant="warning">FEE NETTED</RRBadge>;
      case 'AMOUNT_MISMATCH':
        return <RRBadge variant="critical">AMOUNT MISMATCH</RRBadge>;
      case 'TIMING_DELAY':
        return <RRBadge variant="warning">TIMING DELAY</RRBadge>;
      case 'DUPLICATE_SUSPECTED':
        return <RRBadge variant="warning">DUPLICATE</RRBadge>;
      case 'CHARGEBACK_SUSPECTED':
        return <RRBadge variant="blocked">CHARGEBACK</RRBadge>;
      default:
        return <RRBadge variant="neutral">{status}</RRBadge>;
    }
  };

  return (
    <div className="page-enter p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--rr-text)] flex items-center gap-3">
            Reconciliation Operations Console
            <RRBadge variant="primary" size="sm">Track 04 Core</RRBadge>
          </h1>
          <p className="text-sm text-[var(--rr-text-secondary)] mt-1">
            Multi-tier exact hash matching, MDR fee deductions, and contextual settlement reconciliation.
          </p>
        </div>

        <RRButton
          onClick={fetchReconciliationData}
          disabled={loading}
          variant="secondary"
          icon={<RefreshCw className={loading ? 'animate-spin' : ''} />}
        >
          Refresh Records
        </RRButton>
      </div>

      {/* Reconciliation Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <RRKpiCard 
          label="Match Rate" 
          value={`${matchRate}%`} 
          context="Exact & high fuzzy joins" 
          trend="up" 
        />
        <RRKpiCard 
          label="Exact Matches" 
          value={exactMatches.length.toString()} 
          context="1:1 UTR & Amount" 
          trend="up" 
        />
        <RRKpiCard 
          label="Fee & Tax Netted" 
          value={feeMismatches.length.toString()} 
          context="MDR + 18% GST" 
          trend="neutral" 
        />
        <RRKpiCard 
          label="Amount Mismatches" 
          value={amountMismatches.length.toString()} 
          context="Rounding/Truncation" 
          trend="down" 
        />
        <RRKpiCard 
          label="Timing Lags" 
          value={timingDelays.length.toString()} 
          context="48h-72h Bank Delays" 
          trend="neutral" 
        />
        <RRKpiCard 
          label="Unresolved Exceptions" 
          value={unresolvedExceptions.length.toString()} 
          context={`Rate: ${unresolvedRate}%`} 
          trend="down" 
        />
      </div>

      {/* Reconciliation Exception Classification Breakdown */}
      <RRCard padding="md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--rr-primary)]" />
            <h2 className="text-xs font-semibold text-[var(--rr-text)] uppercase tracking-wider">
              Reconciliation Exception Classification
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[var(--rr-text-muted)]">
            Resolution profile across matched and discrepant ledger records
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 rounded-[var(--rr-radius)] bg-emerald-50/60 border border-emerald-200">
            <div className="text-[11px] text-emerald-700 font-semibold uppercase">Exact Matches</div>
            <div className="text-xl font-bold text-emerald-900 mt-1">
              {exactMatches.length}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Deterministic 1:1 match</div>
          </div>

          <div className="p-3 rounded-[var(--rr-radius)] bg-blue-50/60 border border-blue-200">
            <div className="text-[11px] text-blue-700 font-semibold uppercase">Fuzzy Joins</div>
            <div className="text-xl font-bold text-blue-900 mt-1">
              {fuzzyHighMatches.length + fuzzyLowMatches.length}
            </div>
            <div className="text-[10px] text-blue-600 mt-0.5">Probabilistic text joins</div>
          </div>

          <div className="p-3 rounded-[var(--rr-radius)] bg-amber-50/60 border border-amber-200">
            <div className="text-[11px] text-amber-700 font-semibold uppercase">Fee Variances</div>
            <div className="text-xl font-bold text-amber-900 mt-1">
              {feeMismatches.length}
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5">MDR netting investigated</div>
          </div>

          <div className="p-3 rounded-[var(--rr-radius)] bg-purple-50/60 border border-purple-200">
            <div className="text-[11px] text-purple-700 font-semibold uppercase">Timing Delays</div>
            <div className="text-xl font-bold text-purple-900 mt-1">
              {timingDelays.length}
            </div>
            <div className="text-[10px] text-purple-600 mt-0.5">48h-72h bank settlement lags</div>
          </div>

          <div className="p-3 rounded-[var(--rr-radius)] bg-slate-100 border border-slate-200">
            <div className="text-[11px] text-slate-700 font-semibold uppercase">Unmatched</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {unmatchedTxs.length + unmatchedSettlements.length}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Pending missing credit</div>
          </div>
        </div>
      </RRCard>

      {/* Filter Bar */}
      <RRFilterBar
        searchValue={searchQuery}
        onSearchChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
        searchPlaceholder="Search by case #, scenario, recon status, or merchant ID..."
        activeFilter={statusFilter}
        onFilterChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
        filters={[
          { value: 'ALL', label: 'All Recon Statuses' },
          { value: 'EXACT_MATCH', label: 'Exact Matches' },
          { value: 'FUZZY_MATCH_HIGH', label: 'Fuzzy Match (High)' },
          { value: 'FEE_MISMATCH', label: 'Fee Netting Discrepancies' },
          { value: 'AMOUNT_MISMATCH', label: 'Amount Mismatches' },
          { value: 'TIMING_DELAY', label: 'Timing Delays' },
          { value: 'DUPLICATE_SUSPECTED', label: 'Duplicate Suspected' },
          { value: 'UNMATCHED_TRANSACTION', label: 'Unmatched Transactions' },
          { value: 'UNMATCHED_SETTLEMENT', label: 'Unmatched Settlements' },
        ]}
      >
        <select
          value={minConfidence}
          onChange={(e) => {
            setMinConfidence(parseFloat(e.target.value));
            setCurrentPage(1);
          }}
          className="bg-[var(--rr-surface)] border border-[var(--rr-border)] text-xs text-[var(--rr-text)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--rr-primary)]"
        >
          <option value={0}>Any Confidence</option>
          <option value={0.8}>Confidence &gt;= 80%</option>
          <option value={0.9}>Confidence &gt;= 90%</option>
          <option value={0.95}>Confidence &gt;= 95%</option>
        </select>
      </RRFilterBar>

      {/* Operational Reconciliation Table */}
      <RRCard className="overflow-hidden" padding="none">
        <div className="p-4 border-b border-[var(--rr-border)] flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[var(--rr-text)] uppercase tracking-wider">
            Reconciliation Ledger Records ({filteredCases.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs bg-[var(--rr-surface)]">
            <thead className="bg-[var(--rr-surface-subtle)] text-[var(--rr-text-secondary)] border-b border-[var(--rr-border)] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Case #</th>
                <th className="py-3 px-4">Merchant</th>
                <th className="py-3 px-4">Reconciliation Status</th>
                <th className="py-3 px-4 text-right">Amount at Risk</th>
                <th className="py-3 px-4 text-right">Confidence</th>
                <th className="py-3 px-4">Scenario Category</th>
                <th className="py-3 px-4">Case State</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rr-border)] font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8">
                    <RREmptyState icon={<RefreshCw className="animate-spin w-8 h-8 text-[var(--rr-primary)]" />} title="Loading ledger..." description="" />
                  </td>
                </tr>
              ) : paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8">
                    <RREmptyState icon={<SearchIcon className="w-8 h-8 text-[var(--rr-text-muted)]" />} title="No records found" description="No reconciliation records match filter criteria." />
                  </td>
                </tr>
              ) : (
                paginatedCases.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--rr-surface-subtle)] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[var(--rr-primary)]">
                      <Link href={`/cases/${c.id}`} className="hover:underline">
                        {c.caseNumber}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--rr-text-secondary)] text-[11px]">
                      {c.merchantId}
                    </td>
                    <td className="py-3.5 px-4">
                      {getReconBadge(c.reconStatus)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[var(--rr-text)] text-right">
                      ₹{(c.amountAtRiskCents / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--rr-text-secondary)] text-right">
                      {c.confidenceScore !== undefined ? `${(c.confidenceScore * 100).toFixed(1)}%` : '100.0%'}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--rr-text-secondary)] text-[11px] font-sans font-medium">
                      {c.scenarioType || 'RECON_DISCREPANCY'}
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-[var(--rr-text-secondary)]">
                      {c.status}
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <Link href={`/cases/${c.id}`}>
                        <RRButton size="sm" variant="secondary" icon={<ChevronRight className="w-3 h-3" />}>
                          Investigate
                        </RRButton>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && paginatedCases.length > 0 && (
          <RRPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredCases.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={() => {}}
          />
        )}
      </RRCard>
    </div>
  );
}
