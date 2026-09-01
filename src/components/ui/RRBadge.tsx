import React from 'react';
import { CheckCircle2, AlertCircle, Clock, ShieldAlert, XCircle, Loader2, MinusCircle, Eye, Zap, Ban } from 'lucide-react';

export type BadgeVariant =
  | 'success' | 'verified' | 'active' | 'processing' | 'pending'
  | 'review' | 'warning' | 'blocked' | 'critical' | 'failed'
  | 'neutral' | 'info' | 'primary' | 'risk';

const variantConfig: Record<BadgeVariant, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  success:    { bg: 'bg-[var(--rr-success-soft)]', text: 'text-[var(--rr-success)]', border: 'border-[var(--rr-success)]/20', icon: CheckCircle2 },
  verified:   { bg: 'bg-[var(--rr-success-soft)]', text: 'text-[var(--rr-success)]', border: 'border-[var(--rr-success)]/20', icon: CheckCircle2 },
  active:     { bg: 'bg-[var(--rr-info-soft)]', text: 'text-[var(--rr-primary)]', border: 'border-[var(--rr-primary)]/20', icon: Zap },
  processing: { bg: 'bg-[var(--rr-info-soft)]', text: 'text-[var(--rr-primary)]', border: 'border-[var(--rr-primary)]/20', icon: Loader2 },
  pending:    { bg: 'bg-[var(--rr-warning-soft)]', text: 'text-[var(--rr-warning)]', border: 'border-[var(--rr-warning)]/20', icon: Clock },
  review:     { bg: 'bg-[var(--rr-warning-soft)]', text: 'text-[var(--rr-warning)]', border: 'border-[var(--rr-warning)]/20', icon: Eye },
  warning:    { bg: 'bg-[var(--rr-warning-soft)]', text: 'text-[var(--rr-warning)]', border: 'border-[var(--rr-warning)]/20', icon: AlertCircle },
  blocked:    { bg: 'bg-[var(--rr-risk-soft)]', text: 'text-[var(--rr-risk)]', border: 'border-[var(--rr-risk)]/20', icon: Ban },
  critical:   { bg: 'bg-[var(--rr-risk-soft)]', text: 'text-[var(--rr-risk)]', border: 'border-[var(--rr-risk)]/20', icon: ShieldAlert },
  risk:       { bg: 'bg-[var(--rr-risk-soft)]', text: 'text-[var(--rr-risk)]', border: 'border-[var(--rr-risk)]/20', icon: ShieldAlert },
  failed:     { bg: 'bg-[var(--rr-risk-soft)]', text: 'text-[var(--rr-risk)]', border: 'border-[var(--rr-risk)]/20', icon: XCircle },
  neutral:    { bg: 'bg-[var(--rr-surface-subtle)]', text: 'text-[var(--rr-text-muted)]', border: 'border-[var(--rr-border)]', icon: MinusCircle },
  info:       { bg: 'bg-[var(--rr-info-soft)]', text: 'text-[var(--rr-primary)]', border: 'border-[var(--rr-primary)]/20', icon: AlertCircle },
  primary:    { bg: 'bg-[var(--rr-primary-soft)]', text: 'text-[var(--rr-primary)]', border: 'border-[var(--rr-primary)]/20', icon: Zap },
};

interface RRBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const RRBadge: React.FC<RRBadgeProps> = ({
  variant,
  children,
  showIcon = true,
  size = 'sm',
  className = '',
}) => {
  const config = variantConfig[variant];
  const Icon = config.icon;
  const sizeClasses = size === 'sm'
    ? 'text-[11px] px-2 py-0.5 gap-1'
    : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span className={`inline-flex items-center font-semibold rounded-[var(--rr-radius-sm)] border ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}>
      {showIcon && <Icon className={`${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${variant === 'processing' ? 'animate-spin' : ''}`} />}
      {children}
    </span>
  );
};

/** Maps common case statuses to badge variants */
export function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'SETTLED_VERIFIED': return 'verified';
    case 'RECONCILED': return 'success';
    case 'RISK_BLOCKED': return 'blocked';
    case 'HUMAN_REVIEW_REQUIRED': return 'review';
    case 'RECOVERING': case 'RECOVERY_EXECUTED': case 'VERIFYING': return 'processing';
    case 'OPS_APPROVED': return 'active';
    case 'EXCEPTION_DETECTED': return 'warning';
    case 'RISK_TRIAGING': return 'pending';
    case 'CLOSED_UNRESOLVED': case 'CLOSED_WRITTEN_OFF': return 'neutral';
    default: return 'neutral';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'SETTLED_VERIFIED': return 'Verified';
    case 'RECONCILED': return 'Reconciled';
    case 'RISK_BLOCKED': return 'Blocked';
    case 'HUMAN_REVIEW_REQUIRED': return 'Review';
    case 'RECOVERING': return 'Recovering';
    case 'RECOVERY_EXECUTED': return 'Executed';
    case 'VERIFYING': return 'Verifying';
    case 'OPS_APPROVED': return 'Approved';
    case 'EXCEPTION_DETECTED': return 'Exception';
    case 'RISK_TRIAGING': return 'Triaging';
    case 'CLOSED_UNRESOLVED': return 'Unresolved';
    case 'CLOSED_WRITTEN_OFF': return 'Written Off';
    default: return status.replace(/_/g, ' ');
  }
}
