import React, { useMemo } from 'react';
import { StatStrip } from '../../components/ui/list';
import { toLocalDateStr } from '../dashboard/useDashboardData';
import type { Job } from './types';
import { todayDate } from '../../utils/dates';

interface JobsSummaryCardsProps {
  jobs: Job[];
  loading?: boolean;
  activeStatus?: string;
  onSelectStatus?: (status: string) => void;
}

/** Key job numbers above the list. Tapping one filters the list to that status. */
export const JobsSummaryCards: React.FC<JobsSummaryCardsProps> = ({ jobs, loading, activeStatus, onSelectStatus }) => {
  const stats = useMemo(() => {
    const today = toLocalDateStr(todayDate());
    return {
      today: jobs.filter(j => j.scheduled_date?.slice(0, 10) === today).length,
      scheduled: jobs.filter(j => j.status === 'Scheduled').length,
      inProgress: jobs.filter(j => j.status === 'In Progress').length,
      completed: jobs.filter(j => j.status === 'Completed').length,
    };
  }, [jobs]);

  const pick = (status: string) => onSelectStatus && (() => onSelectStatus(activeStatus === status ? 'all' : status));

  return (
    <StatStrip
      loading={loading}
      items={[
        { label: 'Today', value: stats.today, hint: 'Scheduled for today' },
        { label: 'Scheduled', value: stats.scheduled, hint: 'Booked and upcoming', active: activeStatus === 'Scheduled', onClick: pick('Scheduled') },
        { label: 'In progress', value: stats.inProgress, hint: 'On site now', active: activeStatus === 'In Progress', onClick: pick('In Progress') },
        { label: 'Completed', value: stats.completed, hint: 'Ready to invoice', active: activeStatus === 'Completed', onClick: pick('Completed') },
      ]}
    />
  );
};
