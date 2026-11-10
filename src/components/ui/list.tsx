/**
 * Building blocks for list pages (Leads, Contacts, Estimates, Jobs, Invoices,
 * Expenses, Employees) so they all share one layout:
 *
 *   PageHeader  →  StatStrip (optional)  →  ListPanel [ tabs · toolbar · table / phone cards ]
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MoreHorizontal, Search, X } from 'lucide-react';
import { ListSkeleton } from './skeleton';
import { AnimatePresence, m } from 'framer-motion';
import { pop } from './motion';
import type { LucideIcon } from 'lucide-react';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* -------------------------------------------------------------------------- */
/* Stat strip — a row of key numbers above a list                              */
/* -------------------------------------------------------------------------- */

export interface StatItem {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'red' | 'green' | 'amber';
  active?: boolean;
  onClick?: () => void;
}

const STAT_TONES = { default: 'text-navy', red: 'text-red-700', green: 'text-brand-ink', amber: 'text-amber-700' };

export const StatStrip: React.FC<{ items: StatItem[]; loading?: boolean }> = ({ items, loading }) => (
  <div
    className={cx(
      'grid grid-cols-2 gap-px bg-line border border-line rounded-xl shadow-card overflow-hidden',
      items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'lg:grid-cols-3' : '',
    )}
  >
    {items.map(it => {
      const content = (
        <>
          <div className="text-xs font-medium text-muted truncate">{it.label}</div>
          {loading ? (
            <div className="mt-1.5 h-7 w-16 rounded bg-mist animate-pulse" />
          ) : (
            <div className={cx('mt-0.5 text-xl md:text-2xl font-bold tracking-tight truncate', STAT_TONES[it.tone ?? 'default'])}>{it.value}</div>
          )}
          {it.hint && <div className="mt-0.5 text-2xs text-muted truncate">{it.hint}</div>}
        </>
      );
      const base = cx('block w-full text-left px-4 py-3.5 min-w-0 border-0', it.active ? 'bg-brand-soft' : 'bg-white');
      return it.onClick ? (
        <button key={it.label} type="button" onClick={it.onClick} aria-pressed={it.active} className={cx(base, !it.active && 'hover:bg-canvas')}>
          {content}
        </button>
      ) : (
        <div key={it.label} className={base}>
          {content}
        </div>
      );
    })}
  </div>
);

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */
/* -------------------------------------------------------------------------- */

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  count?: number | string;
}

export function StatusTabs<T extends string>({ tabs, value, onChange }: { tabs: TabItem<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-end gap-1 overflow-x-auto no-scrollbar border-b border-line px-2 md:px-3" role="tablist">
      {tabs.map(t => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cx(
              'relative shrink-0 inline-flex items-center gap-1.5 h-11 px-3 text-sm border-0 bg-transparent whitespace-nowrap transition-colors',
              active ? 'text-navy font-semibold' : 'text-muted hover:text-navy font-medium',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cx(
                  'min-w-[1.25rem] h-5 px-1.5 rounded-full text-2xs font-semibold inline-flex items-center justify-center',
                  active ? 'bg-navy text-white' : 'bg-mist text-ink-soft',
                )}
              >
                {t.count}
              </span>
            )}
            {active && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-brand" />}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Toolbar inputs                                                              */
/* -------------------------------------------------------------------------- */

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = 'Search…', className = '' }) => (
  <div className={cx('relative flex-1 min-w-0', className)}>
    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 pl-9 pr-9 rounded-lg border border-line bg-white text-sm text-navy placeholder:text-subtle hover:border-line-strong focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15 [&::-webkit-search-cancel-button]:hidden"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-muted hover:bg-mist border-0 bg-transparent"
      >
        <X size={14} />
      </button>
    )}
  </div>
);

export const FilterSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...rest }) => (
  <select
    className={cx(
      'h-10 pl-3 pr-8 rounded-lg border border-line bg-white text-sm text-navy hover:border-line-strong focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15 cursor-pointer',
      className,
    )}
    {...rest}
  >
    {children}
  </select>
);

/* -------------------------------------------------------------------------- */
/* Overflow ("…") menu for secondary actions                                   */
/* -------------------------------------------------------------------------- */

export interface MenuAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

