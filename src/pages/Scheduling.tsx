import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { fromMinutes, isJobForCrew, jobDurationMinutes, toDateKey, toMinutes } from '../components/scheduling/schedulingUtils';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { jsPDF } from 'jspdf';
import { 
  Job, 
  Assessment, 
  Profile, 
  CalendarViewMode, 
  CalendarFilterState,
  Crew,
} from '../components/scheduling/types';
import { 
  parseJobDateStr, 
  estimateJobDuration, 
  getJobCrewMembers, 
  getJobCardTheme 
} from '../components/scheduling/schedulingUtils';
import { MiniCalendar } from '../components/scheduling/MiniCalendar';
import { JobOverviewCard } from '../components/scheduling/JobOverviewCard';
import { CrewsSidebarCard } from '../components/scheduling/CrewsSidebarCard';
import { TimeGridView } from '../components/scheduling/TimeGridView';
import { DailyRoutesModal } from '../components/scheduling/DailyRoutesModal';
import { NotifyCustomerSection } from '../components/scheduling/NotifyCustomerSection';
import { JobColorPicker } from '../components/scheduling/JobColorPicker';
import { ManageCrewsModal } from '../components/scheduling/ManageCrewsModal';
import { UnassignedJobsCard } from '../components/scheduling/UnassignedJobsCard';
import { MonthGridView } from '../components/scheduling/MonthGridView';
import { CreateJobModal } from '../components/CreateJobModal';
import { 
  Loader2, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  FileText, 
  Route, 
  Plus, 
  Users, 
  Home, 
  CircleDot, 
  X, 
  MapPin, 
  User, 
} from 'lucide-react';

