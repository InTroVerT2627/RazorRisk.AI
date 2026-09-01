import React from 'react';

/* ============================================================
   RRModal
   ============================================================ */
interface RRModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const RRModal: React.FC<RRModalProps> = ({ open, onClose, title, description, children, footer }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-[var(--rr-duration-base)]" onClick={onClose} />
      <div className="relative bg-[var(--rr-surface)] rounded-[var(--rr-radius-xl)] shadow-[var(--rr-shadow-lg)] border border-[var(--rr-border)] w-full max-w-lg mx-4 animate-[modalEnter_var(--rr-duration-base)_var(--rr-ease-out)]">
        <div className="px-6 py-4 border-b border-[var(--rr-border)]">
          <h2 className="text-[16px] font-semibold text-[var(--rr-text)]">{title}</h2>
          {description && <p className="text-[13px] text-[var(--rr-text-muted)] mt-0.5">{description}</p>}
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="px-6 py-3 border-t border-[var(--rr-border)] flex justify-end gap-2 bg-[var(--rr-surface-subtle)] rounded-b-[var(--rr-radius-xl)]">{footer}</div>}
      </div>
    </div>
  );
};

/* ============================================================
   RRDrawer
   ============================================================ */
interface RRDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side?: 'right' | 'left';
}

export const RRDrawer: React.FC<RRDrawerProps> = ({ open, onClose, title, children, side = 'right' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative ml-auto bg-[var(--rr-surface)] shadow-[var(--rr-shadow-lg)] border-l border-[var(--rr-border)] w-full max-w-md h-full flex flex-col ${side === 'left' ? 'mr-auto ml-0 border-r border-l-0' : ''}`}>
        <div className="px-5 py-4 border-b border-[var(--rr-border)] flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--rr-text)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--rr-text-muted)] hover:text-[var(--rr-text)] text-lg">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};

/* ============================================================
   RRTooltip
   ============================================================ */
interface RRTooltipProps {
  content: string;
  children: React.ReactNode;
}

export const RRTooltip: React.FC<RRTooltipProps> = ({ content, children }) => (
  <span className="relative group inline-flex" title={content}>
    {children}
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[11px] text-white bg-[var(--rr-navy)] rounded-[var(--rr-radius-sm)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--rr-duration-fast)] pointer-events-none shadow-sm z-50">
      {content}
    </span>
  </span>
);

/* ============================================================
   RRTabs
   ============================================================ */
interface RRTabsProps {
  tabs: { value: string; label: string; count?: number }[];
  activeTab: string;
  onTabChange: (value: string) => void;
  className?: string;
}

export const RRTabs: React.FC<RRTabsProps> = ({ tabs, activeTab, onTabChange, className = '' }) => (
  <div className={`flex items-center gap-0.5 bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] rounded-[var(--rr-radius)] p-0.5 ${className}`} role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.value}
        onClick={() => onTabChange(tab.value)}
        role="tab"
        aria-selected={activeTab === tab.value}
        className={`px-3 py-1.5 rounded-[var(--rr-radius-sm)] text-[12px] font-medium transition-all duration-[var(--rr-duration-fast)] ${
          activeTab === tab.value
            ? 'bg-[var(--rr-surface)] text-[var(--rr-text)] shadow-sm'
            : 'text-[var(--rr-text-muted)] hover:text-[var(--rr-text-secondary)]'
        }`}
      >
        {tab.label}
        {tab.count !== undefined && (
          <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
            activeTab === tab.value ? 'bg-[var(--rr-primary-soft)] text-[var(--rr-primary)]' : 'bg-[var(--rr-surface-subtle)] text-[var(--rr-text-disabled)]'
          }`}>
            {tab.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

/* ============================================================
   RRTimeline
   ============================================================ */
interface TimelineEvent {
  id: string;
  label: string;
  description?: string;
  timestamp?: string;
  actor?: 'agent' | 'system' | 'policy' | 'human' | 'provider';
  status?: 'completed' | 'active' | 'pending' | 'blocked';
}

const actorColors: Record<string, string> = {
  agent: 'bg-[var(--rr-primary)]',
  system: 'bg-[var(--rr-text-disabled)]',
  policy: 'bg-[var(--rr-risk)]',
  human: 'bg-[var(--rr-warning)]',
  provider: 'bg-[var(--rr-success)]',
};

const statusDotColors: Record<string, string> = {
  completed: 'bg-[var(--rr-success)]',
  active: 'bg-[var(--rr-primary)]',
  pending: 'bg-[var(--rr-border-strong)]',
  blocked: 'bg-[var(--rr-risk)]',
};

interface RRTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export const RRTimeline: React.FC<RRTimelineProps> = ({ events, className = '' }) => (
  <div className={`space-y-0 ${className}`}>
    {events.map((event, i) => (
      <div key={event.id} className="flex gap-3 page-enter" style={{ animationDelay: `${i * 50}ms` }}>
        <div className="flex flex-col items-center">
          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${statusDotColors[event.status || 'pending']}`} />
          {i < events.length - 1 && <div className="w-px flex-1 bg-[var(--rr-border)]" />}
        </div>
        <div className="pb-4 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--rr-text)]">{event.label}</span>
            {event.actor && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded text-white font-medium ${actorColors[event.actor]}`}>
                {event.actor.toUpperCase()}
              </span>
            )}
          </div>
          {event.description && <p className="text-[12px] text-[var(--rr-text-muted)] mt-0.5">{event.description}</p>}
          {event.timestamp && <span className="text-[10px] text-[var(--rr-text-disabled)] font-mono">{event.timestamp}</span>}
        </div>
      </div>
    ))}
  </div>
);

/* ============================================================
   RRProgress
   ============================================================ */
interface RRProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'risk';
  className?: string;
}

const progressColors: Record<string, string> = {
  primary: 'bg-[var(--rr-primary)]',
  success: 'bg-[var(--rr-success)]',
  warning: 'bg-[var(--rr-warning)]',
  risk: 'bg-[var(--rr-risk)]',
};

export const RRProgress: React.FC<RRProgressProps> = ({
  value, max = 100, label, showValue = true, color = 'primary', className = '',
}) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`space-y-1 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-[11px]">
          {label && <span className="text-[var(--rr-text-muted)]">{label}</span>}
          {showValue && <span className="text-[var(--rr-text-secondary)] font-medium font-tabular">{value.toLocaleString()} / {max.toLocaleString()}</span>}
        </div>
      )}
      <div className="h-1.5 bg-[var(--rr-surface-subtle)] rounded-full overflow-hidden border border-[var(--rr-border)]" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
        <div className={`h-full rounded-full transition-all duration-[var(--rr-duration-slow)] ${progressColors[color]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/* ============================================================
   RRChartContainer
   ============================================================ */
interface RRChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export const RRChartContainer: React.FC<RRChartContainerProps> = ({
  title, subtitle, children, className = '', emptyMessage = 'No data available', isEmpty = false,
}) => (
  <div className={`bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius-lg)] shadow-[var(--rr-shadow-sm)] ${className}`}>
    <div className="px-5 py-3.5 border-b border-[var(--rr-border)]">
      <h3 className="text-[14px] font-semibold text-[var(--rr-text)]">{title}</h3>
      {subtitle && <p className="text-[11px] text-[var(--rr-text-muted)] mt-0.5">{subtitle}</p>}
    </div>
    <div className="p-5">
      {isEmpty ? (
        <div className="text-center py-8 text-[13px] text-[var(--rr-text-disabled)]">{emptyMessage}</div>
      ) : children}
    </div>
  </div>
);
