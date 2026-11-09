import React from 'react';
import { Crew, Job } from './types';
import { isJobForCrew, parseJobDateStr, toDateKey } from './schedulingUtils';
import { todayDate } from '../../utils/dates';

interface CrewsSidebarCardProps {
  jobs: Job[];
  crews: Crew[];
  currentDate: Date;
  onFilterCrew?: (crewId: string) => void;
  activeCrewFilter?: string;
  onManage?: () => void;
}

const initial = (name: string) => (name.trim()[0] || '?').toUpperCase();

export const CrewsSidebarCard: React.FC<CrewsSidebarCardProps> = ({
  jobs,
  crews,
  currentDate,
  onFilterCrew,
  activeCrewFilter,
  onManage,
}) => {
  const todayStr = toDateKey(todayDate());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const summaries = crews.map(crew => {
    const crewJobs = jobs.filter(j => isJobForCrew(j, crew));
    const monthCount = crewJobs.filter(j => {
      const [y, m] = parseJobDateStr(j.scheduled_date).split('-').map(Number);
      return y === year && m === month;
    }).length;
    const onJobToday = crewJobs.some(j => parseJobDateStr(j.scheduled_date) === todayStr);
    return { ...crew, monthCount, onJobToday };
  });

  return (
    <div className="bg-white rounded-2xl border border-line/80 p-4 shadow-3xs select-none">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-navy tracking-tight m-0">Crews</h3>
        <button
          type="button"
          onClick={onManage}
          className="text-2xs font-bold text-brand hover:text-[#5fa832] transition-colors border-none bg-transparent cursor-pointer p-0"
        >
          Manage
        </button>
      </div>

      {summaries.length === 0 ? (
        <p className="text-2xs text-subtle font-semibold m-0">No field workers yet.</p>
      ) : (
        <div className="space-y-1.5">
          {summaries.map(crew => {
            const isSelected = activeCrewFilter === crew.id;
            return (
              <button
                key={crew.id}
                type="button"
                onClick={() => onFilterCrew?.(isSelected ? 'all' : crew.id)}
                title={crew.memberNames.join(', ') || 'No members'}
                className={`w-full flex items-center justify-between gap-2 p-1.5 rounded-xl transition-all cursor-pointer border-none text-left ${
                  isSelected ? 'bg-mist ring-1 ring-line-strong' : 'hover:bg-canvas'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center -space-x-1.5 shrink-0">
                    {(crew.memberNames.length ? crew.memberNames.slice(0, 3) : ['?']).map((n, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full bg-line border border-white flex items-center justify-center text-2xs font-bold text-muted"
                      >
                        {initial(n)}
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xs font-bold text-navy truncate">{crew.name}</div>
                    <div className={`text-[9.5px] font-bold ${crew.onJobToday ? 'text-emerald-600' : 'text-subtle'}`}>
                      {crew.memberIds.length === 0 ? 'No members' : crew.onJobToday ? 'On a job today' : 'Free today'}
                    </div>
                  </div>
                </div>
                <span className="text-2xs font-bold text-muted shrink-0">{crew.monthCount} jobs</span>
              </button>
            );
          })}
        </div>
      )}

      {crews.some(c => c.isFallback) && (
        <p className="text-2xs text-subtle font-medium mt-3 mb-0 leading-snug">
          Showing individual workers. Click Manage to group them into crews.
        </p>
      )}
    </div>
  );
};
