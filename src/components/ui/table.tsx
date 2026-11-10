import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, X } from 'lucide-react';
import { T } from './list';
import { AnimatePresence, m } from 'framer-motion';
import { rise } from './motion';

/**
 * Shared pieces for list tables: sortable column headers, a page bar,
 * row selection with a floating action bar, and CSV export.
 */

/* ------------------------------- Sorting -------------------------------- */

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string = string> {
  key: K;
  dir: SortDir;
}

/** Clicking a header sorts by it; clicking again flips the direction. */
export const nextSort = <K extends string>(current: SortState<K> | null, key: K, firstDir: SortDir = 'asc'): SortState<K> =>
  current && current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: firstDir };

interface SortThProps<K extends string> {
  label: React.ReactNode;
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (s: SortState<K>) => void;
  /** Direction used the first time this column is clicked (e.g. newest or largest first). */
  firstDir?: SortDir;
  align?: 'left' | 'right';
  className?: string;
}

export const SortTh = <K extends string>({ label, sortKey, sort, onSort, firstDir = 'asc', align = 'left', className = '' }: SortThProps<K>) => {
  const active = sort?.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort!.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      className={`${T.th} ${align === 'right' ? 'text-right' : ''} ${className}`}
      aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, sortKey, firstDir))}
        className={`inline-flex items-center gap-1 uppercase tracking-wider border-0 bg-transparent p-0 font-semibold cursor-pointer hover:text-navy ${
          active ? 'text-navy' : 'text-muted'
        } ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <Icon size={12} className={active ? 'text-brand-ink' : 'text-subtle'} />
      </button>
    </th>
  );
};

type Getter<T> = (row: T) => string | number | null | undefined;

/** Sorts rows in the browser. Empty values always go last. */
export const sortRows = <T, K extends string>(rows: T[], sort: SortState<K> | null, getters: Record<K, Getter<T>>) => {
  if (!sort) return rows;
  const get = getters[sort.key];
  if (!get) return rows;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    const ea = va === null || va === undefined || va === '';
    const eb = vb === null || vb === undefined || vb === '';
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * dir;
  });
};

/* ------------------------------- Paging --------------------------------- */

export const PAGE_SIZE = 25;

/** Splits rows into pages; goes back to page 1 whenever `resetKey` changes (new search, filter or sort). */
export const usePaged = <T,>(rows: T[], resetKey: unknown, pageSize = PAGE_SIZE) => {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pages);
  const pageRows = useMemo(() => rows.slice((safePage - 1) * pageSize, safePage * pageSize), [rows, safePage, pageSize]);
  return { page: safePage, setPage, pageRows, total: rows.length, pageSize };
};

const pageList = (page: number, pages: number): (number | '…')[] => {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const nums = [...set].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
};

interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  /** e.g. "jobs" */
  noun: string;
}

/** "Showing 26–50 of 132 jobs" with previous / next and page numbers. */
export const Pager: React.FC<PagerProps> = ({ page, pageSize, total, onPage, noun }) => {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const go = (p: number) => {
    onPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const btn = 'h-9 min-w-9 px-2 inline-flex items-center justify-center rounded-lg text-sm border-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <span className="text-xs text-muted tabular-nums">
        {pages > 1 ? `Showing ${from}–${to} of ${total} ${noun}` : `${total} ${total === 1 ? noun.replace(/s$/, '') : noun}`}
      </span>
      {pages > 1 && (
        <nav className="flex items-center gap-1 self-end sm:self-auto" aria-label="Pages">
          <button type="button" className={`${btn} bg-transparent text-navy hover:bg-mist`} disabled={page === 1} onClick={() => go(page - 1)} aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          <span className="sm:hidden px-2 text-sm text-ink-soft tabular-nums">
            Page {page} of {pages}
          </span>
          <span className="hidden sm:flex items-center gap-1">
            {pageList(page, pages).map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} className="px-1 text-muted">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => go(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={`${btn} tabular-nums ${p === page ? 'bg-navy text-white font-semibold' : 'bg-transparent text-navy hover:bg-mist'}`}
                >
                  {p}
                </button>
              ),
            )}
          </span>
          <button type="button" className={`${btn} bg-transparent text-navy hover:bg-mist`} disabled={page === pages} onClick={() => go(page + 1)} aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
};

/* ------------------------------ Selection ------------------------------- */

/** Tracks selected row ids. `visibleIds` are the rows on screen, for "select all". */
export const useSelection = (visibleIds: string[]) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const someSelected = !allSelected && visibleIds.some(id => selected.has(id));
  return {
    selected,
    count: selected.size,
    has: (id: string) => selected.has(id),
    toggle: (id: string) =>
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAll: () =>
      setSelected(prev => {
        const next = new Set(prev);
        if (allSelected) visibleIds.forEach(id => next.delete(id));
        else visibleIds.forEach(id => next.add(id));
        return next;
      }),
    clear: () => setSelected(new Set()),
    allSelected,
    someSelected,
  };
};

export const SelectBox: React.FC<{ checked: boolean; indeterminate?: boolean; onChange: () => void; label: string }> = ({
  checked,
  indeterminate,
  onChange,
  label,
}) => (
  <input
    type="checkbox"
    aria-label={label}
    checked={checked}
    ref={el => {
      if (el) el.indeterminate = !!indeterminate;
    }}
    onChange={onChange}
    onClick={e => e.stopPropagation()}
    className="w-4 h-4 rounded border-line-strong text-brand accent-[var(--color-brand)] cursor-pointer align-middle"
  />
);

/** Floating bar shown while rows are selected. */
export const BulkBar: React.FC<{ count: number; noun: string; onClear: () => void; children: React.ReactNode }> = ({ count, noun, onClear, children }) => {
  return (
    <AnimatePresence>
      {count > 0 && (
    <m.div {...rise} className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 z-40 max-w-[calc(100vw-1rem)]" role="toolbar" aria-label="Selected rows">
      <div className="flex items-center gap-1.5 sm:gap-2 pl-4 pr-1.5 py-1.5 rounded-xl bg-navy text-white shadow-pop overflow-x-auto no-scrollbar">
        <span className="text-sm font-semibold whitespace-nowrap pr-1">
          {count} {count === 1 ? noun.replace(/s$/, '') : noun} selected
        </span>
        <span className="w-px h-6 bg-white/15 shrink-0" aria-hidden />
        {children}
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 border-0 bg-transparent"
        >
          <X size={16} />
        </button>
      </div>
    </m.div>
      )}
    </AnimatePresence>
  );
};

/** A button styled for the dark bulk bar. */
export const BulkButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ComponentType<{ size?: number }>; danger?: boolean }> = ({
  icon: Icon,
  danger,
  className = '',
  children,
  ...rest
}) => (
  <button
    type="button"
    {...rest}
    className={`h-9 px-3 shrink-0 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium whitespace-nowrap border-0 bg-transparent disabled:opacity-50 ${
      danger ? 'text-red-300 hover:bg-red-500/20' : 'text-white hover:bg-white/10'
    } ${className}`}
  >
    {Icon && <Icon size={15} />}
    {children}
  </button>
);

/* --------------------------------- CSV ---------------------------------- */

/** Downloads rows as a CSV file that opens cleanly in Excel. */
export const downloadCsv = (filename: string, headers: string[], rows: (string | number | null | undefined)[][]) => {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [headers, ...rows].map(r => r.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
