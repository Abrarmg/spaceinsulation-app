import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, TrendingDown, TrendingUp, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { TONES } from './format';
import type { Tone } from './format';

const STATUS_CLASSES: Record<string, string> = {
  quoted: 'text-amber-700 bg-amber-50 border-amber-200',
  sent: 'text-amber-700 bg-amber-50 border-amber-200',
  new: 'text-[#16A34A] bg-[#22C55E]/10 border-[#22C55E]/30',
  scheduled: 'text-blue-700 bg-blue-50 border-blue-200',
  rescheduled: 'text-purple-700 bg-purple-50 border-purple-200',
  'in progress': 'text-brand-ink bg-brand/10 border-brand/30',
  in_progress: 'text-brand-ink bg-brand/10 border-brand/30',
  completed: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  cancelled: 'text-red-700 bg-red-50 border-red-200',
  rejected: 'text-red-700 bg-red-50 border-red-200',
  lost: 'text-red-700 bg-red-50 border-red-200',
};

export const StatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className = '' }) => (
  <span
    className={`px-2 py-0.5 rounded border text-2xs font-bold uppercase tracking-wider whitespace-nowrap ${
      STATUS_CLASSES[status.toLowerCase()] || 'text-muted bg-canvas border-line'
    } ${className}`}
  >
    {status}
  </span>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-line/70 ${className}`} />
);

export const SectionError: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center gap-2 text-xs font-semibold text-[#EF4444] p-4">
    <AlertTriangle size={14} /> Couldn't load this section: {message}
  </div>
);

interface PanelProps {
  title: string;
  icon: LucideIcon;
  tone: Tone;
  link?: { to: string; label: string };
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ title, icon: Icon, tone, link, className = '', bodyClassName = 'p-5', children }) => (
  <section className={`bg-white rounded-2xl border border-line shadow-sm overflow-hidden flex flex-col ${className}`}>
    <header className="px-5 py-3.5 border-b border-line flex items-center justify-between gap-3 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={16} className={`${TONES[tone].text} stroke-[2.5] shrink-0`} />
        <h3 className="text-sm font-semibold text-navy m-0 truncate">{title}</h3>
      </div>
      {link && (
        <Link to={link.to} className="text-xs font-bold text-[#22C55E] hover:text-[#16A34A] transition-colors shrink-0">
          {link.label} <ArrowRight size={14} className="inline -mt-0.5" aria-hidden />
        </Link>
      )}
    </header>
    <div className={`flex-grow ${bodyClassName}`}>{children}</div>
  </section>
);

interface StatCardProps {
  to: string;
  label: string;
  value: React.ReactNode;
  detail: React.ReactNode;
  icon: LucideIcon;
  tone: Tone;
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ to, label, value, detail, icon: Icon, tone, loading }) => {
  const t = TONES[tone];
  return (
    <Link
      to={to}
      className={`bg-white p-4 rounded-2xl border ${t.border} shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all flex items-start gap-3.5 min-w-0`}
    >
      <div className={`w-10 h-10 rounded-xl ${t.solid} text-white flex items-center justify-center shrink-0 shadow-sm`}>
        <Icon size={20} className="stroke-[2.5]" />
      </div>
      <div className="space-y-1.5 min-w-0">
        <div className={`text-2xs font-bold uppercase tracking-wide ${t.text} leading-none mt-0.5`}>{label}</div>
        {loading ? (
          <>
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-24" />
          </>
        ) : (
          <>
            <div className="text-2xl md:text-3xl font-bold text-navy leading-none">{value}</div>
            <div className="text-2xs text-muted font-medium leading-tight">{detail}</div>
          </>
        )}
      </div>
    </Link>
  );
};

export const TrendChip: React.FC<{ current: number; previous: number; versus: string }> = ({ current, previous, versus }) => {
  if (previous === 0) {
    return <span className="text-2xs text-muted font-bold">No data for {versus}</span>;
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="text-2xs text-muted font-bold inline-flex items-center gap-1">
      <span className={`inline-flex items-center gap-0.5 ${up ? 'text-[#16A34A]' : 'text-[#EF4444]'}`}>
        <Icon size={12} />
        {up ? '+' : ''}
        {pct.toFixed(1)}%
      </span>
      vs {versus}
    </span>
  );
};
