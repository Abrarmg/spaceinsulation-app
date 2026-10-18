import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Crew, Job } from './types';
import {
  DRAG_MIME,
  crewsBookedOn,
  formatJobTimeRange,
  fromMinutes,
  getJobCardTheme,
  getJobCrewMembers,
  jobDurationMinutes,
  parseJobDateStr,
  toDateKey,
  toMinutes,
} from './schedulingUtils';
import { CapacityBar } from './CapacityBar';

const DAY_START_MIN = 7 * 60;
const DAY_END_MIN = 19 * 60;
const HOUR_PX = 56;
const SNAP_MIN = 30;
const HOURS = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 }, (_, i) => DAY_START_MIN / 60 + i);

interface TimeGridViewProps {
  days: Date[];
  jobs: Job[];
  crews: Crew[];
  /** Unfiltered jobs, so capacity isn't affected by search or filters. */
  allJobs: Job[];
  onSelectJob: (job: Job) => void;
  onDateClick: (dateStr: string) => void;
  /** startTime null = drop on the all-day row. */
  onDropJob: (jobId: string, dateStr: string, startTime: string | null) => void;
}

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

// Greedy lane assignment so overlapping jobs sit side by side.
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
    let lane = laneEnds.findIndex(end => end <= it.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = it.end;
    it.lane = lane;
  }
  return { items, laneCount: Math.max(1, laneEnds.length) };
}

