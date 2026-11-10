import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { EASE } from '../ui/motion';
import { CalendarPlus, ChevronLeft, ChevronRight, ExternalLink, MapPin, Navigation, Phone, Users } from 'lucide-react';
import type { Crew, Job } from './types';
import { crewLabel, formatJobTimeRange, getJobCardTheme, getJobCrewMembers, parseJobDateStr, toDateKey, toMinutes } from './schedulingUtils';
import { Button, EmptyState } from '../ui';
import { todayDate } from '../../utils/dates';

interface AgendaViewProps {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onAddForDate: (dateKey: string) => void;
  crews?: Crew[];
  crewFilter?: string;
  onCrewFilter?: (id: string) => void;
  /** Desktop layout: two columns, month view first, arrow keys change day. */
  wide?: boolean;
  /** Extra content under the calendar in the desktop layout (e.g. jobs to schedule). */
  aside?: React.ReactNode;
}

type Mode = 'week' | 'month';

// The day's list slides out one side and in from the other, following the swipe.
type SlideDir = 'left' | 'right' | null;
const DAY_SLIDE = {
  enter: (d: SlideDir) => ({ opacity: 0, x: d === 'left' ? 28 : d === 'right' ? -28 : 0 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.2, ease: EASE } },
  exit: (d: SlideDir) => ({ opacity: 0, x: d === 'left' ? -28 : d === 'right' ? 28 : 0, transition: { duration: 0.12, ease: EASE } }),
};

const startOfWeek = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay(), 12);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
const addMonths = (d: Date, n: number) => {
  // Keep the same day where possible (31 Jan + 1 month → 28/29 Feb).
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0, 12).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last), 12);
};
const mapsUrl = (address: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

/** Detects a left/right swipe (mostly horizontal, at least 60px) and calls back with -1 or +1. */
const useSwipe = (onSwipe: (dir: -1 | 1) => void) => {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
    },
  };
};

/**
 * Phone schedule: a week strip or month grid to pick the day, crew filter
 * chips, then that day's jobs in time order. Swipe to change day; each job
 * has one-tap Call and Directions.
 */
