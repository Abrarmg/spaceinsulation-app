import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Coffee, LogIn, LogOut, Pencil, Square, Timer } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Button, Card, EmptyState, Field, Input, Page, PageHeader, Sheet, Textarea } from '../components/ui';
import { ListLoading } from '../components/ui/list';
import { addDaysToDate, appDayStartISO, appWallTimeToISO, partsInAppTz, todayLocal } from '../utils/dates';
import { formatClock, formatHours, loadMyDay, stopJobTimer, totalMs, updateJobTimeEntry, useNow } from '../utils/jobTimer';
import type { BreakEntry, JobTimeEntry, ShiftEntry } from '../utils/jobTimer';

/**
 * Crew timesheet: one day at a time, as a timeline — clock in, time on each
 * job, breaks, clock out. Job time can be corrected (start, end, note);
 * clock in / out times are payroll records and stay read-only here.
 */

type TimelineItem =
  | { kind: 'clock-in'; at: string; shift: ShiftEntry }
  | { kind: 'clock-out'; at: string; shift: ShiftEntry }
  | { kind: 'break'; at: string; brk: BreakEntry }
  | { kind: 'job'; at: string; entry: JobTimeEntry };

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const hhmm = (iso: string) => {
  const p = partsInAppTz(new Date(iso));
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
};

