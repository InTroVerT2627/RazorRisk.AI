import React from 'react';

interface RRCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: React.ReactNode;
  headerAction?: React.ReactNode;
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export const RRCard: React.FC<RRCardProps> = ({
  children,
  className = '',
  padding = 'md',
  header,
  headerAction,
}) => {
  return (
    <div className={`bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius-lg)] shadow-[var(--rr-shadow-sm)] transition-shadow duration-[var(--rr-duration-fast)] ${className}`}>
      {header && (
        <div className="px-5 py-3.5 border-b border-[var(--rr-border)] flex items-center justify-between">
          <div>{header}</div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className={paddingMap[padding]}>
        {children}
      </div>
    </div>
  );
};
