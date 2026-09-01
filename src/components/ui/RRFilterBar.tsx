import React from 'react';
import { Search } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface RRFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export const RRFilterBar: React.FC<RRFilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  activeFilter,
  onFilterChange,
  children,
  className = '',
}) => {
  return (
    <div className={`flex flex-col md:flex-row gap-3 items-start md:items-center justify-between bg-[var(--rr-surface)] p-3.5 rounded-[var(--rr-radius-lg)] border border-[var(--rr-border)] ${className}`}>
      {/* Search Input */}
      <div className="relative flex-1 w-full max-w-md">
        <Search className="w-4 h-4 text-[var(--rr-text-disabled)] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] rounded-[var(--rr-radius)] pl-9 pr-3 py-2 text-[13px] text-[var(--rr-text)] placeholder-[var(--rr-text-disabled)] focus:outline-none focus:border-[var(--rr-primary)] focus:ring-1 focus:ring-[var(--rr-primary)]/20 transition-all duration-[var(--rr-duration-fast)]"
        />
      </div>

      {/* Filter Pills */}
      {filters && onFilterChange && (
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`px-2.5 py-1.5 rounded-[var(--rr-radius)] text-[12px] font-medium whitespace-nowrap transition-all duration-[var(--rr-duration-fast)] ${
                activeFilter === f.value
                  ? 'bg-[var(--rr-primary)] text-white shadow-sm'
                  : 'bg-[var(--rr-surface-subtle)] text-[var(--rr-text-secondary)] hover:bg-[var(--rr-border)] border border-[var(--rr-border)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Extra Controls */}
      {children}
    </div>
  );
};

/* Pagination */
interface RRPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export const RRPagination: React.FC<RRPaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [15, 25, 50, 100],
}) => {
  const start = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="px-4 py-3 border-t border-[var(--rr-border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[var(--rr-text-muted)] bg-[var(--rr-surface-subtle)]">
      <div className="flex items-center gap-2">
        <span>Showing {start}–{end} of {totalItems}</span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius-sm)] px-2 py-1 text-[12px] text-[var(--rr-text-secondary)]"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-2.5 py-1 rounded-[var(--rr-radius-sm)] border border-[var(--rr-border)] bg-[var(--rr-surface)] text-[var(--rr-text-secondary)] hover:bg-[var(--rr-surface-subtle)] disabled:opacity-40 transition-colors duration-[var(--rr-duration-fast)]"
        >
          ← Prev
        </button>
        <span className="px-2 font-medium text-[var(--rr-text)]">{currentPage} / {totalPages}</span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-2.5 py-1 rounded-[var(--rr-radius-sm)] border border-[var(--rr-border)] bg-[var(--rr-surface)] text-[var(--rr-text-secondary)] hover:bg-[var(--rr-surface-subtle)] disabled:opacity-40 transition-colors duration-[var(--rr-duration-fast)]"
        >
          Next →
        </button>
      </div>
    </div>
  );
};
