import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Navigation, 
  Calendar as CalendarIcon,
  Search,
  RefreshCcw,
  Filter,
  Phone
} from 'lucide-react';
import { StatusBadge } from '../../components/ui';
import { supabase } from '../../supabaseClient';
import type { Job } from './types';
import { todayDate } from '../../utils/dates';

interface WorkerJobsViewProps {
  jobs: Job[];
  loading: boolean;
  currentUserId?: string | null;
  onRefresh?: () => void;
}

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
  const isToday = date.toDateString() === todayDate().toDateString();
  const label = isToday ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  return `${label} · ${count} ${count === 1 ? 'job' : 'jobs'}`;
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
  const [selectedDate, setSelectedDate] = useState<Date>(() => todayDate());
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = todayDate();
    return new Date(d.getFullYear(), d.getMonth(), 1, 12);
  });

  // Secondary search & filter state for the all-jobs section
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAllJobs, setShowAllJobs] = useState(false);

  // Strictly filter jobs for the CURRENT worker
  const workerJobs = useMemo(() => {
    return jobs.filter(j => {
      if (effectiveUserId) {
        const inCrew = (j as any).job_crew?.some((c: any) => c.worker_id === effectiveUserId);
        return j.assigned_worker_id === effectiveUserId || inCrew;
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

    const firstDay = new Date(year, month, 1, 12);
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
    const daysInPrevMonth = new Date(year, month, 0, 12).getDate();

    const todayKey = toDateKey(todayDate());
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
      const prevDate = new Date(year, month - 1, daysInPrevMonth - i, 12);
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
      const date = new Date(year, month, day, 12);
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
      const nextDate = new Date(year, month + 1, day, 12);
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
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1, 12));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1, 12));
  };

  const handleGoToToday = () => {
    const now = todayDate();
    setSelectedDate(now);
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12));
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

  // One job, with the actions a technician needs on site.
  const JobCard: React.FC<{ job: Job }> = ({ job }) => {
    const timeDisplay = formatTimeRange(job.start_time, job.end_time);
    const address = job.customers?.service_address;
    const phone = (job.customers as { phone?: string | null } | null)?.phone;

    return (
      <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
        <Link to={`/jobs/${job.id}`} className="block p-4 no-underline">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink-soft">{timeDisplay}</span>
            <StatusBadge status={job.status} />
          </div>
          <div className="mt-1 text-lg font-semibold text-navy truncate">{job.customers?.full_name || 'Unknown customer'}</div>
          <div className="mt-0.5 flex items-start gap-1.5 text-sm text-muted">
            <MapPin size={15} className="shrink-0 mt-0.5" />
            <span className="line-clamp-2">{address || 'No address on file'}</span>
          </div>
          {(job.project_type || job.scope_of_work) && (
            <div className="mt-2 text-sm text-ink-soft line-clamp-2">
              {job.project_type && <span className="font-medium text-navy">{job.project_type} · </span>}
              {job.scope_of_work}
            </div>
          )}
          <div className="mt-2 text-xs text-muted">Job #{job.job_number}</div>
        </Link>
        <div className="grid grid-cols-3 border-t border-line divide-x divide-line">
          {address ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-navy no-underline hover:bg-mist"
            >
              <Navigation size={16} className="text-brand-ink" /> Directions
            </a>
          ) : (
            <span className="h-12 inline-flex items-center justify-center text-sm text-subtle">No address</span>
          )}
          {phone ? (
            <a href={`tel:${phone}`} className="h-12 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-navy no-underline hover:bg-mist">
              <Phone size={16} className="text-brand-ink" /> Call
            </a>
          ) : (
            <span className="h-12 inline-flex items-center justify-center text-sm text-subtle">No phone</span>
          )}
          <Link to={`/jobs/${job.id}`} className="h-12 inline-flex items-center justify-center gap-1 text-sm font-semibold text-brand-ink no-underline hover:bg-mist">
            Open <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto w-full">
      
      {/* 1. Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">My jobs</h1>
          <p className="text-xs sm:text-sm font-medium text-muted mt-0.5">
            Your jobs, day by day.
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 bg-white border border-line hover:bg-canvas text-muted rounded-xl transition-colors shadow-sm"
            title="Refresh Jobs"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin text-brand' : ''} />
          </button>
        )}
      </div>

      {/* 2. Monthly Calendar Card */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-line shadow-card w-full">
        
        {/* Calendar Header: Month Name & Nav Controls */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-bold text-navy">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleGoToToday}
              className="px-2.5 py-1 text-xs font-bold text-navy bg-mist hover:bg-line rounded-lg transition-colors"
            >
              Today
            </button>

            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous Month"
              className="p-2 text-ink-soft hover:text-navy hover:bg-mist rounded-xl transition-colors"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next Month"
              className="p-2 text-ink-soft hover:text-navy hover:bg-mist rounded-xl transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Days of Week Row: S M T W T F S */}
        <div className="grid grid-cols-7 text-center mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
            <div key={idx} className="text-xs sm:text-sm font-bold text-subtle py-1">
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
                  setCurrentMonth(new Date(item.date.getFullYear(), item.date.getMonth(), 1, 12));
                }
              }}
              className={`w-full aspect-square max-w-[46px] sm:max-w-[52px] mx-auto flex flex-col items-center justify-center rounded-xl sm:rounded-2xl transition-all relative ${
                item.isSelected
                  ? 'bg-navy text-white shadow-md font-bold'
                  : item.isToday
                  ? 'border-2 border-navy text-navy font-bold bg-white hover:bg-canvas'
                  : item.isCurrentMonth
                  ? 'text-navy font-semibold hover:bg-mist'
                  : 'text-line-strong font-normal hover:bg-canvas'
              }`}
            >
              <span className="text-xs sm:text-sm leading-none">{item.date.getDate()}</span>
              {/* Job Dot Indicator (Space Insulation Green) */}
              <span 
                className={`w-1.5 h-1.5 rounded-full mt-1 transition-all ${
                  item.hasJobs
                    ? 'bg-brand'
                    : 'bg-transparent'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* 3. Job Count Section Header Below Calendar */}
      <div className="pt-2">
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <h2 className="text-base sm:text-sm font-semibold text-navy">
            {formatSelectedDateHeader(selectedDate, dailyJobs.length)}
          </h2>

        </div>
      </div>

      {/* 4. Daily Job List / Empty State */}
      {loading ? (
        <div className="py-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </div>
      ) : dailyJobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-line-strong p-8 text-center">
          <div className="w-12 h-12 bg-canvas text-subtle border border-line rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CalendarIcon size={22} className="text-muted" />
          </div>
          <h3 className="text-base font-bold text-navy mb-1">
            Nothing booked this day
          </h3>
          <p className="text-xs font-medium text-muted max-w-xs mx-auto">
            Pick another day on the calendar to see its jobs.
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
      <div className="pt-6 border-t border-line">
        <button
          type="button"
          onClick={() => setShowAllJobs(prev => !prev)}
          className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-line text-left hover:bg-canvas transition-colors shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-mist text-navy flex items-center justify-center">
              <Filter size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-navy">
                {showAllJobs ? 'Hide all my jobs' : 'Search all my jobs'}
              </div>
              <div className="text-2xs text-muted">
                {workerJobs.length} total active assignment{workerJobs.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <span className="text-xs font-bold text-brand">
            {showAllJobs ? 'Hide' : 'Show'}
          </span>
        </button>

        {showAllJobs && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {/* Search inputs */}
            <div className="bg-white rounded-2xl p-4 border border-line flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" size={16} />
                <input 
                  type="text" 
                  placeholder="Search by customer, address, or job number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-canvas border border-line rounded-xl text-xs font-bold text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand/20"
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
              <div className="bg-white rounded-2xl border border-line p-8 text-center text-xs text-muted">
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