export const Scheduling: React.FC = () => {

  // Primary Data States
  const [jobs, setJobs] = useState<Job[]>([]);
  const [unassignedJobs, setUnassignedJobs] = useState<Job[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [crewRows, setCrewRows] = useState<any[]>([]);
  const [crewsSetupNeeded, setCrewsSetupNeeded] = useState(false);
  const [manageCrewsOpen, setManageCrewsOpen] = useState(false);
  const jobsRef = useRef<Job[]>([]);
  const unassignedRef = useRef<Job[]>([]);
  const [moveNotice, setMoveNotice] = useState<{ text: string; error?: boolean; undo?: () => void } | null>(null);
  const [loading, setLoading] = useState(true);

  // Calendar Date Navigation
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [crewFilter, setCrewFilter] = useState('all');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & Popovers
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState('');
  const [routesModalOpen, setRoutesModalOpen] = useState(false);

  // Load the month being viewed plus a margin for the leading/trailing days of the month grid.
  const anchor = viewMode === 'month' ? currentDate : selectedDate;
  const rangeKey = `${anchor.getFullYear()}-${anchor.getMonth()}`;
  const range = useMemo(() => {
    const [y, m] = rangeKey.split('-').map(Number);
    return {
      start: toDateKey(new Date(y, m, -7)),
      end: toDateKey(new Date(y, m + 1, 14)),
    };
  }, [rangeKey]);

  // 1. Fetch Real Database Data
  const fetchScheduleData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, assessRes, profilesRes, unassignedRes, crewsRes] = await Promise.all([
        supabase
          .from('jobs')
          .select(`
            *,
            customers (
              full_name, 
              service_address,
              email,
              phone
            ),
            profiles:assigned_worker_id (
              full_name
            ),
            job_crew (
              worker_id,
              profiles:worker_id (
                id,
                full_name
              )
            )
          `)
          .gte('scheduled_date', `${range.start}T00:00:00Z`)
          .lt('scheduled_date', `${range.end}T00:00:00Z`)
          .order('scheduled_date', { ascending: true }),
        supabase
          .from('assessments')
          .select(`
            id,
            lead_id,
            customer_id,
            assigned_to,
            scheduled_date,
            start_time,
            end_time,
            status,
            notes,
            leads (
              id,
              name,
              phone,
              email,
              source
            ),
            profiles:assigned_to (
              full_name
            )
          `)
          .not('scheduled_date', 'is', null)
          .gte('scheduled_date', range.start)
          .lt('scheduled_date', range.end)
          .neq('status', 'completed'),
        supabase
          .from('profiles')
          .select('id, full_name, role, phone, email')
          .eq('role', 'field_worker'),
        // Active jobs still needing a worker, from any date (including unscheduled).
        supabase
          .from('jobs')
          .select('*, customers (full_name, service_address, email, phone), job_crew (worker_id)')
          .is('assigned_worker_id', null)
          .in('status', ['Quoted', 'Scheduled', 'In Progress'])
          .order('scheduled_date', { ascending: true, nullsFirst: false })
          .limit(100),
        supabase
          .from('crews')
          .select('id, name, sort_order, crew_members (worker_id, profiles:worker_id (full_name))')
          .order('sort_order', { ascending: true }),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (assessRes.error) console.error('Failed to load assessments:', assessRes.error);
      if (profilesRes.error) console.error('Failed to load workers:', profilesRes.error);

      const loadedJobs = (jobsRes.data as any[]) || [];
      setJobs(loadedJobs);
      setAssessments((assessRes.data as any[]) || []);
      setWorkers((profilesRes.data as any[]) || []);
      // Before the crews migration is run the table doesn't exist; fall back to individual workers.
      setCrewsSetupNeeded(!!crewsRes.error);
      setCrewRows(crewsRes.error ? [] : (crewsRes.data as any[]) || []);
      if (unassignedRes.error) console.error('Failed to load unassigned jobs:', unassignedRes.error);
      setUnassignedJobs(
        ((unassignedRes.data as any[]) || []).filter(j => !j.job_crew || j.job_crew.length === 0)
      );

      // If currentDate is currently empty or has no jobs, but jobs exist in another month, default smartly
      // If October 2026 has jobs, currentDate is already new Date() which is October 2026.
    } catch (err) {
      console.error('Failed to load schedule data:', err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  jobsRef.current = jobs;
  unassignedRef.current = unassignedJobs;

  // Live updates: refetch (debounced) when anyone changes the schedule, and when returning to the tab.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => fetchScheduleData(), 600);
    };
    let channel = supabase.channel('scheduling-live');
    for (const table of ['jobs', 'job_crew', 'assessments', 'crews', 'crew_members']) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    }
    channel.subscribe();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [fetchScheduleData]);

  useEffect(() => {
    if (!moveNotice) return;
    const id = setTimeout(() => setMoveNotice(null), moveNotice.error ? 6000 : 8000);
    return () => clearTimeout(id);
  }, [moveNotice]);

  /**
   * Reschedule a job. startTime: undefined keeps the current time, null clears it (all-day),
   * a string sets it and shifts end_time to keep the same duration.
   */
  const moveJob = async (jobId: string, dateStr: string, startTime?: string | null, isUndo = false) => {
    // Read through refs: Undo runs from an older render whose `jobs` predates the move.
    const job = jobsRef.current.find(j => j.id === jobId) || unassignedRef.current.find(j => j.id === jobId);
    if (!job) return;
    const prev = { date: job.scheduled_date ? job.scheduled_date.slice(0, 10) : null, start: job.start_time ?? null, end: job.end_time ?? null };

    let start = prev.start;
    let end = prev.end;
    if (startTime === null) {
      start = null;
      end = null;
    } else if (startTime !== undefined) {
      const hadEnd = toMinutes(prev.start) !== null && toMinutes(prev.end) !== null;
      start = startTime;
      end = hadEnd ? fromMinutes(Math.min(23 * 60 + 30, toMinutes(startTime)! + jobDurationMinutes(job))) : null;
    }
    if (prev.date === dateStr && prev.start === start && prev.end === end) return;

    const optimistic = { ...job, scheduled_date: `${dateStr}T00:00:00+00:00`, start_time: start, end_time: end };
    setJobs(list => (list.some(j => j.id === jobId) ? list.map(j => (j.id === jobId ? optimistic : j)) : [...list, optimistic]));

    const { error } = await supabase
      .from('jobs')
      .update({ scheduled_date: dateStr, start_time: start, end_time: end })
      .eq('id', jobId);

    if (error) {
      setJobs(list => list.map(j => (j.id === jobId ? job : j)));
      setMoveNotice({ text: `Couldn't reschedule JOB-${job.job_number}: ${error.message}`, error: true });
      return;
    }

    if (isUndo) {
      setMoveNotice({ text: `JOB-${job.job_number} moved back` });
    } else {
      const when = new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const time = start ? ` at ${new Date(`2000-01-01T${start}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : '';
      setMoveNotice({
        text: `JOB-${job.job_number} moved to ${when}${time}`,
        undo: prev.date ? () => moveJob(jobId, prev.date!, prev.start, true) : undefined,
      });
    }
    if (!prev.date) fetchScheduleData();
  };

  const crews: Crew[] = useMemo(() => {
    if (crewRows.length > 0) {
      return crewRows.map(c => ({
        id: c.id,
        name: c.name,
        memberIds: (c.crew_members || []).map((m: any) => m.worker_id),
        memberNames: (c.crew_members || []).map((m: any) => (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles)?.full_name || 'Worker'),
      }));
    }
    return workers.map(w => ({ id: w.id, name: w.full_name, memberIds: [w.id], memberNames: [w.full_name], isFallback: true }));
  }, [crewRows, workers]);

  // Jobs that appear on the calendar (must have scheduled_date)
  const calendarJobs = useMemo(() => {
    return jobs.filter(j => !!j.scheduled_date);
  }, [jobs]);

  // Filter Calendar Jobs based on Search, Crew, Job Type, Status
  const filteredCalendarJobs = useMemo(() => {
    return calendarJobs.filter(job => {
      // 1. Search filter (customer name, job number, address, scope)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const custName = (job.customers?.full_name || '').toLowerCase();
        const jobNum = `job-${job.job_number}`.toLowerCase();
        const address = (job.customers?.service_address || '').toLowerCase();
        const scope = (job.scope_of_work || '').toLowerCase();
        const matchesSearch = custName.includes(q) || jobNum.includes(q) || address.includes(q) || scope.includes(q);
        if (!matchesSearch) return false;
      }

      // 2. Status filter
      if (statusFilter !== 'all') {
        const s = (job.status || '').toLowerCase();
        const scope = (job.scope_of_work || '').toLowerCase();

        if (statusFilter === 'scheduled' && !s.includes('schedule') && !s.includes('confirm')) return false;
        if (statusFilter === 'quote pending' && !s.includes('quote') && !s.includes('pending') && !s.includes('invoice')) return false;
        if (statusFilter === 'inspection' && !s.includes('inspect') && !s.includes('quoted') && !scope.includes('inspect')) return false;
        if (statusFilter === 'in_progress' && !s.includes('progress')) return false;
        if (statusFilter === 'completed' && !s.includes('complete') && !s.includes('paid')) return false;
        if (statusFilter === 'cancelled' && !s.includes('cancel')) return false;
      }

      // 3. Job Type filter
      if (jobTypeFilter !== 'all') {
        const scope = (job.scope_of_work || '').toLowerCase();
        const s = (job.status || '').toLowerCase();

        if (jobTypeFilter === 'attic' && !scope.includes('attic')) return false;
        if (jobTypeFilter === 'wall' && !scope.includes('wall')) return false;
        if (jobTypeFilter === 'air_sealing' && !scope.includes('air seal')) return false;
        if (jobTypeFilter === 'mold' && !scope.includes('mold') && !scope.includes('remediation')) return false;
        if (jobTypeFilter === 'inspection' && !s.includes('inspect') && !scope.includes('inspect') && !s.includes('quoted')) return false;
        if (jobTypeFilter === 'quote' && !s.includes('quote') && !scope.includes('quote')) return false;
      }

      // 4. Crew filter
      if (crewFilter !== 'all') {
        const crew = crews.find(c => c.id === crewFilter);
        if (crew && !isJobForCrew(job, crew)) return false;
      }

      return true;
    });
  }, [calendarJobs, searchQuery, statusFilter, jobTypeFilter, crewFilter, crews]);

  // Calendar Header Navigation Handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      const prev = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      setCurrentDate(prev);
      setSelectedDate(prev);
    } else if (viewMode === 'week') {
      const prev = new Date(selectedDate);
      prev.setDate(selectedDate.getDate() - 7);
      setSelectedDate(prev);
      setCurrentDate(new Date(prev.getFullYear(), prev.getMonth(), 1));
    } else {
      const prev = new Date(selectedDate);
      prev.setDate(selectedDate.getDate() - 1);
      setSelectedDate(prev);
      setCurrentDate(new Date(prev.getFullYear(), prev.getMonth(), 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      setCurrentDate(next);
      setSelectedDate(next);
    } else if (viewMode === 'week') {
      const next = new Date(selectedDate);
      next.setDate(selectedDate.getDate() + 7);
      setSelectedDate(next);
      setCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1));
    } else {
      const next = new Date(selectedDate);
      next.setDate(selectedDate.getDate() + 1);
      setSelectedDate(next);
      setCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleSelectDateFromMiniCalendar = (date: Date) => {
    setSelectedDate(date);
    setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const handleDateCellClick = (dateStr: string) => {
    setCreateInitialDate(dateStr);
    setCreateModalOpen(true);
  };

  // Month Title for Navigation Header e.g. "JULY 2026"
  const formattedMonthYearTitle = (viewMode === 'month' ? currentDate : selectedDate).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  }).toUpperCase();

  // PDF Manifest Download Generator
  const downloadPlanPDF = () => {
    const targetDateStr = toDateKey(selectedDate);
    const targetJobs = jobs.filter(j => parseJobDateStr(j.scheduled_date) === targetDateStr);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(21, 26, 45);
    doc.text('SPACE INSULATION FSM', 15, 20);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(115, 122, 134);
    doc.text('Daily Operations Plan & Dispatch Manifest', 15, 25);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 28, 195, 28);

    // 2. Details
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(21, 26, 45);
    doc.text('MANIFEST DETAILS', 15, 36);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Scheduled Date: ${selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`, 15, 42);
    doc.text(`Total Slated Jobs: ${targetJobs.length}`, 15, 47);
    doc.text(`Generated At: ${new Date().toLocaleString()}`, 15, 52);

    doc.line(15, 56, 195, 56);

    if (targetJobs.length === 0) {
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(115, 122, 134);
      doc.text('No jobs are scheduled for this day.', 15, 68);
      doc.save(`space_insulation_manifest_${targetDateStr}.pdf`);
      return;
    }

    // 3. Grid headers
    let currentY = 66;
    doc.setFillColor(248, 250, 252);
    doc.rect(15, currentY - 5, 180, 7, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('JOB ID', 18, currentY);
    doc.text('CUSTOMER / ADDRESS', 40, currentY);
    doc.text('SERVICE / DURATION', 105, currentY);
    doc.text('TECHNICIAN', 150, currentY);
    doc.text('STATUS', 178, currentY);

    doc.line(15, currentY + 3, 195, currentY + 3);
    currentY += 10;

    // 4. Rows
    targetJobs.forEach((job) => {
      if (currentY > 270) {
        doc.addPage();
        currentY = 25;
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY - 5, 180, 7, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text('JOB ID', 18, currentY);
        doc.text('CUSTOMER / ADDRESS', 40, currentY);
        doc.text('SERVICE / DURATION', 105, currentY);
        doc.text('TECHNICIAN', 150, currentY);
        doc.text('STATUS', 178, currentY);
        doc.line(15, currentY + 3, 195, currentY + 3);
        currentY += 10;
      }

      const duration = estimateJobDuration(job);
      const crew = getJobCrewMembers(job);
      const techName = crew.length > 0 ? crew.map(c => c.name).join(', ') : 'Unassigned';
      const custName = job.customers?.full_name || 'Unknown';
      const address = job.customers?.service_address || 'No service address listed';
      const service = job.scope_of_work || 'Attic Insulation';

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(21, 26, 45);
      doc.text(`JOB-${job.job_number}`, 18, currentY);

      doc.setFont('Helvetica', 'bold');
      doc.text(custName.substring(0, 30), 40, currentY);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(115, 122, 134);
      doc.text(address.substring(0, 42), 40, currentY + 4);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(21, 26, 45);
      doc.text(service.substring(0, 24), 105, currentY);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(115, 122, 134);
      doc.text(`${duration} hours duration`, 105, currentY + 4);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(21, 26, 45);
      doc.text(techName.substring(0, 20), 150, currentY);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(16, 185, 129);
      doc.text(job.status, 178, currentY);

      doc.setDrawColor(241, 245, 249);
      doc.line(15, currentY + 7, 195, currentY + 7);
      currentY += 14;
    });

    doc.save(`space_insulation_manifest_${targetDateStr}.pdf`);
  };

  return (
    <div className="flex-grow p-4 md:p-6 space-y-4 overflow-y-auto max-h-screen bg-[#F6F7F9] font-sans pb-16">
      
      {/* 1. TOP HEADER: SCHEDULING TITLE & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E7E9ED] pb-3 select-none">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-[#171A1F] tracking-tight m-0">
            Scheduling
          </h2>
          <p className="text-xs md:text-sm text-[#737A86] mt-0.5 font-medium">
            View and manage your insulation jobs on the calendar.
          </p>
        </div>

        <div className="w-full sm:w-auto grid grid-cols-2 sm:flex sm:items-center gap-2">
          {/* Download Plan Button */}
          <button 
            type="button"
            onClick={downloadPlanPDF}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#1E293B] rounded-xl text-xs font-bold shadow-3xs transition-all cursor-pointer min-h-[38px]"
          >
            <FileText size={14} className="text-[#64748B] shrink-0" />
            <span>Download Plan</span>
          </button>

          {/* View Routes Button */}
          <button 
            type="button"
            onClick={() => setRoutesModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#1E293B] rounded-xl text-xs font-bold shadow-3xs transition-all cursor-pointer min-h-[38px]"
          >
            <Route size={14} className="text-[#64748B] shrink-0" />
            <span>View Routes</span>
          </button>

          {/* New Job Button */}
          <button 
            type="button"
            onClick={() => {
              setCreateInitialDate('');
              setCreateModalOpen(true);
            }}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-4.5 py-2 bg-[#76C442] hover:bg-[#689F38] text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer min-h-[38px] border-none"
          >
            <Plus size={15} className="stroke-[3]" />
            <span>New Job</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN LAYOUT: SIDEBAR + CALENDAR */}
      <div className="flex flex-col lg:flex-row gap-5 items-start w-full">
        
        {/* LEFT SIDEBAR (Mini Calendar, Job Overview, Crews, Unassigned Jobs) */}
        <div className="w-full lg:w-[280px] xl:w-[320px] shrink-0 space-y-4">
          {/* Mini Calendar Picker */}
          <MiniCalendar
            currentDate={currentDate}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDateFromMiniCalendar}
            onMonthChange={(d) => {
              setCurrentDate(d);
              setSelectedDate(d);
            }}
            jobs={jobs}
          />

          {/* Job Overview Card */}
          <JobOverviewCard
            jobs={jobs}
            currentDate={currentDate}
            activeStatusFilter={statusFilter}
            onFilterStatus={(s) => setStatusFilter(s)}
          />

          {/* Crews Card */}
          <CrewsSidebarCard
            jobs={jobs}
            crews={crews}
            currentDate={currentDate}
            activeCrewFilter={crewFilter}
            onFilterCrew={(c) => setCrewFilter(c)}
            onManage={() => setManageCrewsOpen(true)}
          />

          {/* Unassigned Jobs Card */}
          <UnassignedJobsCard
            unassignedJobs={unassignedJobs}
            onSelectJob={(j) => setSelectedJob(j)}
          />
        </div>

        {/* RIGHT MAIN CALENDAR AREA */}
        <div className="flex-1 w-full min-w-0 space-y-3">
          
          {/* TOP CALENDAR NAV BAR (< Today >, Month Title, View Switcher) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-3xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 select-none">
            {/* Left: < Today > */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-3xs self-start sm:self-auto">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                title="Previous"
              >
                <ChevronLeft size={16} className="stroke-[2.5]" />
              </button>
              <div className="h-4 w-[1px] bg-slate-200 self-center" />
              <button
                type="button"
                onClick={handleToday}
                className="px-3.5 py-1 text-xs font-black text-slate-800 hover:bg-slate-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
              >
                Today
              </button>
              <div className="h-4 w-[1px] bg-slate-200 self-center" />
              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                title="Next"
              >
                <ChevronRight size={16} className="stroke-[2.5]" />
              </button>
            </div>

            {/* Center: Calendar Icon + Month Title e.g. "📅 JULY 2026" */}
            <div className="flex items-center justify-center gap-2 select-none">
              <CalendarIcon className="text-[#76C442] w-5 h-5 stroke-[2.5]" />
              <span className="text-sm md:text-base font-black text-slate-900 tracking-wide">
                {formattedMonthYearTitle}
              </span>
            </div>

            {/* Right: View mode segmented toggle (Month / Week / Day) */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 self-end sm:self-auto">
              {(['month', 'week', 'day'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all border-none cursor-pointer ${
                    viewMode === mode
                      ? 'bg-[#76C442] text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900 bg-transparent'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* FILTER & LEGEND BAR */}
          <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-2.5 shadow-3xs flex items-center justify-between gap-3 select-none overflow-x-auto">
            {/* Left Controls: Search & Dropdowns */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Search input */}
              <div className="relative w-52 sm:w-60 shrink-0">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search jobs, customers or address..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-[#76C442] transition-colors"
                />
              </div>

              {/* All Crews Dropdown */}
              <div className="relative shrink-0">
                <select
                  value={crewFilter}
                  onChange={(e) => setCrewFilter(e.target.value)}
                  className="pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 cursor-pointer focus:outline-hidden focus:border-[#76C442]"
                >
                  <option value="all">All Crews</option>
                  {crews.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <Users size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* All Job Types Dropdown */}
              <div className="relative shrink-0">
                <select
                  value={jobTypeFilter}
                  onChange={(e) => setJobTypeFilter(e.target.value)}
                  className="pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 cursor-pointer focus:outline-hidden focus:border-[#76C442]"
                >
                  <option value="all">All Job Types</option>
                  <option value="attic">Attic Insulation</option>
                  <option value="wall">Wall Insulation</option>
                  <option value="air_sealing">Air Sealing</option>
                  <option value="mold">Mold Removal</option>
                  <option value="inspection">Inspection</option>
                  <option value="quote">Quote Visit</option>
                </select>
                <Home size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* All Statuses Dropdown */}
              <div className="relative shrink-0">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 cursor-pointer focus:outline-hidden focus:border-[#76C442]"
                >
                  <option value="all">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="quote pending">Quote Pending</option>
                  <option value="inspection">Inspection</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <CircleDot size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Right Status Legend */}
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span>Inspection</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span>Quote Pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Scheduled</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                <span>In Progress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span>Cancelled</span>
              </div>
            </div>
          </div>

          {/* CALENDAR MAIN GRID / VIEW CONTENT */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-20 flex flex-col items-center justify-center">
              <Loader2 className="w-9 h-9 animate-spin text-[#76C442]" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-3">
                Loading schedule data...
              </span>
            </div>
          ) : viewMode === 'month' ? (
            <MonthGridView
              currentDate={currentDate}
              selectedDate={selectedDate}
              jobs={filteredCalendarJobs}
              onSelectJob={(j) => setSelectedJob(j)}
              onEditJob={(j) => setSelectedJob(j)}
              onDateClick={handleDateCellClick}
              crews={crews}
              allJobs={calendarJobs}
              onDropJob={(id, date) => moveJob(id, date)}
            />
          ) : (
            <TimeGridView
              days={
                viewMode === 'week'
                  ? Array.from({ length: 7 }, (_, i) => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - selectedDate.getDay() + i))
                  : [selectedDate]
              }
              jobs={filteredCalendarJobs}
              allJobs={calendarJobs}
              crews={crews}
              onSelectJob={(j) => setSelectedJob(j)}
              onDateClick={handleDateCellClick}
              onDropJob={(id, date, time) => moveJob(id, date, time)}
            />
          )}

        </div>
      </div>

      {/* JOB DETAIL POPOVER/MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs" 
            onClick={() => setSelectedJob(null)}
          />

          <div className="relative bg-white w-full max-w-sm mx-4 rounded-xl shadow-2xl overflow-hidden border border-[#E7E9ED] z-10 flex flex-col animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#151A2D] text-white">
              <div>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#737A86]">
                  Job Details Specifications
                </span>
                <h3 className="text-base font-black text-white m-0">
                  JOB-{selectedJob.job_number}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedJob(null)}
                className="text-[#737A86] hover:text-white transition-colors cursor-pointer border-none bg-transparent"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs font-semibold text-[#171A1F]">
              <div className="space-y-1">
                <div className="text-[9px] uppercase font-bold text-[#737A86]">Customer</div>
                <div className="text-sm font-black text-[#171A1F]">
                  {selectedJob.customers?.full_name || 'Customer'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[9px] uppercase font-bold text-[#737A86]">Service</div>
                <div className="text-xs font-bold text-[#171A1F]">
                  {selectedJob.scope_of_work || 'Attic Insulation'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-[#E7E9ED]/60 pt-3">
                <div className="space-y-1">
                  <div className="text-[9px] uppercase font-bold text-[#737A86]">Date</div>
                  <div className="text-xs font-bold text-[#171A1F]">
                    {selectedJob.scheduled_date ? new Date(parseJobDateStr(selectedJob.scheduled_date) + 'T00:00:00').toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    }) : '--'}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-[9px] uppercase font-bold text-[#737A86]">Time</div>
                  <div className="text-xs font-bold text-[#171A1F]">
                    {selectedJob.start_time ? selectedJob.start_time.substring(0, 5) : 'Time TBD'}
                  </div>
                </div>
              </div>

              <div className="space-y-1 border-t border-[#E7E9ED]/60 pt-3">
                <div className="text-[9px] uppercase font-bold text-[#737A86] flex items-center gap-0.5">
                  <MapPin size={11} className="text-[#76C442]" />
                  <span>Address</span>
                </div>
                <div className="text-xs font-bold text-[#171A1F] leading-relaxed">
                  {selectedJob.customers?.service_address || 'No service address listed'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-[#E7E9ED]/60 pt-3">
                <div className="space-y-1">
                  <div className="text-[9px] uppercase font-bold text-[#737A86] flex items-center gap-0.5">
                    <User size={11} className="text-[#76C442]" />
                    <span>Crew Assigned</span>
                  </div>
                  <div className="text-xs font-bold text-[#171A1F] flex flex-wrap gap-1">
                    {(() => {
                      const crew = getJobCrewMembers(selectedJob);
                      if (crew.length === 0) return <span className="italic text-[#94A3B8]">Unassigned</span>;
                      return crew.map((member) => (
                        <span key={member.id} className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[#171A1F] text-[11px] font-bold">
                          {member.name}
                        </span>
                      ));
                    })()}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[9px] uppercase font-bold text-[#737A86]">Status</div>
                  <div>
                    {(() => {
                      const theme = getJobCardTheme(selectedJob);
                      return (
                        <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${theme.pillBg} ${theme.pillText}`}>
                          {selectedJob.status}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <JobColorPicker
              job={selectedJob}
              onChanged={(color) => {
                const update = (j: Job) => (j.id === selectedJob.id ? { ...j, color } : j);
                setJobs(list => list.map(update));
                setUnassignedJobs(list => list.map(update));
                setSelectedJob(j => (j ? { ...j, color } : j));
              }}
            />

            <NotifyCustomerSection job={selectedJob} />

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#E7E9ED] bg-[#F6F7F9] flex items-center justify-between font-bold text-xs select-none">
              <div className="flex gap-2">
                <Link
                  to={`/jobs/${selectedJob.id}`}
                  className="px-3.5 py-1.5 border border-[#E6E8EC] bg-white text-[#171A1F] text-xs font-bold rounded-lg transition-colors cursor-pointer min-h-[36px] flex items-center"
                >
                  View Job
                </Link>
                <Link
                  to={`/jobs/${selectedJob.id}`}
                  className="px-3.5 py-1.5 border border-[#E6E8EC] bg-white text-[#171A1F] text-xs font-bold rounded-lg transition-colors cursor-pointer min-h-[36px] flex items-center"
                >
                  Edit
                </Link>
              </div>

              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="px-4 py-1.5 bg-[#151A2D] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer min-h-[36px] border-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE JOB PRE-FILLED MODAL */}
      <CreateJobModal 
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          fetchScheduleData();
        }}
        initialDate={createInitialDate}
      />

      {/* TODAY ROUTES SEQUENCE MODAL */}
      {moveNotice && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg ${
            moveNotice.error ? 'bg-red-600' : 'bg-[#151A2D]'
          }`}
        >
          <span>{moveNotice.text}</span>
          {moveNotice.undo && (
            <button
              type="button"
              onClick={() => {
                const undo = moveNotice.undo!;
                setMoveNotice(null);
                undo();
              }}
              className="text-[#76C442] font-black uppercase tracking-wider cursor-pointer"
            >
              Undo
            </button>
          )}
        </div>
      )}

      <ManageCrewsModal
        isOpen={manageCrewsOpen}
        onClose={() => setManageCrewsOpen(false)}
        crews={crews.filter(c => !c.isFallback)}
        workers={workers}
        setupNeeded={crewsSetupNeeded}
        onChanged={fetchScheduleData}
      />

      {routesModalOpen && (
        <DailyRoutesModal date={selectedDate} jobs={jobs} workers={workers} onClose={() => setRoutesModalOpen(false)} />
      )}

    </div>
  );
};
