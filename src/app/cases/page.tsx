'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Filter, 
  ChevronRight, 
  ChevronLeft,
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  TrendingUp, 
  ArrowLeft,
  ArrowUpDown,
  RefreshCw,
  FileSearch
} from 'lucide-react';
import { FinOpsCase } from '@/types';
import { 
  RRCard, 
  RRBadge, 
  RRButton, 
  RRSection, 
  RRFilterBar, 
  RRPagination, 
  RREmptyState, 
  RRSkeletonRow, 
  getStatusVariant, 
  getStatusLabel 
} from '@/components/ui';

export default function CaseExplorerPage() {
  const [cases, setCases] = useState<FinOpsCase[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'caseNumber' | 'amountAtRiskCents' | 'riskScore' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [loading, setLoading] = useState(true);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cases');
      const data = await res.json();
      if (data.success) {
        setCases(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const filteredCases = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return cases.filter((c) => {
      const matchesStatus = filterStatus === 'ALL' || c.status === filterStatus;
      if (!matchesStatus) return false;
      if (!q) return true;

      return (
        c.caseNumber.toLowerCase().includes(q) ||
        c.reconStatus.toLowerCase().includes(q) ||
        (c.scenarioType && c.scenarioType.toLowerCase().includes(q)) ||
        (c.riskClassification && c.riskClassification.toLowerCase().includes(q))
      );
    });
  }, [cases, filterStatus, searchQuery]);

  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (valA === undefined) valA = sortOrder === 'asc' ? 999999999 : -1;
      if (valB === undefined) valB = sortOrder === 'asc' ? 999999999 : -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [filteredCases, sortBy, sortOrder]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedCases.length / pageSize)), [sortedCases.length, pageSize]);
  const paginatedCases = useMemo(() => sortedCases.slice((currentPage - 1) * pageSize, currentPage * pageSize), [sortedCases, currentPage, pageSize]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const statusFilters = [
    { value: 'ALL', label: 'ALL' },
    { value: 'SETTLED_VERIFIED', label: 'SETTLED VERIFIED' },
    { value: 'RECOVERING', label: 'RECOVERING' },
    { value: 'HUMAN_REVIEW_REQUIRED', label: 'HUMAN REVIEW' },
    { value: 'RISK_BLOCKED', label: 'RISK BLOCKED' },
    { value: 'CLOSED_UNRESOLVED', label: 'UNRESOLVED' },
    { value: 'EXCEPTION_DETECTED', label: 'EXCEPTION' }
  ];

  return (
    <div className="page-enter p-8 space-y-6 max-w-7xl mx-auto w-full">
      <RRSection
        title="FinOps Case Explorer"
        subtitle="Search, filter, and audit every reconciliation exception across the closed-loop state machine."
        action={
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-[var(--rr-text-muted)] bg-[var(--rr-surface-subtle)] px-3 py-1.5 rounded-[var(--rr-radius)] border border-[var(--rr-border)]">
              Total Cases: <span className="text-[var(--rr-text)] font-bold">{cases.length}</span>
            </div>
            <RRButton
              variant="primary"
              loading={loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={async () => {
                setLoading(true);
                try {
                  await fetch('/api/orchestrator/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ size: 500, seed: Math.floor(Math.random() * 10000) }),
                  });
                  await fetchCases();
                  setCurrentPage(1);
                } catch (err) {
                  console.error(err);
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? 'Processing Batch...' : '⚡ Ingest Live FinOps Batch (500)'}
            </RRButton>
          </div>
        }
      />

      <RRFilterBar
        searchValue={searchQuery}
        onSearchChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
        searchPlaceholder="Search by case number, anomaly type, scenario, or risk classification..."
        filters={statusFilters}
        activeFilter={filterStatus}
        onFilterChange={(val) => { setFilterStatus(val); setCurrentPage(1); }}
      />

      <RRCard padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--rr-surface-subtle)] text-[var(--rr-text-secondary)] border-b border-[var(--rr-border)] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4 cursor-pointer hover:text-[var(--rr-text)] transition-colors" onClick={() => toggleSort('caseNumber')}>
                  <div className="flex items-center gap-1">
                    Case Number <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Scenario Category</th>
                <th className="py-3.5 px-4">Reconciliation Anomaly</th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-[var(--rr-text)] text-right transition-colors" onClick={() => toggleSort('amountAtRiskCents')}>
                  <div className="flex items-center justify-end gap-1">
                    Amount at Risk <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">Verified Recovered</th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-[var(--rr-text)] transition-colors" onClick={() => toggleSort('riskScore')}>
                  <div className="flex items-center gap-1">
                    Risk Evaluation <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rr-border)] bg-[var(--rr-surface)]">
              {loading ? (
                <>
                  <RRSkeletonRow columns={8} />
                  <RRSkeletonRow columns={8} />
                  <RRSkeletonRow columns={8} />
                  <RRSkeletonRow columns={8} />
                  <RRSkeletonRow columns={8} />
                </>
              ) : paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <RREmptyState
                      icon={<FileSearch className="w-8 h-8 text-[var(--rr-text-muted)]" />}
                      title="No cases found"
                      description="No cases match your current filter criteria."
                    />
                  </td>
                </tr>
              ) : (
                paginatedCases.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--rr-surface-subtle)] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-[var(--rr-primary)]">
                      <Link href={`/cases/${c.id}`} className="hover:underline">
                        {c.caseNumber}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--rr-text)] font-medium">
                      {c.scenarioType || 'RECON_DISCREPANCY'}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--rr-text-secondary)] font-mono">
                      {c.reconStatus}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-[var(--rr-text)] text-right">
                      ₹{(c.amountAtRiskCents / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-[var(--rr-success)] text-right">
                      ₹{(c.recoveredAmountCents / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4">
                      {c.riskScore !== undefined ? (
                        <span className={`font-mono font-bold ${
                          c.riskScore >= 70 ? 'text-[var(--rr-risk)]' : c.riskScore >= 45 ? 'text-[var(--rr-warning)]' : 'text-[var(--rr-success)]'
                        }`}>
                          {c.riskScore}/100 <span className="text-[10px] text-[var(--rr-text-muted)] font-normal">({c.riskClassification || 'OPS_SHAPED'})</span>
                        </span>
                      ) : c.reconStatus === 'EXACT_MATCH' ? (
                        <RRBadge variant="success" size="sm">
                          BYPASSED (EXACT)
                        </RRBadge>
                      ) : (
                        <RRBadge variant="neutral" size="sm">
                          PENDING TRIAGE
                        </RRBadge>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <RRBadge variant={getStatusVariant(c.status)}>
                        {getStatusLabel(c.status)}
                      </RRBadge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/cases/${c.id}`}>
                        <RRButton variant="secondary" size="sm">
                          Investigate <ChevronRight className="w-3 h-3 ml-1" />
                        </RRButton>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && sortedCases.length > 0 && (
          <div className="border-t border-[var(--rr-border)]">
            <RRPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedCases.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            />
          </div>
        )}
      </RRCard>
    </div>
  );
}
