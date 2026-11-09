import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Eye,
  FilePlus2,
  FileSpreadsheet,
  Inbox,
  PenLine,
  Send,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Everything that has happened with one customer, newest first:
 * leads, estimates (sent, viewed, approved), jobs, sign-offs, invoices and payments.
 * Built only from records the contact page already loads.
 */

type Kind = 'sales' | 'jobs' | 'money';

interface TimelineEvent {
  id: string;
  at: Date;
  kind: Kind;
  icon: LucideIcon;
  tone: string;
  title: string;
  detail?: string;
  to?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CustomerTimelineProps {
  contact: { id: string; created_at: string; source?: string | null };
  leads: any[];
  estimates: any[];
  jobs: any[];
  invoices: any[];
  inspections?: any[];
}

const money = (n: unknown) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Parses a timestamp; plain dates (YYYY-MM-DD) are read at noon so they never shift a day. */
const when = (v: unknown): Date | null => {
  if (!v || typeof v !== 'string') return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v);
  return isNaN(d.getTime()) ? null : d;
};

/** Calendar date of a job, which is stored at midnight UTC. */
const jobDay = (v: unknown) => {
  if (!v || typeof v !== 'string') return null;
  const d = new Date(`${v.slice(0, 10)}T12:00:00`);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

const parsePayments = (raw: unknown): { amount: number; method?: string; date?: string }[] => {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.payments) ? parsed.payments : [];
  } catch {
    return [];
  }
};

const sourceLabel = (s?: string | null) => {
  const v = (s || '').toLowerCase();
  if (!v || v === 'manual') return null;
  if (v === 'facebook') return 'Facebook';
  if (v === 'csv_import') return 'spreadsheet import';
  if (v === 'existing_customer') return 'existing customer';
  return v.replace(/_/g, ' ');
};

const TONES = {
  lead: 'bg-purple-50 text-purple-700',
  estimate: 'bg-blue-50 text-blue-700',
  good: 'bg-brand-soft text-brand-ink',
  job: 'bg-amber-50 text-amber-700',
  neutral: 'bg-mist text-ink-soft',
};

const buildEvents = ({ contact, leads, estimates, jobs, invoices, inspections = [] }: CustomerTimelineProps): TimelineEvent[] => {
  const out: TimelineEvent[] = [];
  const push = (e: Omit<TimelineEvent, 'at'> & { at: Date | null }) => {
    if (e.at) out.push(e as TimelineEvent);
  };

  const src = sourceLabel(contact.source);
  push({
    id: `contact-${contact.id}`,
    at: when(contact.created_at),
    kind: 'sales',
    icon: UserPlus,
    tone: TONES.neutral,
    title: 'Added as a contact',
    detail: src ? `From ${src}` : undefined,
  });

  for (const l of leads) {
    const s = sourceLabel(l.source);
    push({
      id: `lead-${l.id}`,
      at: when(l.received_at) || when(l.created_at),
      kind: 'sales',
      icon: Inbox,
      tone: TONES.lead,
      title: s ? `New lead from ${s}` : 'New lead',
      detail: l.status ? `Status: ${String(l.status).replace(/_/g, ' ')}` : undefined,
      to: `/leads/${l.id}`,
    });
  }

  for (const r of inspections) {
    push({
      id: `insp-${r.id}`,
      at: when(r.completed_at) || when(r.created_at),
      kind: 'sales',
      icon: ClipboardCheck,
      tone: TONES.neutral,
      title: r.status === 'completed' ? 'Home inspection completed' : 'Home inspection started',
    });
  }

  for (const e of estimates) {
    const label = `Estimate #${e.estimate_number ?? ''}`;
    const to = `/estimates/${e.id}`;
    push({
      id: `est-${e.id}`,
      at: when(e.created_at),
      kind: 'sales',
      icon: FilePlus2,
      tone: TONES.estimate,
      title: `${label} created`,
      detail: [e.title, money(e.total_amount)].filter(Boolean).join(' · '),
      to,
    });
    push({ id: `est-sent-${e.id}`, at: when(e.sent_at), kind: 'sales', icon: Send, tone: TONES.estimate, title: `${label} sent to the customer`, to });
    push({
      id: `est-view-${e.id}`,
      at: when(e.first_viewed_at) || when(e.last_viewed_at),
      kind: 'sales',
      icon: Eye,
      tone: TONES.estimate,
      title: `Customer opened ${label.toLowerCase()}`,
      detail: Number(e.view_count) > 1 ? `Viewed ${e.view_count} times` : undefined,
      to,
    });
    push({
      id: `est-ok-${e.id}`,
      at: when(e.approved_at),
      kind: 'sales',
      icon: CheckCircle2,
      tone: TONES.good,
      title: `${label} approved`,
      detail: money(e.total_amount),
      to,
    });
  }

  for (const j of jobs) {
    const label = `Job #${j.job_number ?? ''}`;
    const to = `/jobs/${j.id}`;
    const day = jobDay(j.scheduled_date);
    push({
      id: `job-${j.id}`,
      at: when(j.created_at),
      kind: 'jobs',
      icon: Briefcase,
      tone: TONES.job,
      title: day ? `${label} booked for ${day}` : `${label} created`,
      detail: [j.status, j.quoted_amount ? money(j.quoted_amount) : null].filter(Boolean).join(' · '),
      to,
    });
    push({ id: `job-sig-${j.id}`, at: when(j.signed_at), kind: 'jobs', icon: PenLine, tone: TONES.good, title: `Customer signed off ${label.toLowerCase()}`, to });
  }

  for (const inv of invoices) {
    const label = `Invoice ${inv.invoice_number ?? ''}`.trim();
    const to = `/invoices/${inv.id}`;
    push({
      id: `inv-${inv.id}`,
      at: when(inv.created_at),
      kind: 'money',
      icon: FileSpreadsheet,
      tone: TONES.neutral,
      title: `${label} created`,
      detail: `${money(inv.total)} · ${inv.status || 'Draft'}`,
      to,
    });
    const payments = parsePayments(inv.stripe_payment_id);
    payments.forEach((p, i) =>
      push({
        id: `pay-${inv.id}-${i}`,
        at: when(p.date),
        kind: 'money',
        icon: CreditCard,
        tone: TONES.good,
        title: `Payment received · ${money(p.amount)}`,
        detail: [p.method, label].filter(Boolean).join(' · '),
        to,
      }),
    );
    if (payments.length === 0 && String(inv.status).toLowerCase() === 'paid') {
      push({ id: `paid-${inv.id}`, at: when(inv.paid_at), kind: 'money', icon: CreditCard, tone: TONES.good, title: `${label} paid in full`, detail: money(inv.total), to });
    }
  }

  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
};

