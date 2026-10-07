import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { jsPDF } from 'jspdf';
import { 
  Job, 
  Assessment, 
  Profile, 
  CalendarViewMode, 
  CalendarFilterState 
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
import { UnassignedJobsCard } from '../components/scheduling/UnassignedJobsCard';
import { MonthGridView } from '../components/scheduling/MonthGridView';
import { WeekGridView } from '../components/scheduling/WeekGridView';
import { DayView } from '../components/scheduling/DayView';
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
  Navigation 
} from 'lucide-react';

export const Scheduling: React.FC = () => {
  const navigate = useNavigate();

  // Primary Data States
  const [jobs, setJobs] = useState<Job[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [workers, setWorkers] = useState<Profile[]>([]);
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

  // 1. Fetch Real Database Data
  const fetchScheduleData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, assessRes, profilesRes] = await Promise.all([
        supabase
          .from('jobs')
          .select(`
            id, 
            job_number, 
            status, 
            scheduled_date,
            start_time,
            end_time,
            scope_of_work, 
            attic_sqft, 
            customers (
              full_name, 
              service_address
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
          .neq('status', 'completed'),
        supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('role', 'field_worker')
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (assessRes.error) console.error('Failed to load assessments:', assessRes.error);
      if (profilesRes.error) console.error('Failed to load workers:', profilesRes.error);

      const loadedJobs = (jobsRes.data as any[]) || [];
      setJobs(loadedJobs);
      setAssessments((assessRes.data as any[]) || []);
      setWorkers((profilesRes.data as any[]) || []);

      // If currentDate is currently empty or has no jobs, but jobs exist in another month, default smartly
      // If October 2026 has jobs, currentDate is already new Date() which is October 2026.
    } catch (err) {
      console.error('Failed to load schedule data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  // Separate unassigned jobs (jobs with no assigned worker and empty crew)
  const unassignedJobs = useMemo(() => {
    return jobs.filter(j => {
      const hasWorker = !!j.assigned_worker_id;
      const hasCrew = j.job_crew && j.job_crew.length > 0;
      return !hasWorker && !hasCrew;
    });
  }, [jobs]);

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
        const assignedName = (job.profiles?.full_name || '').toLowerCase();
        const crewNames = (job.job_crew || []).map(c => (c.profiles?.full_name || '').toLowerCase());
        const allNames = [assignedName, ...crewNames].join(' ');

        if (crewFilter === 'crew_a' && !allNames.includes('ali qasim') && !allNames.includes('khder')) return false;
        if (crewFilter === 'crew_b' && !allNames.includes('haval') && !allNames.includes('suod')) return false;
        if (crewFilter === 'crew_c' && !allNames.includes('rayan') && !allNames.includes('ali khalaf')) return false;
        if (crewFilter === 'crew_d' && !allNames.includes('hussein') && !allNames.includes('shaker')) return false;
      }

      return true;
    });
  }, [calendarJobs, searchQuery, statusFilter, jobTypeFilter, crewFilter]);

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
    const targetDateStr = selectedDate.toISOString().split('T')[0];
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
            workers={workers}
            currentDate={currentDate}
            activeCrewFilter={crewFilter}
            onFilterCrew={(c) => setCrewFilter(c)}
            onViewAll={() => navigate('/employees')}
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
                  <option value="crew_a">Crew A</option>
                  <option value="crew_b">Crew B</option>
                  <option value="crew_c">Crew C</option>
                  <option value="crew_d">Crew D</option>
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
            />
          ) : viewMode === 'week' ? (
            <WeekGridView
              selectedDate={selectedDate}
              jobs={filteredCalendarJobs}
              onSelectJob={(j) => setSelectedJob(j)}
              onEditJob={(j) => setSelectedJob(j)}
              onDateClick={handleDateCellClick}
            />
          ) : (
            <DayView
              selectedDate={selectedDate}
              jobs={filteredCalendarJobs}
              onSelectJob={(j) => setSelectedJob(j)}
              onDateClick={handleDateCellClick}
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
      {routesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs" 
            onClick={() => setRoutesModalOpen(false)}
          />

          <div className="relative bg-white w-full max-w-lg mx-4 rounded-xl shadow-2xl overflow-hidden border border-[#E7E9ED] z-10 flex flex-col max-h-[85vh] animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#151A2D] text-white">
              <div className="flex items-center gap-2">
                <Route className="text-[#76C442] w-5 h-5 stroke-[2.5]" />
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#737A86]">
                    Technician Stops Manifest
                  </span>
                  <h3 className="text-base font-black text-white m-0">
                    Dispatch Routes
                  </h3>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setRoutesModalOpen(false)}
                className="text-[#737A86] hover:text-white transition-colors cursor-pointer border-none bg-transparent"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#171A1F]">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-xl flex items-center justify-between select-none">
                <div>
                  <div className="text-[10px] text-[#737A86] uppercase font-bold">Selected Date</div>
                  <div className="text-xs font-black text-[#151A2D]">
                    {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <span className="bg-[#76C442]/15 text-[#151A2D] text-[10px] font-black px-2 py-0.5 rounded">
                  {jobs.filter(j => parseJobDateStr(j.scheduled_date) === selectedDate.toISOString().split('T')[0]).length} Total Stops
                </span>
              </div>

              {(() => {
                const targetDateStr = selectedDate.toISOString().split('T')[0];
                const dayJobs = jobs.filter(j => parseJobDateStr(j.scheduled_date) === targetDateStr);

                if (dayJobs.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 font-bold">
                      No jobs scheduled to build route sequences on this day.
                    </div>
                  );
                }

                // Group jobs by assigned worker
                const grouped: Record<string, Job[]> = {};
                dayJobs.forEach(job => {
                  const crew = getJobCrewMembers(job);
                  if (crew.length === 0) {
                    const fallback = 'Unassigned Installer';
                    if (!grouped[fallback]) grouped[fallback] = [];
                    grouped[fallback].push(job);
                  } else {
                    crew.forEach(worker => {
                      if (!grouped[worker.name]) grouped[worker.name] = [];
                      if (!grouped[worker.name].some(j => j.id === job.id)) {
                        grouped[worker.name].push(job);
                      }
                    });
                  }
                });

                return Object.keys(grouped).map(workerName => {
                  const workerJobs = grouped[workerName];
                  const addressList = workerJobs.map(j => j.customers?.service_address).filter(Boolean);
                  const googleMapsLink = `https://www.google.com/maps/dir/${addressList.map(a => encodeURIComponent(a || '')).join('/')}`;

                  return (
                    <div key={workerName} className="border border-[#E2E8F0] rounded-xl p-4 space-y-3 bg-white shadow-3xs">
                      {/* Worker Header */}
                      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                        <div className="flex items-center gap-1.5 font-black text-xs text-[#151A2D]">
                          <User size={13} className="text-[#76C442]" />
                          <span>{workerName}</span>
                        </div>
                        {addressList.length > 0 && (
                          <a 
                            href={googleMapsLink}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-[#76C442] hover:underline font-extrabold"
                          >
                            <Navigation size={10} />
                            <span>GPS Directions</span>
                          </a>
                        )}
                      </div>

                      {/* Stops Timeline */}
                      <div className="space-y-3 relative pl-4 border-l border-slate-200 ml-1.5">
                        {workerJobs.map((job, idx) => {
                          const duration = estimateJobDuration(job);
                          return (
                            <div key={job.id} className="relative space-y-1">
                              <div className="absolute -left-[20.5px] top-1.5 w-3 h-3 bg-white border-2 border-[#76C442] rounded-full flex items-center justify-center font-black text-[7px] text-[#151A2D]">
                                {idx + 1}
                              </div>
                              
                              <div className="font-extrabold text-[11px]">
                                Stop #{idx + 1} · JOB-{job.job_number}
                              </div>
                              <div className="text-[#737A86] text-[10px] font-semibold">
                                {job.customers?.full_name} · {job.scope_of_work || 'Attic Insulation'} ({duration}h)
                              </div>
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customers?.service_address || '')}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[#76C442] hover:underline text-[9.5px] font-bold flex items-center gap-0.5 select-none"
                              >
                                <MapPin size={9} className="text-[#76C442]" />
                                <span>{job.customers?.service_address || 'No service address listed'}</span>
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#E7E9ED] bg-[#F6F7F9] flex items-center justify-end font-bold text-xs select-none">
              <button
                type="button"
                onClick={() => setRoutesModalOpen(false)}
                className="px-4 py-1.5 bg-[#151A2D] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer min-h-[36px] border-none"
              >
                Close Manifest
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
