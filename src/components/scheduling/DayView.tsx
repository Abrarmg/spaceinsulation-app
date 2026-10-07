import React from 'react';
import { Job } from './types';
import { 
  parseJobDateStr, 
  estimateJobDuration, 
  getJobCardTheme, 
  getJobCrewMembers, 
  formatJobTimeRange 
} from './schedulingUtils';
import { 
  Layers, 
  Clock, 
  MapPin, 
  User, 
  Briefcase, 
  Plus, 
  ExternalLink 
} from 'lucide-react';

interface DayViewProps {
  selectedDate: Date;
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onDateClick: (dateStr: string) => void;
}

export const DayView: React.FC<DayViewProps> = ({
  selectedDate,
  jobs,
  onSelectJob,
  onDateClick
}) => {
  const dateStr = selectedDate.toISOString().split('T')[0];
  const dayJobs = jobs.filter(j => parseJobDateStr(j.scheduled_date) === dateStr);

  const formattedDate = selectedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-3xs p-5 space-y-5 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Daily Manifest
          </span>
          <h3 className="text-lg font-black text-slate-800 m-0">
            {formattedDate}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-[#76C442]/15 text-[#151A2D] text-xs font-black">
            {dayJobs.length} {dayJobs.length === 1 ? 'Job' : 'Jobs'} Slated
          </span>

          <button
            type="button"
            onClick={() => onDateClick(dateStr)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer border-none"
          >
            <Plus size={13} className="stroke-[3]" />
            <span>Add Job</span>
          </button>
        </div>
      </div>

      {/* Jobs List */}
      {dayJobs.length === 0 ? (
        <div className="py-20 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 font-bold p-4">
          <Briefcase size={28} className="mx-auto text-slate-300 mb-2" />
          No insulation projects scheduled on this day.
        </div>
      ) : (
        <div className="space-y-3">
          {dayJobs.map((job) => {
            const duration = estimateJobDuration(job);
            const timeRange = formatJobTimeRange(job);
            const theme = getJobCardTheme(job);
            const crew = getJobCrewMembers(job);
            const techName = crew.length > 0 ? crew.map(c => c.name).join(', ') : 'Unassigned';

            return (
              <div
                key={job.id}
                onClick={() => onSelectJob(job)}
                className={`bg-white border rounded-xl p-4 shadow-3xs hover:shadow-xs transition-all cursor-pointer flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${theme.border} ${theme.borderAccent}`}
              >
                {/* Left Info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800">
                      JOB-{job.job_number}
                    </span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span className="text-xs font-bold text-slate-900">
                      {job.customers?.full_name || 'Customer'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 font-medium flex flex-wrap gap-x-3 items-center">
                    <span className="flex items-center gap-1">
                      <Layers size={12} className="text-slate-400" />
                      <span>{job.scope_of_work || 'Attic Insulation'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-slate-400" />
                      <span>{duration} hours</span>
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                    <MapPin size={12} className="text-[#76C442]" />
                    <span>{job.customers?.service_address || 'No service address listed'}</span>
                  </div>
                </div>

                {/* Right Meta & Actions */}
                <div className="flex items-center gap-4 justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                  <div className="text-right">
                    <div className="text-[9.5px] text-slate-400 uppercase font-bold">
                      Assigned Crew
                    </div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1 justify-end">
                      <User size={12} className="text-[#76C442]" />
                      <span className="truncate max-w-[140px]">{techName}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[9.5px] text-slate-400 uppercase font-bold">
                      Time Slot
                    </div>
                    <div className="text-xs font-black text-slate-800">
                      {timeRange}
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${theme.pillBg} ${theme.pillText}`}>
                    {theme.pillLabel}
                  </span>

                  <ExternalLink size={15} className="text-slate-400 hover:text-slate-700" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