export const Timesheet: React.FC = () => {
  const [day, setDay] = useState(() => todayLocal());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ available: boolean; jobEntries: JobTimeEntry[]; shifts: ShiftEntry[]; breaks: BreakEntry[] }>({
    available: true,
    jobEntries: [],
    shifts: [],
    breaks: [],
  });
  const [editing, setEditing] = useState<JobTimeEntry | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await loadMyDay(userId, appDayStartISO(day), appDayStartISO(addDaysToDate(day, 1))));
    } catch (err: any) {
      setError(err.message || 'Could not load your time.');
    } finally {
      setLoading(false);
    }
  }, [userId, day]);

  useEffect(() => {
    load();
  }, [load]);

  const running = data.jobEntries.some(e => !e.ended_at) || data.shifts.some(s => !s.clock_out);
  const now = useNow(running);

  const shiftMs = data.shifts.reduce((sum, s) => sum + totalMs([{ started_at: s.clock_in, ended_at: s.clock_out }], now), 0);
  const breakMs = data.breaks.reduce((sum, b) => sum + totalMs([{ started_at: b.break_start, ended_at: b.break_end }], now), 0);
  const jobMs = totalMs(data.jobEntries, now);
  const activeShift = data.shifts.find(s => !s.clock_out);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    data.shifts.forEach(shift => {
      items.push({ kind: 'clock-in', at: shift.clock_in, shift });
      if (shift.clock_out) items.push({ kind: 'clock-out', at: shift.clock_out, shift });
    });
    data.breaks.forEach(brk => items.push({ kind: 'break', at: brk.break_start, brk }));
    data.jobEntries.forEach(entry => items.push({ kind: 'job', at: entry.started_at, entry }));
    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [data]);

  const isToday = day === todayLocal();
  const dayTitle = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const stop = async (entry: JobTimeEntry) => {
    try {
      await stopJobTimer(entry.id);
      await load();
    } catch (err: any) {
      alert('Could not stop the timer: ' + (err.message || err));
    }
  };

  return (
    <Page className="!max-w-4xl">
      <PageHeader title="Timesheet" subtitle="Your time for the day. Tap Edit to fix a job time or add a note." />

      {/* Day picker */}
      <div className="flex items-center justify-between gap-2 bg-white border border-line rounded-xl shadow-card p-2">
        <button
          type="button"
          onClick={() => setDay(d => addDaysToDate(d, -1))}
          aria-label="Previous day"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-soft hover:bg-mist border-0 bg-transparent"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center min-w-0">
          <div className="text-sm font-semibold text-navy truncate">{isToday ? 'Today' : dayTitle}</div>
          {isToday && <div className="text-xs text-muted">{dayTitle}</div>}
        </div>
        <div className="flex items-center gap-1">
          {!isToday && (
            <button
              type="button"
              onClick={() => setDay(todayLocal())}
              className="h-8 px-3 rounded-full text-xs font-semibold text-brand-ink bg-brand-soft border-0"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={() => setDay(d => addDaysToDate(d, 1))}
            disabled={isToday}
            aria-label="Next day"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-soft hover:bg-mist border-0 bg-transparent disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Day totals */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {[
          { label: 'On the clock', value: formatHours(Math.max(0, shiftMs - breakMs)), live: !!activeShift },
          { label: 'On jobs', value: formatHours(jobMs), live: data.jobEntries.some(e => !e.ended_at) },
          { label: 'Breaks', value: formatHours(breakMs), live: data.breaks.some(b => !b.break_end) },
        ].map(t => (
          <div key={t.label} className="bg-white border border-line rounded-xl shadow-card p-3 md:p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
              {t.live && <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />}
              {t.label}
            </div>
            <div className="mt-1 text-xl md:text-2xl font-bold text-navy tabular-nums">{t.value}</div>
          </div>
        ))}
      </div>

      {isToday && activeShift && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-brand-soft border border-brand/30 text-sm">
          <span className="text-brand-ink font-medium">Clocked in since {timeOf(activeShift.clock_in)}</span>
          <Link to="/worker-dashboard" className="font-semibold text-navy no-underline hover:underline">
            Clock out on Home
          </Link>
        </div>
      )}

      {!data.available && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
          Job timers aren't switched on yet, so only clock in / out is shown. Ask the office to finish the set-up.
        </div>
      )}

      {/* Timeline */}
      <Card padded={false}>
        {loading ? (
          <ListLoading label="Loading your time…" rows={4} />
        ) : error ? (
          <p className="m-0 p-6 text-sm text-red-700 text-center">{error}</p>
        ) : timeline.length === 0 ? (
          <EmptyState
            icon={Timer}
            title="No time on this day"
            description={isToday ? 'Clock in on Home when you start, then start the timer on each job.' : 'Nothing was tracked on this day.'}
          />
        ) : (
          <ol className="m-0 p-4 md:p-5 list-none">
            {timeline.map((item, i) => {
              const last = i === timeline.length - 1;
              const dot =
                item.kind === 'job'
                  ? !item.entry.ended_at
                    ? 'bg-brand border-brand'
                    : 'bg-white border-brand'
                  : item.kind === 'break'
                    ? 'bg-white border-amber-400'
                    : 'bg-white border-line-strong';
              return (
                <li key={`${item.kind}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                  {/* Rail */}
                  <div className="flex flex-col items-center w-4 shrink-0">
                    <span className={`mt-1 w-3.5 h-3.5 rounded-full border-2 ${dot}`} />
                    {!last && <span className="flex-1 w-px bg-line mt-1" aria-hidden />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-muted">{timeOf(item.at)}</div>

                    {item.kind === 'clock-in' && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-navy">
                        <LogIn size={15} className="text-brand-ink" /> Clocked in
                      </div>
                    )}
                    {item.kind === 'clock-out' && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-navy">
                        <LogOut size={15} className="text-muted" /> Clocked out
                      </div>
                    )}
                    {item.kind === 'break' && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-sm text-amber-800">
                        <Coffee size={15} /> Break ·{' '}
                        {item.brk.break_end ? formatHours(totalMs([{ started_at: item.brk.break_start, ended_at: item.brk.break_end }])) : 'on break now'}
                      </div>
                    )}
                    {item.kind === 'job' && (
                      <div
                        className={`mt-1.5 rounded-xl border p-3.5 ${!item.entry.ended_at ? 'border-brand/40 bg-brand-soft/40' : 'border-line bg-white'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm text-ink-soft">
                              Tracked time:{' '}
                              <span className={`font-semibold tabular-nums ${!item.entry.ended_at ? 'text-brand-ink' : 'text-navy'}`}>
                                {formatClock(totalMs([item.entry], now))}
                              </span>
                            </div>
                            <Link to={`/jobs/${item.entry.job_id}`} className="block mt-0.5 text-[0.9375rem] font-semibold text-navy no-underline hover:underline truncate">
                              {item.entry.jobs?.customers?.full_name || 'Job'}
                              {item.entry.jobs?.job_number ? <span className="font-normal text-muted"> · Job #{item.entry.jobs.job_number}</span> : null}
                            </Link>
                            <div className="text-xs text-muted mt-0.5">
                              {timeOf(item.entry.started_at)} – {item.entry.ended_at ? timeOf(item.entry.ended_at) : 'now'}
                            </div>
                            {item.entry.note && <p className="m-0 mt-2 text-sm text-ink-soft line-clamp-3">{item.entry.note}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {!item.entry.ended_at && (
                              <button
                                type="button"
                                onClick={() => stop(item.entry)}
                                className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 border-0 bg-transparent"
                              >
                                <Square size={12} fill="currentColor" /> Stop timer
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditing(item.entry)}
                              aria-label={`Edit time entry for ${item.entry.jobs?.customers?.full_name || 'this job'}`}
                              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-brand-ink hover:bg-brand-soft border-0 bg-transparent"
                            >
                              <Pencil size={14} /> Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <p className="m-0 text-xs text-muted flex items-center gap-1.5">
        <Clock size={13} /> Clock in and clock out times are payroll records. Ask the office if one needs fixing.
      </p>

      <EditTimeEntrySheet entry={editing} day={day} onClose={() => setEditing(null)} onSaved={load} />
    </Page>
  );
};

/* -------------------------------------------------------------------------- */
/* Edit one job time entry                                                    */
/* -------------------------------------------------------------------------- */

const EditTimeEntrySheet: React.FC<{ entry: JobTimeEntry | null; day: string; onClose: () => void; onSaved: () => void }> = ({
  entry,
  day,
  onClose,
  onSaved,
}) => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setStart(hhmm(entry.started_at));
    setEnd(entry.ended_at ? hhmm(entry.ended_at) : '');
    setNote(entry.note || '');
    setError(null);
  }, [entry]);

  const toISO = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return appWallTimeToISO(day, h, m);
  };
  const running = !!entry && !entry.ended_at;
  const durationMs = start && end ? new Date(toISO(end)).getTime() - new Date(toISO(start)).getTime() : null;

  const save = async () => {
    if (!entry) return;
    if (!start) return setError('Enter a start time.');
    if (!running && !end) return setError('Enter an end time.');
    const startISO = toISO(start);
    const endISO = end ? toISO(end) : null;
    if (endISO && new Date(endISO) < new Date(startISO)) return setError('The end time is before the start time.');
    if (new Date(startISO).getTime() > Date.now() || (endISO && new Date(endISO).getTime() > Date.now() + 60000)) {
      return setError('Times can’t be later than now.');
    }
    setSaving(true);
    setError(null);
    try {
      await updateJobTimeEntry(entry.id, { started_at: startISO, ended_at: endISO, note: note.trim() || null });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not save the change.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={!!entry}
      onClose={onClose}
      title="Edit time entry"
      description={entry?.jobs?.customers?.full_name ? `${entry.jobs.customers.full_name}${entry.jobs.job_number ? ` · Job #${entry.jobs.job_number}` : ''}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save time entry
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time" htmlFor="te-start">
            <Input id="te-start" type="time" value={start} onChange={e => setStart(e.target.value)} />
          </Field>
          <Field label="End time" htmlFor="te-end" hint={running && !end ? 'Still running — leave empty to keep it going' : undefined}>
            <Input id="te-end" type="time" value={end} onChange={e => setEnd(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-canvas border border-line px-3 py-2.5 text-sm">
          <span className="text-muted">Duration</span>
          <span className="font-semibold text-navy tabular-nums">
            {durationMs === null ? (running ? 'Running' : '—') : durationMs < 0 ? 'End is before start' : formatHours(durationMs)}
          </span>
        </div>
        <Field label="Note" htmlFor="te-note" hint="For example: took extra time to train a new crew member.">
          <Textarea id="te-note" rows={3} value={note} onChange={e => setNote(e.target.value)} />
        </Field>
        {error && <p className="m-0 text-sm text-red-700">{error}</p>}
      </div>
    </Sheet>
  );
};
