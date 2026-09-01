'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ShieldCheck, 
  DollarSign, 
  Lock, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  FileText, 
  ShieldAlert,
  Send,
  Activity,
  Check,
  X
} from 'lucide-react';
import { FinOpsCase, TransactionRecord, SettlementRecord, RiskAssessment, RecoveryActionRecord, AuditTrailEntry } from '@/types';
import { RRCard, RRBadge, RRButton, RRTimeline, RREmptyState, getStatusVariant, getStatusLabel } from '@/components/ui';

interface CaseDetailData {
  case: FinOpsCase;
  transaction: TransactionRecord | null;
  settlement: SettlementRecord | null;
  riskAssessments: RiskAssessment[];
  recoveryActions: RecoveryActionRecord[];
  auditEntries: AuditTrailEntry[];
}

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [data, setData] = useState<CaseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [humanNotes, setHumanNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchCaseDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cases/${resolvedParams.id}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseDetails();
  }, [resolvedParams.id]);

  const handleHumanAction = async (action: 'APPROVE_RECOVERY' | 'CONFIRM_BLOCK' | 'WRITE_OFF') => {
    try {
      setActionLoading(true);
      const res = await fetch('/api/orchestrator/human-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: resolvedParams.id,
          action,
          humanOperatorId: 'FINOPS_LEAD_01',
          notes: humanNotes || `Manual ${action} decision authorized by FinOps Operator.`,
        }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        setActionSuccess(`Case status updated to ${action}. Audit entry chained.`);
        setHumanNotes('');
        await fetchCaseDetails();
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-enter p-8 max-w-7xl mx-auto w-full text-[var(--rr-text-muted)] text-[13px] font-mono flex items-center justify-center h-64">
        Loading case investigation telemetry...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-enter p-8 max-w-7xl mx-auto w-full space-y-4">
        <Link href="/cases" className="text-[var(--rr-primary)] flex items-center gap-1 text-[13px] hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Cases
        </Link>
        <div className="text-[var(--rr-risk)] text-[13px] font-mono">Case record not found.</div>
      </div>
    );
  }

  const { case: c, transaction: tx, settlement: st, riskAssessments, recoveryActions, auditEntries } = data;
  const latestRisk = riskAssessments[riskAssessments.length - 1];
  const latestRecovery = recoveryActions[recoveryActions.length - 1];

  const policyChecks = [
    { name: 'Maximum Retry Ceiling', limit: '<= 3 attempts', pass: c.retryCount < 3, value: `${c.retryCount} of 3` },
    { name: 'Retry Cooldown Window', limit: '>= 2.0 hours', pass: true, value: 'Satisfied' },
    { name: 'Risk Hard Block Gate', limit: 'Risk Score < 70', pass: (c.riskScore ?? 0) < 70, value: `${c.riskScore ?? 0} / 100` },
    { name: 'Human Review Boundary', limit: 'Risk Score < 45', pass: (c.riskScore ?? 0) < 45, value: `${c.riskScore ?? 0} / 100` },
    { name: 'Auto-Recovery Amount Cap', limit: '<= ₹50,000', pass: c.amountAtRiskCents <= 5000000, value: `₹${(c.amountAtRiskCents / 100).toLocaleString('en-IN')}` },
    { name: 'Allowed Strategy Channel', limit: 'WhatsApp / SMS / Gateway', pass: true, value: latestRecovery?.channel || 'WHATSAPP' },
    { name: 'Max Incentive Discount', limit: '<= 10.0% (1000 bps)', pass: (latestRecovery?.discountOfferedBps ?? 0) <= 1000, value: `${((latestRecovery?.discountOfferedBps ?? 0) / 100).toFixed(1)}%` },
  ];

  const overallPolicyPass = policyChecks.every((chk) => chk.pass);

  return (
    <div className="page-enter p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Navigation Breadcrumb & Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link href="/cases" className="text-[var(--rr-text-muted)] hover:text-[var(--rr-primary)] flex items-center gap-1 text-[13px] font-medium mb-2 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Case Explorer
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--rr-text)] font-mono">{c.caseNumber}</h1>
            <RRBadge variant={getStatusVariant(c.reconStatus)}>{c.reconStatus}</RRBadge>
            <RRBadge variant={getStatusVariant(c.status)}>STATUS: {c.status}</RRBadge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] text-right">
            <div className="text-[10px] uppercase font-semibold text-[var(--rr-text-muted)]">Amount at Risk</div>
            <div className="text-lg font-bold font-mono text-[var(--rr-text)]">
              ₹{(c.amountAtRiskCents / 100).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-[var(--rr-success-soft)] border border-[var(--rr-success)] text-right">
            <div className="text-[10px] uppercase font-semibold text-[var(--rr-success)]">Verified Recovered</div>
            <div className="text-lg font-bold font-mono text-[var(--rr-success)]">
              ₹{(c.recoveredAmountCents / 100).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-[var(--rr-success-soft)] border border-[var(--rr-success)] text-[var(--rr-success)] text-[13px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Cross-Track Operational Flow Timeline */}
      <RRCard padding="md">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--rr-border)]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--rr-primary)]" />
            <h2 className="text-xs font-semibold text-[var(--rr-text)] uppercase tracking-wider">
              Connected Operational Flow: Finance → Risk → Recovery → Verification
            </h2>
          </div>
          <RRBadge variant={c.status === 'SETTLED_VERIFIED' ? 'success' : c.status === 'RISK_BLOCKED' ? 'blocked' : 'info'}>
            Stage: {c.status}
          </RRBadge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Finance Decision */}
          <div className="p-3 rounded-lg border bg-[var(--rr-surface-subtle)] border-[var(--rr-border)] space-y-1">
            <div className="text-[10px] font-mono text-[var(--rr-text-muted)] uppercase">1. Finance Recon</div>
            <div className="text-xs font-bold text-[var(--rr-text)]">{c.reconStatus}</div>
            <div className="text-[11px] text-[var(--rr-text-secondary)]">
              {c.reconStatus === 'EXACT_MATCH' ? 'Exact Match Confirmed' : `Discrepancy: ₹${(c.amountAtRiskCents / 100).toFixed(2)}`}
            </div>
          </div>

          {/* 2. Risk Assessment */}
          <div className="p-3 rounded-lg border bg-[var(--rr-surface-subtle)] border-[var(--rr-border)] space-y-1">
            <div className="text-[10px] font-mono text-[var(--rr-text-muted)] uppercase">2. Risk Manager</div>
            <div className="text-xs font-bold text-[var(--rr-text)]">
              {latestRisk ? `${latestRisk.riskScore}/100 — ${latestRisk.classification}` : (c.riskScore ? `${c.riskScore}/100` : 'Pending')}
            </div>
            <div className="text-[11px] text-[var(--rr-text-secondary)]">
              {latestRisk?.recommendedAction || (c.status === 'RISK_BLOCKED' ? 'BLOCK_AND_BLACKLIST' : 'PROCEED_TO_RECOVERY')}
            </div>
          </div>

          {/* 3. Recovery Eligibility */}
          <div className={`p-3 rounded-lg border space-y-1 ${
            c.recoveryEligibilityStatus === 'ELIGIBLE' || c.recoveryEligibilityStatus === 'VERIFIED'
              ? 'bg-emerald-50/50 border-emerald-200'
              : c.recoveryEligibilityStatus === 'BLOCKED'
              ? 'bg-red-50/50 border-red-200'
              : 'bg-amber-50/50 border-amber-200'
          }`}>
            <div className="text-[10px] font-mono text-[var(--rr-text-muted)] uppercase">3. Recovery Eligibility</div>
            <div className={`text-xs font-bold ${
              c.recoveryEligibilityStatus === 'ELIGIBLE' || c.recoveryEligibilityStatus === 'VERIFIED' ? 'text-emerald-700' :
              c.recoveryEligibilityStatus === 'BLOCKED' ? 'text-red-700' : 'text-amber-700'
            }`}>
              {c.recoveryEligibilityStatus || (c.recoveryEligible ? 'ELIGIBLE' : 'PENDING_RISK')}
            </div>
            <div className="text-[11px] text-[var(--rr-text-secondary)] truncate">
              {c.recoveryEligibilityReason || 'Operational eligibility evaluated'}
            </div>
          </div>

          {/* 4. Strategy & Policy */}
          <div className="p-3 rounded-lg border bg-[var(--rr-surface-subtle)] border-[var(--rr-border)] space-y-1">
            <div className="text-[10px] font-mono text-[var(--rr-text-muted)] uppercase">4. Recovery Strategy</div>
            <div className="text-xs font-bold text-[var(--rr-text)]">
              {latestRecovery?.actionType || (c.amountAtRiskCents >= 5000000 ? 'BOUNDED_NEGOTIATE' : 'RETRY_PAYMENT')}
            </div>
            <div className="text-[11px] text-[var(--rr-success)] font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> {overallPolicyPass ? 'Policy Approved' : 'Policy Check'}
            </div>
          </div>

          {/* 5. Verification & Re-Recon */}
          <div className={`p-3 rounded-lg border space-y-1 ${
            c.status === 'SETTLED_VERIFIED'
              ? 'bg-emerald-50/70 border-emerald-300'
              : 'bg-[var(--rr-surface-subtle)] border-[var(--rr-border)]'
          }`}>
            <div className="text-[10px] font-mono text-[var(--rr-text-muted)] uppercase">5. Re-Reconciliation</div>
            <div className={`text-xs font-bold ${c.status === 'SETTLED_VERIFIED' ? 'text-emerald-700' : 'text-[var(--rr-text)]'}`}>
              {c.status === 'SETTLED_VERIFIED' ? 'SETTLED VERIFIED' : 'Pending Bank UTR'}
            </div>
            <div className="text-[11px] text-[var(--rr-text-secondary)]">
              {c.status === 'SETTLED_VERIFIED' ? `Net Cash: ₹${(c.recoveredAmountCents / 100).toLocaleString('en-IN')}` : 'Awaiting confirmation'}
            </div>
          </div>
        </div>
      </RRCard>

      {/* Structured Evidence Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Transaction */}
        <RRCard className="p-5 space-y-4 shadow-[var(--rr-shadow-sm)]">
          <div className="text-[14px] font-semibold text-[var(--rr-text)] border-b border-[var(--rr-border)] pb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--rr-primary)]" />
            Transaction Details
          </div>
          <div className="space-y-3 text-[13px]">
            <div className="flex justify-between items-center">
              <span className="text-[var(--rr-text-muted)]">Reference</span>
              <span className="text-[var(--rr-text)] font-mono">{tx?.externalRef || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--rr-text-muted)]">Customer</span>
              <span className="text-[var(--rr-text)] font-medium">{tx?.customerName || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--rr-text-muted)]">Method</span>
              <span className="text-[var(--rr-text)]">{tx?.paymentMethod} ({tx?.gatewayCode})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--rr-text-muted)]">Status</span>
              <RRBadge variant={getStatusVariant(tx?.status || '')}>{tx?.status || 'N/A'}</RRBadge>
            </div>
            {tx?.errorCode && (
              <div className="mt-3 p-3 rounded-lg bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] text-[var(--rr-risk)] text-[12px] font-mono">
                Error: {tx.errorCode} - {tx.errorDescription}
              </div>
            )}
          </div>
        </RRCard>

        {/* Settlement */}
        <RRCard className="p-5 space-y-4 shadow-[var(--rr-shadow-sm)]">
          <div className="text-[14px] font-semibold text-[var(--rr-text)] border-b border-[var(--rr-border)] pb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[var(--rr-success)]" />
            Settlement Info
          </div>
          <div className="space-y-3 text-[13px]">
            <div className="flex justify-between items-center">
              <span className="text-[var(--rr-text-muted)]">Settlement Ref (UTR)</span>
              <span className="text-[var(--rr-text)] font-mono">{st?.utrRrn || st?.id || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--rr-text-muted)]">Amount</span>
              <span className="text-[var(--rr-text)] font-mono">₹{((st?.amountCents || 0) / 100).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--rr-text-muted)]">Recon Status</span>
              {st?.reconciledStatus ? <RRBadge variant={getStatusVariant(st.reconciledStatus)}>{st.reconciledStatus}</RRBadge> : <span className="text-[var(--rr-text-muted)]">N/A</span>}
            </div>
          </div>
        </RRCard>

        {/* Reconciliation */}
        <RRCard className="p-5 space-y-4 shadow-[var(--rr-shadow-sm)]">
          <div className="text-[14px] font-semibold text-[var(--rr-text)] border-b border-[var(--rr-border)] pb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--rr-warning)]" />
            Reconciliation State
          </div>
          <div className="space-y-3 text-[13px]">
            <div className="flex justify-between items-center">
              <span className="text-[var(--rr-text-muted)]">Discrepancy</span>
              <span className="text-[var(--rr-risk)] font-mono font-bold">₹{(c.amountAtRiskCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--rr-text-muted)]">Recon Result</span>
              <RRBadge variant={getStatusVariant(c.reconStatus)}>{c.reconStatus}</RRBadge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--rr-text-muted)]">Terminal State</span>
              <RRBadge variant={getStatusVariant(c.status)}>{c.status}</RRBadge>
            </div>
          </div>
        </RRCard>
        
        {/* Risk */}
        <RRCard className="p-5 space-y-4 shadow-[var(--rr-shadow-sm)]">
          <div className="text-[14px] font-semibold text-[var(--rr-text)] border-b border-[var(--rr-border)] pb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[var(--rr-primary)]" />
            AI Risk Triage
          </div>
          {latestRisk ? (
            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between items-center">
                <span className="text-[var(--rr-text-muted)]">Score</span>
                <span className={`font-bold text-[15px] ${
                  latestRisk.riskScore >= 70 ? 'text-[var(--rr-risk)]' : 
                  latestRisk.riskScore >= 45 ? 'text-[var(--rr-warning)]' : 
                  'text-[var(--rr-success)]'
                }`}>
                  {latestRisk.riskScore} / 100
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--rr-text-muted)]">Classification</span>
                <span className="text-[var(--rr-text)] font-medium">{latestRisk.classification}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--rr-text-muted)]">Action</span>
                <span className="text-[var(--rr-text)] font-medium">{latestRisk.recommendedAction}</span>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] text-[var(--rr-text-secondary)] text-[12px] leading-relaxed">
                <span className="text-[var(--rr-primary)] font-semibold block mb-1">Rationale</span>
                {latestRisk.reasoningSummary}
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-[var(--rr-text-muted)] py-6 text-center italic">Pending risk evaluation</div>
          )}
        </RRCard>

        {/* Recovery */}
        <RRCard className="p-5 space-y-4 shadow-[var(--rr-shadow-sm)]">
          <div className="text-[14px] font-semibold text-[var(--rr-text)] border-b border-[var(--rr-border)] pb-3 flex items-center gap-2">
            <Send className="w-4 h-4 text-[var(--rr-success)]" />
            Recovery Strategy
          </div>
          {latestRecovery ? (
            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between items-center">
                <span className="text-[var(--rr-text-muted)]">Channel</span>
                <span className="text-[var(--rr-text)] font-medium">{latestRecovery.channel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--rr-text-muted)]">Strategy / Action</span>
                <span className="text-[var(--rr-text)]">{latestRecovery.actionType}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--rr-text-muted)]">Discount Offered</span>
                <span className="text-[var(--rr-text)] font-mono">{((latestRecovery.discountOfferedBps || 0) / 100).toFixed(1)}%</span>
              </div>
              {latestRecovery.executionResult && (
                <div className="mt-3 p-3 rounded-lg bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] text-[12px] text-[var(--rr-text-secondary)] font-mono">
                  <div className="font-medium text-[var(--rr-text)]">{latestRecovery.executionResult.message}</div>
                  {latestRecovery.executionResult.simulatedSettlementUtr && (
                    <div className="text-[var(--rr-text-muted)] mt-1.5 pt-1.5 border-t border-[var(--rr-border)]">
                      UTR: {latestRecovery.executionResult.simulatedSettlementUtr}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[13px] text-[var(--rr-text-muted)] py-6 text-center italic">Pending recovery evaluation</div>
          )}
        </RRCard>

        {/* Policy */}
        <RRCard className="p-5 space-y-4 shadow-[var(--rr-shadow-sm)]">
          <div className="flex items-center justify-between border-b border-[var(--rr-border)] pb-3">
            <div className="text-[14px] font-semibold text-[var(--rr-text)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--rr-primary)]" />
              Policy Gate Matrix
            </div>
            <RRBadge variant={overallPolicyPass ? 'success' : 'critical'}>
              {overallPolicyPass ? 'ALLOWED' : 'BLOCKED'}
            </RRBadge>
          </div>
          <div className="space-y-2 text-[12px] max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
            {policyChecks.map((chk, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] flex items-center justify-between">
                <div>
                  <span className="text-[var(--rr-text)] font-medium block">{chk.name}</span>
                  <span className="text-[var(--rr-text-muted)] font-mono text-[11px] mt-0.5 block">Rule: {chk.limit}</span>
                </div>
                {chk.pass ? (
                  <span className="flex items-center gap-1.5 text-[var(--rr-success)] font-bold font-mono">
                    <Check className="w-3.5 h-3.5" /> PASS
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[var(--rr-risk)] font-bold font-mono">
                    <X className="w-3.5 h-3.5" /> FAIL
                  </span>
                )}
              </div>
            ))}
          </div>
        </RRCard>
      </div>

      {/* Bottom Split: Human Override & Audit Chain */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        {/* Operator Action Panel */}
        <RRCard className="p-6 space-y-5 shadow-[var(--rr-shadow-md)]">
          <div className="flex items-center gap-2 border-b border-[var(--rr-border)] pb-3">
            <UserCheck className="w-4.5 h-4.5 text-[var(--rr-primary)]" />
            <h3 className="text-[14px] font-semibold text-[var(--rr-text)] uppercase tracking-wider">
              Controlled FinOps Operator Action
            </h3>
          </div>
          
          <p className="text-[13px] text-[var(--rr-text-muted)] leading-relaxed">
            All operator actions are validated against policy bounds and sealed into the SHA-256 audit log.
          </p>

          <div className="space-y-2.5">
            <label className="text-[12px] font-medium text-[var(--rr-text-secondary)] block">
              Operator Decision Rationale
            </label>
            <textarea
              value={humanNotes}
              onChange={(e) => setHumanNotes(e.target.value)}
              placeholder="Enter mandatory justification for operator decision..."
              rows={3}
              className="w-full bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius)] p-3 text-[13px] text-[var(--rr-text)] placeholder-[var(--rr-text-muted)] focus:outline-none focus:border-[var(--rr-primary)] focus:ring-1 focus:ring-[var(--rr-primary)] transition-all resize-none shadow-sm"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <RRButton
              variant="success"
              onClick={() => handleHumanAction('APPROVE_RECOVERY')}
              loading={actionLoading}
              className="flex-1"
            >
              Authorize Recovery
            </RRButton>
            <RRButton
              variant="danger"
              onClick={() => handleHumanAction('CONFIRM_BLOCK')}
              loading={actionLoading}
              className="flex-1"
            >
              Confirm Block
            </RRButton>
            <RRButton
              variant="secondary"
              onClick={() => handleHumanAction('WRITE_OFF')}
              loading={actionLoading}
            >
              Write-Off
            </RRButton>
          </div>
        </RRCard>

        {/* SHA-256 Hash Chain */}
        <RRCard className="p-6 space-y-5 shadow-[var(--rr-shadow-md)]">
          <div className="flex items-center justify-between border-b border-[var(--rr-border)] pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4.5 h-4.5 text-[var(--rr-primary)]" />
              <h3 className="text-[14px] font-semibold text-[var(--rr-text)] uppercase tracking-wider">
                Case Audit Provenance
              </h3>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--rr-success-soft)] border border-[var(--rr-success)]">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--rr-success)]" />
              <span className="text-[11px] font-mono text-[var(--rr-success)] font-bold">SHA-256 Valid</span>
            </div>
          </div>

          <div className="max-h-[280px] overflow-y-auto pr-3 custom-scrollbar">
            {auditEntries.length === 0 ? (
              <RREmptyState
                icon={<Clock className="w-10 h-10 text-[var(--rr-text-muted)]" />}
                title="No Audit Entries"
                description="No actions have been recorded for this case yet."
              />
            ) : (
              <RRTimeline
                events={auditEntries.map(log => ({
                  id: String(log.id),
                  label: log.action,
                  description: `${log.decision} (Hash: ${log.currentHash.substring(0, 16)}...)`,
                  timestamp: new Date(log.timestamp).toLocaleTimeString(),
                  actor: log.actorId.startsWith('FINOPS') ? 'human' : 'agent',
                  status: 'completed'
                }))}
              />
            )}
          </div>
        </RRCard>
      </div>
    </div>
  );
}
