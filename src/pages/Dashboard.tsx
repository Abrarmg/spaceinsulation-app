// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  TrendingUp, 
  UserCheck, 
  FileSpreadsheet, 
  Loader2, 
  AlertTriangle,
  FileText,
  Search,
  Plus,
  MapPin,
  Truck,
  HelpCircle,
  HardHat,
  DollarSign,
  ArrowUpRight,
  MoreVertical,
  CheckCircle2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { calculateMonthlyFinancials } from '../utils/financials';

interface JobSummary {
  id: string;
  job_number: number;
  status: string;
  scheduled_date: string | null;
  assigned_worker_id: string | null;
  customer_name: string;
  worker_name: string;
}

interface ClockedInWorker {
  id: string;
  worker_id: string;
  clock_in: string;
  full_name: string;
  duration: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Dashboard stats
  const [stats, setStats] = useState({
    todayJobs: 0,
    waitingApproval: 0,
    inProgressJobs: 0,
    clockedInCount: 0,
    unpaidCount: 0,
    unpaidTotal: 0,
    monthlyRevenue: 0,
    netProfit: 0,
    netProfitHasIncomplete: false,
    pipelineTotal: 0,
    workersTotal: 0
  });

  // Needs Attention Counts
  const [attention, setAttention] = useState({
    overdueInvoices: 0,
    pendingEstimates: 0,
    unassignedJobs: 0,
    rescheduledJobs: 0
  });

  // Pipeline Snapshot Counts
  const [pipeline, setPipeline] = useState({
    draftEstimates: 0,
    quotedEstimates: 0,
    scheduledJobs: 0,
    inProgressJobs: 0,
    completedJobs: 0
  });

