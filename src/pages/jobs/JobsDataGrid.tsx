import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Pencil } from 'lucide-react';
import { EmptyState, StatusBadge } from '../../components/ui';
import { Avatar, ListLoading, MobileList, MobileRow, T } from '../../components/ui/list';
import type { Job } from './types';

interface JobsDataGridProps {
  jobs: Job[];
  loading: boolean;
  onEdit: (job: Job) => void;
  /** True when a search or filter is active, so the empty message can say so. */
  filtered?: boolean;
  onNewJob?: () => void;
}

const money = (n: number | null | undefined) =>
  `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Jobs are stored at midnight UTC, so read the calendar date straight from the string. */
const formatDate = (iso: string | null) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : null;

const crewNames = (job: Job) => {
  const names: string[] = [];
  job.job_crew?.forEach(c => {
    const n = c.profiles?.full_name;
    if (n && !names.includes(n)) names.push(n);
  });
  if (names.length === 0 && job.profiles?.full_name) names.push(job.profiles.full_name);
  return names;
};

const CrewText: React.FC<{ job: Job }> = ({ job }) => {
  const names = crewNames(job);
  if (names.length === 0) return <span className="text-amber-700 font-medium">Needs a crew</span>;
  return <span title={names.join(', ')}>{names.join(', ')}</span>;
};

export const JobsDataGrid: React.FC<JobsDataGridProps> = ({ jobs, loading, onEdit, filtered, onNewJob }) => {
  const navigate = useNavigate();

  if (loading) return <ListLoading label="Loading jobs…" />;

  if (jobs.length === 0) {
    return filtered ? (
      <EmptyState icon={ClipboardList} title="No jobs match" description="Try a different search, or clear the filters." />
    ) : (
      <EmptyState
        icon={ClipboardList}
        title="No jobs yet"
        description="Jobs you book or convert from estimates will show up here."
        action={
          onNewJob && (
            <button type="button" onClick={onNewJob} className="h-10 px-4 rounded-lg bg-brand hover:bg-brand-hover text-navy text-sm font-semibold border-0">
              Create a job
            </button>
          )
        }
      />
    );
  }

  return (
    <>
      {/* Desktop & tablet */}
      <div className={T.wrap}>
        <table className={T.table}>
          <thead className={T.thead}>
            <tr>
              <th className={T.th}>Customer</th>
              <th className={`${T.th} hidden lg:table-cell`}>Address</th>
              <th className={T.th}>Scheduled</th>
              <th className={T.th}>Status</th>
              <th className={`${T.th} text-right`}>Value</th>
              <th className={`${T.th} w-12`}>
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id} className={T.tr} onClick={() => navigate(`/jobs/${job.id}`)}>
                <td className={T.td}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={job.customers?.full_name} />
                    <div className="min-w-0">
                      <div className="font-semibold truncate max-w-[240px]">{job.customers?.full_name || 'Unknown customer'}</div>
                      <div className="text-xs text-muted">Job #{job.job_number}</div>
                    </div>
                  </div>
                </td>
                <td className={`${T.td} hidden lg:table-cell`}>
                  <div className="text-sm truncate max-w-[220px]">{job.customers?.service_address?.split(',')[0] || '—'}</div>
                  <div className="text-xs text-muted truncate max-w-[220px]">{job.customers?.service_address?.split(',').slice(1).join(',').trim()}</div>
                </td>
                <td className={T.td}>
                  <div className="whitespace-nowrap">{formatDate(job.scheduled_date) ?? <span className="text-muted">Not scheduled</span>}</div>
                  <div className="text-xs text-muted truncate max-w-[200px]">
                    <CrewText job={job} />
                  </div>
                </td>
                <td className={T.td}>
                  <StatusBadge status={job.status} />
                </td>
                <td className={`${T.td} text-right font-semibold whitespace-nowrap`}>{money(job.quoted_amount)}</td>
                <td className={`${T.td} text-right`}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onEdit(job);
                    }}
                    title="Edit job"
                    aria-label={`Edit job ${job.job_number}`}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-navy hover:bg-line border-0 bg-transparent"
                  >
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone */}
      <MobileList>
        {jobs.map(job => (
          <MobileRow
            key={job.id}
            to={`/jobs/${job.id}`}
            title={job.customers?.full_name || 'Unknown customer'}
            subtitle={`Job #${job.job_number}${job.customers?.service_address ? ` · ${job.customers.service_address.split(',')[0]}` : ''}`}
            right={<StatusBadge status={job.status} />}
            meta={
              <>
                <span>{formatDate(job.scheduled_date) ?? 'Not scheduled'}</span>
                <span className="font-semibold text-navy">{money(job.quoted_amount)}</span>
                <span className="truncate max-w-[160px]">
                  <CrewText job={job} />
                </span>
              </>
            }
          />
        ))}
      </MobileList>
    </>
  );
};
