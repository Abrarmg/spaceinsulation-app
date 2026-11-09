import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useSearchParams } from 'react-router-dom';
import { CreateJobModal } from '../components/CreateJobModal';
import { JobsHeader } from './jobs/JobsHeader';
import { JobsSummaryCards } from './jobs/JobsSummaryCards';
import { JobsFilters, JobsStatusTabs, DEFAULT_JOB_FILTERS } from './jobs/JobsFilters';
import { Page } from '../components/ui';
import { ListPanel } from '../components/ui/list';
import { JobsDataGrid } from './jobs/JobsDataGrid';
import type { JobSortKey } from './jobs/JobsDataGrid';
import { BulkBar, BulkButton, Pager, downloadCsv, sortRows, usePaged, useSelection } from '../components/ui/table';
import type { SortState } from '../components/ui/table';
import { useConfirm, useToast } from '../hooks/useFeedback';
import { CheckCircle2, Download, XCircle } from 'lucide-react';
import { WorkerJobsView } from './jobs/WorkerJobsView';
import type { Job, JobFilterState } from './jobs/types';
import { todayDate, todayLocal } from '../utils/dates';

export const JobsList: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter & Search States
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<JobFilterState>({
    searchQuery: '',
    status: searchParams.get('status') || 'all',
    dateRange: '',
    crew: searchParams.get('crew') || '',
    sort: 'Newest'
  });
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<Job | null>(null);

  // User Session
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Initial auth fetch
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setCurrentUserRole(data.role);
          });
      }
    });
  }, []);

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    let userRole = currentUserRole;
    if (!userRole) {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      userRole = data?.role || null;
    }

    setLoading(true);
    try {
      const isFieldWorker = userRole === 'field_worker';
      let query = supabase
        .from('jobs')
        .select('*, customers(full_name, service_address, phone, email), profiles:assigned_worker_id(full_name), job_crew(worker_id, profiles:worker_id(id, full_name))');

      if (isFieldWorker) {
        query = query.eq('assigned_worker_id', session.user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setJobs(data as unknown as Job[] || []);
    } catch (err: any) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserRole]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Derived State: statusCounts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: jobs.length };
    jobs.forEach(job => {
      counts[job.status] = (counts[job.status] || 0) + 1;
    });
    return counts;
  }, [jobs]);

  // Derived State: filteredJobs
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // Status
    if (filters.status !== 'all') {
      result = result.filter(j => j.status === filters.status);
    }

    // Search
    if (filters.searchQuery) {
      const lowerQ = filters.searchQuery.toLowerCase().trim();
      result = result.filter(j => {
        const jNum = String(j.job_number ?? '').toLowerCase();
        const custName = String(j.customers?.full_name ?? '').toLowerCase();
        const custAddr = String(j.customers?.service_address ?? '').toLowerCase();
        const custPhone = String((j.customers as any)?.phone ?? '').toLowerCase();
        const custEmail = String((j.customers as any)?.email ?? '').toLowerCase();

        return (
          jNum.includes(lowerQ) ||
          custName.includes(lowerQ) ||
          custAddr.includes(lowerQ) ||
          custPhone.includes(lowerQ) ||
          custEmail.includes(lowerQ)
        );
      });
    }

    // Crew Filter
    if (filters.crew === 'unassigned') {
      result = result.filter(j => (!j.job_crew || j.job_crew.length === 0) && !j.assigned_worker_id);
    } else if (filters.crew === 'assigned') {
      result = result.filter(j => (j.job_crew && j.job_crew.length > 0) || !!j.assigned_worker_id);
    }

    // Date Range (simple mock logic for today/week/month based on scheduled_date)
    if (filters.dateRange) {
      const today = todayDate();
      result = result.filter(j => {
        if (!j.scheduled_date) return false;
        // Jobs are stored at midnight UTC; read the calendar date from the string so it isn't a day off.
        const jobDate = new Date(`${j.scheduled_date.slice(0, 10)}T12:00:00`);
        if (filters.dateRange === 'today') {
          return jobDate.toDateString() === today.toDateString();
        } else if (filters.dateRange === 'week') {
          const diffTime = Math.abs(today.getTime() - jobDate.getTime());
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 7;
        } else if (filters.dateRange === 'month') {
          return jobDate.getMonth() === today.getMonth() && jobDate.getFullYear() === today.getFullYear();
        }
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (filters.sort) {
        case 'Oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'Highest Value':
          return (b.quoted_amount || 0) - (a.quoted_amount || 0);
        case 'Nearest Date':
          if (!a.scheduled_date) return 1;
          if (!b.scheduled_date) return -1;
          return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
        case 'Newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [jobs, filters]);

  const handleFilterChange = (newFilters: Partial<JobFilterState>) => {
    // Choosing a sort from the dropdown replaces a column-header sort.
    if (newFilters.sort) setColumnSort(null);
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Clicking a column header sorts by it (overrides the dropdown until it's changed).
  const [columnSort, setColumnSort] = useState<SortState<JobSortKey> | null>(null);
  const sortedJobs = useMemo(
    () =>
      sortRows(filteredJobs, columnSort, {
        customer: j => j.customers?.full_name?.toLowerCase(),
        scheduled: j => j.scheduled_date?.slice(0, 10),
        status: j => j.status,
        value: j => j.quoted_amount ?? 0,
      }),
    [filteredJobs, columnSort],
  );
  const { page, setPage, pageRows, total, pageSize } = usePaged(sortedJobs, JSON.stringify([filters, columnSort]));
  const selection = useSelection(pageRows.map(j => j.id));
  const { confirm, confirmDialog } = useConfirm();
  const { showToast, toastElement } = useToast();
  const [bulkBusy, setBulkBusy] = useState(false);

  const selectedJobs = jobs.filter(j => selection.has(j.id));

  const bulkSetStatus = async (status: 'Completed' | 'Cancelled') => {
    const n = selectedJobs.length;
    const ok = await confirm({
      title: status === 'Completed' ? `Mark ${n} ${n === 1 ? 'job' : 'jobs'} completed?` : `Cancel ${n} ${n === 1 ? 'job' : 'jobs'}?`,
      message:
        status === 'Completed'
          ? 'They’ll move to Completed, ready to invoice.'
          : 'They’ll be marked Cancelled and drop off the schedule. You can change a job’s status again later.',
      confirmLabel: status === 'Completed' ? 'Mark completed' : 'Cancel jobs',
      danger: status === 'Cancelled',
    });
    if (!ok) return;
    setBulkBusy(true);
    const { error } = await supabase.from('jobs').update({ status }).in('id', selectedJobs.map(j => j.id));
    setBulkBusy(false);
    if (error) {
      showToast('Could not update the jobs: ' + error.message, 'error');
      return;
    }
    showToast(`${n} ${n === 1 ? 'job' : 'jobs'} updated.`);
    selection.clear();
    fetchJobs();
  };

  const exportJobs = (list: Job[]) =>
    downloadCsv(
      `jobs_export_${todayLocal()}.csv`,
      ['Job Number', 'Customer', 'Address', 'Status', 'Scheduled Date', 'Quoted Amount', 'Priority', 'Crew'],
      list.map(j => [
        j.job_number,
        j.customers?.full_name,
        j.customers?.service_address,
        j.status,
        j.scheduled_date?.slice(0, 10),
        j.quoted_amount || 0,
        j.priority || 'Normal',
        j.profiles?.full_name || 'Unassigned',
      ]),
    );

  const handleExportCSV = () => {
    if (filteredJobs.length === 0) return alert('No data to export.');
    return exportJobs(sortedJobs);
  };

  const handleImportCSV = () => {
    alert('The CSV Import tool is currently being configured for your workspace to map your specific spreadsheet columns. Please contact support to finalize your import template.');
  };

  const isFiltered =
    filters.searchQuery !== DEFAULT_JOB_FILTERS.searchQuery ||
    filters.dateRange !== DEFAULT_JOB_FILTERS.dateRange ||
    filters.crew !== DEFAULT_JOB_FILTERS.crew ||
    filters.status !== DEFAULT_JOB_FILTERS.status;

  const openNewJob = () => {
    setJobToEdit(null);
    setIsModalOpen(true);
  };

  if (currentUserRole === 'field_worker') {
    return (
      <Page>
        <WorkerJobsView jobs={jobs} loading={loading} currentUserId={currentUserId} onRefresh={fetchJobs} />
      </Page>
    );
  }

  return (
    <Page>
      <JobsHeader onNewJob={openNewJob} onExport={handleExportCSV} onImport={handleImportCSV} />

      <JobsSummaryCards
        jobs={jobs}
        loading={loading}
        activeStatus={filters.status}
        onSelectStatus={status => handleFilterChange({ status })}
      />

      <ListPanel
        tabs={<JobsStatusTabs filters={filters} onChange={handleFilterChange} statusCounts={statusCounts} />}
        toolbar={<JobsFilters filters={filters} onChange={handleFilterChange} />}
        footer={
          !loading && filteredJobs.length > 0 ? (
            <Pager page={page} pageSize={pageSize} total={total} onPage={setPage} noun="jobs" />
          ) : undefined
        }
      >
        <JobsDataGrid
          jobs={pageRows}
          sort={columnSort}
          onSort={setColumnSort}
          selection={selection}
          loading={loading}
          filtered={isFiltered}
          onNewJob={openNewJob}
          onEdit={job => {
            setJobToEdit(job);
            setIsModalOpen(true);
          }}
        />
      </ListPanel>

      <BulkBar count={selection.count} noun="jobs" onClear={selection.clear}>
        <BulkButton icon={CheckCircle2} onClick={() => bulkSetStatus('Completed')} disabled={bulkBusy}>
          Mark completed
        </BulkButton>
        <BulkButton icon={Download} onClick={() => exportJobs(selectedJobs)}>
          Export
        </BulkButton>
        <BulkButton icon={XCircle} danger onClick={() => bulkSetStatus('Cancelled')} disabled={bulkBusy}>
          Cancel jobs
        </BulkButton>
      </BulkBar>
      {confirmDialog}
      {toastElement}

      <CreateJobModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchJobs}
        jobToEdit={jobToEdit || undefined}
      />
    </Page>
  );
};
