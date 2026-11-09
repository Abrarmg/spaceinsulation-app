import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, CreditCard, Eye, Inbox, PenLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

/**
 * Office notifications built from dates the app already records — no extra
 * table needed: new leads, estimates opened or approved, invoices paid and
 * jobs signed off in the last two weeks. "Read" is remembered per user on
 * this device.
 */

interface Notice {
  id: string;
  at: Date;
  icon: LucideIcon;
  tone: string;
  title: string;
  detail?: string;
  to: string;
}

const WINDOW_DAYS = 14;
const POLL_MS = 60_000;

const when = (v: unknown) => {
  if (!v || typeof v !== 'string') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const money = (n: unknown) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const nameOf = (c: unknown): string | undefined => {
  const row = Array.isArray(c) ? c[0] : c;
  return row && typeof row === 'object' ? (row as { full_name?: string }).full_name : undefined;
};

const timeAgo = (d: Date) => {
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const loadNotices = async (): Promise<Notice[]> => {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400e3).toISOString();
  const rows = async (q: PromiseLike<{ data: any[] | null; error: unknown }>) => {
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  };
  const [leads, viewed, approved, paid, signed] = await Promise.allSettled([
    rows(supabase.from('leads').select('id, name, source, received_at').gte('received_at', since).order('received_at', { ascending: false }).limit(15)),
    rows(
      supabase
        .from('estimates')
        .select('id, estimate_number, customer_name, last_viewed_at, view_count')
        .gte('last_viewed_at', since)
        .order('last_viewed_at', { ascending: false })
        .limit(15),
    ),
    rows(
      supabase
        .from('estimates')
        .select('id, estimate_number, customer_name, total_amount, approved_at')
        .gte('approved_at', since)
        .order('approved_at', { ascending: false })
        .limit(15),
    ),
    rows(
      supabase
        .from('invoices')
        .select('id, invoice_number, total, paid_at, customers(full_name)')
        .gte('paid_at', since)
        .order('paid_at', { ascending: false })
        .limit(15),
    ),
    rows(
      supabase
        .from('jobs')
        .select('id, job_number, signed_at, customers(full_name)')
        .gte('signed_at', since)
        .order('signed_at', { ascending: false })
        .limit(15),
    ),
  ]);
  const ok = (r: PromiseSettledResult<any[]>) => (r.status === 'fulfilled' ? r.value : []);
  const out: Notice[] = [];

  for (const l of ok(leads)) {
    const at = when(l.received_at);
    if (!at) continue;
    const src = (l.source || '').toLowerCase();
    out.push({
      id: `lead-${l.id}`,
      at,
      icon: Inbox,
      tone: 'bg-purple-50 text-purple-700',
      title: `New lead${src === 'facebook' ? ' from Facebook' : src === 'website' ? ' from your website' : ''}`,
      detail: l.name || 'No name given',
      to: `/leads/${l.id}`,
    });
  }
  for (const e of ok(viewed)) {
    const at = when(e.last_viewed_at);
    if (!at) continue;
    out.push({
      // Include the time so a later view shows up as new again.
      id: `view-${e.id}-${e.last_viewed_at}`,
      at,
      icon: Eye,
      tone: 'bg-blue-50 text-blue-700',
      title: `${e.customer_name || 'A customer'} opened estimate #${e.estimate_number ?? ''}`,
      detail: Number(e.view_count) > 1 ? `Viewed ${e.view_count} times — a good moment to follow up` : 'A good moment to follow up',
      to: `/estimates/${e.id}`,
    });
  }
  for (const e of ok(approved)) {
    const at = when(e.approved_at);
    if (!at) continue;
    out.push({
      id: `approved-${e.id}`,
      at,
      icon: CheckCircle2,
      tone: 'bg-brand-soft text-brand-ink',
      title: `Estimate #${e.estimate_number ?? ''} approved`,
      detail: `${e.customer_name || 'Customer'} · ${money(e.total_amount)} — convert it to a job`,
      to: `/estimates/${e.id}`,
    });
  }
  for (const inv of ok(paid)) {
    const at = when(inv.paid_at);
    if (!at) continue;
    out.push({
      id: `paid-${inv.id}`,
      at,
      icon: CreditCard,
      tone: 'bg-brand-soft text-brand-ink',
      title: `Invoice ${inv.invoice_number || ''} paid`.replace(/\s+/g, ' '),
      detail: `${nameOf(inv.customers) || 'Customer'} · ${money(inv.total)}`,
      to: `/invoices/${inv.id}`,
    });
  }
  for (const j of ok(signed)) {
    const at = when(j.signed_at);
    if (!at) continue;
    out.push({
      id: `signed-${j.id}`,
      at,
      icon: PenLine,
      tone: 'bg-amber-50 text-amber-700',
      title: `Job #${j.job_number ?? ''} signed off`,
      detail: `${nameOf(j.customers) || 'Customer'} — ready to invoice`,
      to: `/jobs/${j.id}`,
    });
  }

  return out.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 30);
};