export const OverflowMenu: React.FC<{ actions: MenuAction[]; label?: string; align?: 'left' | 'right' }> = ({ actions, label = 'More actions', align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        aria-label={label}
        title={label}
        className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-line bg-white text-ink-soft hover:bg-mist hover:text-navy shadow-card"
      >
        <MoreHorizontal size={18} />
      </button>
      <AnimatePresence>
      {open && (
        <m.div
          {...pop}
          style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
          className={cx('absolute top-full mt-1.5 w-52 bg-white border border-line rounded-xl shadow-pop p-1 z-40', align === 'right' ? 'right-0' : 'left-0')}
          onClick={e => e.stopPropagation()}
        >
          {actions.map(({ label: l, icon: Icon, onClick, danger }) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setOpen(false);
                onClick();
              }}
              className={cx(
                'w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm text-left border-0 bg-transparent',
                danger ? 'text-red-600 hover:bg-red-50' : 'text-navy hover:bg-mist',
              )}
            >
              {Icon && <Icon size={16} className={danger ? '' : 'text-muted'} />}
              {l}
            </button>
          ))}
        </m.div>
      )}
      </AnimatePresence>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Panel that wraps tabs, toolbar and results                                  */
/* -------------------------------------------------------------------------- */

interface ListPanelProps {
  tabs?: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const ListPanel: React.FC<ListPanelProps> = ({ tabs, toolbar, footer, children }) => (
  <section className="bg-white border border-line rounded-xl shadow-card">
    {tabs}
    {toolbar && <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 p-3 md:px-4 border-b border-line">{toolbar}</div>}
    <div>{children}</div>
    {footer && <div className="px-4 py-3 border-t border-line">{footer}</div>}
  </section>
);

/* -------------------------------------------------------------------------- */
/* Table + phone rows                                                          */
/* -------------------------------------------------------------------------- */

/** Class names for list tables so every table reads the same. */
export const T = {
  wrap: 'hidden md:block overflow-x-auto',
  table: 'w-full text-left border-collapse',
  thead: 'bg-canvas border-b border-line',
  th: 'px-4 py-2.5 text-2xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap',
  tr: 'border-b border-line last:border-0 hover:bg-canvas cursor-pointer transition-colors',
  td: 'px-4 py-3 text-sm text-navy align-middle',
};

interface MobileRowProps {
  to?: string;
  onClick?: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  right?: React.ReactNode;
  leading?: React.ReactNode;
  selected?: boolean;
}

/** One tappable row in the phone version of a list. */
export const MobileRow: React.FC<MobileRowProps> = ({ to, onClick, title, subtitle, meta, right, leading, selected }) => {
  const body = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[0.9375rem] font-semibold text-navy truncate">{title}</div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
        {subtitle && <div className="text-xs text-muted truncate mt-0.5">{subtitle}</div>}
        {meta && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-ink-soft">{meta}</div>}
      </div>
      <ChevronRight size={16} className="text-subtle shrink-0 self-center" />
    </>
  );
  const cls = cx('flex items-start gap-3 px-4 py-3.5 no-underline text-left w-full border-0', selected ? 'bg-brand-soft/60' : 'bg-white active:bg-mist');
  if (to) {
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e => e.key === 'Enter' && onClick?.()} className={cls}>
      {body}
    </div>
  );
};

export const MobileList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="md:hidden divide-y divide-line">{children}</div>
);

/** Grey placeholder rows while a list loads (keeps the layout steady). */
export const ListLoading: React.FC<{ label?: string; rows?: number }> = ({ label = 'Loading…', rows }) => (
  <ListSkeleton label={label} rows={rows} />
);

/** Initials avatar used in list rows. */
export const Avatar: React.FC<{ name?: string | null; size?: 'sm' | 'md'; className?: string }> = ({ name, size = 'md', className = '' }) => {
  const letters =
    (name || '?')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(p => p[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || '?';
  return (
    <span
      className={cx(
        'rounded-full bg-mist text-ink-soft font-semibold inline-flex items-center justify-center shrink-0',
        size === 'sm' ? 'w-8 h-8 text-2xs' : 'w-9 h-9 text-xs',
        className,
      )}
    >
      {letters}
    </span>
  );
};

/** Two or three big switches between views of a page (e.g. Roster / Payroll). */
export function Segmented<V extends string>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <div className="inline-flex w-full sm:w-auto p-1 rounded-lg bg-mist border border-line" role="tablist">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 sm:flex-none h-9 px-4 rounded-md text-sm border-0 transition-colors',
            o.value === value ? 'bg-white text-navy font-semibold shadow-card' : 'bg-transparent text-muted hover:text-navy font-medium',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