  const [todaySchedule, setTodaySchedule] = useState<JobSummary[]>([]);
  const [upcomingSchedule, setUpcomingSchedule] = useState<JobSummary[]>([]);
  const [clockedInWorkers, setClockedInWorkers] = useState<ClockedInWorker[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function initializeDashboard() {
      // 1. Verify user session and role
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (isMounted) navigate('/login/admin');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile || profile.role !== 'office_staff') {
        if (isMounted) navigate('/worker-dashboard');
        return;
      }

      try {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // 2. Fetch counts/stats in parallel
        const [
          { count: todayCount },
          { count: approvalCount },
          { count: progressCount },
          { count: clockedInCount },
          { data: invoicesData },
          { data: pendingEstimates },
          { count: overdueInvoicesCount },
          { count: pendingEstimatesCount },
          { count: unassignedJobsCount },
          { count: rescheduledJobsCount },
          { count: draftCount },
          { count: quotedCount },
          { count: scheduledCount },
          { count: progressCountSnapshot },
          { count: completedCount },
          { count: workersTotalCount }
        ] = await Promise.all([
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('scheduled_date', todayStr),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).in('status', ['Quoted', 'Sent']),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'In Progress'),
          supabase.from('time_entries').select('*', { count: 'exact', head: true }).is('clock_out', null),
          supabase.from('invoices').select('total').eq('status', 'Sent'),
          supabase.from('estimates').select('total_amount').eq('status', 'Sent'),
          supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('status', 'Sent').lt('due_date', todayStr),
          supabase.from('estimates').select('*', { count: 'exact', head: true }).eq('status', 'Sent'),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).is('assigned_worker_id', null),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'Rescheduled'),
          supabase.from('estimates').select('*', { count: 'exact', head: true }).eq('status', 'Draft'),
          supabase.from('estimates').select('*', { count: 'exact', head: true }).eq('status', 'Sent'),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'Scheduled'),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'In Progress'),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'Completed'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'field_worker')
        ]);

        const currentYearMonth = (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })();
        
        const fin = await calculateMonthlyFinancials(currentYearMonth);
        const unpaidCountVal = invoicesData?.length || 0;
        const unpaidTotalVal = (invoicesData || []).reduce((sum, inv) => sum + Number(inv.total), 0);
        const pipelineSum = (pendingEstimates || []).reduce((sum, est) => sum + Number(est.total_amount), 0);

        if (isMounted) {
          setStats({
            todayJobs: todayCount || 0,
            waitingApproval: approvalCount || 0,
            inProgressJobs: progressCount || 0,
            clockedInCount: clockedInCount || 0,
            unpaidCount: unpaidCountVal,
            unpaidTotal: unpaidTotalVal,
            monthlyRevenue: fin.revenue,
            netProfit: fin.netProfit,
            netProfitHasIncomplete: fin.hasIncompleteEntries,
            pipelineTotal: pipelineSum,
            workersTotal: workersTotalCount || 0
          });

          setAttention({
            overdueInvoices: overdueInvoicesCount || 0,
            pendingEstimates: pendingEstimatesCount || 0,
            unassignedJobs: unassignedJobsCount || 0,
            rescheduledJobs: rescheduledJobsCount || 0
          });

          setPipeline({
            draftEstimates: draftCount || 0,
            quotedEstimates: quotedCount || 0,
            scheduledJobs: scheduledCount || 0,
            inProgressJobs: progressCountSnapshot || 0,
            completedJobs: completedCount || 0
          });
        }

        // 3. Fetch today's schedule jobs
        const { data: todayJobsData } = await supabase
          .from('jobs')
          .select('*, customers(full_name), profiles:assigned_worker_id(full_name)')
          .eq('scheduled_date', todayStr)
          .order('job_number', { ascending: true });

        const mappedToday: JobSummary[] = (todayJobsData || []).map((j: any) => {
          const cust = Array.isArray(j.customers) ? j.customers[0] : j.customers;
          const prof = Array.isArray(j.profiles) ? j.profiles[0] : j.profiles;
          return {
            id: j.id,
            job_number: j.job_number,
            status: j.status,
            scheduled_date: j.scheduled_date,
            assigned_worker_id: j.assigned_worker_id,
            customer_name: cust?.full_name || 'Unknown Client',
            worker_name: prof?.full_name || 'Unassigned'
          };
        });

        if (isMounted) setTodaySchedule(mappedToday);

        // 4. Fetch upcoming appointments (next 5 days)
        const { data: upcomingJobsData } = await supabase
          .from('jobs')
          .select('*, customers(full_name), profiles:assigned_worker_id(full_name)')
          .gt('scheduled_date', todayStr)
          .lte('scheduled_date', new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('scheduled_date', { ascending: true });

        const mappedUpcoming: JobSummary[] = (upcomingJobsData || []).map((j: any) => {
          const cust = Array.isArray(j.customers) ? j.customers[0] : j.customers;
          const prof = Array.isArray(j.profiles) ? j.profiles[0] : j.profiles;
          return {
            id: j.id,
            job_number: j.job_number,
            status: j.status,
            scheduled_date: j.scheduled_date,
            assigned_worker_id: j.assigned_worker_id,
            customer_name: cust?.full_name || 'Unknown Client',
            worker_name: prof?.full_name || 'Unassigned'
          };
        });

        if (isMounted) setUpcomingSchedule(mappedUpcoming);

        // 5. Fetch currently clocked in workers
        const { data: clockedData } = await supabase
          .from('time_entries')
          .select('*, profiles:worker_id(full_name)')
          .is('clock_out', null);

        const mappedClocked: ClockedInWorker[] = (clockedData || []).map((c: any) => {
          const prof = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
          return {
            id: c.id,
            worker_id: c.worker_id,
            clock_in: c.clock_in,
            full_name: prof?.full_name || 'Worker',
            duration: '00:00:00'
          };
        });

        if (isMounted) setClockedInWorkers(mappedClocked);

        // 6. Fetch recent status changes/activities
        const { data: recentJobs } = await supabase
          .from('jobs')
          .select('id, job_number, status, created_at, customers(full_name)')
          .order('created_at', { ascending: false })
          .limit(5);

        const activities = (recentJobs || []).map((rj: any) => {
          const cust = Array.isArray(rj.customers) ? rj.customers[0] : rj.customers;
          return {
            id: rj.id,
            job_number: rj.job_number,
            status: rj.status,
            customer_name: cust?.full_name || 'Client',
            time: new Date(rj.created_at)
          };
        });

        if (isMounted) setRecentActivities(activities);

      } catch (err) {
        console.error('Failed to load admin dashboard:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initializeDashboard();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // Live timer ticks for clocked in employees
  useEffect(() => {
    if (clockedInWorkers.length === 0) return;

    const interval = setInterval(() => {
      setClockedInWorkers(prevWorkers => 
        prevWorkers.map(w => {
          const start = new Date(w.clock_in).getTime();
          const diffMs = Date.now() - start;

          if (diffMs <= 0) return { ...w, duration: '00:00:00' };

          const hours = Math.floor(diffMs / 3600000);
          const minutes = Math.floor((diffMs % 3600000) / 60000);
          const seconds = Math.floor((diffMs % 60000) / 1000);
          
          const pad = (n: number) => n.toString().padStart(2, '0');
          return {
            ...w,
            duration: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [clockedInWorkers.length]);

  // Activity feed time helper
  const getTimeElapsed = (date: Date) => {
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
    return date.toLocaleDateString();
  };

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'quoted':
      case 'sent':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'scheduled':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'in_progress':
      case 'in progress':
        return 'text-[#76C442] bg-[#76C442]/5 border-[#76C442]/20 animate-pulse';
      case 'completed':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200 font-bold';
      case 'cancelled':
      case 'rejected':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-[#737A86] bg-[#F7F8FA] border-[#E6E8EC]';
    }
  };

  if (loading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-screen gap-3 text-[#737A86] bg-[#F6F7F9]">
        <Loader2 className="w-9 h-9 animate-spin text-[#76C442]" />
        <span className="text-xs font-bold uppercase tracking-wider">Loading Command Dashboard...</span>
      </div>
    );
  }

  // Grouped monthly comparison data points


  const offlineWorkersCount = Math.max(0, stats.workersTotal - stats.clockedInCount);

  return (
    <div className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 overflow-y-auto max-h-screen bg-[#F8FAFC] pb-24 font-sans">
      
      {/* 1. Page Header & Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div>
          <h2 className="text-2xl font-black text-[#151A2D] tracking-tight m-0 select-none">
            Here's an overview of your business today.
          </h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium select-none">
            Track operations, manage teams, and grow your insulation business.
          </p>
        </div>
        <div className="flex flex-row items-center gap-2 select-none shrink-0 w-full md:w-auto mt-1 md:mt-0">
          <div className="px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#151A2D] shadow-sm flex-grow md:flex-grow-0 text-center flex items-center gap-2">
            <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <CalendarIcon size={14} className="text-[#64748B]" />
          </div>
          <button className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#151A2D] shadow-sm hover:bg-[#F1F5F9] cursor-pointer transition-colors">
            <span>Today</span>
            <ChevronDown size={14} className="text-[#64748B]" />
          </button>
        </div>
      </div>

      {/* 2. Top 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Today's Jobs */}
        <Link 
          to="/scheduling" 
          className="bg-gradient-to-br from-white to-[#F0F7FF] p-4 rounded-2xl border border-[#E0F2FE] shadow-sm transition-premium hover:-translate-y-1 hover:shadow-[0_8px_20px_-4px_rgba(14,165,233,0.15)] flex items-start gap-3.5 group cursor-pointer relative overflow-hidden animate-stagger-1"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0EA5E9] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#0EA5E9]/20 z-10">
            <CalendarIcon size={20} className="stroke-[2.5]" />
          </div>
          <div className="space-y-1 z-10">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#0EA5E9] leading-none mt-0.5">Today's Jobs</div>
            <div className="text-3xl font-black text-[#151A2D] leading-none">{stats.todayJobs}</div>
            <div className="text-[11px] text-[#64748B] font-medium leading-none">
              <span className="font-bold text-[#151A2D]">{stats.todayJobs}</span> scheduled today
            </div>
          </div>
          <CalendarIcon size={80} className="absolute -right-4 -bottom-4 text-[#0EA5E9] opacity-[0.04] stroke-[1] pointer-events-none group-hover:scale-110 transition-transform duration-500" />
        </Link>

        {/* Quotes Pending */}
        <Link 
          to="/estimates" 
          className="bg-gradient-to-br from-white to-[#F0FDF4] p-4 rounded-2xl border border-[#DCFCE7] shadow-sm transition-premium hover:-translate-y-1 hover:shadow-[0_8px_20px_-4px_rgba(34,197,94,0.15)] flex items-start gap-3.5 group cursor-pointer relative overflow-hidden animate-stagger-2"
        >
          <div className="w-10 h-10 rounded-xl bg-[#22C55E] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#22C55E]/20 z-10">
            <FileText size={20} className="stroke-[2.5]" />
          </div>
          <div className="space-y-1 z-10">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#22C55E] leading-none mt-0.5">Quotes Pending</div>
            <div className="text-3xl font-black text-[#151A2D] leading-none">{stats.waitingApproval}</div>
            <div className="text-[11px] text-[#64748B] font-medium leading-none">
              <span className="text-[#22C55E] font-bold">${stats.pipelineTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> pipeline
            </div>
          </div>
          <FileText size={80} className="absolute -right-4 -bottom-4 text-[#22C55E] opacity-[0.04] stroke-[1] pointer-events-none group-hover:scale-110 transition-transform duration-500" />
        </Link>

        {/* Active Builds */}
        <Link 
          to="/jobs?status=in_progress" 
          className="bg-gradient-to-br from-white to-[#F5F3FF] p-4 rounded-2xl border border-[#EDE9FE] shadow-sm transition-premium hover:-translate-y-1 hover:shadow-[0_8px_20px_-4px_rgba(139,92,246,0.15)] flex items-start gap-3.5 group cursor-pointer relative overflow-hidden animate-stagger-3"
        >
          <div className="w-10 h-10 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#8B5CF6]/20 z-10">
            <TrendingUp size={20} className="stroke-[2.5]" />
          </div>
          <div className="space-y-1 z-10">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#8B5CF6] leading-none mt-0.5">Active Builds</div>
            <div className="text-3xl font-black text-[#151A2D] leading-none">{stats.inProgressJobs}</div>
            <div className="text-[11px] text-[#64748B] font-medium leading-none">
              <span className="font-bold text-[#151A2D]">{stats.inProgressJobs}</span> currently in progress
            </div>
          </div>
          <TrendingUp size={80} className="absolute -right-4 -bottom-4 text-[#8B5CF6] opacity-[0.04] stroke-[1] pointer-events-none group-hover:scale-110 transition-transform duration-500" />
        </Link>

        {/* Workers Active */}
        <Link 
          to="/employees" 
          className="bg-gradient-to-br from-white to-[#FFF7ED] p-4 rounded-2xl border border-[#FFEDD5] shadow-sm transition-premium hover:-translate-y-1 hover:shadow-[0_8px_20px_-4px_rgba(249,115,22,0.15)] flex items-start gap-3.5 group cursor-pointer relative overflow-hidden animate-stagger-4"
        >
          <div className="w-10 h-10 rounded-xl bg-[#F97316] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#F97316]/20 z-10">
            <UserCheck size={20} className="stroke-[2.5]" />
          </div>
          <div className="space-y-1 z-10">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#F97316] leading-none mt-0.5">Workers Active</div>
            <div className="text-3xl font-black text-[#151A2D] leading-none">{stats.clockedInCount}</div>
            <div className="text-[11px] text-[#64748B] font-medium leading-none">
              <span className="font-bold text-[#151A2D]">{stats.clockedInCount}</span> currently on site
            </div>
          </div>
          <UserCheck size={80} className="absolute -right-4 -bottom-4 text-[#F97316] opacity-[0.04] stroke-[1] pointer-events-none group-hover:scale-110 transition-transform duration-500" />
        </Link>

      </div>

      {/* 3. Needs Attention Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl px-5 py-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#151A2D] shrink-0">
          <AlertTriangle size={16} className="text-[#F97316] stroke-[2.5]" />
          <span>Needs Attention</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-[#151A2D]">
          {/* Overdue Invoices */}
          <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
            <span className={`w-2 h-2 rounded-full ${attention.overdueInvoices > 0 ? 'bg-[#EF4444] animate-pulse' : 'bg-[#22C55E]'}`} />
            <span className={attention.overdueInvoices > 0 ? 'text-[#EF4444]' : 'text-[#64748B]'}>
              {attention.overdueInvoices} Overdue Invoices
            </span>
          </div>
          
          {/* Estimates Awaiting Response */}
          <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
            <span className={`w-2 h-2 rounded-full ${attention.pendingEstimates > 0 ? 'bg-[#F97316]' : 'bg-[#22C55E]'}`} />
            <span className={attention.pendingEstimates > 0 ? 'text-[#F97316]' : 'text-[#64748B]'}>
              {attention.pendingEstimates} Estimates Awaiting Response
            </span>
          </div>

          {/* Crew Assignments Needed */}
          <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
            <span className={`w-2 h-2 rounded-full ${attention.unassignedJobs > 0 ? 'bg-[#EAB308]' : 'bg-[#22C55E]'}`} />
            <span className={attention.unassignedJobs > 0 ? 'text-[#EAB308]' : 'text-[#64748B]'}>
              {attention.unassignedJobs} Crew Assignments Needed
            </span>
          </div>

          {/* Jobs Rescheduled */}
          <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
            <span className={`w-2 h-2 rounded-full ${attention.rescheduledJobs > 0 ? 'bg-[#22C55E]' : 'bg-[#22C55E]'}`} />
            <span className={attention.rescheduledJobs > 0 ? 'text-[#22C55E]' : 'text-[#64748B]'}>
              {attention.rescheduledJobs} Jobs Rescheduled
            </span>
          </div>
          
          <ChevronRight size={16} className="text-[#64748B] ml-auto hidden md:block cursor-pointer" />
        </div>
      </div>

      {/* 4. Two-Column Layout 1: Today's Operations + Crew Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Today's Operations */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col justify-between min-h-[300px]">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <CalendarIcon size={16} className="text-[#22C55E] stroke-[2.5]" />
              <h3 className="text-xs font-black text-[#151A2D] m-0 uppercase tracking-widest">Today's Operations</h3>
            </div>
            <Link to="/scheduling" className="text-xs font-bold text-[#22C55E] hover:text-[#16A34A] transition-colors flex items-center gap-1 shrink-0">
              <span>View Calendar →</span>
            </Link>
          </div>

          <div className="p-6 flex-grow flex flex-col justify-center">
            {todaySchedule.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative mb-4">
                  <div className="w-16 h-16 bg-[#F0FDF4] rounded-2xl border-2 border-[#BBF7D0] flex items-center justify-center">
                    <CalendarIcon size={32} className="text-[#22C55E]" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-[#22C55E] rounded-full border-2 border-white flex items-center justify-center text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                </div>
                <div className="text-lg font-black text-[#151A2D] mb-1">All clear for today!</div>
                <div className="text-sm text-[#64748B] font-medium mb-6">No installation jobs are currently scheduled.</div>
                <Link 
                  to="/scheduling" 
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 bg-[#7CC242] hover:bg-[#6ab331] text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-[#7CC242]/20 hover:-translate-y-0.5"
                >
                  <Plus size={18} />
                  <span>Schedule a Job</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Simplified list for scheduled jobs */}
                {todaySchedule.slice(0, 4).map((j) => (
                  <div key={j.id} className="flex items-center justify-between p-3 border border-[#E2E8F0] rounded-xl hover:border-[#7CC242]/40 transition-colors bg-[#F8FAFC]">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex flex-col items-center justify-center text-[#151A2D] shadow-sm">
                        <span className="text-[10px] font-bold uppercase text-[#64748B]">JOB</span>
                        <span className="text-xs font-black">{j.job_number}</span>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#151A2D]">{j.customer_name}</div>
                        <div className="text-xs text-[#64748B] font-medium mt-0.5">{j.worker_name} • {j.status}</div>
                      </div>
                    </div>
                    <Link to={`/jobs/${j.id}`} className="px-4 py-2 bg-white border border-[#E2E8F0] text-xs font-bold text-[#151A2D] rounded-lg hover:bg-[#F1F5F9] transition-colors">
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Crew Status */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col min-h-[300px]">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-[#22C55E] stroke-[2.5]" />
              <h3 className="text-xs font-black text-[#151A2D] m-0 uppercase tracking-widest">Crew Status</h3>
            </div>
            <Link to="/employees" className="text-xs font-bold text-[#22C55E] hover:text-[#16A34A] transition-colors flex items-center gap-1 shrink-0">
              <span>View Team →</span>
            </Link>
          </div>

          <div className="p-6 flex-grow flex flex-col gap-6 relative">
            {/* 3 Status Bubbles */}
            <div className="grid grid-cols-3 gap-4 relative z-10">
              {/* On Site */}
              <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
                    <span className="text-lg font-black text-[#151A2D] leading-none">{stats.clockedInCount}</span>
                  </div>
                  <div className="text-[10px] font-bold text-[#151A2D] mt-1">On Site</div>
                </div>
                <MapPin size={24} className="text-[#22C55E] opacity-50 stroke-[1.5]" />
              </div>
              
              {/* Travelling */}
              <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
                    <span className="text-lg font-black text-[#151A2D] leading-none">0</span>
                  </div>
                  <div className="text-[10px] font-bold text-[#151A2D] mt-1">Travelling</div>
                </div>
                <Truck size={24} className="text-[#F59E0B] opacity-50 stroke-[1.5]" />
              </div>
              
              {/* Offline */}
              <div className="bg-[#F8FAFC] border border-[#F1F5F9] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                    <span className="text-lg font-black text-[#151A2D] leading-none">{offlineWorkersCount}</span>
                  </div>
                  <div className="text-[10px] font-bold text-[#151A2D] mt-1">Offline</div>
                </div>
                <UserCheck size={24} className="text-[#3B82F6] opacity-50 stroke-[1.5]" />
              </div>
            </div>

            {/* Workers active shifts list or Empty State */}
            <div className="flex-grow flex flex-col">
              {clockedInWorkers.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center mt-2 relative z-10">
                  <div className="text-sm font-bold text-[#64748B] italic mb-1">No field technicians clocked in</div>
                  <Link to="/employees" className="text-xs font-black text-[#22C55E] hover:text-[#16A34A] transition-colors">
                    View Team →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-[150px] relative z-10 pr-2">
                  {clockedInWorkers.map(w => (
                    <div key={w.id} className="flex items-center justify-between p-3 bg-white border border-[#E2E8F0] rounded-xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#F0FDF4] border border-[#DCFCE7] flex items-center justify-center text-[#22C55E] text-xs font-black">
                          {w.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#151A2D]">{w.full_name}</div>
                          <div className="text-[10px] text-[#64748B] font-medium">Started at {new Date(w.clock_in).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#F0FDF4] text-[#22C55E] px-2 py-1 rounded-md border border-[#DCFCE7]">
                        <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full animate-pulse" />
                        <span className="text-[10px] font-black font-mono tracking-wider">{w.duration}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Decorative Workers Illustration (only visible if empty or partial) */}
            {clockedInWorkers.length < 3 && (
              <div className="absolute bottom-0 right-4 flex opacity-20 pointer-events-none grayscale">
                {/* SVG placeholders for workers to mimic the image */}
                <svg width="120" height="80" viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M100 60C116.569 60 130 46.5685 130 30C130 13.4315 116.569 0 100 0C83.4315 0 70 13.4315 70 30C70 46.5685 83.4315 60 100 60Z" fill="#CBD5E1"/>
                  <path d="M180 120C180 86.8629 144.183 60 100 60C55.8172 60 20 86.8629 20 120H180Z" fill="#CBD5E1"/>
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Business Pipeline */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 flex flex-col justify-between gap-4 min-h-[160px] overflow-hidden">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#151A2D] select-none">
            <TrendingUp size={16} className="text-[#8B5CF6] stroke-[2.5]" />
            <span>Business Pipeline</span>
          </div>
          
          <div className="flex sm:grid sm:grid-cols-5 overflow-x-auto sm:overflow-visible gap-3 pb-2 sm:pb-0 scrollbar-none items-center">
            {/* Stage 1: Leads */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 flex flex-col justify-between min-h-[90px] min-w-[140px] sm:min-w-0">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider leading-none">Leads</div>
                <div className="text-[#8B5CF6] bg-[#F5F3FF] p-1.5 rounded-lg"><UserCheck size={14} /></div>
              </div>
              <div>
                <div className="text-xl font-black text-[#151A2D] mt-1 leading-none">{pipeline.draftEstimates}</div>
                <div className="text-[10px] text-[#64748B] font-medium leading-none mt-1.5">Inquiry drafts</div>
              </div>
            </div>
            
            {/* Stage 2: Quoted */}
            <div className="bg-white border border-[#E0F2FE] rounded-xl p-3 flex flex-col justify-between min-h-[90px] min-w-[140px] sm:min-w-0 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider leading-none">Quoted</div>
                <div className="text-[#0EA5E9] bg-[#F0F7FF] p-1.5 rounded-lg"><FileText size={14} /></div>
              </div>
              <div>
                <div className="text-xl font-black text-[#151A2D] mt-1 leading-none">{pipeline.quotedEstimates}</div>
                <div className="text-[10px] text-[#0EA5E9] font-bold leading-none mt-1.5 truncate">
                  ${stats.pipelineTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            
            {/* Stage 3: Scheduled */}
            <div className="bg-white border border-[#DCFCE7] rounded-xl p-3 flex flex-col justify-between min-h-[90px] min-w-[140px] sm:min-w-0 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider leading-none">Scheduled</div>
                <div className="text-[#22C55E] bg-[#F0FDF4] p-1.5 rounded-lg"><CalendarIcon size={14} /></div>
              </div>
              <div>
                <div className="text-xl font-black text-[#151A2D] mt-1 leading-none">{pipeline.scheduledJobs}</div>
                <div className="text-[10px] text-[#64748B] font-medium leading-none mt-1.5">Slated builds</div>
              </div>
            </div>

            {/* Stage 4: In Progress */}
            <div className="bg-white border border-[#FFEDD5] rounded-xl p-3 flex flex-col justify-between min-h-[90px] min-w-[140px] sm:min-w-0 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider leading-none">In Progress</div>
                <div className="text-[#F97316] bg-[#FFF7ED] p-1.5 rounded-lg"><HardHat size={14} /></div>
              </div>
              <div>
                <div className="text-xl font-black text-[#151A2D] mt-1 leading-none">{pipeline.inProgressJobs}</div>
                <div className="text-[10px] text-[#64748B] font-medium leading-none mt-1.5">Active site</div>
              </div>
            </div>

            {/* Stage 5: Completed */}
            <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl p-3 flex flex-col justify-between min-h-[90px] min-w-[140px] sm:min-w-0 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider leading-none">Completed</div>
                <div className="text-[#22C55E] bg-[#DCFCE7] p-1.5 rounded-full"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
              </div>
              <div>
                <div className="text-xl font-black text-[#151A2D] mt-1 leading-none">{pipeline.completedJobs}</div>
                <div className="text-[10px] text-[#64748B] font-medium leading-none mt-1.5">Closed builds</div>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Schedule */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <CalendarIcon size={16} className="text-[#0EA5E9] stroke-[2.5]" />
              <h3 className="text-xs font-black text-[#151A2D] m-0 uppercase tracking-widest">Upcoming Schedule</h3>
            </div>
            <Link to="/scheduling" className="text-xs font-bold text-[#22C55E] hover:text-[#16A34A] transition-colors">
              View Schedule →
            </Link>
          </div>

          <div className="p-6 flex-grow flex flex-col justify-center bg-[#F0F7FF]/50 relative">
            {upcomingSchedule.length === 0 ? (
              <div className="flex items-center justify-center gap-4 text-center select-none z-10 relative">
                <div className="w-12 h-12 bg-white rounded-xl border border-[#E0F2FE] shadow-sm flex items-center justify-center shrink-0">
                  <CalendarIcon size={24} className="text-[#0EA5E9]" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-black text-[#151A2D]">No upcoming jobs scheduled</div>
                  <div className="text-[11px] text-[#64748B] font-medium">You're all caught up!</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 relative z-10">
                {upcomingSchedule.slice(0, 3).map(j => (
                  <div key={j.id} className="bg-white border border-[#E2E8F0] rounded-xl p-3 flex flex-col">
                    <div className="flex items-center justify-between">
                      <Link to={`/jobs/${j.id}`} className="text-xs font-black text-[#22C55E] hover:underline">
                        JOB-{j.job_number}
                      </Link>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${getStatusClass(j.status)}`}>
                        {j.status}
                      </span>
                    </div>
                    <div className="text-xs text-[#151A2D] font-bold mt-1 truncate">{j.customer_name}</div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Decorative Clouds */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
              <svg width="100%" height="100%" viewBox="0 0 300 100" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                <path d="M40 70C25 70 15 60 15 45C15 30 25 20 40 20C45 20 50 22 53 25C58 15 68 10 80 10C95 10 110 22 110 40C110 42 109 45 108 48C115 50 120 58 120 65C120 75 110 80 100 80H40V70Z" fill="#E0F2FE"/>
                <path d="M250 80C235 80 225 70 225 55C225 40 235 30 250 30C255 30 260 32 263 35C268 25 278 20 290 20C305 20 320 32 320 50C320 52 319 55 318 58C325 60 330 68 330 75C330 85 320 90 310 90H250V80Z" fill="#E0F2FE"/>
              </svg>
            </div>
          </div>
        </div>

      </div>

      {/* 6. Financial Overview */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E2E8F0] pb-4">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#151A2D] select-none">
            <DollarSign size={16} className="text-[#22C55E] stroke-[2.5]" />
            <span>Financial Overview</span>
          </div>
          <Link to="/net-profit-breakdown" className="text-xs font-bold text-[#22C55E] hover:text-[#16A34A] transition-colors flex items-center gap-1">
            <span>Net Profit Analytics →</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Monthly Revenue */}
          <div className="bg-[#F0FDF4] p-5 rounded-xl border border-[#DCFCE7] flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#151A2D] mb-1">
                <TrendingUp size={14} className="text-[#22C55E]" />
                Monthly Revenue
              </div>
              <div className="text-3xl font-black text-[#151A2D] leading-none mb-1">
                ${stats.monthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <span className="text-[10px] text-[#64748B] font-bold">
                <span className="text-[#22C55E]">+14.2%</span> from June
              </span>
            </div>
            <div className="w-24 h-12 relative z-10 opacity-70">
              <svg viewBox="0 0 100 40" className="w-full h-full stroke-[#22C55E] fill-none stroke-[2]" preserveAspectRatio="none">
                <path d="M0 30 L20 25 L40 35 L60 15 L80 20 L100 5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Net Profit */}
          <div className="bg-[#FFFBEB] p-5 rounded-xl border border-[#FEF3C7] flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#151A2D] mb-1">
                <TrendingUp size={14} className="text-[#F59E0B]" />
                Net Profit
              </div>
              <div className="text-3xl font-black text-[#151A2D] leading-none mb-1 flex items-center gap-2">
                ${stats.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                {stats.netProfitHasIncomplete && (
                  <span title="Incomplete time entries" className="text-[#EF4444] animate-pulse"><AlertTriangle size={16}/></span>
                )}
              </div>
              <span className="text-[10px] text-[#64748B] font-bold">
                <span className="text-[#F59E0B]">+18.7%</span> from June
              </span>
            </div>
            <div className="w-24 h-12 relative z-10 opacity-70">
              <svg viewBox="0 0 100 40" className="w-full h-full stroke-[#F59E0B] fill-none stroke-[2]" preserveAspectRatio="none">
                <path d="M0 35 L25 30 L50 20 L75 25 L100 10" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Outstanding Invoices */}
          <div className="bg-[#FEF2F2] p-5 rounded-xl border border-[#FEE2E2] flex items-start flex-col justify-center relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#151A2D] mb-1">
                <FileText size={14} className="text-[#EF4444]" />
                Outstanding Invoices
              </div>
              <div className="text-3xl font-black text-[#151A2D] leading-none mb-1">
                ${stats.unpaidTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <span className="text-[10px] text-[#64748B] font-bold">
                {stats.unpaidCount} unpaid invoices
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 text-[10px] font-bold text-[#64748B] pt-2">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#22C55E]"/> Revenue</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#151A2D]"/> Net Profit</div>
        </div>
      </div>
    </div>
  );
};
