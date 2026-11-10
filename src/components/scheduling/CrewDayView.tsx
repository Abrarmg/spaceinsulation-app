import React, { useMemo, useState } from 'react';
import { Check, Plus, Users } from 'lucide-react';
import type { Job, Profile } from './types';
import {
  DRAG_MIME,
  formatJobTimeRange,
  fromMinutes,
  getJobCardTheme,
  jobDurationMinutes,
  parseJobDateStr,
  toDateKey,
  toMinutes,
} from './schedulingUtils';

/**
 * One day with a column per crew member (plus "Unassigned"). Each header shows
 * how many of that person's jobs are done. Drag a job to another time or
 * person to move or reassign it; click an empty slot to book a job for that
 * time and person.
 */

const DAY_START_MIN = 7 * 60;
const DAY_END_MIN = 19 * 60;
const HOUR_PX = 56;
const SNAP_MIN = 30;
const HOURS = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 }, (_, i) => DAY_START_MIN / 60 + i);
const DONE = ['Completed', 'Invoiced', 'Paid'];
export const UNASSIGNED = '__unassigned__';

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Ids of everyone on a job (job crew, or the assigned worker). */
const crewIdsOf = (job: Job) => {
  const ids = (job.job_crew || []).map(c => c.worker_id);
  if (ids.length === 0 && job.assigned_worker_id) ids.push(job.assigned_worker_id);
  return ids;
};