const FILTERS: { id: 'all' | Kind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sales', label: 'Leads & estimates' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'money', label: 'Invoices & payments' },
];

const PAGE = 15;

export const CustomerTimeline: React.FC<CustomerTimelineProps> = props => {
  const events = useMemo(() => buildEvents(props), [props]);
  const [filter, setFilter] = useState<'all' | Kind>('all');
  const [limit, setLimit] = useState(PAGE);

  const shown = events.filter(e => filter === 'all' || e.kind === filter);
  const visible = shown.slice(0, limit);

  // Group by month so long histories stay easy to scan.
  const groups: { label: string; items: TimelineEvent[] }[] = [];
  for (const e of visible) {
    const label = e.at.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pt-3 pb-1">
        {FILTERS.map(f => {
          const count = f.id === 'all' ? events.length : events.filter(e => e.kind === f.id).length;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setLimit(PAGE);
              }}
              className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
                active ? 'bg-navy text-white border-navy' : 'bg-white text-ink-soft border-line hover:bg-mist'
              }`}
            >
              {f.label} <span className={active ? 'text-white/70' : 'text-muted'}>{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="m-0 px-4 py-8 text-sm text-muted text-center">Nothing here yet.</p>
      ) : (
        <div className="px-4 pb-4">
          {groups.map(g => (
            <section key={g.label}>
              <h3 className="m-0 pt-4 pb-2 text-2xs font-semibold text-muted uppercase tracking-wider">{g.label}</h3>
              <ol className="m-0 p-0 list-none relative">
                {g.items.map((e, i) => {
                  const Icon = e.icon;
                  const last = i === g.items.length - 1;
                  const body = (
                    <>
                      <span className="relative flex flex-col items-center shrink-0">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center ${e.tone}`}>
                          <Icon size={15} />
                        </span>
                        {!last && <span className="flex-1 w-px bg-line mt-1" aria-hidden />}
                      </span>
                      <span className={`min-w-0 flex-1 ${last ? 'pb-1' : 'pb-4'}`}>
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium text-navy">{e.title}</span>
                          <time className="text-xs text-muted shrink-0 tabular-nums" dateTime={e.at.toISOString()}>
                            {e.at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          </time>
                        </span>
                        {e.detail && <span className="block text-xs text-muted mt-0.5 truncate">{e.detail}</span>}
                      </span>
                    </>
                  );
                  return (
                    <li key={e.id}>
                      {e.to ? (
                        <Link to={e.to} className="flex gap-3 no-underline rounded-lg -mx-2 px-2 pt-1 hover:bg-canvas">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex gap-3 -mx-2 px-2 pt-1">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {shown.length > limit && (
            <button
              type="button"
              onClick={() => setLimit(l => l + PAGE)}
              className="mt-3 w-full h-10 rounded-lg border border-line bg-white text-sm font-medium text-navy hover:bg-mist"
            >
              Show older ({shown.length - limit} more)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
