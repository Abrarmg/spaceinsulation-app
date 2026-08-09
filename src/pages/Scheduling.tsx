import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CreateJobModal } from '../components/CreateJobModal';
import { jsPDF } from 'jspdf';
import { 
  Loader2, 
  MapPin, 
  User, 
  X, 
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Layers,
  Clock,
  Briefcase,
  Navigation,
  FileText,
  Route
} from 'lucide-react';

interface Customer {
  full_name: string;
  service_address: string | null;
}

interface Job {
  id: string;
  job_number: number;
  status: string;
  scheduled_date: string | null;
  assigned_worker_id: string | null;
  scope_of_work: string | null;
  attic_sqft: number | null;
  customers: Customer | null;
  profiles: {
    full_name: string;
  } | null;
}

export const Scheduling: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Custom header title tracking
  const [calendarTitle, setCalendarTitle] = useState('July 2026');
  const [activeView, setActiveView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 6, 31));

  // Modal / Popover States
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [routesModalOpen, setRoutesModalOpen] = useState(false);
  
  // Create Job Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState('');

  const calendarRef = useRef<any>(null);

  // Fetch jobs with RLS-bypassing fallback logic if admin is authenticated
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id, 
          job_number, 
          status, 
          scheduled_date, 
          scope_of_work, 
          attic_sqft, 
          customers (
            full_name, 
            service_address
          ),
          profiles:assigned_worker_id (
            full_name
          )
        `)
        .not('scheduled_date', 'is', null);

      if (error) throw error;
      setJobs(data as any[] || []);
    } catch (err) {
      console.error('Failed to load scheduled jobs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Sync calendar title label
  useEffect(() => {
    if (calendarRef.current && activeView !== 'day') {
      setTimeout(() => {
        const api = calendarRef.current.getApi();
        setCalendarTitle(api.view.title);
      }, 100);
    }
  }, [loading, activeView]);

  // Parse Date String helper (safe split for ISO strings)
  const parseJobDateStr = (dateVal: string | null) => {
    if (!dateVal) return '';
    return dateVal.includes('T') ? dateVal.split('T')[0] : dateVal;
  };

  // Estimate Job Duration helper based on attic size
  const estimateJobDuration = (job: Job) => {
    const sqft = job.attic_sqft || 1000;
    return sqft > 1500 ? 4 : 3;
  };

  // PDF Download Manifest Generator
  const downloadTodayPlanPDF = () => {
    const todayStr = '2026-07-31';
    const todayJobs = jobs.filter(j => parseJobDateStr(j.scheduled_date) === todayStr);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Header (Corporate white paper)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(21, 26, 45); // Dark navy
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
    doc.text(`Scheduled Date: Friday, July 31, 2026`, 15, 42);
    doc.text(`Total Slated Jobs: ${todayJobs.length}`, 15, 47);
    doc.text(`Generated At: ${new Date().toLocaleString()}`, 15, 52);

    doc.line(15, 56, 195, 56);

    if (todayJobs.length === 0) {
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(115, 122, 134);
      doc.text('No jobs are scheduled for today.', 15, 68);
      doc.save('space_insulation_today_plan.pdf');
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

    // 4. Job Rows mapping
    todayJobs.forEach((job) => {
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
      const techName = job.profiles?.full_name || 'Unassigned';
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
      doc.text(techName, 150, currentY);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      if (job.status.toLowerCase() === 'completed') {
        doc.setTextColor(100, 116, 139);
      } else if (job.status.toLowerCase() === 'scheduled' || job.status.toLowerCase() === 'confirmed') {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(59, 130, 246);
      }
      doc.text(job.status, 178, currentY);

      doc.setDrawColor(241, 245, 249);
      doc.line(15, currentY + 7, 195, currentY + 7);
      currentY += 14;
    });

    // Footer Page Counter
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('CONFIDENTIAL - FOR INTERNAL FIELD DISPATCH USE ONLY', 15, 285);
    doc.text('Page 1 of 1', 180, 285);

    doc.save(`space_insulation_manifest_${todayStr}.pdf`);
  };

  // Translate Supabase records to calendar format
  const calendarEvents = jobs.map((job) => {
    const duration = estimateJobDuration(job);
    const dateStr = parseJobDateStr(job.scheduled_date);
    
    return {
      id: job.id,
      title: `JOB-${job.job_number} · ${job.customers?.full_name || 'Client'}`,
      start: `${dateStr}T10:00:00`,
      end: `${dateStr}T${10 + duration}:00:00`,
      allDay: false, // Maps to hourly grids on Week & Day views
      extendedProps: {
        jobNumber: job.job_number,
        status: job.status,
        customerName: job.customers?.full_name || 'Unknown',
        serviceAddress: job.customers?.service_address || 'No service address listed',
        serviceName: job.scope_of_work || 'Attic Insulation',
        scheduledDate: dateStr,
        assignedWorkerName: job.profiles?.full_name || 'Unassigned',
        timeStr: `10:00 AM – ${10 + duration === 12 ? 12 : (10 + duration) % 12}:00 PM`,
        duration
      }
    };
  });

  // Color mappings based on requested status colors:
  // Blue=Inspection/Quoted, Yellow/Amber=Quote pending, Green=Confirmed/Scheduled, Orange=In Progress, Grey=Completed, Red=Cancelled
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'inspection':
      case 'quoted':
        return {
          card: 'border-l-3 border-blue-800 bg-blue-600 text-white hover:bg-blue-700',
          dot: 'bg-white',
          label: 'Quoted / Inspection'
        };
      case 'quote pending':
      case 'pending':
      case 'invoiced':
        return {
          card: 'border-l-3 border-amber-700 bg-amber-500 text-white hover:bg-amber-600',
          dot: 'bg-white',
          label: 'Quote Pending'
        };
      case 'confirmed':
      case 'scheduled':
        return {
          card: 'border-l-3 border-emerald-800 bg-emerald-600 text-white hover:bg-emerald-700',
          dot: 'bg-white',
          label: 'Confirmed / Scheduled'
        };
      case 'in_progress':
      case 'in progress':
        return {
          card: 'border-l-3 border-orange-700 bg-orange-500 text-white hover:bg-orange-600',
          dot: 'bg-white',
          label: 'In Progress'
        };
      case 'completed':
      case 'paid':
        return {
          card: 'border-l-3 border-slate-700 bg-slate-500 text-white hover:bg-slate-600',
          dot: 'bg-white',
          label: 'Completed'
        };
      case 'cancelled':
        return {
          card: 'border-l-3 border-red-800 bg-red-600 text-white hover:bg-red-700',
          dot: 'bg-white',
          label: 'Cancelled'
        };
      default:
        return {
          card: 'border-l-3 border-slate-700 bg-slate-500 text-white hover:bg-slate-600',
          dot: 'bg-white',
          label: status
        };
    }
  };

  // Navigations controllers
  const handleNavPrev = () => {
    if (activeView === 'day') {
      const prevDate = new Date(currentDate);
      prevDate.setDate(currentDate.getDate() - 1);
      setCurrentDate(prevDate);
      setCalendarTitle(prevDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }));
    } else {
      const api = calendarRef.current.getApi();
      api.prev();
      setCalendarTitle(api.view.title);
    }
  };

  const handleNavNext = () => {
    if (activeView === 'day') {
      const nextDate = new Date(currentDate);
      nextDate.setDate(currentDate.getDate() + 1);
      setCurrentDate(nextDate);
      setCalendarTitle(nextDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }));
    } else {
      const api = calendarRef.current.getApi();
      api.next();
      setCalendarTitle(api.view.title);
    }
  };

  const handleNavToday = () => {
    const today = new Date(2026, 6, 31); // July 31, 2026 standard seed date
    setCurrentDate(today);
    if (activeView === 'day') {
      setCalendarTitle(today.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }));
    } else {
      const api = calendarRef.current.getApi();
      api.gotoDate('2026-07-31');
      setCalendarTitle(api.view.title);
    }
  };

  const handleViewChange = (view: 'month' | 'week' | 'day') => {
    setActiveView(view);
    if (view === 'day') {
      setCalendarTitle(currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }));
    } else {
      setTimeout(() => {
        const api = calendarRef.current.getApi();
        if (view === 'month') {
          api.changeView('dayGridMonth');
        } else {
          api.changeView('timeGridWeek');
        }
        api.gotoDate(currentDate);
        setCalendarTitle(api.view.title);
      }, 50);
    }
  };

  // FullCalendar event click trigger
  const handleEventClick = (info: any) => {
    const matchedJob = jobs.find(j => j.id === info.event.id);
    if (matchedJob) {
      setSelectedJob(matchedJob);
    }
  };

  // Custom Event Element rendering
  const renderEventContent = (eventInfo: any) => {
    const status = eventInfo.event.extendedProps.status || 'scheduled';
    const customerName = eventInfo.event.extendedProps.customerName || '';
    const serviceName = eventInfo.event.extendedProps.serviceName || '';
    const assignedWorkerName = eventInfo.event.extendedProps.assignedWorkerName || 'Unassigned';
    const jobNo = eventInfo.event.extendedProps.jobNumber;
    const styleObj = getStatusStyle(status);

    return (
      <div 
        title={`Worker Assigned: ${assignedWorkerName}`}
        className={`w-full px-2.5 py-1 text-[10.5px] font-black rounded-lg truncate select-none border border-white/10 shadow-3xs flex items-center justify-between gap-1.5 transition-all duration-150 hover:scale-[1.01] hover:shadow-2xs active:scale-[0.99] cursor-pointer ${styleObj.card}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styleObj.dot}`} />
          <span className="truncate flex items-center">
            <span className="font-extrabold text-white uppercase tracking-tight">JOB-{jobNo}</span>
            <span className="mx-1.5 text-white/40 font-normal">|</span>
            <span className="text-white font-black truncate">{customerName}</span>
            {serviceName && (
              <>
                <span className="mx-1.5 text-white/40 font-normal">·</span>
                <span className="text-white/80 font-bold text-[9px] uppercase tracking-wide truncate">{serviceName}</span>
              </>
            )}
          </span>
        </div>
      </div>
    );
  };

  // Day Cell click triggers Quick Add Job pre-fill modal
  const handleDateClick = (arg: any) => {
    if (arg.jsEvent.target.closest('.fc-event')) return; // Avoid overlap click trigger
    setCreateInitialDate(arg.dateStr);
    setCreateModalOpen(true);
  };

  // Custom Day Cell Content generator
  const renderDayCellContent = (arg: any) => {
    const dateStr = arg.date.toISOString().split('T')[0];
    const dayJobs = jobs.filter(j => parseJobDateStr(j.scheduled_date) === dateStr);
    const count = dayJobs.length;
    const isToday = dateStr === '2026-07-31'; // Mock July 31 today highlighted date

    return (
      <div className="w-full h-full flex flex-col justify-between p-1 select-none relative group min-h-[40px]">
        <div className="flex justify-between items-center w-full">
          <span className={`text-[10px] font-black ${
            isToday 
              ? 'bg-[#76C442] text-[#151A2D] w-5 h-5 rounded-full flex items-center justify-center' 
              : 'text-[#475569]'
          }`}>
            {arg.dayNumberText}
          </span>
          {count > 3 && (
            <span className="bg-red-500 text-white text-[8px] font-black rounded-full px-1.5 py-0.2 scale-90" title={`${count} jobs scheduled`}>
              {count} jobs
            </span>
          )}
        </div>
      </div>
    );
  };

  // Filter jobs for currently selected day view
  const currentDayJobs = jobs.filter(j => parseJobDateStr(j.scheduled_date) === formatDateString(currentDate));

  // Date format helpers
  function formatDateString(d: Date) {
    return d.toISOString().split('T')[0];
  }

  return (
    <div className="flex-grow p-4 md:p-6 space-y-4 overflow-y-auto max-h-screen bg-[#F6F7F9] font-sans pb-16">
      
      {/* CSS customization blocks */}
      <style>{`
        .fc {
          --fc-border-color: #E2E8F0;
          --fc-today-bg-color: rgba(118, 196, 66, 0.03);
          --fc-neutral-bg-color: #FFFFFF;
          font-family: inherit;
        }
        .fc .fc-toolbar {
          display: none !important;
        }
        .fc-theme-standard td, .fc-theme-standard th {
          border-color: #E2E8F0 !important;
        }
        .fc .fc-scrollgrid {
          border-radius: 12px !important;
          overflow: hidden;
          border: 1px solid #E2E8F0 !important;
        }
        .fc .fc-col-header-cell {
          background-color: #F8FAFC !important;
          border-bottom: 2px solid #E2E8F0 !important;
        }
        .fc .fc-col-header-cell-cushion {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: #64748B;
          padding: 10px 0;
          text-decoration: none !important;
        }
        .fc .fc-daygrid-day-number {
          font-size: 11px;
          font-weight: 800;
          color: #475569;
          padding: 8px;
          text-decoration: none !important;
        }
        .fc .fc-daygrid-day:hover {
          background-color: rgba(241, 245, 249, 0.4) !important;
          cursor: pointer;
        }
        .fc .fc-daygrid-day::after {
          content: '+';
          position: absolute;
          top: 6px;
          left: 30px;
          font-size: 14px;
          font-weight: 900;
          color: #76C442;
          opacity: 0;
          transition: opacity 0.15s ease-in-out;
        }
        .fc .fc-daygrid-day:hover::after {
          opacity: 1;
        }
        .fc .fc-daygrid-event {
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
          margin: 3px 6px !important;
        }
        .fc-timegrid-slot {
          height: 52px !important;
        }
        .fc-timegrid-slot-label-cushion {
          font-size: 10px;
          font-weight: 700;
          color: #64748B;
        }
        .fc-timegrid-axis-cushion {
          font-size: 10px;
          font-weight: 700;
          color: #64748B;
        }
        .fc-timegrid-slots td {
          border-bottom: 1px dashed #E2E8F0 !important;
        }
        .fc-v-event {
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
        }
        .fc .fc-daygrid-day {
          background-color: #FFFDF0 !important;
        }
        .fc-timegrid-col {
          background-color: #FFFDF0 !important;
        }
        .fc .fc-day-today {
          background-color: rgba(118, 196, 66, 0.15) !important;
        }
        @media (max-width: 767px) {
          .fc-view-harness {
            overflow-x: auto !important;
          }
          .fc-view {
            min-width: 620px !important;
          }
        }
      `}</style>

      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E7E9ED] pb-3 select-none">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-[#171A1F] tracking-tight m-0">
            Scheduling
          </h2>
          <p className="text-xs md:text-sm text-[#737A86] mt-0.5 font-medium">
            View scheduled insulation jobs on your calendar.
          </p>
        </div>
        
        <div className="w-full sm:w-auto grid grid-cols-2 sm:flex sm:items-center gap-2">
          {/* Download Today Plan Button */}
          <button 
            onClick={downloadTodayPlanPDF}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#1E293B] rounded-xl text-[10.5px] sm:text-xs font-black shadow-3xs transition-all cursor-pointer min-h-[38px]"
          >
            <FileText size={13} className="text-[#64748B] shrink-0" />
            <span className="truncate">Download Plan</span>
          </button>

          {/* View Today Routes Button */}
          <button 
            onClick={() => setRoutesModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#1E293B] rounded-xl text-[10.5px] sm:text-xs font-black shadow-3xs transition-all cursor-pointer min-h-[38px]"
          >
            <Route size={13} className="text-[#64748B] shrink-0" />
            <span className="truncate">View Routes</span>
          </button>

          {/* New Job Button */}
          <button 
            onClick={() => {
              setCreateInitialDate('');
              setCreateModalOpen(true);
            }}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-5 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer min-h-[38px] border-none"
          >
            <Plus size={14} className="stroke-[3]" />
            <span>New Job</span>
          </button>
        </div>
      </div>

      {/* CALENDAR BLOCK CARD */}
      <div className="bg-white rounded-xl border border-[#E7E9ED] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
        
        {/* CALENDAR NAVIGATION & CONTROLS */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 border-b border-[#E2E8F0] gap-4 select-none bg-slate-50/40">
          {/* Navigation controls */}
          <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-white p-0.5 shadow-2xs select-none">
            <button 
              onClick={handleNavPrev}
              className="p-2 text-[#64748B] hover:text-[#1E293B] hover:bg-slate-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
            >
              <ChevronLeft size={15} className="stroke-[2.5]" />
            </button>
            <div className="h-5 w-[1px] bg-slate-200 self-center" />
            <button 
              onClick={handleNavToday}
              className="px-4 py-1.5 text-xs font-black text-[#1E293B] hover:bg-slate-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
            >
              Today
            </button>
            <div className="h-5 w-[1px] bg-slate-200 self-center" />
            <button 
              onClick={handleNavNext}
              className="p-2 text-[#64748B] hover:text-[#1E293B] hover:bg-slate-50 rounded-lg transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
            >
              <ChevronRight size={15} className="stroke-[2.5]" />
            </button>
          </div>

          {/* Month / Year header title */}
          <div className="flex items-center justify-center gap-2 select-none">
            <Calendar className="text-[#76C442] w-4.5 h-4.5 stroke-[2.5]" />
            <span className="text-sm font-black text-[#151A2D] uppercase tracking-wide">
              {calendarTitle}
            </span>
          </div>

          {/* Views switchers */}
          <div className="flex bg-[#F1F5F9] p-0.5 rounded-xl border border-[#E2E8F0] shadow-3xs">
            {(['month', 'week', 'day'] as const).map(view => (
              <button
                key={view}
                onClick={() => handleViewChange(view)}
                className={`px-4.5 py-1.5 rounded-lg text-[10px] uppercase font-black tracking-wider transition-all border-none cursor-pointer ${
                  activeView === view 
                    ? 'bg-white text-[#151A2D] shadow-xs' 
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {/* FEATURE 2 — LEGEND ROW */}
        <div className="flex flex-wrap items-center gap-3.5 px-4 py-2.5 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[10px] font-bold text-[#64748B] select-none">
          <span className="uppercase text-[9px] tracking-wider text-[#94A3B8]">Status Legend:</span>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> <span>Inspection / Quoted</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> <span>Quote Pending</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> <span>Confirmed / Scheduled</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> <span>In Progress</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> <span>Completed</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> <span>Cancelled</span></div>
        </div>

        {/* CALENDAR VIEW CONTENT GRID */}
        <div className="p-4 relative min-h-[480px]">
          {loading ? (
            <div className="absolute inset-0 bg-white/50 flex flex-col items-center justify-center z-10">
              <Loader2 className="w-9 h-9 animate-spin text-[#76C442]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#737A86] mt-2">Loading calendar events...</span>
            </div>
          ) : activeView !== 'day' ? (
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              initialDate="2026-07-31" // Seed default focus range
              events={calendarEvents}
              eventClick={handleEventClick}
              eventContent={renderEventContent}
              dateClick={handleDateClick}
              dayCellContent={renderDayCellContent}
              height="auto"
              dayMaxEvents={2} // Allows clean +X more overflow handling
              allDaySlot={false}
              slotMinTime="08:00:00"
              slotMaxTime="18:00:00"
              eventTimeFormat={{
                hour: 'numeric',
                minute: '2-digit',
                meridiem: 'short'
              }}
            />
          ) : (
            /* FEATURE 4 — DAY VIEW UPGRADE (Full detailed list panel) */
            <div className="space-y-4 max-w-3xl mx-auto select-none">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">
                  Detailed Jobs Schedule list
                </h3>
                <span className="bg-[#76C442]/15 text-[#151A2D] text-[10px] font-black px-2.5 py-0.5 rounded-lg">
                  {currentDayJobs.length} Jobs Slated
                </span>
              </div>

              {currentDayJobs.length === 0 ? (
                <div className="py-20 border border-dashed border-slate-200 rounded-xl text-center text-xs text-[#737A86] font-bold p-4">
                  <Briefcase size={22} className="mx-auto text-slate-300 mb-2" />
                  No insulation projects scheduled on this day.
                </div>
              ) : (
                <div className="space-y-3">
                  {currentDayJobs.map((job) => {
                    const duration = estimateJobDuration(job);
                    const range = `10:00 AM – ${10 + duration === 12 ? 12 : (10 + duration) % 12}:00 PM`;
                    const techName = job.profiles?.full_name || 'Unassigned';
                    const styleObj = getStatusStyle(job.status);

                    return (
                      <div 
                        key={`day-view-card-${job.id}`}
                        onClick={() => setSelectedJob(job)}
                        className={`bg-white border rounded-xl p-4 shadow-3xs hover:shadow-xs transition-all duration-150 cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-l-4 ${styleObj.card}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#151A2D]">JOB-{job.job_number}</span>
                            <span className="text-[10px] text-[#737A86]">·</span>
                            <span className="text-[11px] font-bold text-[#171A1F]">{job.customers?.full_name}</span>
                          </div>
                          
                          <div className="text-[10px] text-[#737A86] font-medium flex flex-wrap gap-x-3 items-center">
                            <span className="flex items-center gap-0.5"><Layers size={11} /> {job.scope_of_work || 'Attic Insulation'}</span>
                            <span className="flex items-center gap-0.5"><Clock size={11} /> {duration} hours</span>
                          </div>

                          <div className="text-[9px] text-[#737A86] font-medium flex items-center gap-0.5">
                            <MapPin size={11} className="text-[#76C442]" />
                            <span>{job.customers?.service_address || 'Richmond Hill'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4.5 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 select-none">
                          <div className="text-right">
                            <div className="text-[9px] text-[#737A86] uppercase font-bold">Assigned Tech</div>
                            <div className="text-xs font-extrabold text-[#171A1F] flex items-center gap-1">
                              <User size={11} className="text-[#76C442]" />
                              <span>{techName}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[9px] text-[#737A86] uppercase font-bold">Time Slot</div>
                            <div className="text-xs font-black text-[#171A1F]">{range}</div>
                          </div>

                          <span className={`px-2.5 py-0.5 border rounded-lg text-[9px] font-black uppercase tracking-wider ${styleObj.card}`}>
                            {job.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* JOB DETAIL POPOVER/MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs" 
            onClick={() => setSelectedJob(null)}
          />

          {/* Modal Card */}
          <div className="relative bg-white w-full max-w-sm mx-4 rounded-xl shadow-2xl overflow-hidden border border-[#E7E9ED] z-10 flex flex-col animate-scale-up">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#151A2D] text-white">
              <div>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#737A86]">
                  Job details specifications
                </span>
                <h3 className="text-base font-black text-white m-0">
                  JOB-{selectedJob.job_number}
                </h3>
              </div>
              <button 
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
                  {selectedJob.customers?.full_name}
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
                    10:00 AM – {selectedJob.attic_sqft && selectedJob.attic_sqft > 1500 ? '2' : '1'}:00 PM
                  </div>
                </div>
              </div>

              <div className="space-y-1 border-t border-[#E7E9ED]/60 pt-3">
                <div className="text-[9px] uppercase font-bold text-[#737A86] flex items-center gap-0.5">
                  <MapPin size={11} className="text-[#76C442]" />
                  <span>Address</span>
                </div>
                <div className="text-xs font-bold text-[#171A1F] leading-relaxed">
                  {selectedJob.customers?.service_address || 'Richmond Hill'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-[#E7E9ED]/60 pt-3">
                <div className="space-y-1">
                  <div className="text-[9px] uppercase font-bold text-[#737A86] flex items-center gap-0.5">
                    <User size={11} className="text-[#76C442]" />
                    <span>Technician</span>
                  </div>
                  <div className="text-xs font-bold text-[#171A1F]">
                    {selectedJob.profiles?.full_name || 'Ahmed'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[9px] uppercase font-bold text-[#737A86]">Status</div>
                  <div>
                    <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${getStatusStyle(selectedJob.status).card}`}>
                      {selectedJob.status}
                    </span>
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
          fetchJobs();
        }}
        initialDate={createInitialDate}
      />

      {/* TODAY ROUTES SEQUENCE MODAL */}
      {routesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs" 
            onClick={() => setRoutesModalOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative bg-white w-full max-w-lg mx-4 rounded-xl shadow-2xl overflow-hidden border border-[#E7E9ED] z-10 flex flex-col max-h-[85vh] animate-scale-up">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#151A2D] text-white">
              <div className="flex items-center gap-2">
                <Route className="text-[#76C442] w-5 h-5 stroke-[2.5]" />
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#737A86]">
                    Technician Stops manifest
                  </span>
                  <h3 className="text-base font-black text-white m-0">
                    Today's Dispatch Routes
                  </h3>
                </div>
              </div>
              <button 
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
                  <div className="text-[10px] text-[#737A86] uppercase font-bold">Current Manifest Date</div>
                  <div className="text-xs font-black text-[#151A2D]">Friday, July 31, 2026</div>
                </div>
                <span className="bg-[#76C442]/15 text-[#151A2D] text-[10px] font-black px-2 py-0.5 rounded">
                  {jobs.filter(j => parseJobDateStr(j.scheduled_date) === '2026-07-31').length} Total Stops
                </span>
              </div>

              {(() => {
                const todayStr = '2026-07-31';
                const todayJobs = jobs.filter(j => parseJobDateStr(j.scheduled_date) === todayStr);

                if (todayJobs.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 font-bold">
                      No jobs scheduled to build route sequences today.
                    </div>
                  );
                }

                // Group jobs by assigned worker
                const grouped: Record<string, Job[]> = {};
                todayJobs.forEach(job => {
                  const workerName = job.profiles?.full_name || 'Unassigned Installer';
                  if (!grouped[workerName]) grouped[workerName] = [];
                  grouped[workerName].push(job);
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
                              {/* Timeline bullet node */}
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
                                title="Open this location in Google Maps"
                              >
                                <MapPin size={9} className="text-[#76C442]" />
                                <span>{job.customers?.service_address || 'Richmond Hill'}</span>
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
