'use client';

import React, { useEffect, useState } from 'react';
import { 
  UserCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw
} from 'lucide-react';
import { FinOpsCase } from '@/types';
import { 
  RRCard, 
  RRBadge, 
  RRButton, 
  RRSection, 
  RREmptyState, 
  getStatusVariant, 
  getStatusLabel 
} from '@/components/ui';

export default function HumanReviewQueuePage() {
  const [cases, setCases] = useState<FinOpsCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<FinOpsCase | null>(null);
  const [operatorNotes, setOperatorNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchHumanReviewCases = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cases?status=HUMAN_REVIEW_REQUIRED');
      const json = await res.json();
      if (json.success) {
        setCases(json.data);
        if (json.data.length > 0 && !selectedCase) {
          setSelectedCase(json.data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to fetch human review cases', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHumanReviewCases();
  }, []);

  const handleOperatorDecision = async (decision: 'APPROVE_RECOVERY' | 'CONFIRM_BLOCK' | 'WRITE_OFF') => {
    if (!selectedCase) return;

    try {
      setActionLoading(true);
      const res = await fetch('/api/orchestrator/human-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: selectedCase.id,
          action: decision,
          humanOperatorId: 'FINOPS_LEAD_OPERATOR',
          notes: operatorNotes || `Authorized manual decision: ${decision}`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionSuccess(`Case ${selectedCase.caseNumber} successfully updated to ${decision}. Audit block recorded.`);
        setOperatorNotes('');
        await fetchHumanReviewCases();
        setSelectedCase(null);
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="page-enter p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--rr-text)] flex items-center gap-3">
            Human Review & Escalation Queue
            <RRBadge variant="warning" showIcon={false}>
              {cases.length} Action Items
            </RRBadge>
          </h1>
          <p className="text-sm text-[var(--rr-text-secondary)] mt-1">
            Authorized FinOps intervention for borderline risk scores (Risk Score 45 to 70), duplicate glitches, and policy-gated exceptions.
          </p>
        </div>

        <RRButton
          onClick={fetchHumanReviewCases}
          disabled={loading}
          variant="secondary"
          icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh Queue
        </RRButton>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-[var(--rr-radius)] bg-[var(--rr-success-soft)] border border-[var(--rr-success)] text-[var(--rr-success)] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Master-Detail Review Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Queue List (1/3) */}
        <RRCard padding="none" className="h-fit border-[var(--rr-border)] shadow-[var(--rr-shadow-sm)]">
          <div className="p-4 border-b border-[var(--rr-border)] flex items-center justify-between bg-[var(--rr-surface-subtle)]">
            <h2 className="text-xs font-semibold text-[var(--rr-text)] uppercase tracking-wider">
              Pending Escalations ({cases.length})
            </h2>
            <span className="text-[11px] text-[var(--rr-warning)] font-mono">Requires Authorization</span>
          </div>

          <div className="p-2 space-y-1.5 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-xs text-[var(--rr-text-muted)]">Loading queue...</div>
            ) : cases.length === 0 ? (
              <div className="p-4">
                <RREmptyState
                  icon={<UserCheck className="w-8 h-8 text-[var(--rr-text-muted)]" />}
                  title="Queue Empty"
                  description="Human review queue is currently empty."
                />
              </div>
            ) : (
              cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCase(c)}
                  className={`w-full text-left p-3.5 rounded-[var(--rr-radius)] border transition-all text-xs space-y-1.5 ${
                    selectedCase?.id === c.id
                      ? 'bg-[var(--rr-primary-soft)] border-[var(--rr-primary)] text-[var(--rr-text)]'
                      : 'bg-[var(--rr-surface)] border-[var(--rr-border)] text-[var(--rr-text-secondary)] hover:bg-[var(--rr-surface-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[var(--rr-primary)]">{c.caseNumber}</span>
                    <span className="font-mono font-bold text-[var(--rr-warning)]">{c.riskScore ?? 45}/100</span>
                  </div>
                  <div className="font-medium text-[var(--rr-text)]">{c.reconStatus}</div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--rr-text-muted)]">
                    <span className="font-mono font-semibold text-[var(--rr-text)]">
                      ₹{(c.amountAtRiskCents / 100).toLocaleString('en-IN')}
                    </span>
                    <span>{c.scenarioType || 'ESCALATED'}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </RRCard>

        {/* Right Column: Case Deep Inspection & Action Gate (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCase ? (
            <RRCard className="space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--rr-border)] pb-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--rr-text)] font-mono flex items-center gap-3">
                    {selectedCase.caseNumber}
                    <RRBadge variant={getStatusVariant(selectedCase.status || 'REVIEW')} size="sm">
                      {getStatusLabel(selectedCase.status || 'HUMAN_REVIEW_REQUIRED')}
                    </RRBadge>
                  </h2>
                  <p className="text-xs text-[var(--rr-text-muted)] mt-1">
                    Merchant: <span className="font-mono text-[var(--rr-text)]">{selectedCase.merchantId}</span> • Anomaly: <span className="font-mono text-[var(--rr-text)]">{selectedCase.reconStatus}</span>
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-[var(--rr-text-muted)] uppercase font-semibold">Amount at Risk</div>
                  <div className="text-xl font-bold font-mono text-[var(--rr-text)]">
                    ₹{(selectedCase.amountAtRiskCents / 100).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Evidence Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* WHY FLAGGED */}
                 <RRCard padding="sm" className="bg-[var(--rr-surface-subtle)] border-[var(--rr-border)] shadow-none">
                   <div className="text-[11px] font-semibold text-[var(--rr-warning)] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                     <AlertTriangle className="w-3.5 h-3.5" />
                     WHY FLAGGED
                   </div>
                   <p className="text-[var(--rr-text-secondary)] text-xs leading-relaxed font-sans">
                     {selectedCase.escalationReason || 'Action flagged for human operator review due to borderline risk score or high-value exception category.'}
                   </p>
                 </RRCard>

                 {/* POLICY ALLOWANCE / RISK */}
                 <RRCard padding="sm" className="bg-[var(--rr-surface-subtle)] border-[var(--rr-border)] shadow-none">
                   <div className="text-[11px] font-semibold text-[var(--rr-primary)] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                     <ShieldAlert className="w-3.5 h-3.5" />
                     RISK CONTEXT
                   </div>
                   <div className="grid grid-cols-2 gap-2 text-xs">
                     <div>
                       <span className="text-[var(--rr-text-muted)] block text-[10px]">Risk Score</span>
                       <span className="text-sm font-bold font-mono text-[var(--rr-warning)]">
                         {selectedCase.riskScore ?? 45} / 100
                       </span>
                     </div>
                     <div>
                       <span className="text-[var(--rr-text-muted)] block text-[10px]">Classification</span>
                       <span className="text-xs font-bold font-mono text-[var(--rr-primary)]">
                         {selectedCase.riskClassification || 'OPS_SHAPED'}
                       </span>
                     </div>
                     <div>
                       <span className="text-[var(--rr-text-muted)] block text-[10px]">Retry Counter</span>
                       <span className="text-xs font-bold font-mono text-[var(--rr-text)]">
                         {selectedCase.retryCount} of {selectedCase.maxRetriesAllowed}
                       </span>
                     </div>
                     <div>
                       <span className="text-[var(--rr-text-muted)] block text-[10px]">Policy Gate Status</span>
                       <span className="text-xs font-bold text-[var(--rr-primary)]">
                         PAUSED (GATED)
                       </span>
                     </div>
                   </div>
                 </RRCard>
              </div>

              {/* Controlled Action Panel */}
              <div className="space-y-4 pt-4 border-t border-[var(--rr-border)]">
                <h3 className="text-xs font-semibold text-[var(--rr-text)] uppercase tracking-wider">
                  Authorized FinOps Operator Decision
                </h3>

                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-[var(--rr-text-secondary)]">
                    Mandatory Decision Rationale / Audit Notes
                  </label>
                  <textarea
                    rows={3}
                    value={operatorNotes}
                    onChange={(e) => setOperatorNotes(e.target.value)}
                    placeholder="Specify business justification for manual override..."
                    className="w-full bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius)] p-3 text-xs text-[var(--rr-text)] placeholder-[var(--rr-text-muted)] focus:outline-none focus:border-[var(--rr-primary)]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <RRButton
                    onClick={() => handleOperatorDecision('APPROVE_RECOVERY')}
                    loading={actionLoading && operatorNotes.includes('APPROVE_RECOVERY')}
                    variant="success"
                    className="flex-1"
                  >
                    Approve & Dispatch Recovery
                  </RRButton>
                  <RRButton
                    onClick={() => handleOperatorDecision('CONFIRM_BLOCK')}
                    loading={actionLoading && operatorNotes.includes('CONFIRM_BLOCK')}
                    variant="danger"
                    className="flex-1"
                  >
                    Confirm Risk & Block
                  </RRButton>
                  <RRButton
                    onClick={() => handleOperatorDecision('WRITE_OFF')}
                    disabled={actionLoading}
                    variant="secondary"
                  >
                    Write-Off Ledger
                  </RRButton>
                </div>
              </div>
            </RRCard>
          ) : (
            <RRCard className="h-full flex items-center justify-center min-h-[400px]">
              <RREmptyState
                icon={<ShieldAlert className="w-10 h-10 text-[var(--rr-text-muted)]" />}
                title="No Case Selected"
                description="Select a case from the queue to review and authorize decisions."
              />
            </RRCard>
          )}
        </div>
      </div>
    </div>
  );
}
