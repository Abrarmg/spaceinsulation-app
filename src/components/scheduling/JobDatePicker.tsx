import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { addDaysToDate, todayLocal } from '../../utils/dates';

/**
 * Month calendar for picking a job's day. Days that already have jobs are
 * shaded green with how many are booked, so it's easy to spot quiet days.
 * Weeks start on Monday.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export const JobDatePicker: React.FC<{
  value: string;
  onChange: (ymd: string) => void;
  /** Editing an older job may keep a past date; new jobs can't be booked in the past. */
  allowPast?: boolean;
  /** Job being edited, so it isn't counted as "busy" on its own day. */
  excludeJobId?: string;
}> = ({ value, onChange, allowPast = false, excludeJobId }) => {
  const start = value || todayLocal();
  const [view, setView] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 }));
  const [busy, setBusy] = useState<Record<string, number>>({});

  // Follow the value when it changes from outside (e.g. opening the form from a schedule slot).
  useEffect(() => {
    if (value) setView({ y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)) - 1 });
  }, [value]);

  // Monday-first grid covering the month.
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1, 12);
    const lead = (first.getDay() + 6) % 7;
    const startYmd = addDaysToDate(ymd(view.y, view.m, 1), -lead);
    const daysInMonth = new Date(view.y, view.m + 1, 0, 12).getDate();
    const count = Math.ceil((lead + daysInMonth) / 7) * 7;
    return Array.from({ length: count }, (_, i) => addDaysToDate(startYmd, i));
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    const from = cells[0];
    const to = addDaysToDate(cells[cells.length - 1], 1);
    supabase
      .from('jobs')
      .select('id, scheduled_date, status')
      .gte('scheduled_date', `${from}T00:00:00Z`)
      .lt('scheduled_date', `${to}T00:00:00Z`)
      .then(({ data }) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        (data || []).forEach((j: { id: string; scheduled_date: string | null; status: string }) => {
          if (!j.scheduled_date || j.id === excludeJobId || j.status === 'Cancelled') return;
          const k = j.scheduled_date.slice(0, 10);
          counts[k] = (counts[k] || 0) + 1;
        });
        setBusy(counts);
      });
    return () => {
      cancelled = true;
    };
  }, [cells, excludeJobId]);

  const today = todayLocal();
  const monthLabel = new Date(view.y, view.m, 15, 12).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const move = (n: number) =>
    setView(v => {
      const d = new Date(v.y, v.m + n, 1, 12);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-base font-bold text-navy">{monthLabel}</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => move(-1)} aria-label="Previous month" className="w-9 h-9 flex items-center justify-center rounded-lg text-brand-ink hover:bg-mist border-0 bg-transparent">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => move(1)} aria-label="Next month" className="w-9 h-9 flex items-center justify-center rounded-lg text-brand-ink hover:bg-mist border-0 bg-transparent">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted pb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={monthLabel}>
        {cells.map(day => {
          const inMonth = Number(day.slice(5, 7)) - 1 === view.m;
          const past = day < today;
          const disabled = past && !allowPast && day !== value;
          const selected = day === value;
          const count = busy[day] || 0;
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => onChange(day)}
              aria-pressed={selected}
              aria-label={`${new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${
                count ? `, ${count} ${count === 1 ? 'job' : 'jobs'} booked` : ''
              }`}
              className={`relative h-11 rounded-lg text-sm font-semibold tabular-nums border-0 transition-colors disabled:cursor-not-allowed ${
                selected
                  ? 'bg-navy text-white'
                  : disabled
                    ? `text-line-strong ${count ? 'bg-mist' : 'bg-transparent'}`
                    : count
                      ? 'bg-brand/25 text-navy hover:bg-brand/40'
                      : inMonth
                        ? 'bg-transparent text-navy hover:bg-mist'
                        : 'bg-canvas text-subtle hover:bg-mist'
              } ${day === today && !selected ? 'ring-2 ring-inset ring-brand' : ''}`}
            >
              {Number(day.slice(8, 10))}
              {count > 0 && (
                <span
                  className={`absolute top-0.5 right-1 text-[0.625rem] font-bold leading-none ${selected ? 'text-brand' : disabled ? 'text-subtle' : 'text-brand-ink'}`}
                  aria-hidden
                >
                  {count}
                </span>
              )}
              {selected && <Check size={11} strokeWidth={3} className="absolute bottom-1 right-1 text-brand" aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[0.6875rem] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-brand/25" /> Jobs already booked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded ring-2 ring-inset ring-brand" /> Today
        </span>
      </div>
    </div>
  );
};
