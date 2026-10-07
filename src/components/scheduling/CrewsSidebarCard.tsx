import React from 'react';
import { Job, Profile } from './types';
import { parseJobDateStr } from './schedulingUtils';

interface CrewsSidebarCardProps {
  jobs: Job[];
  workers: Profile[];
  currentDate: Date;
  onFilterCrew?: (crewIdOrName: string) => void;
  activeCrewFilter?: string;
  onViewAll?: () => void;
}

export const CrewsSidebarCard: React.FC<CrewsSidebarCardProps> = ({
  jobs,
  workers,
  currentDate,
  onFilterCrew,
  activeCrewFilter,
  onViewAll
}) => {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const todayStr = new Date().toISOString().split('T')[0];

  // Group workers into real Crews matching the design
  // If we have workers, we can group them into pairs (Crew A, Crew B, Crew C, Crew D)
  const crewGroups = [
    {
      id: 'crew_a',
      displayName: 'Crew A',
      leadNames: ['Ali Qasim', 'Khder'],
      workerMatches: ['ali qasim', 'khder']
    },
    {
      id: 'crew_b',
      displayName: 'Crew B',
      leadNames: ['Haval', 'Suod'],
      workerMatches: ['haval', 'suod']
    },
    {
      id: 'crew_c',
      displayName: 'Crew C',
      leadNames: ['Rayan', 'Ali K.'],
      workerMatches: ['rayan', 'ali khalaf']
    },
    {
      id: 'crew_d',
      displayName: 'Crew D',
      leadNames: ['Hussein', 'Shaker'],
      workerMatches: ['hussein', 'shaker']
    }
  ];

  // Helper to test if a job belongs to a crew
  const isJobAssignedToCrew = (job: Job, workerMatches: string[]): boolean => {
    const assignedName = (job.profiles?.full_name || '').toLowerCase();
    if (workerMatches.some(m => assignedName.includes(m))) return true;

    if (job.job_crew && job.job_crew.length > 0) {
      return job.job_crew.some(c => {
        const cName = (c.profiles?.full_name || '').toLowerCase();
        return workerMatches.some(m => cName.includes(m));
      });
    }
    return false;
  };

  const crewSummaries = crewGroups.map((crew) => {
    // Count jobs this month
    const thisMonthJobs = jobs.filter(j => {
      const dateStr = parseJobDateStr(j.scheduled_date);
      if (!dateStr) return false;
      const [y, m] = dateStr.split('-').map(Number);
      if (y !== currentYear || m !== (currentMonth + 1)) return false;
      return isJobAssignedToCrew(j, crew.workerMatches);
    });

    // Check if on job today
    const hasJobToday = jobs.some(j => {
      const dateStr = parseJobDateStr(j.scheduled_date);
      return dateStr === todayStr && isJobAssignedToCrew(j, crew.workerMatches);
    });

    let statusType: 'on_job' | 'available' | 'off_today' = 'available';
    if (hasJobToday) {
      statusType = 'on_job';
    } else if (thisMonthJobs.length === 0) {
      statusType = 'off_today';
    }

    return {
      id: crew.id,
      name: crew.displayName,
      leads: crew.leadNames,
      jobCount: thisMonthJobs.length,
      status: statusType
    };
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-3xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-slate-800 tracking-tight m-0">
          Crews
        </h3>

        <button
          type="button"
          onClick={onViewAll}
          className="text-[10px] font-bold text-[#76C442] hover:text-[#5fa832] transition-colors border-none bg-transparent cursor-pointer p-0"
        >
          View All
        </button>
      </div>

      {/* Crews List */}
      <div className="space-y-2.5">
        {crewSummaries.map((crew) => {
          const isSelected = activeCrewFilter === crew.id;

          return (
            <button
              key={crew.id}
              type="button"
              onClick={() => onFilterCrew?.(isSelected ? 'all' : crew.id)}
              className={`w-full flex items-center justify-between p-1.5 rounded-xl transition-all cursor-pointer border-none text-left ${
                isSelected 
                  ? 'bg-slate-100 ring-1 ring-slate-300' 
                  : 'hover:bg-slate-50'
              }`}
            >
              {/* Avatars and Crew Name */}
              <div className="flex items-center gap-2">
                {/* Overlapping double avatars */}
                <div className="flex items-center -space-x-1.5 shrink-0">
                  <div className="w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[8px] font-black text-slate-600 shadow-3xs">
                    {crew.leads[0]?.[0] || 'A'}
                  </div>
                  <div className="w-5 h-5 rounded-full bg-slate-300 border border-white flex items-center justify-center text-[8px] font-black text-slate-700 shadow-3xs">
                    {crew.leads[1]?.[0] || 'B'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-800">
                    {crew.name}
                  </span>

                  {/* Status Indicator */}
                  {crew.status === 'on_job' ? (
                    <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      On Job
                    </span>
                  ) : crew.status === 'available' ? (
                    <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      Off Today
                    </span>
                  )}
                </div>
              </div>

              {/* Job count */}
              <span className="text-[10px] font-bold text-slate-500">
                {crew.jobCount} jobs
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
