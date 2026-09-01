import React from 'react';

interface RRSkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const RRSkeleton: React.FC<RRSkeletonProps> = ({ className = '', width, height }) => (
  <div
    className={`skeleton-shimmer rounded-[var(--rr-radius)] ${className}`}
    style={{ width, height }}
    aria-hidden="true"
  />
);

export const RRSkeletonKpi: React.FC = () => (
  <div className="bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius-lg)] p-4 space-y-2">
    <RRSkeleton className="h-3 w-20" />
    <RRSkeleton className="h-7 w-24" />
    <RRSkeleton className="h-2.5 w-16" />
  </div>
);

export const RRSkeletonRow: React.FC<{ cols?: number; columns?: number }> = ({ cols = 6, columns }) => {
  const count = columns ?? cols;
  return (
    <tr>
      {Array.from({ length: count }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <RRSkeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
};

interface RREmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const RREmptyState: React.FC<RREmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
    {icon && <div className="mb-3 text-[var(--rr-text-disabled)]">{icon}</div>}
    <h3 className="text-[15px] font-semibold text-[var(--rr-text-secondary)] mb-1">{title}</h3>
    {description && <p className="text-[13px] text-[var(--rr-text-muted)] max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