function layoutLanes(jobs: Job[]) {
  const items = jobs
    .map(job => {
      const start = Math.max(DAY_START_MIN, Math.min(toMinutes(job.start_time)!, DAY_END_MIN - SNAP_MIN));
      const end = Math.min(DAY_END_MIN, start + jobDurationMinutes(job));
      return { job, start, end: Math.max(end, start + SNAP_MIN), lane: 0 };
    })
    .sort((a, b) => a.start - b.start);
  const laneEnds: number[] = [];
  for (const it of items) {
    let lane = laneEnds.findIndex(e => e <= it.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = it.end;
    it.lane = lane;
  }
  return { items, laneCount: Math.max(1, laneEnds.length) };
}

interface CrewDayViewProps {
  date: Date;
  jobs: Job[];
  workers: Profile[];
  /** Worker ids to show (the team picker). */
  visibleIds: string[];
  onChangeVisible: (ids: string[]) => void;
  onSelectJob: (job: Job) => void;
  /** Book a job: start time null = all day; workerId null = unassigned. */
  onSlotClick: (dateStr: string, startTime: string | null, workerId: string | null) => void;
  /** Move / reassign: startTime null = all day; toWorker null = unassigned. */
  onDropJob: (jobId: string, dateStr: string, startTime: string | null, fromWorker: string | null, toWorker: string | null) => void;
}

export const CrewDayView: React.FC<CrewDayViewProps> = ({
  date,
  jobs,
  workers,
  visibleIds,
  onChangeVisible,
  onSelectJob,
  onSlotClick,
  onDropJob,
}) => {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dateStr = toDateKey(date);

  const dayJobs = useMemo(() => jobs.filter(j => parseJobDateStr(j.scheduled_date) === dateStr), [jobs, dateStr]);

  const shown = workers.filter(w => visibleIds.includes(w.id));
  const unassignedJobs = dayJobs.filter(j => crewIdsOf(j).length === 0);
  const columns = [
    ...shown.map(w => ({ key: w.id, workerId: w.id as string | null, name: w.full_name, jobs: dayJobs.filter(j => crewIdsOf(j).includes(w.id)) })),
    ...(unassignedJobs.length > 0 ? [{ key: UNASSIGNED, workerId: null as string | null, name: 'Unassigned', jobs: unassignedJobs }] : []),
  ].map(c => ({
    ...c,
    allDay: c.jobs.filter(j => toMinutes(j.start_time) === null),
    timed: layoutLanes(c.jobs.filter(j => toMinutes(j.start_time) !== null)),
    done: c.jobs.filter(j => DONE.includes(j.status)).length,
  }));

  const allowDrop = (key: string) => (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== key) setDragOver(key);
  };

  const readDrag = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData(DRAG_MIME);
    const [jobId, from] = raw.split('|');
    return { jobId, from: from && from !== UNASSIGNED ? from : null };
  };

  const timeAt = (e: React.MouseEvent<HTMLDivElement> | React.DragEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const raw = DAY_START_MIN + (y / HOUR_PX) * 60;
    return fromMinutes(Math.min(DAY_END_MIN - SNAP_MIN, Math.max(DAY_START_MIN, Math.floor(raw / SNAP_MIN) * SNAP_MIN)));
  };

  const jobBlock = (job: Job, columnKey: string, style?: React.CSSProperties) => {
    const theme = getJobCardTheme(job);
    return (
      <button
        key={`${columnKey}-${job.id}`}
        type="button"
        draggable
        onDragStart={e => {
          e.dataTransfer.setData(DRAG_MIME, `${job.id}|${columnKey}`);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={e => {
          e.stopPropagation();
          onSelectJob(job);
        }}
        title={`Job #${job.job_number} · ${job.customers?.full_name || ''}`}
        style={style}
        className={`${theme.bg} ${theme.border} ${theme.borderAccent} border rounded-lg px-2 py-1 text-left overflow-hidden cursor-grab active:cursor-grabbing shadow-2xs hover:shadow-xs w-full`}
      >
        <div className={`text-[0.6875rem] font-semibold truncate ${theme.timeColor}`}>{formatJobTimeRange(job)}</div>
        <div className={`text-xs font-semibold truncate ${theme.titleColor}`}>{job.customers?.full_name || `Job #${job.job_number}`}</div>
        <div className="text-[0.6875rem] text-muted truncate">{job.customers?.service_address?.split(',')[0]}</div>
      </button>
    );
  };

  const gridCols = `56px repeat(${Math.max(1, columns.length)}, minmax(150px, 1fr))`;

  return (
    <div className="w-full bg-white rounded-2xl border border-line shadow-card overflow-hidden select-none">
      {/* Team picker */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-line">
        <div className="text-sm font-semibold text-navy">
          {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen(o => !o)}
            aria-expanded={pickerOpen}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-white text-sm font-medium text-navy hover:bg-mist"
          >
            <Users size={15} className="text-muted" />
            Team · {shown.length} of {workers.length}
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} aria-hidden />
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-line rounded-xl shadow-pop z-40 p-1.5">
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">Show on schedule</span>
                  <button
                    type="button"
                    onClick={() => onChangeVisible(shown.length === workers.length ? [] : workers.map(w => w.id))}
                    className="text-xs font-semibold text-brand-ink border-0 bg-transparent hover:underline"
                  >
                    {shown.length === workers.length ? 'Clear' : 'Select all'}
                  </button>
                </div>
                {workers.length === 0 ? (
                  <p className="m-0 px-2.5 py-3 text-sm text-muted">No crew members yet.</p>
                ) : (
                  workers.map(w => {
                    const on = visibleIds.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => onChangeVisible(on ? visibleIds.filter(id => id !== w.id) : [...visibleIds, w.id])}
                        aria-pressed={on}
                        className="w-full flex items-center justify-between gap-2 h-10 px-2.5 rounded-lg text-sm text-navy text-left border-0 bg-transparent hover:bg-mist"
                      >
                        {w.full_name}
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${
                            on ? 'bg-brand border-brand text-navy' : 'border-line-strong bg-white'
                          }`}
                        >
                          {on && <Check size={13} strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {columns.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <Users size={28} className="mx-auto text-line-strong" />
          <p className="m-0 mt-2 text-sm font-semibold text-navy">No team members selected</p>
          <p className="m-0 mt-1 text-sm text-muted">Use the Team button to choose whose day to show.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 56 + columns.length * 150 }}>
            {/* Column headers */}
            <div className="grid border-b border-line bg-canvas" style={{ gridTemplateColumns: gridCols }}>
              <div />
              {columns.map(c => (
                <div key={c.key} className="flex items-center justify-between gap-2 px-2.5 py-2 border-l border-line min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[0.6875rem] font-bold ${
                        c.workerId ? 'bg-navy text-white' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {c.workerId ? initials(c.name) : '?'}
                    </span>
                    <span className="text-sm font-semibold text-navy truncate">{c.name}</span>
                  </div>
                  <span
                    className={`shrink-0 h-6 px-2 rounded-md text-xs font-semibold tabular-nums flex items-center ${
                      c.jobs.length && c.done === c.jobs.length ? 'bg-brand-soft text-brand-ink' : 'bg-mist text-ink-soft'
                    }`}
                    title={`${c.done} of ${c.jobs.length} done`}
                  >
                    {c.done}/{c.jobs.length}
                  </span>
                </div>
              ))}
            </div>

            {/* All-day row */}
            <div className="grid border-b border-line" style={{ gridTemplateColumns: gridCols }}>
              <div className="text-2xs font-semibold uppercase text-subtle px-2 py-2 text-right">All day</div>
              {columns.map(c => (
                <div
                  key={c.key}
                  onDragOver={allowDrop(`all-${c.key}`)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => {
                    const { jobId, from } = readDrag(e);
                    setDragOver(null);
                    if (!jobId) return;
                    e.preventDefault();
                    onDropJob(jobId, dateStr, null, from, c.workerId);
                  }}
                  className={`border-l border-line p-1 space-y-1 min-h-[40px] ${dragOver === `all-${c.key}` ? 'bg-brand/10' : ''}`}
                >
                  {c.allDay.map(job => jobBlock(job, c.key))}
                  <button
                    type="button"
                    onClick={() => onSlotClick(dateStr, null, c.workerId)}
                    className="w-full py-1 rounded-md text-line-strong hover:text-brand-ink hover:bg-canvas flex items-center justify-center border-0 bg-transparent"
                    aria-label={`Book an all-day job for ${c.name}`}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Timed grid */}
            <div className="grid max-h-[640px] overflow-y-auto" style={{ gridTemplateColumns: gridCols }}>
              <div className="relative" style={{ height: HOURS.length * HOUR_PX }}>
                {HOURS.map((h, i) => (
                  <div key={h} className="absolute right-2 text-[0.6875rem] font-semibold text-subtle -translate-y-1/2" style={{ top: i * HOUR_PX }}>
                    {i === 0 ? '' : hourLabel(h)}
                  </div>
                ))}
              </div>
              {columns.map(c => (
                <div
                  key={c.key}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Book a job for ${c.name}`}
                  onClick={e => onSlotClick(dateStr, timeAt(e), c.workerId)}
                  onDragOver={allowDrop(`grid-${c.key}`)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => {
                    const { jobId, from } = readDrag(e);
                    setDragOver(null);
                    if (!jobId) return;
                    e.preventDefault();
                    onDropJob(jobId, dateStr, timeAt(e), from, c.workerId);
                  }}
                  className={`group relative border-l border-line cursor-copy ${dragOver === `grid-${c.key}` ? 'bg-brand/5' : 'hover:bg-canvas/60'}`}
                  style={{ height: HOURS.length * HOUR_PX }}
                >
                  {HOURS.map((h, i) => (
                    <div key={h} className="absolute inset-x-0 border-t border-mist" style={{ top: i * HOUR_PX }} />
                  ))}
                  {c.timed.items.map(({ job, start, end, lane }) =>
                    jobBlock(job, c.key, {
                      position: 'absolute',
                      top: ((start - DAY_START_MIN) / 60) * HOUR_PX + 1,
                      height: ((end - start) / 60) * HOUR_PX - 2,
                      left: `calc(${(lane / c.timed.laneCount) * 100}% + 3px)`,
                      width: `calc(${100 / c.timed.laneCount}% - 6px)`,
                    }),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <p className="text-2xs text-subtle px-3 py-2 m-0 border-t border-mist">
        Click an empty time to book a job for that person. Drag a job to another time or person to move or reassign it.
      </p>
    </div>
  );
};
