import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Clock, 
  Briefcase, 
  Navigation, 
  Calendar as CalendarIcon,
  Search,
  RefreshCcw,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import type { Job } from './types';

interface WorkerJobsViewProps {
  jobs: Job[];
  loading: boolean;
  currentUserId?: string | null;
  onRefresh?: () => void;
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

const formatTime12h = (time: string | null | undefined): string => {
  if (!time) return '';
  const parts = time.split(':');
  if (parts.length < 2) return time;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
};

const formatTimeRange = (startTime: string | null | undefined, endTime: string | null | undefined): string => {
  const start = formatTime12h(startTime);
  const end = formatTime12h(endTime);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return `Until ${end}`;
  return 'Time not set';
};

const toDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getJobDateKey = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null;
  const part = dateStr.split('T')[0].trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return toDateKey(d);
};

const formatSelectedDateHeader = (date: Date, count: number): string => {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = date.getDate();
  const jobSuffix = count === 1 ? '1 JOB' : `${count} JOBS`;
  return `${weekday} ${month} ${day} • ${jobSuffix}`;
};

export const WorkerJobsView: React.FC<WorkerJobsViewProps> = ({ 
  jobs, 
  loading, 
  currentUserId,
  onRefresh
}) => {
  // Worker profile id state
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(currentUserId || null);

  useEffect(() => {
    if (!effectiveUserId) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setEffectiveUserId(session.user.id);
        }
      });
    }
  }, [effectiveUserId]);

  // Calendar navigation & selection state
  // Initial date: always Today
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Secondary search & filter state for the all-jobs section
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAllJobs, setShowAllJobs] = useState(false);

  // Strictly filter jobs for the CURRENT worker
  const workerJobs = useMemo(() => {
    return jobs.filter(j => {
      if (effectiveUserId) {
        return j.assigned_worker_id === effectiveUserId;
      }
      return true;
    });
  }, [jobs, effectiveUserId]);

  // Map jobs by date key 'YYYY-MM-DD'
  const jobsByDate = useMemo(() => {
    const map: Record<string, Job[]> = {};
    workerJobs.forEach(job => {
      const key = getJobDateKey(job.scheduled_date);
      if (key) {
        if (!map[key]) map[key] = [];
        map[key].push(job);
      }
    });
    return map;
  }, [workerJobs]);

  // Calendar days generation
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayKey = toDateKey(new Date());
    const selectedKey = toDateKey(selectedDate);

    const days: {
      date: Date;
      dateKey: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasJobs: boolean;
      jobCount: number;
    }[] = [];

    // Previous month padding days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, daysInPrevMonth - i);
      const key = toDateKey(prevDate);
      const jobCount = jobsByDate[key]?.length || 0;
      days.push({
        date: prevDate,
        dateKey: key,
        isCurrentMonth: false,
        isToday: key === todayKey,
        isSelected: key === selectedKey,
        hasJobs: jobCount > 0,
        jobCount
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const key = toDateKey(date);
      const jobCount = jobsByDate[key]?.length || 0;
      days.push({
        date,
        dateKey: key,
        isCurrentMonth: true,
        isToday: key === todayKey,
        isSelected: key === selectedKey,
        hasJobs: jobCount > 0,
        jobCount
      });
    }

    // Next month padding days to complete grid weeks
    const totalSlots = Math.ceil(days.length / 7) * 7;
    const remainingSlots = totalSlots - days.length;
    for (let day = 1; day <= remainingSlots; day++) {
      const nextDate = new Date(year, month + 1, day);
      const key = toDateKey(nextDate);
      const jobCount = jobsByDate[key]?.length || 0;
      days.push({
        date: nextDate,
        dateKey: key,
        isCurrentMonth: false,
        isToday: key === todayKey,
        isSelected: key === selectedKey,
        hasJobs: jobCount > 0,
        jobCount
      });
    }

    return days;
  }, [currentMonth, selectedDate, jobsByDate]);

  // Jobs for the selected date
  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  
  const dailyJobs = useMemo(() => {
    const list = jobsByDate[selectedDateKey] || [];
    return [...list].sort((a, b) => {
      if (a.start_time && b.start_time) {
        return a.start_time.localeCompare(b.start_time);
      }
      return (a.job_number || 0) - (b.job_number || 0);
    });
  }, [jobsByDate, selectedDateKey]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Search/filtered list for all-jobs drawer
  const allFilteredJobs = useMemo(() => {
    let result = [...workerJobs];
    if (statusFilter !== 'all') {
      result = result.filter(j => j.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase().trim();
      result = result.filter(j => 
        String(j.job_number).includes(lower) ||
        (j.customers?.full_name || '').toLowerCase().includes(lower) ||
        (j.customers?.service_address || '').toLowerCase().includes(lower)
      );
    }
    return result.sort((a, b) => {
      if (!a.scheduled_date) return 1;
      if (!b.scheduled_date) return -1;
      return new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime();
    });
  }, [workerJobs, statusFilter, searchQuery]);

  // Reusable Job Card Component
  const JobCard: React.FC<{ job: Job }> = ({ job }) => {
    const timeDisplay = formatTimeRange(job.start_time, job.end_time);

    return (
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-sm hover:border-[#7CC242]/50 hover:shadow-md transition-all flex flex-col gap-4">
        {/* Top Header: Job Number + Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider mb-0.5">
              JOB-{job.job_number}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#151A2D] line-clamp-1">
              {job.customers?.full_name || 'Unknown Contact'}
            </h3>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0 ${getStatusColor(job.status)}`}>
            {job.status}
          </span>
        </div>

        {/* Operational Details: Address, Time, Project Scope */}
        <div className="space-y-2.5 text-[#475569]">
          {/* Service Address */}
          <div className="flex items-start gap-2.5 text-xs sm:text-sm">
            <MapPin size={16} className="shrink-0 mt-0.5 text-[#94A3B8]" />
            <span className="font-semibold line-clamp-2">
              {job.customers?.service_address || 'No service address provided'}
            </span>
          </div>

          {/* Time Range */}
          <div className="flex items-center gap-2.5 text-xs sm:text-sm">
            <Clock size={16} className="shrink-0 text-[#94A3B8]" />
            <span className="font-semibold text-[#151A2D]">{timeDisplay}</span>
          </div>

          {/* Scope / Project */}
          {(job.project_type || job.scope_of_work) && (
            <div className="flex items-start gap-2.5 text-xs sm:text-sm">
              <Briefcase size={16} className="shrink-0 mt-0.5 text-[#94A3B8]" />
              <div className="flex flex-col min-w-0">
                {job.project_type && (
                  <span className="font-bold text-[#151A2D]">{job.project_type}</span>
                )}
                {job.scope_of_work && (
                  <span className="text-[#64748B] text-xs line-clamp-2 mt-0.5 whitespace-pre-line">
                    {job.scope_of_work}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons: View Job + Map Navigation */}
        <div className="flex items-center gap-2 pt-3 border-t border-[#F1F5F9] mt-auto">
          <Link 
            to={`/jobs/${job.id}`}
            className="flex-1 py-2.5 bg-[#151A2D] hover:bg-[#202744] text-white rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>View Job</span>
            <span className="text-[#7CC242]">→</span>
          </Link>

          {job.customers?.service_address && (
            <button
              type="button"
              onClick={() => {
                window.open(`https://maps.google.com/?q=${encodeURIComponent(job.customers!.service_address)}`, '_blank');
              }}
              title="Open in Google Maps"
              className="px-3.5 py-2.5 bg-[#7CC242]/10 hover:bg-[#7CC242]/20 text-[#7CC242] rounded-xl transition-colors flex items-center justify-center shrink-0"
            >
              <Navigation size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
      
      {/* 1. Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#151A2D] tracking-tight">My Jobs</h1>
          <p className="text-xs sm:text-sm font-medium text-[#64748B] mt-0.5">
            Your assigned field assignments and schedule.
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] rounded-xl transition-colors shadow-sm"
            title="Refresh Jobs"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin text-[#7CC242]' : ''} />
          </button>
        )}
      </div>

      {/* 2. Monthly Calendar Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#E2E8F0] shadow-sm w-full">
        
        {/* Calendar Header: Month Name & Nav Controls */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-black text-[#151A2D]">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleGoToToday}
              className="px-2.5 py-1 text-xs font-bold text-[#151A2D] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg transition-colors"
            >
              Today
            </button>

            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous Month"
              className="p-2 text-[#475569] hover:text-[#151A2D] hover:bg-[#F1F5F9] rounded-xl transition-colors"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next Month"
              className="p-2 text-[#475569] hover:text-[#151A2D] hover:bg-[#F1F5F9] rounded-xl transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Days of Week Row: S M T W T F S */}
        <div className="grid grid-cols-7 text-center mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
            <div key={idx} className="text-xs sm:text-sm font-bold text-[#94A3B8] py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar 7-Column Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSelectedDate(item.date);
                if (!item.isCurrentMonth) {
                  setCurrentMonth(new Date(item.date.getFullYear(), item.date.getMonth(), 1));
                }
              }}
              className={`w-full aspect-square max-w-[46px] sm:max-w-[52px] mx-auto flex flex-col items-center justify-center rounded-xl sm:rounded-2xl transition-all relative ${
                item.isSelected
                  ? 'bg-[#151A2D] text-white shadow-md font-black'
                  : item.isToday
                  ? 'border-2 border-[#151A2D] text-[#151A2D] font-black bg-white hover:bg-[#F8FAFC]'
                  : item.isCurrentMonth
                  ? 'text-[#151A2D] font-semibold hover:bg-[#F1F5F9]'
                  : 'text-[#CBD5E1] font-normal hover:bg-[#F8FAFC]'
              }`}
            >
              <span className="text-xs sm:text-sm leading-none">{item.date.getDate()}</span>
              {/* Job Dot Indicator (Space Insulation Green) */}
              <span 
                className={`w-1.5 h-1.5 rounded-full mt-1 transition-all ${
                  item.hasJobs
                    ? 'bg-[#7CC242]'
                    : 'bg-transparent'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* 3. Job Count Section Header Below Calendar */}
      <div className="pt-2">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
          <h2 className="text-xs sm:text-sm font-black text-[#151A2D] uppercase tracking-wider">
            {formatSelectedDateHeader(selectedDate, dailyJobs.length)}
          </h2>

          {dailyJobs.length > 0 && (
            <span className="text-xs font-bold text-[#64748B]">
              {dailyJobs.length} {dailyJobs.length === 1 ? 'Job' : 'Jobs'}
            </span>
          )}
        </div>
      </div>

      {/* 4. Daily Job List / Empty State */}
      {loading ? (
        <div className="py-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7CC242]"></div>
        </div>
      ) : dailyJobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-8 sm:p-12 text-center">
          <div className="w-12 h-12 bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CalendarIcon size={22} className="text-[#64748B]" />
          </div>
          <h3 className="text-base font-black text-[#151A2D] mb-1">
            No jobs scheduled for this day.
          </h3>
          <p className="text-xs font-medium text-[#64748B] max-w-xs mx-auto">
            Select another date on the calendar above to view scheduled assignments.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {dailyJobs.map(job => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {/* 5. Collapsible: Search & Filter All Assigned Jobs */}
      <div className="pt-6 border-t border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => setShowAllJobs(prev => !prev)}
          className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-[#E2E8F0] text-left hover:bg-[#F8FAFC] transition-colors shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F1F5F9] text-[#151A2D] flex items-center justify-center">
              <Filter size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-[#151A2D]">
                {showAllJobs ? 'Hide All Assigned Jobs' : 'Search All Assigned Jobs'}
              </div>
              <div className="text-[10px] text-[#64748B]">
                {workerJobs.length} total active assignment{workerJobs.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <span className="text-xs font-bold text-[#7CC242]">
            {showAllJobs ? '▲ Collapse' : '▼ Expand'}
          </span>
        </button>

        {showAllJobs && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {/* Search inputs */}
            <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={16} />
                <input 
                  type="text" 
                  placeholder="Search by customer, address, or job number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20"
              >
                <option value="all">All Statuses</option>
                <option value="Quoted">Quoted</option>
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              {(searchQuery || statusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                  className="px-3 py-2 bg-[#FEF2F2] text-[#DC2626] rounded-xl text-xs font-bold hover:bg-[#FEE2E2] transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            {/* List */}
            {allFilteredJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center text-xs text-[#64748B]">
                No jobs match your search filter.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {allFilteredJobs.map(job => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
