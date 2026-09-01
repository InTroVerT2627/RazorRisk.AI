'use client';

import React, { useEffect, useState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { RRCard, RRBadge, RRButton, RRSection } from '@/components/ui';
import { MerchantPolicy } from '@/types';

export default function PolicyConfigPage() {
  const [policy, setPolicy] = useState<MerchantPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/policies')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPolicy(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;

    try {
      setSaving(true);
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      const data = await res.json();
      if (data.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-enter p-8 space-y-8 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--rr-text)] flex items-center gap-3">
          Deterministic Policy Engine Guardrails
          <RRBadge variant="success" size="sm">
            Zero-Bypass Architecture
          </RRBadge>
        </h1>
        <p className="text-sm text-[var(--rr-text-secondary)] mt-1">
          FinOps Rule: LLM decides strategy, code strictly enforces limits. All limits configured here cannot be overridden by AI prompts.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-[var(--rr-radius)] bg-[var(--rr-success-soft)] border border-[var(--rr-success)] text-[var(--rr-success)] text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          <span>Policy guardrails updated and synchronized into live deterministic engine.</span>
        </div>
      )}

      {policy && (
        <form onSubmit={handleSave} className="space-y-6">
          <RRCard padding="md" className="space-y-6">
            <h2 className="text-sm font-semibold text-[var(--rr-text)] uppercase tracking-wider border-b border-[var(--rr-border)] pb-3">
              1. Risk Score & Fraud Gates
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-[var(--rr-text-secondary)] mb-1">
                  Hard Block Risk Threshold (0 - 100)
                </label>
                <input
                  type="number"
                  value={policy.riskScoreBlockThreshold}
                  onChange={(e) => setPolicy({ ...policy, riskScoreBlockThreshold: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius)] p-2.5 text-xs text-[var(--rr-text)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--rr-primary)] focus:border-[var(--rr-primary)] transition-all shadow-sm"
                />
                <p className="text-[11px] text-[var(--rr-text-muted)] mt-1">
                  Any case with risk score $\ge$ this value is unconditionally blocked from automated recovery.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--rr-text-secondary)] mb-1">
                  Human Review Escalation Threshold (0 - 100)
                </label>
                <input
                  type="number"
                  value={policy.riskScoreHumanThreshold}
                  onChange={(e) => setPolicy({ ...policy, riskScoreHumanThreshold: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius)] p-2.5 text-xs text-[var(--rr-text)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--rr-primary)] focus:border-[var(--rr-primary)] transition-all shadow-sm"
                />
                <p className="text-[11px] text-[var(--rr-text-muted)] mt-1">
                  Cases with scores between this threshold and hard block are routed to Human Review Queue.
                </p>
              </div>
            </div>
          </RRCard>

          <RRCard padding="md" className="space-y-6">
            <h2 className="text-sm font-semibold text-[var(--rr-text)] uppercase tracking-wider border-b border-[var(--rr-border)] pb-3">
              2. Recovery Limits & Bounded Incentives
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-medium text-[var(--rr-text-secondary)] mb-1">
                  Maximum Retry Attempts
                </label>
                <input
                  type="number"
                  value={policy.maxRetryAttempts}
                  onChange={(e) => setPolicy({ ...policy, maxRetryAttempts: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius)] p-2.5 text-xs text-[var(--rr-text)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--rr-primary)] focus:border-[var(--rr-primary)] transition-all shadow-sm"
                />
                <p className="text-[11px] text-[var(--rr-text-muted)] mt-1">
                  Strict ceiling on automated gateway retries.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--rr-text-secondary)] mb-1">
                  Retry Cooldown Hours
                </label>
                <input
                  type="number"
                  value={policy.retryCooldownHours}
                  onChange={(e) => setPolicy({ ...policy, retryCooldownHours: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius)] p-2.5 text-xs text-[var(--rr-text)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--rr-primary)] focus:border-[var(--rr-primary)] transition-all shadow-sm"
                />
                <p className="text-[11px] text-[var(--rr-text-muted)] mt-1">
                  Minimum cooldown window between attempts.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--rr-text-secondary)] mb-1">
                  Maximum Discount Basis Points (bps)
                </label>
                <input
                  type="number"
                  value={policy.maxDiscountBps}
                  onChange={(e) => setPolicy({ ...policy, maxDiscountBps: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius)] p-2.5 text-xs text-[var(--rr-text)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--rr-primary)] focus:border-[var(--rr-primary)] transition-all shadow-sm"
                />
                <p className="text-[11px] text-[var(--rr-text-muted)] mt-1">
                  1000 bps = 10.0% maximum incentive limit.
                </p>
              </div>
            </div>
          </RRCard>

          <div className="flex justify-end gap-3 pt-4">
            <RRButton
              type="submit"
              variant="primary"
              loading={saving}
              disabled={saving}
              icon={<Save className="w-4 h-4" />}
            >
              Save & Lock Policy Guardrails
            </RRButton>
          </div>
        </form>
      )}
    </div>
  );
}
