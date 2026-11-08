import React, { useMemo } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react';
import type { Job } from './types';
import { formatJobTimeRange, getJobCardTheme, getJobCrewMembers, parseJobDateStr, toDateKey, toMinutes } from './schedulingUtils';
import { Button, EmptyState } from '../ui';

interface AgendaViewProps {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onAddForDate: (dateKey: string) => void;
}

const startOfWeek = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * Phone schedule: a week strip to pick the day, then that day's jobs as a
 * simple list in time order. Tap a job to open it.
 */
export const AgendaView: React.FC<AgendaViewProps> = ({ selectedDate, onSelectDate, jobs, onSelectJob, onAddForDate }) => {
  const weekStart = startOfWeek(selectedDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayKey = toDateKey(new Date());
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

  return (
    <div className="space-y-3">
      {/* Week strip */}
      <div className="bg-white border border-line rounded-xl shadow-card p-2">
        <div className="flex items-center justify-between px-1 pb-2">
          <button
            type="button"
            onClick={() => onSelectDate(addDays(selectedDate, -7))}
            aria-label="Previous week"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-soft hover:bg-mist border-0 bg-transparent"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-navy">
            {weekStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <button
            type="button"
            onClick={() => onSelectDate(addDays(selectedDate, 7))}
            aria-label="Next week"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-soft hover:bg-mist border-0 bg-transparent"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(d => {
            const key = toDateKey(d);
            const isSel = key === selectedKey;
            const isToday = key === todayKey;
            const count = countsByDay.get(key) || 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectDate(d)}
                aria-pressed={isSel}
                aria-label={`${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}, ${count} jobs`}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border-0 transition-colors ${
                  isSel ? 'bg-navy text-white' : 'bg-transparent text-navy hover:bg-mist'
                }`}
              >
                <span className={`text-2xs ${isSel ? 'text-white/70' : 'text-muted'}`}>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                <span className={`text-base font-semibold leading-none ${isToday && !isSel ? 'text-brand-ink' : ''}`}>{d.getDate()}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${count ? (isSel ? 'bg-brand' : 'bg-brand') : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Day heading */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="text-base font-semibold text-navy">
            {selectedKey === todayKey ? 'Today' : selectedDate.toLocaleDateString(undefined, { weekday: 'long' })}
            <span className="font-normal text-muted"> · {selectedDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</span>
          </div>
          <div className="text-xs text-muted">
            {dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'}
          </div>
        </div>
        <Button size="sm" variant="secondary" icon={CalendarPlus} onClick={() => onAddForDate(selectedKey)}>
          Add
        </Button>
      </div>

      {/* Day list */}
      {dayJobs.length === 0 ? (
        <div className="bg-white border border-line rounded-xl shadow-card">
          <EmptyState
            icon={CalendarPlus}
            title="Nothing booked"
            description="No jobs on this day yet."
            action={
              <Button icon={CalendarPlus} onClick={() => onAddForDate(selectedKey)}>
                Schedule a job
              </Button>
            }
            className="py-10"
          />
        </div>
      ) : (
        <ul className="m-0 p-0 list-none space-y-2">
          {dayJobs.map(job => {
            const theme = getJobCardTheme(job);
            const crew = getJobCrewMembers(job);
            return (
              <li key={job.id}>
                <button
                  type="button"
                  onClick={() => onSelectJob(job)}
                  className={`w-full text-left bg-white border border-line rounded-xl shadow-card p-3.5 flex gap-3 ${theme.borderAccent} active:bg-mist`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-ink-soft">{formatJobTimeRange(job)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold ${theme.pillBg} ${theme.pillText}`}>{theme.pillLabel}</span>
                    </div>
                    <div className="text-[0.9375rem] font-semibold text-navy truncate">{job.customers?.full_name || `Job #${job.job_number}`}</div>
                    {job.customers?.service_address && (
                      <div className="flex items-start gap-1.5 text-xs text-muted">
                        <MapPin size={13} className="shrink-0 mt-0.5" />
                        <span className="truncate">{job.customers.service_address}</span>
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
