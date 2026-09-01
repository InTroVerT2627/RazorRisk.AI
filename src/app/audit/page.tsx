'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  ShieldX
} from 'lucide-react';
import { 
  RRCard, 
  RRBadge, 
  RRButton, 
  RRSection,
  RRProgress,
  RREmptyState
} from '@/components/ui';
import { AuditTrailEntry } from '@/types';

export default function AuditExplorerPage() {
  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
  const [integrity, setIntegrity] = useState<{ valid: boolean; error?: string; corruptedIndex?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/audit');
      const json = await res.json();
      if (json.success) {
        setEntries(json.data.entries);
        setIntegrity(json.data.integrity);
      }
    } catch (e) {
      console.error('Failed to fetch audit data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const handleVerifyChain = async () => {
    try {
      setVerifying(true);
      setProgress(0);
      
      // Simulate progress
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + 15, 90));
      }, 100);

      const res = await fetch('/api/audit');
      const json = await res.json();
      
      clearInterval(interval);
      setProgress(100);

      if (json.success) {
        setIntegrity(json.data.integrity);
        setEntries(json.data.entries);
        if (json.data.integrity.valid) {
          setVerifyMessage(`CHAIN 100% VALID: Verified all ${json.data.totalEntries} sequential SHA-256 blocks from genesis.`);
        } else {
          setVerifyMessage(`CHAIN INTEGRITY FAILURE: Tampering discovered at block #${json.data.integrity.corruptedIndex}! ${json.data.integrity.error}`);
        }
        setTimeout(() => setVerifyMessage(null), 5000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => {
        setVerifying(false);
        setProgress(0);
      }, 500);
    }
  };

  return (
    <div className="page-enter p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--rr-text)] flex items-center gap-3">
            Immutable SHA-256 Audit Trail
            <RRBadge variant="info" size="sm">
              Cryptographically Chained
            </RRBadge>
          </h1>
          <p className="text-sm text-[var(--rr-text-secondary)] mt-1">
            Every agent reasoning output, policy gate check, and state delta is linked into a tamper-evident hash chain.
          </p>
        </div>

        <RRButton
          variant="primary"
          onClick={handleVerifyChain}
          disabled={verifying || loading}
          loading={verifying}
          icon={<RefreshCw className="w-4 h-4" />}
        >
          {verifying ? 'Verifying SHA-256 Chain...' : 'VERIFY AUDIT CHAIN'}
        </RRButton>
      </div>

      {verifying && progress > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[var(--rr-text-secondary)]">
            <span>Cryptographic Verification in Progress...</span>
            <span>{progress}%</span>
          </div>
          <RRProgress value={progress} />
        </div>
      )}

      {verifyMessage && (
        <div className={`p-4 rounded-[var(--rr-radius)] border text-xs flex items-center gap-2 font-mono ${
          integrity?.valid
            ? 'bg-[var(--rr-success-soft)] border-[var(--rr-success)] text-[var(--rr-success)]'
            : 'bg-[var(--rr-risk-soft)] border-[var(--rr-risk)] text-[var(--rr-risk)]'
        }`}>
          {integrity?.valid ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <ShieldX className="w-4 h-4 shrink-0" />}
          <span>{verifyMessage}</span>
        </div>
      )}

      <RRCard>
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-[var(--rr-radius)] border flex items-center justify-center ${
              integrity?.valid
                ? 'bg-[var(--rr-success-soft)] border-[var(--rr-success-soft)] text-[var(--rr-success)]'
                : 'bg-[var(--rr-risk-soft)] border-[var(--rr-risk-soft)] text-[var(--rr-risk)]'
            }`}>
              {integrity?.valid ? <ShieldCheck className="w-5 h-5" /> : <ShieldX className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-semibold text-[var(--rr-text)] text-sm flex items-center gap-2">
                <span>Cryptographic Chain Status:</span>
                <span className={`font-mono font-bold ${integrity?.valid ? 'text-[var(--rr-success)]' : 'text-[var(--rr-risk)]'}`}>
                  {integrity?.valid ? 'CHAIN VALID (0 TAMPERING)' : 'INTEGRITY BREACH'}
                </span>
              </div>
              <p className="text-xs text-[var(--rr-text-secondary)] mt-0.5">
                {entries.length} total blocks linked. Genesis hash: <span className="font-mono text-[var(--rr-text-muted)]">0000000000000000...</span>
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-xs text-[var(--rr-text-secondary)] bg-[var(--rr-surface-subtle)] px-3.5 py-2 rounded-[var(--rr-radius)] border border-[var(--rr-border)]">
            Total Blocks: <span className="text-[var(--rr-text)] font-bold">{entries.length}</span>
          </div>
        </div>
      </RRCard>

      <RRSection title="Sequential Audit Blocks" subtitle="Most recent operations and cryptographic linkages">
        <div className="space-y-3 mt-4">
          {loading ? (
            <RRCard padding="md">
              <div className="text-center text-xs text-[var(--rr-text-secondary)]">
                Loading audit ledger...
              </div>
            </RRCard>
          ) : entries.length === 0 ? (
            <RREmptyState
              icon={<ShieldCheck className="w-8 h-8 text-[var(--rr-text-muted)]" />}
              title="No audit entries"
              description="No audit entries recorded in ledger yet. Run batch simulation from Command Center."
            />
          ) : (
            entries.map((entry) => (
              <RRCard key={entry.id} padding="md" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--rr-border)] pb-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2 font-mono">
                    <span className="font-bold px-2 py-0.5 rounded bg-[var(--rr-primary-soft)] text-[var(--rr-primary)] border border-[var(--rr-primary-soft)]">
                      BLOCK #{entry.id}
                    </span>
                    <span className="font-semibold text-[var(--rr-text-secondary)]">
                      ACTOR: {entry.actorType} ({entry.actorId})
                    </span>
                    {entry.caseId && (
                      <Link href={`/cases/${entry.caseId}`} className="text-[var(--rr-primary)] hover:underline">
                        [{entry.caseId}]
                      </Link>
                    )}
                  </div>
                  <span className="text-[var(--rr-text-muted)] font-mono text-[11px]">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[var(--rr-text-muted)] block text-[10px] uppercase font-semibold">Action Triggered</span>
                    <span className="font-semibold text-[var(--rr-text)] font-mono">{entry.action}</span>
                    <p className="text-[var(--rr-text-secondary)] mt-1 font-sans leading-relaxed">{entry.decision}</p>
                  </div>

                  {entry.reasoningSummary && (
                    <div>
                      <span className="text-[var(--rr-text-muted)] block text-[10px] uppercase font-semibold">Structured Rationale</span>
                      <p className="text-[var(--rr-text-secondary)] bg-[var(--rr-surface-subtle)] p-2.5 rounded border border-[var(--rr-border)] text-[11px] leading-relaxed">
                        {entry.reasoningSummary}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--rr-border)] grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-[var(--rr-text-muted)]">
                  <div className="truncate">
                    <span className="text-[var(--rr-text-secondary)] font-semibold">Prev Hash:</span> {entry.prevHash}
                  </div>
                  <div className="truncate text-right sm:text-left">
                    <span className="text-[var(--rr-primary)] font-semibold">Current Hash:</span> {entry.currentHash}
                  </div>
                </div>
              </RRCard>
            ))
          )}
        </div>
      </RRSection>
    </div>
  );
}
