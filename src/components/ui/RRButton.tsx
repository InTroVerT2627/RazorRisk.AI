import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--rr-primary)] hover:bg-[var(--rr-primary-hover)] active:bg-[var(--rr-primary-active)] text-white shadow-sm',
  secondary: 'bg-[var(--rr-surface)] hover:bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] text-[var(--rr-text)] shadow-sm',
  outline: 'bg-[var(--rr-surface)] hover:bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] text-[var(--rr-text)] shadow-sm',
  danger: 'bg-[var(--rr-risk)] hover:bg-red-700 active:bg-red-800 text-white shadow-sm',
  success: 'bg-[var(--rr-success)] hover:bg-green-700 active:bg-green-800 text-white shadow-sm',
  ghost: 'bg-transparent hover:bg-[var(--rr-surface-subtle)] text-[var(--rr-text-secondary)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-[12px] px-2.5 py-1.5 gap-1.5',
  md: 'text-[13px] px-3.5 py-2 gap-2',
  lg: 'text-[14px] px-5 py-2.5 gap-2',
};

interface RRButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const RRButton: React.FC<RRButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium rounded-[var(--rr-radius)] transition-all duration-[var(--rr-duration-fast)] focus-visible:ring-2 focus-visible:ring-[var(--rr-primary)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
};
