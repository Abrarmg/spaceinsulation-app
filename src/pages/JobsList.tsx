import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { CreateJobModal } from '../components/CreateJobModal';
import { JobsHeader } from './jobs/JobsHeader';
import { JobsSummaryCards } from './jobs/JobsSummaryCards';
import { JobsFilters } from './jobs/JobsFilters';
import { JobsDataGrid } from './jobs/JobsDataGrid';
import { WorkerJobsView } from './jobs/WorkerJobsView';
import type { Job, JobFilterState } from './jobs/types';

export const JobsList: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter & Search States
  const [filters, setFilters] = useState<JobFilterState>({
    searchQuery: '',
    status: 'all',
    dateRange: '',
    crew: '',
    sort: 'Newest'
  });
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<Job | null>(null);

  // User Session
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Initial auth fetch
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
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
        .select('*, customers(full_name, service_address), profiles:assigned_worker_id(full_name)');

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
      const lowerQ = filters.searchQuery.toLowerCase();
      result = result.filter(j => {
        return (
          j.job_number.toString().includes(lowerQ) ||
          (j.customers?.full_name || '').toLowerCase().includes(lowerQ) ||
          (j.customers?.service_address || '').toLowerCase().includes(lowerQ)
        );
      });
    }

    // Crew Filter
    if (filters.crew === 'unassigned') {
      result = result.filter(j => !j.assigned_worker_id);
    } else if (filters.crew === 'assigned') {
      result = result.filter(j => !!j.assigned_worker_id);
    }

    // Date Range (simple mock logic for today/week/month based on scheduled_date)
    if (filters.dateRange) {
      const today = new Date();
      result = result.filter(j => {
        if (!j.scheduled_date) return false;
        const jobDate = new Date(j.scheduled_date);
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
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleExportCSV = () => {
    if (filteredJobs.length === 0) return alert('No data to export.');
    
    const headers = ['Job Number', 'Customer', 'Address', 'Status', 'Scheduled Date', 'Quoted Amount', 'Priority', 'Crew'];
    const rows = filteredJobs.map(j => [
      `"${j.job_number}"`,
      `"${(j.customers?.full_name || '').replace(/"/g, '""')}"`,
      `"${(j.customers?.service_address || '').replace(/"/g, '""')}"`,
      j.status,
      j.scheduled_date || '',
      j.quoted_amount || 0,
      j.priority || 'Normal',
      `"${(j.profiles?.full_name || 'Unassigned').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `jobs_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = () => {
    alert('The CSV Import tool is currently being configured for your workspace to map your specific spreadsheet columns. Please contact support to finalize your import template.');
  };

  return (
    <div className="w-full px-4 md:px-8 mx-auto max-w-[1600px] space-y-6">
      {currentUserRole === 'field_worker' ? (
        <WorkerJobsView jobs={jobs} loading={loading} />
      ) : (
        <>
          <JobsHeader 
            onNewJob={() => {
          setJobToEdit(null);
          setIsModalOpen(true);
        }} 
        onExport={handleExportCSV}
        onImport={handleImportCSV}
      />

      {!loading && <JobsSummaryCards jobs={jobs} />}

      <JobsFilters 
        filters={filters}
        onChange={handleFilterChange}
        statusCounts={statusCounts}
      />

      <JobsDataGrid 
        jobs={filteredJobs}
        loading={loading}
        onEdit={(job) => {
          setJobToEdit(job);
          setIsModalOpen(true);
        }}
      />

      <CreateJobModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchJobs}
        jobToEdit={jobToEdit || undefined}
      />
      </>
      )}
    </div>
  );
};
