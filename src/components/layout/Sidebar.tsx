'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  ArrowRightLeft,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  FileCheck2,
  Lock,
  SlidersHorizontal,
  CheckCircle2,
  Activity,
  Database,
  Shield,
} from 'lucide-react';

const navSections = [
  {
    label: 'OVERVIEW',
    items: [
      { name: 'Command Center', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Case Explorer', href: '/cases', icon: Layers },
      { name: 'Reconciliation', href: '/reconciliation', icon: ArrowRightLeft },
      { name: 'Risk Manager', href: '/risk', icon: ShieldAlert },
      { name: 'Revenue Recovery', href: '/recovery', icon: TrendingUp },
      { name: 'Human Review', href: '/human-review', icon: UserCheck },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { name: 'Evaluation Center', href: '/evaluation', icon: FileCheck2 },
      { name: 'Audit Trail', href: '/audit', icon: Lock },
    ],
  },
  {
    label: 'CONTROL',
    items: [
      { name: 'Policy Guardrails', href: '/policies', icon: SlidersHorizontal },
    ],
  },
];

type SystemStatus = 'healthy' | 'degraded' | 'unavailable';

const systemChecks: { label: string; icon: React.ElementType; status: SystemStatus }[] = [
  { label: 'AI Provider', icon: Activity, status: 'healthy' },
  { label: 'Policy Engine', icon: Shield, status: 'healthy' },
  { label: 'Audit Chain', icon: Lock, status: 'healthy' },
  { label: 'Data Store', icon: Database, status: 'healthy' },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside
      className="w-[252px] bg-[var(--rr-surface)] border-r border-[var(--rr-border)] flex flex-col h-screen select-none shrink-0"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="px-5 py-4 border-b border-[var(--rr-border)] flex items-center gap-3">
        {/* Brand Mark: Shield with R */}
        <div className="w-8 h-8 rounded-lg bg-[var(--rr-primary)] flex items-center justify-center shadow-sm">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 1L2 4v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V4L9 1z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.2" strokeLinejoin="round"/>
            <text x="6" y="12.5" fill="white" fontSize="8" fontWeight="700" fontFamily="Inter, sans-serif">R</text>
          </svg>
        </div>
        <div>
          <div className="font-semibold text-[13px] tracking-tight text-[var(--rr-text)]">
            RazorRisk.AI
          </div>
          <p className="text-[10px] text-[var(--rr-text-muted)] leading-tight">
            Autonomous FinOps
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <div className="px-3 pb-1.5 text-[10px] font-semibold text-[var(--rr-text-disabled)] tracking-wider uppercase">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-[var(--rr-radius)] text-[13px] font-medium transition-all duration-[var(--rr-duration-fast)] relative ${
                      isActive
                        ? 'bg-[var(--rr-primary-soft)] text-[var(--rr-primary)]'
                        : 'text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)] hover:bg-[var(--rr-surface-subtle)]'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--rr-primary)] transition-all duration-[var(--rr-duration-base)]" />
                    )}
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--rr-primary)]' : 'text-[var(--rr-text-muted)]'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* System Status Footer */}
      <div className="px-4 py-3 border-t border-[var(--rr-border)] bg-[var(--rr-surface-subtle)]">
        <div className="text-[10px] font-semibold text-[var(--rr-text-disabled)] tracking-wider uppercase mb-2">
          System Status
        </div>
        <div className="space-y-1.5">
          {systemChecks.map((check) => (
            <div key={check.label} className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--rr-text-muted)] flex items-center gap-1.5">
                <check.icon className="w-3 h-3" />
                {check.label}
              </span>
              <span className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  check.status === 'healthy' ? 'bg-[var(--rr-success)]' :
                  check.status === 'degraded' ? 'bg-[var(--rr-warning)]' : 'bg-[var(--rr-risk)]'
                }`} />
                <span className={`text-[10px] font-medium ${
                  check.status === 'healthy' ? 'text-[var(--rr-success)]' :
                  check.status === 'degraded' ? 'text-[var(--rr-warning)]' : 'text-[var(--rr-risk)]'
                }`}>
                  {check.status === 'healthy' ? 'OK' : check.status.toUpperCase()}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
