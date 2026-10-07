import React from 'react';
import { Job } from './types';
import { JobCard } from './JobCard';
import { parseJobDateStr } from './schedulingUtils';
import { Plus } from 'lucide-react';

interface MonthGridViewProps {
  currentDate: Date;
  selectedDate: Date;
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onEditJob?: (job: Job) => void;
  onDateClick: (dateStr: string) => void;
}

export const MonthGridView: React.FC<MonthGridViewProps> = ({
  currentDate,
  selectedDate,
  jobs,
  onSelectJob,
  onEditJob,
  onDateClick
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  const todayStr = new Date().toISOString().split('T')[0];
  const selectedStr = selectedDate.toISOString().split('T')[0];

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
    const d = new Date(year, month - 1, dayNumber);
    const dateStr = d.toISOString().split('T')[0];
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
    const d = new Date(year, month, i);
    const dateStr = d.toISOString().split('T')[0];
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
    const d = new Date(year, month + 1, i);
    const dateStr = d.toISOString().split('T')[0];
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
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-3xs overflow-hidden select-none">
      {/* Weekday Header Row */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-[#F8FAFC]">
        {weekdayHeaders.map((day) => (
          <div
            key={day}
            className="text-center py-2.5 text-[11px] font-black text-slate-500 tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Days Matrix */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-200/80">
        {cells.map((cell, idx) => {
          return (
            <div
              key={cell.dateStr + '-' + idx}
              onClick={(e) => {
                // If user clicks on the empty day background, trigger quick add
                if ((e.target as HTMLElement).closest('.group')) return;
                onDateClick(cell.dateStr);
              }}
              className={`min-h-[140px] xl:min-h-[160px] p-2 flex flex-col justify-start transition-colors relative group/cell cursor-pointer ${
                cell.isCurrentMonth ? 'bg-white hover:bg-slate-50/50' : 'bg-slate-50/40 hover:bg-slate-100/40'
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
                  className="opacity-0 group-hover/cell:opacity-100 p-0.5 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-800 transition-all border-none bg-transparent cursor-pointer"
                  title={`Add Job for ${cell.dateStr}`}
                >
                  <Plus size={13} className="stroke-[2.5]" />
                </button>

                {/* Day Number */}
                <span
                  className={`text-[11px] font-bold ml-auto ${
                    cell.isToday || cell.isSelected
                      ? 'w-6 h-6 rounded-full bg-[#76C442] text-white flex items-center justify-center font-black shadow-2xs'
                      : cell.isCurrentMonth
                      ? 'text-slate-700'
                      : 'text-slate-300'
                  }`}
                >
                  {cell.dayNumber}
                </span>
              </div>

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
