import React, { useState } from 'react';
import { Crew, Job } from './types';
import { JobCard } from './JobCard';
import { DRAG_MIME, crewsBookedOn, parseJobDateStr, toDateKey } from './schedulingUtils';
import { CapacityBar } from './CapacityBar';
import { Plus } from 'lucide-react';
import { todayDate } from '../../utils/dates';

interface MonthGridViewProps {
  currentDate: Date;
  selectedDate: Date;
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onEditJob?: (job: Job) => void;
  onDateClick: (dateStr: string) => void;
  crews: Crew[];
  /** Unfiltered jobs, so capacity isn't affected by search or filters. */
  allJobs: Job[];
  onDropJob: (jobId: string, dateStr: string) => void;
}

export const MonthGridView: React.FC<MonthGridViewProps> = ({
  currentDate,
  selectedDate,
  jobs,
  onSelectJob,
  onEditJob,
  onDateClick,
  crews,
  allJobs,
  onDropJob,
}) => {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const crewNoun = crews.some(c => c.isFallback) ? 'workers' : 'crews';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1, 12).getDay(); // 0 is Sun
  const totalDaysInMonth = new Date(year, month + 1, 0, 12).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0, 12).getDate();

  const todayStr = toDateKey(todayDate());
  const selectedStr = toDateKey(selectedDate);

  // Map jobs by dateStr
  const jobsByDate = new Map<string, Job[]>();
  jobs.forEach(job => {
    const d = parseJobDateStr(job.scheduled_date);
    if (!d) return;
    if (!jobsByDate.has(d)) {
      jobsByDate.set(d, []);
    }
    jobsByDate.get(d)!.push(job);
  });

  interface DayCellData {
    dayNumber: number;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    jobs: Job[];
  }

  const cells: DayCellData[] = [];

  // 1. Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNumber = totalDaysInPrevMonth - i;
    const d = new Date(year, month - 1, dayNumber, 12);
    const dateStr = toDateKey(d);
    cells.push({
      dayNumber,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedStr,
      jobs: jobsByDate.get(dateStr) || []
    });
  }

  // 2. Current month days
  for (let i = 1; i <= totalDaysInMonth; i++) {
    const d = new Date(year, month, i, 12);
    const dateStr = toDateKey(d);
    cells.push({
      dayNumber: i,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedStr,
      jobs: jobsByDate.get(dateStr) || []
    });
  }

  // 3. Next month leading days to complete row grid (multiples of 7)
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i, 12);
    const dateStr = toDateKey(d);
    cells.push({
      dayNumber: i,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedStr,
      jobs: jobsByDate.get(dateStr) || []
    });
  }

  const weekdayHeaders = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className="w-full bg-white rounded-2xl border border-line shadow-3xs overflow-hidden select-none">
      {/* Weekday Header Row */}
      <div className="grid grid-cols-7 border-b border-line bg-canvas">
        {weekdayHeaders.map((day) => (
          <div
            key={day}
            className="text-center py-2.5 text-2xs font-bold text-muted tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Days Matrix */}
      <div className="grid grid-cols-7 divide-x divide-y divide-line/80">
        {cells.map((cell, idx) => {
          return (
            <div
              key={cell.dateStr + '-' + idx}
              onClick={(e) => {
                // If user clicks on the empty day background, trigger quick add
                if ((e.target as HTMLElement).closest('.group')) return;
                onDateClick(cell.dateStr);
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOver !== cell.dateStr) setDragOver(cell.dateStr);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
              }}
              onDrop={(e) => {
                const jobId = e.dataTransfer.getData(DRAG_MIME);
                setDragOver(null);
                if (!jobId) return;
                e.preventDefault();
                onDropJob(jobId, cell.dateStr);
              }}
              className={`min-h-[140px] xl:min-h-[160px] p-2 flex flex-col justify-start transition-colors relative group/cell cursor-pointer ${
                dragOver === cell.dateStr
                  ? 'bg-brand/10 ring-2 ring-inset ring-brand'
                  : cell.isCurrentMonth ? 'bg-white hover:bg-canvas/50' : 'bg-canvas/40 hover:bg-mist/40'
              }`}
            >
              {/* Day Cell Header: Quick Add Button (hover) & Day Number */}
              <div className="flex items-center justify-between mb-1.5 min-h-[24px]">
                {/* Hover Quick Add Plus */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDateClick(cell.dateStr);
                  }}
                  className="opacity-0 group-hover/cell:opacity-100 p-0.5 rounded-md hover:bg-line text-subtle hover:text-navy transition-all border-none bg-transparent cursor-pointer"
                  title={`Add Job for ${cell.dateStr}`}
                >
                  <Plus size={13} className="stroke-[2.5]" />
                </button>

                {/* Day Number */}
                <span
                  className={`text-2xs font-bold ml-auto ${
                    cell.isToday || cell.isSelected
                      ? 'w-6 h-6 rounded-full bg-brand text-navy flex items-center justify-center font-bold shadow-2xs'
                      : cell.isCurrentMonth
                      ? 'text-ink-soft'
                      : 'text-line-strong'
                  }`}
                >
                  {cell.dayNumber}
                </span>
              </div>

              {cell.isCurrentMonth && (
                <CapacityBar
                  booked={crewsBookedOn(cell.dateStr, allJobs, crews)}
                  total={crews.length}
                  noun={crewNoun}
                  className="mb-1.5"
                />
              )}

              {/* Day Jobs List */}
              <div className="space-y-1 overflow-y-auto flex-1 max-h-[220px] pr-0.5">
                {cell.jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={onSelectJob}
                    onEdit={onEditJob}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
