import React from 'react';
import { Job } from './types';
import { JobCard } from './JobCard';
import { parseJobDateStr } from './schedulingUtils';
import { Plus } from 'lucide-react';

interface WeekGridViewProps {
  selectedDate: Date;
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onEditJob?: (job: Job) => void;
  onDateClick: (dateStr: string) => void;
}

export const WeekGridView: React.FC<WeekGridViewProps> = ({
  selectedDate,
  jobs,
  onSelectJob,
  onEditJob,
  onDateClick
}) => {
  // Get start of week (Sunday)
  const current = new Date(selectedDate);
  const dayOfWeek = current.getDay();
  const startOfWeek = new Date(current);
  startOfWeek.setDate(current.getDate() - dayOfWeek);

  const days: Array<{
    date: Date;
    dateStr: string;
    dayName: string;
    dayNumber: number;
    isToday: boolean;
    jobs: Job[];
  }> = [];

  const todayStr = new Date().toISOString().split('T')[0];

  const jobsByDate = new Map<string, Job[]>();
  jobs.forEach(job => {
    const d = parseJobDateStr(job.scheduled_date);
    if (!d) return;
    if (!jobsByDate.has(d)) {
      jobsByDate.set(d, []);
    }
    jobsByDate.get(d)!.push(job);
  });

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    days.push({
      date: d,
      dateStr,
      dayName: dayNames[i],
      dayNumber: d.getDate(),
      isToday: dateStr === todayStr,
      jobs: jobsByDate.get(dateStr) || []
    });
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-3xs overflow-hidden select-none">
      {/* 7 Columns for Week */}
      <div className="grid grid-cols-7 divide-x divide-slate-200">
        {days.map((day) => {
          return (
            <div key={day.dateStr} className="min-h-[460px] flex flex-col bg-white">
              {/* Day Header */}
              <div className={`p-3 border-b border-slate-200 text-center ${
                day.isToday ? 'bg-[#76C442]/10' : 'bg-[#F8FAFC]'
              }`}>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  {day.dayName}
                </div>
                <div className={`text-base font-black mt-0.5 inline-flex items-center justify-center ${
                  day.isToday 
                    ? 'w-7 h-7 rounded-full bg-[#76C442] text-white shadow-xs' 
                    : 'text-slate-800'
                }`}>
                  {day.dayNumber}
                </div>
                <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                  {day.jobs.length} {day.jobs.length === 1 ? 'job' : 'jobs'}
                </div>
              </div>

              {/* Day Content */}
              <div className="p-2 flex-1 overflow-y-auto space-y-1.5">
                {day.jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={onSelectJob}
                    onEdit={onEditJob}
                  />
                ))}

                {/* Quick Add Button */}
                <button
                  type="button"
                  onClick={() => onDateClick(day.dateStr)}
                  className="w-full py-2 border border-dashed border-slate-200 hover:border-[#76C442] rounded-xl text-slate-400 hover:text-[#76C442] flex items-center justify-center gap-1 text-[10px] font-bold transition-all bg-transparent cursor-pointer mt-2"
                >
                  <Plus size={12} />
                  <span>Add Job</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
