/**
 * Building blocks for detail pages (Contact, Lead, Estimate, Job, Invoice):
 *
 *   BackLink → DetailHeader [title · status · next step]  →  two-column cards  →  MobileActionBar
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ButtonLink, EmptyState } from './index';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export const BackLink: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <Link to={to} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy no-underline">
    <ArrowLeft size={16} /> {label}
  </Link>
);

interface DetailHeaderProps {
  back?: { to: string; label: string };
  title: React.ReactNode;
  /** Badges shown next to the title (status, etc.). */
  badges?: React.ReactNode;
  /** One line of facts under the title, e.g. "Job #1042 · Tue 10 Nov". */
  meta?: React.ReactNode;
  /** Buttons on the right; on phones they wrap under the title. */
  actions?: React.ReactNode;
}

export const DetailHeader: React.FC<DetailHeaderProps> = ({ back, title, badges, meta, actions }) => (
  <div className="space-y-3">
    {back && <BackLink {...back} />}
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 text-2xl md:text-[1.75rem] font-bold text-navy tracking-tight leading-tight break-words">{title}</h1>
          {badges}
        </div>
        {meta && <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">{meta}</div>}
      </div>
      {actions && <div className="hidden md:flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  </div>
);

/** Two-column layout: main content on the left, a narrower column on the right (stacks on phones). */
export const DetailGrid: React.FC<{ main: React.ReactNode; side: React.ReactNode }> = ({ main, side }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 items-start">
    <div className="lg:col-span-2 space-y-4 md:space-y-5 min-w-0">{main}</div>
    <div className="space-y-4 md:space-y-5 min-w-0">{side}</div>
  </div>
);

/** Label/value pairs, e.g. phone, email, address. */
export const InfoList: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <dl className={cx('m-0 divide-y divide-line', className)}>{children}</dl>
);

export const InfoRow: React.FC<{ icon?: LucideIcon; label: string; children: React.ReactNode }> = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
    {Icon && <Icon size={16} className="text-subtle mt-0.5 shrink-0" />}
    <dt className="w-28 shrink-0 text-xs text-muted pt-0.5">{label}</dt>
    <dd className="m-0 min-w-0 flex-1 text-sm text-navy break-words">{children}</dd>
  </div>
);

/** Small number tiles, e.g. attic sqft / existing R / target R. */
export const Tiles: React.FC<{ items: { label: string; value: React.ReactNode }[] }> = ({ items }) => (
  <div className={cx('grid gap-2', items.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
    {items.map(it => (
      <div key={it.label} className="rounded-lg bg-canvas border border-line px-3 py-2.5 text-center">
        <div className="text-2xs text-muted">{it.label}</div>
        <div className="mt-0.5 text-base font-semibold text-navy">{it.value}</div>
      </div>
    ))}
  </div>
);

/**
 * Buttons pinned to the bottom of the screen on phones, so the next step is
 * always one thumb-tap away. Pages using it should add bottom padding (pb-24 md:pb-0).
 */
export const MobileActionBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2 [&>*]:flex-1">
    {children}
  </div>
);

export const DetailLoading: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex-1 flex items-center justify-center gap-2 min-h-[60vh] text-sm text-muted">
    <Loader2 size={20} className="animate-spin text-brand" />
    {label}
  </div>
);

export const DetailNotFound: React.FC<{ title: string; message?: string | null; back: { to: string; label: string } }> = ({ title, message, back }) => (
  <div className="flex-1 flex items-center justify-center min-h-[60vh]">
    <EmptyState
      icon={AlertCircle}
      title={title}
      description={message || 'It may have been deleted, or the link is wrong.'}
      action={<ButtonLink to={back.to} variant="secondary" icon={ArrowLeft}>{back.label}</ButtonLink>}
    />
  </div>
);
