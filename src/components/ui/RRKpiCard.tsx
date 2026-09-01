import React from 'react';

interface RRKpiCardProps {
  label: string;
  value: string | number;
  context?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  className?: string;
}

export const RRKpiCard: React.FC<RRKpiCardProps> = ({
  label,
  value,
  context,
  icon,
  trend,
  trendLabel,
  className = '',
}) => {
  return (
    <div className={`bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius-lg)] p-4 shadow-[var(--rr-shadow-sm)] hover:-translate-y-0.5 hover:shadow-[var(--rr-shadow-md)] transition-all duration-[var(--rr-duration-base)] ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-[var(--rr-text-muted)] uppercase tracking-wide">{label}</span>
        {icon && <span className="text-[var(--rr-text-disabled)]">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-[var(--rr-text)] font-tabular count-animate">{value}</div>
      {(context || trendLabel) && (
        <div className="flex items-center gap-2 mt-1">
          {context && <span className="text-[11px] text-[var(--rr-text-muted)]">{context}</span>}
          {trendLabel && (
            <span className={`text-[10px] font-semibold ${
              trend === 'up' ? 'text-[var(--rr-success)]' :
              trend === 'down' ? 'text-[var(--rr-risk)]' :
              'text-[var(--rr-text-muted)]'
            }`}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
