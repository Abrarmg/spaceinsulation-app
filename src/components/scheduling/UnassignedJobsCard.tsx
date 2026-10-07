import React from 'react';
import { Job } from './types';
import { formatTime12h, getJobTypeDetails } from './schedulingUtils';
import { FileText, HardHat, Home, Package } from 'lucide-react';

interface UnassignedJobsCardProps {
  unassignedJobs: Job[];
  onSelectJob: (job: Job) => void;
}

export const UnassignedJobsCard: React.FC<UnassignedJobsCardProps> = ({
  unassignedJobs,
  onSelectJob
}) => {
  const count = unassignedJobs.length;

  const renderIcon = (scope: string) => {
    const s = scope.toLowerCase();
    if (s.includes('quote') || s.includes('assessment')) {
      return <FileText size={13} className="text-amber-500" />;
    }
    if (s.includes('wall') || s.includes('air seal')) {
      return <HardHat size={13} className="text-orange-500" />;
    }
    if (s.includes('attic')) {
      return <Home size={13} className="text-emerald-500" />;
    }
    return <Package size={13} className="text-slate-500" />;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-3xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-slate-800 tracking-tight m-0">
          Unassigned Jobs
        </h3>

        {/* Count badge */}
        <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 font-black text-[10px] flex items-center justify-center">
          {count}
        </span>
      </div>

      {/* List */}
      {count === 0 ? (
        <div className="py-4 text-center text-[11px] text-slate-400 font-semibold">
          All jobs have assigned crews.
        </div>
      ) : (
        <div className="space-y-2.5">
          {unassignedJobs.slice(0, 5).map((job) => {
            const timeStr = job.start_time ? formatTime12h(job.start_time) : 'Time TBD';
            const details = getJobTypeDetails(job);
            const address = job.customers?.service_address || 'No address';
            // Extract city or short address
            const shortAddress = address.split(',')[0] || address;

            const isPending = (job.status || '').toLowerCase().includes('pending') || (job.status || '').toLowerCase() === 'quoted';
            const isInProgress = (job.status || '').toLowerCase().includes('progress');

            return (
              <button
                key={job.id}
                type="button"
                onClick={() => onSelectJob(job)}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-all cursor-pointer border-none text-left"
              >
                <div className="flex items-start gap-2.5 overflow-hidden">
                  <div className="mt-0.5 shrink-0">
                    {renderIcon(job.scope_of_work || '')}
                  </div>
                  <div className="truncate">
                    <div className="text-[11px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                      <span className="text-slate-500 font-semibold">{timeStr}</span>
                      <span className="truncate">{details.title}</span>
                    </div>
                    <div className="text-[9.5px] text-slate-400 truncate">
                      {shortAddress}
                    </div>
                  </div>
                </div>

                {/* Status pill tag */}
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ml-2 ${
                  isInProgress
                    ? 'bg-orange-100 text-orange-700'
                    : isPending
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {job.status || 'Pending'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
