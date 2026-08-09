import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  Briefcase, 
  Calendar,
  CheckCircle2,
  Clock,
  Navigation,
  RefreshCcw
} from 'lucide-react';
import type { Job } from './types';

interface WorkerJobsViewProps {
  jobs: Job[];
  loading: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Quoted': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'Scheduled': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'In Progress': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Completed': return 'bg-green-100 text-green-700 border-green-200';
    case 'Cancelled': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

export const WorkerJobsView: React.FC<WorkerJobsViewProps> = ({ jobs, loading }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Compute stats for current user
  const stats = useMemo(() => {
    const todayStr = new Date().toDateString();
    return {
      assigned: jobs.length,
      today: jobs.filter(j => j.scheduled_date && new Date(j.scheduled_date).toDateString() === todayStr).length,
      inProgress: jobs.filter(j => j.status === 'In Progress').length,
      completed: jobs.filter(j => j.status === 'Completed').length
    };
  }, [jobs]);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    let result = [...jobs];
    
    // Status
    if (statusFilter !== 'all') {
      result = result.filter(j => j.status === statusFilter);
    }
    
    // Search
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(j => 
        j.job_number.toString().includes(lower) ||
        (j.customers?.full_name || '').toLowerCase().includes(lower) ||
        (j.customers?.service_address || '').toLowerCase().includes(lower)
      );
    }

    // Date
    if (dateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      result = result.filter(j => {
        if (!j.scheduled_date) return false;
        const jobDate = new Date(j.scheduled_date);
        jobDate.setHours(0, 0, 0, 0);
        
        switch (dateFilter) {
          case 'today': return jobDate.getTime() === today.getTime();
          case 'tomorrow': return jobDate.getTime() === tomorrow.getTime();
          case 'upcoming': return jobDate.getTime() > today.getTime();
          case 'past': return jobDate.getTime() < today.getTime();
          default: return true;
        }
      });
    }

    // Sort by soonest
    result.sort((a, b) => {
      if (!a.scheduled_date) return 1;
      if (!b.scheduled_date) return -1;
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    });

    return result;
  }, [jobs, searchQuery, statusFilter, dateFilter]);

  // Group filtered jobs
  const groupedJobs = useMemo(() => {
    const today = new Date().toDateString();
    const todayJobs: Job[] = [];
    const upcomingJobs: Job[] = [];
    
    filteredJobs.forEach(job => {
      if (job.scheduled_date && new Date(job.scheduled_date).toDateString() === today) {
        todayJobs.push(job);
      } else {
        upcomingJobs.push(job);
      }
    });
    
    return { today: todayJobs, upcoming: upcomingJobs };
  }, [filteredJobs]);

  const JobCard = ({ job }: { job: Job }) => {
    const date = job.scheduled_date ? new Date(job.scheduled_date) : null;
    const dateStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unscheduled';
    const timeStr = date ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Time not set';

    return (
      <Link to={`/jobs/${job.id}`} className="block group">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-[#7CC242]/50 transition-all cursor-pointer h-full flex flex-col relative overflow-hidden">
          
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider mb-1">
                JOB-{job.job_number}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#151A2D] line-clamp-1 group-hover:text-[#7CC242] transition-colors">
                {job.customers?.full_name || 'Unknown Customer'}
              </h3>
            </div>
            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(job.status)}`}>
              {job.status}
            </span>
          </div>

          <div className="space-y-2.5 mb-5 flex-grow">
            <div className="flex items-start gap-2.5 text-[#475569]">
              <MapPin size={16} className="shrink-0 mt-0.5 text-[#94A3B8]" />
              <span className="text-xs sm:text-sm font-semibold line-clamp-2">
                {job.customers?.service_address || 'No address provided'}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-[#475569]">
              <Calendar size={16} className="shrink-0 text-[#94A3B8]" />
              <span className="text-xs sm:text-sm font-semibold">{dateStr}</span>
            </div>
            <div className="flex items-center gap-2.5 text-[#475569]">
              <Clock size={16} className="shrink-0 text-[#94A3B8]" />
              <span className="text-xs sm:text-sm font-semibold">{timeStr}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-auto pt-4 border-t border-[#F1F5F9]">
            <button className="flex-1 py-2.5 bg-[#F8FAFC] hover:bg-[#E2E8F0] text-[#151A2D] rounded-xl text-xs font-bold transition-colors text-center">
              View Job →
            </button>
            <button 
              className="px-4 py-2.5 bg-[#7CC242]/10 hover:bg-[#7CC242]/20 text-[#7CC242] rounded-xl transition-colors flex items-center justify-center"
              onClick={(e) => {
                e.preventDefault(); // Prevent navigating to job
                if (job.customers?.service_address) {
                  window.open(`https://maps.google.com/?q=${encodeURIComponent(job.customers.service_address)}`);
                }
              }}
            >
              <Navigation size={16} />
            </button>
          </div>
        </div>
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7CC242]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#151A2D] tracking-tight">My Jobs</h1>
        <p className="text-sm font-medium text-[#64748B] mt-1">Manage your assigned jobs and stay on top of your schedule.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Assigned Jobs', value: stats.assigned, icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', sub: 'Your active assignments' },
          { label: 'Today', value: stats.today, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', sub: 'Scheduled for today' },
          { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', sub: 'Currently working' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', sub: 'Completed jobs' }
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className={`bg-white rounded-2xl p-4 sm:p-5 border ${stat.border} shadow-sm`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color}`}>
                  <Icon size={16} />
                </div>
                <h3 className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">{stat.label}</h3>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-[#151A2D] mb-0.5">{stat.value}</div>
              <div className="text-[10px] font-semibold text-[#94A3B8]">{stat.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={18} />
          <input 
            type="text" 
            placeholder="Search your jobs by customer or job number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 focus:border-[#7CC242]"
          />
        </div>
        
        <div className="flex flex-wrap md:flex-nowrap gap-2">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20"
          >
            <option value="all">All Statuses</option>
            <option value="Quoted">Quoted</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <button 
            onClick={() => { setSearchQuery(''); setStatusFilter('all'); setDateFilter('all'); }}
            className="px-3 py-2.5 bg-white border border-[#E2E8F0] hover:bg-[#FEF2F2] hover:text-[#DC2626] hover:border-[#FECACA] text-[#64748B] rounded-xl transition-colors shadow-sm"
            title="Reset Filters"
          >
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredJobs.length === 0 ? (
        <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-12 text-center">
          <div className="w-16 h-16 bg-[#ECFDF5] text-[#10B981] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-lg font-black text-[#151A2D] mb-2">No jobs found</h3>
          <p className="text-sm font-medium text-[#64748B] max-w-sm mx-auto">
            You're all caught up! No jobs match your current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* Today Section */}
          {groupedJobs.today.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-[#E2E8F0] pb-2">
                <h2 className="text-lg font-black text-[#151A2D]">TODAY</h2>
                <span className="px-2 py-0.5 rounded-full bg-[#151A2D] text-white text-[10px] font-bold">
                  {groupedJobs.today.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupedJobs.today.map(job => <JobCard key={job.id} job={job} />)}
              </div>
            </div>
          )}

          {/* Upcoming Section */}
          {groupedJobs.upcoming.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-[#E2E8F0] pb-2">
                <h2 className="text-lg font-black text-[#151A2D]">UPCOMING & PAST</h2>
                <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] text-[10px] font-bold">
                  {groupedJobs.upcoming.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupedJobs.upcoming.map(job => <JobCard key={job.id} job={job} />)}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