export const AgendaView: React.FC<AgendaViewProps> = ({
  selectedDate,
  onSelectDate,
  jobs,
  onSelectJob,
  onAddForDate,
  crews = [],
  crewFilter = 'all',
  onCrewFilter,
  wide = false,
  aside,
}) => {
  const [mode, setMode] = useState<Mode>(wide ? 'month' : 'week');
  // Which way the last day change went, so the list slides in from that side.
  const [slide, setSlide] = useState<'left' | 'right' | null>(null);

  const todayKey = toDateKey(todayDate());
  const selectedKey = toDateKey(selectedDate);

  const countsByDay = useMemo(() => {
    const m = new Map<string, number>();
    jobs.forEach(j => {
      const k = parseJobDateStr(j.scheduled_date);
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }, [jobs]);

  const dayJobs = useMemo(
    () =>
      jobs
        .filter(j => parseJobDateStr(j.scheduled_date) === selectedKey)
        .sort((a, b) => (toMinutes(a.start_time) ?? 9999) - (toMinutes(b.start_time) ?? 9999)),
    [jobs, selectedKey],
  );

  const goDays = (n: number) => {
    setSlide(n > 0 ? 'left' : 'right');
    onSelectDate(addDays(selectedDate, n));
  };
  const goPeriod = (dir: -1 | 1) => {
    setSlide(dir > 0 ? 'left' : 'right');
    onSelectDate(mode === 'week' ? addDays(selectedDate, dir * 7) : addMonths(selectedDate, dir));
  };
  const pick = (d: Date) => {
    setSlide(d > selectedDate ? 'left' : d < selectedDate ? 'right' : null);
    onSelectDate(d);
  };

  const listSwipe = useSwipe(dir => goDays(dir));

  // Desktop: left/right arrow keys move a day (ignored while typing or when a pop-up is open).
  const goDaysRef = useRef(goDays);
  goDaysRef.current = goDays;
  useEffect(() => {
    if (!wide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"]') || t.closest('[role="dialog"], .fixed.inset-0'))) return;
      if (document.querySelector('.fixed.inset-0.z-50')) return;
      e.preventDefault();
      goDaysRef.current(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide]);
  const calendarSwipe = useSwipe(dir => goPeriod(dir));

  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Month grid: full weeks covering the selected month.
  const monthFirst = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12);
  const gridStart = startOfWeek(monthFirst);
  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 12).getDate();
  const cells = Math.ceil((monthFirst.getDay() + daysInMonth) / 7) * 7;
  const monthDays = Array.from({ length: cells }, (_, i) => addDays(gridStart, i));

  const dayButton = (d: Date, compact: boolean) => {
    const key = toDateKey(d);
    const isSel = key === selectedKey;
    const isToday = key === todayKey;
    const inMonth = d.getMonth() === selectedDate.getMonth();
    const count = countsByDay.get(key) || 0;
    return (
      <button
        key={key}
        type="button"
        onClick={() => pick(d)}
        aria-pressed={isSel}
        aria-label={`${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}, ${count} ${count === 1 ? 'job' : 'jobs'}`}
        className={`flex flex-col items-center gap-0.5 rounded-lg border-0 transition-colors ${compact ? 'py-1.5' : 'py-2'} ${
          isSel ? 'bg-navy text-white' : `bg-transparent hover:bg-mist ${inMonth || !compact ? 'text-navy' : 'text-subtle'}`
        }`}
      >
        {!compact && (
          <span className={`text-2xs ${isSel ? 'text-white/70' : 'text-muted'}`}>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
        )}
        <span className={`text-base font-semibold leading-none ${isToday && !isSel ? 'text-brand-ink' : ''}`}>{d.getDate()}</span>
        {compact ? (
          <span
            className={`min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[0.6875rem] font-semibold leading-[1.125rem] ${
              count ? (isSel ? 'bg-brand text-navy' : 'bg-brand-soft text-brand-ink') : 'bg-transparent'
            }`}
          >
            {count || ''}
          </span>
        ) : (
          <span className={`h-1.5 w-1.5 rounded-full ${count ? 'bg-brand' : 'bg-transparent'}`} />
        )}
      </button>
    );
  };

  const calendarCard = (
    <>
      {/* Week strip / month grid */}
      <div className="bg-white border border-line rounded-xl shadow-card p-2" {...calendarSwipe}>
        <div className="flex items-center justify-between gap-2 px-1 pb-2">
          <button
            type="button"
            onClick={() => goPeriod(-1)}
            aria-label={mode === 'week' ? 'Previous week' : 'Previous month'}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-soft hover:bg-mist border-0 bg-transparent"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-navy whitespace-nowrap">
            {/* Short month on narrow phones so it never gets cut off */}
            <span className="min-[380px]:hidden">
              {(mode === 'week' ? weekStart : monthFirst).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
            <span className="hidden min-[380px]:inline">
              {(mode === 'week' ? weekStart : monthFirst).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
          </span>
          <div className="flex items-center gap-1">
            <div className="flex p-0.5 rounded-lg bg-mist" role="group" aria-label="Calendar size">
              {(['week', 'month'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`h-7 px-2.5 rounded-md text-xs border-0 capitalize ${
                    mode === m ? 'bg-white text-navy font-semibold shadow-card' : 'bg-transparent text-muted font-medium'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => goPeriod(1)}
              aria-label={mode === 'week' ? 'Next week' : 'Next month'}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-soft hover:bg-mist border-0 bg-transparent"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {mode === 'week' ? (
          <div className="grid grid-cols-7 gap-1">{weekDays.map(d => dayButton(d, false))}</div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 pb-1">
              {weekDays.map(d => (
                <span key={d.getDay()} className="text-center text-2xs font-medium text-muted">
                  {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">{monthDays.map(d => dayButton(d, true))}</div>
          </>
        )}

        {selectedKey !== todayKey && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => pick(todayDate())}
              className="h-8 px-3 rounded-full text-xs font-semibold text-brand-ink bg-brand-soft border-0"
            >
              Back to today
            </button>
          </div>
        )}
      </div>

    </>
  );

  const crewChips = (
    <>
      {/* Crew filter */}
      {crews.length > 0 && onCrewFilter && (
        <div className={`flex gap-1.5 ${wide ? 'flex-wrap' : 'overflow-x-auto no-scrollbar -mx-4 px-4'}`} role="group" aria-label="Filter by crew">
          {[{ id: 'all', name: 'All crews' }, ...crews].map(c => {
            const active = crewFilter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCrewFilter(c.id)}
                aria-pressed={active}
                title={'memberNames' in c && c.memberNames?.length ? `${c.name}: ${c.memberNames.join(', ')}` : c.name}
                className={`shrink-0 h-9 px-3.5 rounded-full text-sm font-medium border transition-colors ${
                  active ? 'bg-navy text-white border-navy' : 'bg-white text-ink-soft border-line'
                }`}
              >
                {'memberNames' in c ? crewLabel(c) : c.name}
              </button>
            );
          })}
        </div>
      )}

    </>
  );

  const dayHeading = (
    <>
      {/* Day heading with previous / next day */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={() => goDays(-1)}
            aria-label="Previous day"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-ink-soft hover:bg-mist border-0 bg-transparent"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="text-base font-semibold text-navy truncate">
              {selectedKey === todayKey ? 'Today' : selectedDate.toLocaleDateString(undefined, { weekday: 'long' })}
              <span className="font-normal text-muted"> · {selectedDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
            </div>
            <div className="text-xs text-muted">
              {dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'}
              {crewFilter !== 'all' ? ' for this crew' : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={() => goDays(1)}
            aria-label="Next day"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-ink-soft hover:bg-mist border-0 bg-transparent"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <Button size="sm" variant="secondary" icon={CalendarPlus} onClick={() => onAddForDate(selectedKey)}>
          Add
        </Button>
      </div>

    </>
  );

  const dayList = (
    <>
      {/* Day list — swipe left/right to change day */}
      <AnimatePresence mode="wait" initial={false} custom={slide}>
      <m.div
        key={selectedKey}
        {...listSwipe}
        custom={slide}
        variants={DAY_SLIDE}
        initial="enter"
        animate="center"
        exit="exit"
        className="min-h-[40vh]"
      >
        {dayJobs.length === 0 ? (
          <div className="bg-white border border-line rounded-xl shadow-card">
            <EmptyState
              icon={CalendarPlus}
              title="Nothing booked"
              description={crewFilter !== 'all' ? 'This crew has no jobs on this day.' : 'No jobs on this day yet. Swipe to see other days.'}
              action={
                <Button icon={CalendarPlus} onClick={() => onAddForDate(selectedKey)}>
                  Schedule a job
                </Button>
              }
              className="py-10"
            />
          </div>
        ) : (
          <ul className={`m-0 p-0 list-none ${wide ? 'grid grid-cols-1 xl:grid-cols-2 gap-3' : 'space-y-2.5'}`}>
            {dayJobs.map(job => {
              const theme = getJobCardTheme(job);
              const crew = getJobCrewMembers(job);
              const address = job.customers?.service_address;
              const phone = job.customers?.phone;
              const action = 'h-11 inline-flex items-center justify-center gap-1.5 text-sm font-medium no-underline';
              return (
                <li key={job.id} className={`bg-white border border-line rounded-xl shadow-card overflow-hidden ${theme.borderAccent}`}>
                  <button type="button" onClick={() => onSelectJob(job)} className="w-full text-left p-3.5 flex gap-3 border-0 bg-transparent active:bg-mist">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink-soft">{formatJobTimeRange(job)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold ${theme.pillBg} ${theme.pillText}`}>{theme.pillLabel}</span>
                      </div>
                      <div className="text-[0.9375rem] font-semibold text-navy truncate">{job.customers?.full_name || `Job #${job.job_number}`}</div>
                      {address && (
                        <div className="flex items-start gap-1.5 text-xs text-muted">
                          <MapPin size={13} className="shrink-0 mt-0.5" />
                          <span className="truncate">{address}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs">
                        <Users size={13} className="shrink-0 text-muted" />
                        {crew.length ? (
                          <span className="text-ink-soft truncate">{crew.map(c => c.name).join(', ')}</span>
                        ) : (
                          <span className="text-amber-700 font-medium">Needs a crew</span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="grid grid-cols-3 border-t border-line divide-x divide-line">
                    {phone ? (
                      <a href={`tel:${phone}`} className={`${action} text-navy active:bg-mist`}>
                        <Phone size={16} className="text-brand-ink" /> Call
                      </a>
                    ) : (
                      <span className={`${action} text-subtle`}>No phone</span>
                    )}
                    {address ? (
                      <a href={mapsUrl(address)} target="_blank" rel="noopener noreferrer" className={`${action} text-navy active:bg-mist`}>
                        <Navigation size={16} className="text-brand-ink" /> Directions
                      </a>
                    ) : (
                      <span className={`${action} text-subtle`}>No address</span>
                    )}
                    <a href={`/jobs/${job.id}`} onClick={e => { e.preventDefault(); onSelectJob(job); }} className={`${action} text-brand-ink font-semibold active:bg-mist`}>
                      <ExternalLink size={15} /> Details
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </m.div>
      </AnimatePresence>
    </>
  );

  // Desktop: calendar and crews on the left, the day's jobs on the right.
  if (wide) {
    return (
      <div className="grid grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] gap-5 items-start">
        <div className="space-y-3 sticky top-20">
          {calendarCard}
          {crewChips}
          {aside}
        </div>
        <div className="space-y-3 min-w-0">
          {dayHeading}
          {dayList}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {calendarCard}
      {crewChips}
      {dayHeading}
      {dayList}
    </div>
  );
};