const seenKey = (uid?: string) => `si.notifications.seen.${uid || 'anon'}`;

const readSeen = (uid?: string) => {
  try {
    const v = Number(localStorage.getItem(seenKey(uid)));
    if (v) return v;
  } catch {
    /* storage unavailable */
  }
  // First visit: only the last day counts as new, so the badge doesn't start at 9+.
  return Date.now() - 86400e3;
};

export const NotificationBell: React.FC = () => {
  const { session } = useAuth();
  const uid = session?.user?.id;
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [seenAt, setSeenAt] = useState(() => readSeen(uid));
  // While the panel is open, keep showing which items were new when it opened.
  const [highlightSince, setHighlightSince] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    loadNotices()
      .then(setNotices)
      .catch(err => console.warn('Notifications failed to load:', err));
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const unread = (notices || []).filter(n => n.at.getTime() > seenAt).length;

  const markSeen = () => {
    const now = Date.now();
    setSeenAt(now);
    try {
      localStorage.setItem(seenKey(uid), String(now));
    } catch {
      /* storage unavailable — read state lasts for this visit */
    }
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setHighlightSince(seenAt);
    markSeen();
    refresh();
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      if (window.innerWidth < 640) setPos({ top: r.bottom + 8, left: 8, right: 8 });
      else setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right), width: 380 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
        aria-expanded={open}
        className={`relative w-10 h-10 flex items-center justify-center rounded-lg border-0 ${
          open ? 'bg-mist text-navy' : 'bg-transparent text-ink-soft hover:bg-mist'
        }`}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[0.6875rem] font-bold leading-[18px] text-center ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            style={{ position: 'fixed', ...pos }}
            className="z-[70] bg-white border border-line rounded-xl shadow-pop overflow-hidden animate-fade-in"
          >
            <div className="flex items-center justify-between px-4 h-12 border-b border-line">
              <span className="text-sm font-semibold text-navy">Notifications</span>
              <span className="text-xs text-muted">Last {WINDOW_DAYS} days</span>
            </div>
            {notices === null ? (
              <div className="p-4 space-y-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-12 rounded-lg bg-mist animate-pulse" />
                ))}
              </div>
            ) : notices.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="w-11 h-11 mx-auto rounded-full bg-brand-soft text-brand-ink flex items-center justify-center">
                  <Bell size={20} />
                </div>
                <div className="mt-3 text-sm font-semibold text-navy">You're all caught up</div>
                <p className="m-0 mt-1 text-xs text-muted">
                  New leads, estimate views and approvals, payments and job sign-offs will show up here.
                </p>
              </div>
            ) : (
              <ul className="m-0 p-0 list-none max-h-[min(70vh,480px)] overflow-y-auto divide-y divide-line">
                {notices.map(n => {
                  const Icon = n.icon;
                  const isNew = highlightSince !== null && n.at.getTime() > highlightSince;
                  return (
                    <li key={n.id}>
                      <Link
                        to={n.to}
                        onClick={() => setOpen(false)}
                        className={`flex items-start gap-3 px-4 py-3 no-underline hover:bg-canvas ${isNew ? 'bg-brand-soft/40' : ''}`}
                      >
                        <span className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${n.tone}`}>
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-navy leading-snug">{n.title}</span>
                          {n.detail && <span className="block text-xs text-muted mt-0.5 leading-snug">{n.detail}</span>}
                          <span className="block text-2xs text-subtle mt-1">{timeAgo(n.at)}</span>
                        </span>
                        {isNew && <span className="w-2 h-2 mt-1.5 rounded-full bg-brand shrink-0" aria-label="New" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
};