export const TimeGridView: React.FC<TimeGridViewProps> = ({ days, jobs, crews, allJobs, onSelectJob, onDateClick, onDropJob }) => {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const todayStr = toDateKey(new Date());
  const crewNoun = crews.some(c => c.isFallback) ? 'workers' : 'crews';

  const columns = days.map(d => {
    const dateStr = toDateKey(d);
    const dayJobs = jobs.filter(j => parseJobDateStr(j.scheduled_date) === dateStr);
    return {
      date: d,
      dateStr,
      allDay: dayJobs.filter(j => toMinutes(j.start_time) === null),
      timed: layoutLanes(dayJobs.filter(j => toMinutes(j.start_time) !== null)),
      booked: crewsBookedOn(dateStr, allJobs, crews),
    };
  });

  const allowDrop = (key: string) => (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== key) setDragOver(key);
  };

  const dropOnGrid = (dateStr: string) => (e: React.DragEvent<HTMLDivElement>) => {
    const jobId = e.dataTransfer.getData(DRAG_MIME);
    setDragOver(null);
    if (!jobId) return;
    e.preventDefault();
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const raw = DAY_START_MIN + (y / HOUR_PX) * 60;
    const snapped = Math.min(DAY_END_MIN - SNAP_MIN, Math.max(DAY_START_MIN, Math.round(raw / SNAP_MIN) * SNAP_MIN));
    onDropJob(jobId, dateStr, fromMinutes(snapped));
  };

  const dropOnAllDay = (dateStr: string) => (e: React.DragEvent) => {
    const jobId = e.dataTransfer.getData(DRAG_MIME);
    setDragOver(null);
    if (!jobId) return;
    e.preventDefault();
    onDropJob(jobId, dateStr, null);
  };

  const jobBlock = (job: Job, style?: React.CSSProperties) => {
    const theme = getJobCardTheme(job);
    const crewNames = getJobCrewMembers(job).map(c => c.name).join(', ');
    return (
      <button
        key={job.id}
        type="button"
        draggable
        onDragStart={e => {
          e.dataTransfer.setData(DRAG_MIME, job.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => onSelectJob(job)}
        title={`JOB-${job.job_number} · ${job.customers?.full_name || ''}${crewNames ? ` · ${crewNames}` : ''}`}
        style={style}
        className={`${theme.bg} ${theme.border} ${theme.borderAccent} border rounded-lg px-1.5 py-1 text-left overflow-hidden cursor-grab active:cursor-grabbing shadow-2xs hover:shadow-xs w-full`}
      >
        <div className={`text-[9.5px] font-black truncate ${theme.timeColor}`}>{formatJobTimeRange(job)}</div>
        <div className={`text-[10.5px] font-bold truncate ${theme.titleColor}`}>{job.customers?.full_name || `JOB-${job.job_number}`}</div>
        {crewNames && <div className="text-[9px] text-slate-500 font-semibold truncate">{crewNames}</div>}
      </button>
    );
  };

  const gridCols = `56px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-3xs overflow-hidden select-none">
      <div className="overflow-x-auto">
        <div style={{ minWidth: days.length > 1 ? 840 : undefined }}>
          {/* Header */}
          <div className="grid border-b border-slate-200 bg-[#F8FAFC]" style={{ gridTemplateColumns: gridCols }}>
            <div />
            {columns.map(col => {
              const isToday = col.dateStr === todayStr;
              return (
                <div key={col.dateStr} className={`px-2 py-2 text-center border-l border-slate-200 ${isToday ? 'bg-[#76C442]/10' : ''}`}>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    {col.date.toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                  <div className={`text-sm font-black inline-flex items-center justify-center mt-0.5 ${isToday ? 'w-7 h-7 rounded-full bg-[#76C442] text-white' : 'text-slate-800'}`}>
                    {col.date.getDate()}
                  </div>
                  <CapacityBar booked={col.booked} total={crews.length} noun={crewNoun} className="mt-1.5" />
                </div>
              );
            })}
          </div>

          {/* All-day row */}
          <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: gridCols }}>
            <div className="text-[9px] font-black uppercase text-slate-400 px-2 py-2 text-right">All day</div>
            {columns.map(col => (
              <div
                key={col.dateStr}
                onDragOver={allowDrop(`all-${col.dateStr}`)}
                onDragLeave={() => setDragOver(null)}
                onDrop={dropOnAllDay(col.dateStr)}
                className={`border-l border-slate-200 p-1 space-y-1 min-h-[40px] ${dragOver === `all-${col.dateStr}` ? 'bg-[#76C442]/10' : ''}`}
              >
                {col.allDay.map(job => jobBlock(job))}
                <button
                  type="button"
                  onClick={() => onDateClick(col.dateStr)}
                  className="w-full py-1 rounded-md text-slate-300 hover:text-[#76C442] hover:bg-slate-50 flex items-center justify-center cursor-pointer"
                  aria-label={`Add job on ${col.dateStr}`}
                >
                  <Plus size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Timed grid */}
          <div className="grid max-h-[620px] overflow-y-auto" style={{ gridTemplateColumns: gridCols }}>
            <div className="relative" style={{ height: HOURS.length * HOUR_PX }}>
              {HOURS.map((h, i) => (
                <div key={h} className="absolute right-2 text-[9.5px] font-bold text-slate-400 -translate-y-1/2" style={{ top: i * HOUR_PX }}>
                  {i === 0 ? '' : hourLabel(h)}
                </div>
              ))}
            </div>
            {columns.map(col => (
              <div
                key={col.dateStr}
                onDragOver={allowDrop(`grid-${col.dateStr}`)}
                onDragLeave={() => setDragOver(null)}
                onDrop={dropOnGrid(col.dateStr)}
                className={`relative border-l border-slate-200 ${dragOver === `grid-${col.dateStr}` ? 'bg-[#76C442]/5' : ''}`}
                style={{ height: HOURS.length * HOUR_PX }}
              >
                {HOURS.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: i * HOUR_PX }} />
                ))}
                {col.timed.items.map(({ job, start, end, lane }) =>
                  jobBlock(job, {
                    position: 'absolute',
                    top: ((start - DAY_START_MIN) / 60) * HOUR_PX + 1,
                    height: ((end - start) / 60) * HOUR_PX - 2,
                    left: `calc(${(lane / col.timed.laneCount) * 100}% + 2px)`,
                    width: `calc(${100 / col.timed.laneCount}% - 4px)`,
                  })
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 font-medium px-3 py-2 m-0 border-t border-slate-100">
        Drag a job to another day or time to reschedule it. Drop it on “All day” to clear its time.
      </p>
    </div>
  );
};
