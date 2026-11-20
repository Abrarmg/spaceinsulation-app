import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Crew, Job } from './types';
import { DRAG_MIME, crewLabel, isJobForCrew, parseJobDateStr, toDateKey, toMinutes } from './schedulingUtils';
import { todayDate } from '../../utils/dates';
import { holidayOn } from '../../utils/holidays';

/**
 * Dense month calendar for desktop, laid out like a wall/Outlook calendar:
 * week numbers down the side, Monday-first columns, and every job as a solid
 * colour bar reading "8:00a  Customer – City". Colour = the crew doing the job
 * (or the job's own colour if one was picked). Days with more jobs than fit
 * show "+N"; click it to see them all.
 */

interface MonthBoardViewProps {
  currentDate: Date;
  jobs: Job[];
  crews: Crew[];
  onSelectJob: (job: Job) => void;
  onDateClick: (dateStr: string) => void;
  onDropJob: (jobId: string, dateStr: string) => void;
}

const MAX_BARS = 5;

// Strong colours so white text stays readable on the bars.
const CREW_PALETTE = ['#2563EB', '#7C3AED', '#15803D', '#DC2626', '#EA580C', '#0F766E', '#DB2777', '#0369A1', '#A16207', '#4D7C0F'];
const UNASSIGNED = '#64748B';
// Picked job colours (jobColors.ts keys) as solid bar colours.
const SOLID_BY_KEY: Record<string, string> = {
  blue: '#2563EB', sky: '#0369A1', teal: '#0F766E', green: '#15803D', lime: '#4D7C0F', yellow: '#A16207',
  orange: '#EA580C', red: '#DC2626', pink: '#DB2777', purple: '#7C3AED', brown: '#92400E', slate: '#475569',
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** ISO-8601 week number (weeks start Monday; week 1 holds the first Thursday). */
const isoWeek = (d: Date) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

/** "08:30:00" → "8:30a" */
const shortTime = (time: string | null | undefined) => {
  const mins = toMinutes(time);
  if (mins === null) return '';
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'a' : 'p'}`;
};

/** "14 Maple Ave, Oakville, ON L6J 1A1" → "Oakville" */
const cityOf = (address: string | null | undefined) => {
  const parts = (address || '').split(',').map(p => p.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[1].replace(/\s+[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i, '') : '';
};

const isDone = (job: Job) => /complete|paid|invoic/i.test(job.status || '');
const isCancelled = (job: Job) => /cancel/i.test(job.status || '');

export const MonthBoardView: React.FC<MonthBoardViewProps> = ({ currentDate, jobs, crews, onSelectJob, onDateClick, onDropJob }) => {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openDay) return;
    const close = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpenDay(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpenDay(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [openDay]);

  const crewColor = useMemo(() => {
    const map = new Map<string, string>();
    crews.forEach((c, i) => map.set(c.id, CREW_PALETTE[i % CREW_PALETTE.length]));
    return map;
  }, [crews]);

  const colorFor = (job: Job) => {
    if (job.color && SOLID_BY_KEY[job.color]) return SOLID_BY_KEY[job.color];
    const crew = crews.find(c => isJobForCrew(job, c));
    return crew ? crewColor.get(crew.id)! : UNASSIGNED;
  };
  const crewNameFor = (job: Job) => {
    const crew = crews.find(c => isJobForCrew(job, c));
    return crew ? crewLabel(crew) : 'No crew yet';
  };

  const jobsByDay = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const job of jobs) {
      const d = parseJobDateStr(job.scheduled_date);
      if (!d) continue;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(job);
    }
    // Earliest first; jobs with no time go last.
    for (const list of map.values()) {
      list.sort((a, b) => (toMinutes(a.start_time) ?? 9999) - (toMinutes(b.start_time) ?? 9999) || a.job_number - b.job_number);
    }
    return map;
  }, [jobs]);

  // Monday on/before the 1st through the Sunday on/after the last day.
  const weeks = useMemo(() => {
    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    const first = new Date(y, m, 1, 12);
    const start = new Date(y, m, 1 - ((first.getDay() + 6) % 7), 12);
    const last = new Date(y, m + 1, 0, 12);
    const end = new Date(y, m + 1, 0 + ((7 - last.getDay()) % 7), 12);
    const out: Date[][] = [];
    for (let d = new Date(start); d <= end; ) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(d));
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12);
      }
      out.push(week);
    }
    return out;
  }, [currentDate]);

  const todayKey = toDateKey(todayDate());
  const month = currentDate.getMonth();

  const legend = useMemo(() => {
    const items = crews.map(c => ({ label: crewLabel(c), color: crewColor.get(c.id)! }));
    if (jobs.some(j => !crews.some(c => isJobForCrew(j, c)) && !j.color)) items.push({ label: 'No crew yet', color: UNASSIGNED });
    return items;
  }, [crews, crewColor, jobs]);

  const renderBar = (job: Job) => {
    const time = shortTime(job.start_time);
    const name = job.customers?.full_name || `Job #${job.job_number}`;
    const city = cityOf(job.customers?.service_address);
    const done = isDone(job);
    const cancelled = isCancelled(job);
    return (
      <button
        key={job.id}
        type="button"
        draggable
        onDragStart={e => {
          e.dataTransfer.setData(DRAG_MIME, job.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={e => {
          e.stopPropagation();
          setOpenDay(null);
          onSelectJob(job);
        }}
        title={[
          `${time || 'Anytime'} · ${name}`,
          job.customers?.service_address || '',
          `Crew: ${crewNameFor(job)}`,
          `Job #${job.job_number} · ${job.status}`,
        ].filter(Boolean).join('\n')}
        style={{ backgroundColor: colorFor(job) }}
        className={`w-full flex items-center gap-1 rounded-[3px] px-1.5 h-[22px] text-left text-[11.5px] leading-none text-white cursor-pointer border-none shadow-[0_1px_0_rgba(0,0,0,0.12)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy ${
          cancelled ? 'opacity-55 line-through' : ''
        }`}
      >
        {time && <span className="font-bold shrink-0 tabular-nums">{time}</span>}
        <span className="truncate font-medium">
          {name}
          {city && <span className="opacity-90"> - {city}</span>}
        </span>
        {done && (
          <span className="ml-auto shrink-0 w-3.5 h-3.5 rounded-[3px] bg-white/95 flex items-center justify-center" aria-label="Done">
            <Check size={10} strokeWidth={3.5} className="text-green-700" />
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-line shadow-card overflow-hidden select-none" data-motion="off">
      {/* Crew colour key */}
      {legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 border-b border-line text-xs text-ink-soft">
          {legend.map(item => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px] shrink-0" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      )}

      {/* Weekday header */}
      <div className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] border-b border-line bg-canvas">
        <div />
        {WEEKDAYS.map(d => (
          <div key={d} className="px-2 py-2 text-xs font-semibold text-muted">
            <span className="hidden xl:inline">{d}</span>
            <span className="xl:hidden">{d.slice(0, 3)}</span>
          </div>
        ))}
      </div>

      {weeks.map(week => (
        <div key={toDateKey(week[0])} className="grid grid-cols-[36px_repeat(7,minmax(0,1fr))] border-b border-line last:border-b-0">
          {/* Week number */}
          <div className="flex items-start justify-center pt-2 bg-canvas border-r border-line">
            <span className="text-[13px] font-semibold text-subtle tabular-nums" title={`Week ${isoWeek(week[0])}`}>
              {isoWeek(week[0])}
            </span>
          </div>

          {week.map(day => {
            const k = toDateKey(day);
            const list = jobsByDay.get(k) || [];
            const visible = list.slice(0, MAX_BARS);
            const hidden = list.length - visible.length;
            const inMonth = day.getMonth() === month;
            const isToday = k === todayKey;
            const holiday = holidayOn(k);
            const firstOfMonth = day.getDate() === 1;

            return (
              <div
                key={k}
                onClick={() => onDateClick(k)}
                onDragOver={e => {
                  if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOver !== k) setDragOver(k);
                }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                }}
                onDrop={e => {
                  const id = e.dataTransfer.getData(DRAG_MIME);
                  setDragOver(null);
                  if (!id) return;
                  e.preventDefault();
                  onDropJob(id, k);
                }}
                title="Click an empty spot to book a job on this day"
                className={`relative min-h-[150px] border-r border-line last:border-r-0 px-1 pt-1 pb-1.5 cursor-pointer transition-colors ${
                  dragOver === k ? 'bg-brand/10 ring-2 ring-inset ring-brand' : inMonth ? 'bg-white hover:bg-canvas/60' : 'bg-canvas/70 hover:bg-mist/50'
                }`}
              >
                {/* Day number + "+N" */}
                <div className="flex items-center justify-between h-6 px-0.5 mb-1">
                  <span
                    className={`text-[15px] font-semibold tabular-nums ${
                      isToday
                        ? 'w-6 h-6 -ml-0.5 rounded-full bg-red-600 text-white flex items-center justify-center text-[13px]'
                        : inMonth ? 'text-navy' : 'text-subtle'
                    }`}
                  >
                    {firstOfMonth && !isToday ? day.toLocaleDateString(undefined, { month: 'short' }) + ' 1' : day.getDate()}
                  </span>
                  {hidden > 0 && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setOpenDay(openDay === k ? null : k);
                      }}
                      className="text-xs font-semibold text-ink-soft hover:text-navy hover:bg-mist rounded px-1.5 h-5 border-none bg-transparent cursor-pointer"
                      aria-label={`Show all ${list.length} jobs`}
                    >
                      +{hidden}
                    </button>
                  )}
                </div>

                <div className="space-y-[3px]">
                  {holiday && (
                    <div className="h-[20px] rounded-[3px] px-1.5 flex items-center text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 truncate">
                      {holiday}
                    </div>
                  )}
                  {visible.map(renderBar)}
                </div>

                {/* All jobs for a busy day */}
                {openDay === k && (
                  <div
                    ref={popRef}
                    onClick={e => e.stopPropagation()}
                    className="absolute z-30 left-0 top-0 w-[max(100%,260px)] bg-white rounded-xl border border-line shadow-2xl p-2 cursor-default"
                  >
                    <div className="flex items-center justify-between px-1 pb-1.5">
                      <span className="text-sm font-semibold text-navy">
                        {day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenDay(null)}
                        aria-label="Close"
                        className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:bg-mist border-none bg-transparent cursor-pointer"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="space-y-[3px] max-h-[320px] overflow-y-auto">
                      {list.map(renderBar)}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDay(null);
                        onDateClick(k);
                      }}
                      className="mt-2 w-full h-8 rounded-lg text-xs font-semibold text-brand-ink bg-brand-soft hover:bg-brand/20 border-none cursor-pointer"
                    >
                      + Book another job this day
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
