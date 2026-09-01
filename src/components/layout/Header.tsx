'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { RefreshCw, Activity, Shield, Lock, FlaskConical } from 'lucide-react';

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Command Center', subtitle: 'Autonomous reconciliation, risk intelligence and revenue recovery' },
  '/cases': { title: 'Case Explorer', subtitle: 'Investigate exceptions across the live financial operation' },
  '/reconciliation': { title: 'Reconciliation', subtitle: 'Multi-tier matching, MDR netting, and settlement reconciliation' },
  '/risk': { title: 'Risk Manager', subtitle: 'Multi-signal risk triage and anomaly radar' },
  '/recovery': { title: 'Revenue Recovery', subtitle: 'Adaptive recovery strategies and bounded negotiation' },
  '/human-review': { title: 'Human Review', subtitle: 'Authorized intervention for escalated cases' },
  '/evaluation': { title: 'Evaluation Center', subtitle: 'Empirical benchmark and trust scorecard' },
  '/audit': { title: 'Audit Trail', subtitle: 'Immutable SHA-256 cryptographic chain' },
  '/policies': { title: 'Policy Guardrails', subtitle: 'Deterministic policy engine configuration' },
};

interface HeaderProps {
  onRunSimulation?: () => void;
  isLoading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onRunSimulation, isLoading }) => {
  const pathname = usePathname();
  
  // Match dynamic routes
  const routeKey = Object.keys(routeTitles).find(key => 
    pathname === key || (key !== '/' && pathname.startsWith(key))
  ) || '/';
  
  const { title, subtitle } = routeTitles[routeKey] || routeTitles['/'];

  return (
    <header className="h-14 px-6 border-b border-[var(--rr-border)] bg-[var(--rr-surface)] flex items-center justify-between shrink-0">
      {/* Left: Page context */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--rr-text)] leading-tight">{title}</h1>
          <p className="text-[11px] text-[var(--rr-text-muted)] leading-tight">{subtitle}</p>
        </div>
      </div>

      {/* Right: Status + Actions */}
      <div className="flex items-center gap-4">
        {/* Test Mode Badge */}
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[var(--rr-radius-sm)] bg-[var(--rr-warning-soft)] text-[var(--rr-warning)] border border-[var(--rr-warning)]/20 transition-colors duration-[var(--rr-duration-base)] flex items-center gap-1">
          <FlaskConical className="w-3 h-3" />
          SIMULATION
        </span>

        {/* System Health Dots */}
        <div className="flex items-center gap-3 text-[11px] text-[var(--rr-text-muted)]">
          <span className="flex items-center gap-1" title="AI Provider">
            <Activity className="w-3 h-3" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--rr-success)]" />
          </span>
          <span className="flex items-center gap-1" title="Policy Engine">
            <Shield className="w-3 h-3" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--rr-success)]" />
          </span>
          <span className="flex items-center gap-1" title="Audit Chain">
            <Lock className="w-3 h-3" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--rr-success)]" />
          </span>
        </div>

        {/* Action Button */}
        {onRunSimulation && (
          <button
            onClick={onRunSimulation}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--rr-radius)] text-[12px] font-medium bg-[var(--rr-primary)] hover:bg-[var(--rr-primary-hover)] text-white transition-all duration-[var(--rr-duration-fast)] shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Processing...' : 'Run Batch'}
          </button>
        )}
      </div>
    </header>
  );
};
