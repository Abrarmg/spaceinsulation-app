import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase, supabaseAdmin } from '../../supabaseClient';
import { 
  FileText, 
  Plus, 
  Search, 
  Loader2, 
  ArrowRight, 
  AlertCircle,
  MoreVertical,
  Layers,
  Check,
  Send,
  DollarSign,
  X,
  Filter
} from 'lucide-react';

interface Estimate {
  id: string;
  estimate_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  status: string;
  total_amount: number;
  created_at: string;
  insulation_type?: string;
  insulation_rate?: number;
  home_size?: number;
  line_items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }> | null;
  expert_name?: string | null;
  expert_role?: string | null;
  expert_email?: string | null;
  expert_phone?: string | null;
  expert_address?: string | null;
}

interface Stats {
  total: number;
  draft: number;
  sent: number;
  approved: number;
  pipelineValue: number;
}

const STATUS_OPTIONS = ['all', 'Draft', 'Sent', 'Approved', 'Rejected', 'Expired'];
const ITEMS_PER_PAGE = 8;

export const AdminEstimatesList: React.FC = () => {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Stats summaries
  const [stats, setStats] = useState<Stats>({ total: 0, draft: 0, sent: 0, approved: 0, pipelineValue: 0 });

  // Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Mobile bottom filter sheet state
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [selectedMobileStatus, setSelectedMobileStatus] = useState('all');

  // Conversion Confirmation Dialog States
  const [conversionTarget, setConversionTarget] = useState<Estimate | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedJobInfo, setConvertedJobInfo] = useState<{ id: string; jobNumber: number } | null>(null);

  // Global click listener to close actions dropdowns
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const dbClient = supabaseAdmin || supabase;

  // Fetch summary statistics
  const fetchStats = useCallback(async () => {
    try {
      const { data, error: statsErr } = await dbClient
        .from('estimates')
        .select('status, total_amount');

      if (statsErr) throw statsErr;

      const items = data || [];
      const computed: Stats = {
        total: items.length,
        draft: items.filter(e => e.status === 'Draft').length,
        sent: items.filter(e => e.status === 'Sent').length,
        approved: items.filter(e => e.status === 'Approved').length,
        pipelineValue: items.reduce((sum, e) => sum + Number(e.total_amount || 0), 0)
      };
      setStats(computed);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [dbClient]);

  // Fetch estimates list
  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromRange = (currentPage - 1) * ITEMS_PER_PAGE;
      const toRange = fromRange + ITEMS_PER_PAGE - 1;

      let query = dbClient
        .from('estimates')
        .select('*', { count: 'exact' });

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply search query (ID, name, email, insulation type, or home size)
      if (debouncedQuery.trim()) {
        const queryTerm = debouncedQuery.trim();
        query = query.or(`estimate_number.ilike.%${queryTerm}%,customer_name.ilike.%${queryTerm}%,customer_email.ilike.%${queryTerm}%,insulation_type.ilike.%${queryTerm}%`);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(fromRange, toRange);

      const { data, count, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      setEstimates((data as any[]) || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Failed to fetch estimates:', err);
      setError('Could not load estimates. Please verify database connection.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, debouncedQuery, dbClient]);

  useEffect(() => {
    fetchEstimates();
    fetchStats();
  }, [fetchEstimates, fetchStats]);

  // Date and Expiration Calculators (7 day window)
  const getValidUntilDate = (createdAtStr: string) => {
    const createdDate = new Date(createdAtStr);
    return new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  };

  const getExpiryDetails = (createdAtStr: string, status: string) => {
    const validDate = getValidUntilDate(createdAtStr);
    const dateText = validDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    
    if (status.toLowerCase() === 'approved' || status.toLowerCase() === 'completed' || status.toLowerCase() === 'rejected') {
      return { text: dateText, style: 'text-brand-charcoal font-medium' };
    }

    const now = new Date('2026-07-31T15:30:00'); // Seed mock date
    const validZero = new Date(validDate.getFullYear(), validDate.getMonth(), validDate.getDate());
    const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = validZero.getTime() - nowZero.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: 'Expired', style: 'text-red-650 font-black' };
    } else if (diffDays <= 2) {
      return { text: `Expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}`, style: 'text-amber-600 font-extrabold animate-pulse' };
    }
    return { text: dateText, style: 'text-brand-charcoal font-medium' };
  };

  // Status Badge Styling Helper
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'text-slate-600 bg-slate-50 border-slate-200';
      case 'sent':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'approved':
        return 'text-green-700 bg-green-50 border-green-200 font-extrabold';
      case 'rejected':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'expired':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      default:
        return 'text-slate-650 bg-slate-50 border-slate-200';
    }
  };

  // actions menu triggers
  const handleDuplicate = async (e: React.MouseEvent, targetEst: Estimate) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (!confirm(`Duplicate estimate ${targetEst.estimate_number}?`)) return;

    try {
      const { data: maxEstData } = await dbClient
        .from('estimates')
        .select('estimate_number')
        .order('estimate_number', { ascending: false })
        .limit(1);

      const nextNum = maxEstData && maxEstData.length > 0 
        ? Number(maxEstData[0].estimate_number.replace('EST-', '')) + 1 
        : 1001;

      const { error: dupErr } = await dbClient
        .from('estimates')
        .insert([{
          estimate_number: `EST-${nextNum}`,
          customer_id: targetEst.customer_id,
          customer_name: targetEst.customer_name,
          customer_email: targetEst.customer_email,
          home_size: targetEst.home_size || 0,
          insulation_type: targetEst.insulation_type || 'Line Items',
          insulation_rate: targetEst.insulation_rate || 0,
          expert_name: targetEst.expert_name,
          expert_role: targetEst.expert_role,
          expert_email: targetEst.expert_email,
          expert_phone: targetEst.expert_phone,
          expert_address: targetEst.expert_address,
          total_amount: targetEst.total_amount,
          line_items: targetEst.line_items,
          status: 'Draft'
        }]);

      if (dupErr) throw dupErr;
      alert(`Duplicate EST-${nextNum} created!`);
      fetchEstimates();
      fetchStats();
    } catch (err: any) {
      alert('Failed to duplicate estimate: ' + err.message);
    }
  };

  const handleSendToCustomer = async (e: React.MouseEvent, targetEst: Estimate) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (!confirm(`Send estimate ${targetEst.estimate_number} to ${targetEst.customer_name}?`)) return;

    try {
      const { error: updateErr } = await dbClient
        .from('estimates')
        .update({ status: 'Sent', sent_at: new Date().toISOString() })
        .eq('id', targetEst.id);

      if (updateErr) throw updateErr;
      alert(`Estimate sent successfully! Status updated to 'Sent'.`);
      fetchEstimates();
      fetchStats();
    } catch (err: any) {
      alert('Failed to send estimate: ' + err.message);
    }
  };

  const handleDelete = async (e: React.MouseEvent, targetEstId: string, estNum: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (!confirm(`Are you absolutely sure you want to delete estimate ${estNum}? This cannot be undone.`)) return;

    try {
      // First delete associated items and sections to satisfy foreign key constraints
      await dbClient.from('estimate_items').delete().eq('estimate_id', targetEstId);
      await dbClient.from('estimate_sections').delete().eq('estimate_id', targetEstId).select(); // .select() is just to ignore errors if it doesn't exist, wait, no, just execute.
      
      const { error: deleteErr } = await dbClient
        .from('estimates')
        .delete()
        .eq('id', targetEstId);

      if (deleteErr) throw deleteErr;
      alert('Estimate deleted successfully.');
      fetchEstimates();
      fetchStats();
    } catch (err: any) {
      alert('Failed to delete estimate: ' + err.message);
    }
  };

  // Convert Approved Estimate to Job Workflow
  const handleOpenConversion = (e: React.MouseEvent, est: Estimate) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setConversionTarget(est);
    setConvertedJobInfo(null);
  };

  const executeJobConversion = async () => {
    if (!conversionTarget) return;
    setIsConverting(true);
    try {
      // 1. Fetch maximum job number for incremental sequence
      const { data: maxJobData, error: maxJobError } = await dbClient
        .from('jobs')
        .select('job_number')
        .order('job_number', { ascending: false })
        .limit(1);

      if (maxJobError) throw maxJobError;

      const nextJobNum = maxJobData && maxJobData.length > 0 
        ? Number(maxJobData[0].job_number) + 1 
        : 1001;

      // 2. Generate scope details summary
      const lineItems = Array.isArray(conversionTarget.line_items) ? conversionTarget.line_items : [];
      const itemsList = lineItems.map((item) => 
        `- ${item.description} (Qty: ${item.quantity || 1} × $${Number(item.unit_price || 0).toFixed(2)} = $${(Number(item.quantity || 1) * Number(item.unit_price || 0)).toFixed(2)})`
      ).join('\n');

      const scopeOfWork = [
        `Converted from Estimate ${conversionTarget.estimate_number}`,
        `Insulation Type: ${conversionTarget.insulation_type || 'Attic Insulation'}`,
        itemsList ? `\nDetailed Scope Items:\n${itemsList}` : null
      ].filter(Boolean).join('\n');

      // 3. Insert Job record
      const { data: jobData, error: jobErr } = await dbClient
        .from('jobs')
        .insert([{
          customer_id: conversionTarget.customer_id,
          job_number: nextJobNum,
          status: 'Scheduled',
          scope_of_work: scopeOfWork,
          quoted_amount: conversionTarget.total_amount
        }])
        .select()
        .maybeSingle();

      if (jobErr) throw jobErr;

      // 4. Update estimate status to Approved
      const { error: estErr } = await dbClient
        .from('estimates')
        .update({ status: 'Approved' })
        .eq('id', conversionTarget.id);

      if (estErr) throw estErr;

      if (jobData) {
        setConvertedJobInfo({ id: jobData.id, jobNumber: nextJobNum });
      }
      fetchEstimates();
      fetchStats();
    } catch (err: any) {
      alert('Job conversion failed: ' + err.message);
    } finally {
      setIsConverting(false);
    }
  };

  const handleApplyMobileFilter = () => {
    setStatusFilter(selectedMobileStatus);
    setCurrentPage(1);
    setMobileFilterOpen(false);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="flex-grow p-4 md:p-6 space-y-6 overflow-y-auto max-h-screen bg-[#F6F7F9] font-sans pb-16">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E9ED] pb-3.5 select-none">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-[#151A2D] tracking-tight m-0">Estimate Directory</h2>
          <p className="text-xs md:text-sm text-[#737A86] mt-0.5 font-semibold">
            Create, track, and manage customer estimates and job conversions.
          </p>
        </div>
        
        <Link 
          to="/estimates/new" 
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] font-black text-xs uppercase tracking-wider rounded-xl shadow-xs cursor-pointer transition-colors border-none"
        >
          <Plus size={15} className="stroke-[3]" />
          <span>New Estimate</span>
        </Link>
      </div>

      {/* FEATURE 2 — ESTIMATE SUMMARY STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 select-none">
        {/* Total estimates card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 text-[#737A86] rounded-lg shrink-0">
            <FileText size={16} />
          </div>
          <div>
            <div className="text-[10px] text-[#737A86] uppercase font-bold">Total Estimates</div>
            <div className="text-sm font-black text-[#151A2D]">{stats.total}</div>
          </div>
        </div>

        {/* Draft estimates card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 text-[#737A86] rounded-lg shrink-0">
            <Layers size={16} />
          </div>
          <div>
            <div className="text-[10px] text-[#737A86] uppercase font-bold">Draft</div>
            <div className="text-sm font-black text-[#151A2D]">{stats.draft}</div>
          </div>
        </div>

        {/* Sent estimates card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <Send size={16} />
          </div>
          <div>
            <div className="text-[10px] text-[#737A86] uppercase font-bold">Sent</div>
            <div className="text-sm font-black text-[#151A2D]">{stats.sent}</div>
          </div>
        </div>

        {/* Approved estimates card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <Check size={16} />
          </div>
          <div>
            <div className="text-[10px] text-[#737A86] uppercase font-bold">Approved</div>
            <div className="text-sm font-black text-[#151A2D]">{stats.approved}</div>
          </div>
        </div>

        {/* Pipeline value estimates card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs flex items-center gap-3 col-span-2 lg:col-span-1">
          <div className="p-2.5 bg-[#76C442]/10 text-[#76C442] rounded-lg shrink-0">
            <DollarSign size={16} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="text-[10px] text-[#737A86] uppercase font-bold">Pipeline Value</div>
            <div className="text-sm font-black text-[#76C442]">
              ${Number(stats.pipelineValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* FEATURE 3 — SEARCH AND FILTER AREA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white border border-[#E2E8F0] p-3 rounded-xl gap-3 shadow-3xs select-none">
        {/* Search input field */}
        <div className="relative flex-grow max-w-lg">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737A86]" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search estimates, customers, or estimate ID..."
            className="w-full pl-9 pr-4 py-2 border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442] bg-[#F7F8FA]"
          />
        </div>

        {/* Desktop Filter Pills */}
        <div className="hidden sm:flex flex-wrap items-center gap-1.5">
          {STATUS_OPTIONS.map(filter => (
            <button
              key={filter}
              onClick={() => {
                setStatusFilter(filter);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg border text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer ${
                statusFilter === filter 
                  ? 'bg-[#151A2D] text-white border-[#151A2D] shadow-xs' 
                  : 'bg-white text-[#737A86] border-[#E2E8F0] hover:bg-slate-50'
              }`}
            >
              {filter === 'all' ? 'All status' : filter}
            </button>
          ))}
        </div>

        {/* Mobile Filter toggle trigger */}
        <button
          onClick={() => {
            setSelectedMobileStatus(statusFilter);
            setMobileFilterOpen(true);
          }}
          className="sm:hidden flex items-center justify-center gap-1.5 px-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-black text-[#171A1F] cursor-pointer"
        >
          <Filter size={13} className="text-[#737A86]" />
          <span>Filter ▾</span>
        </button>
      </div>

      {/* MAIN DATA BLOCK */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-3xs overflow-hidden min-h-[340px] flex flex-col justify-between">
        
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2 text-[#737A86] select-none">
            <Loader2 className="w-8 h-8 animate-spin text-[#76C442]" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading estimates directory...</span>
          </div>
        ) : error ? (
          <div className="py-24 text-center text-red-600 flex flex-col items-center justify-center gap-2">
            <AlertCircle size={28} />
            <span className="text-xs font-bold uppercase tracking-wider">{error}</span>
          </div>
        ) : estimates.length === 0 ? (
          /* EMPTY SEARCH AND TABLE STATES */
          <div className="flex flex-col items-center justify-center py-24 text-center px-4 select-none">
            <FileText className="w-12 h-12 text-[#E2E8F0] mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">
              {debouncedQuery.trim() ? 'No estimates found' : 'No estimates yet'}
            </h3>
            <p className="text-xs text-[#737A86] max-w-xs mt-1 font-semibold">
              {debouncedQuery.trim() 
                ? 'Try another name, email address, or estimate number.' 
                : 'Create your first estimate to start building your sales pipeline.'
              }
            </p>
            {!debouncedQuery.trim() && (
              <Link
                to="/estimates/new"
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] rounded-lg text-xs font-black shadow-xs transition-colors border-none"
              >
                <Plus size={13} className="stroke-[3]" />
                <span>Create Estimate</span>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* DESKTOP / TABLET VIEWPORTS TABLE */}
            <div className="hidden md:block overflow-x-auto relative">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#151A2D] text-white border-b border-[#111624] text-[10px] font-black uppercase tracking-wider select-none">
                    <th className="px-5 py-3.5 pl-6">Estimate</th>
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5">Service</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Total</th>
                    <th className="px-5 py-3.5">Valid Until</th>
                    <th className="px-5 py-3.5 text-right pr-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {estimates.map((est) => {
                    const expiry = getExpiryDetails(est.created_at, est.status);
                    
                    return (
                      <tr key={est.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* 5. ESTIMATE ID COLUMN */}
                        <td className="px-5 py-3.5 pl-6">
                          <Link 
                            to={`/estimates/${est.id}`}
                            className="text-xs font-black text-[#151A2D] hover:text-[#76C442] hover:underline"
                          >
                            {est.estimate_number}
                          </Link>
                          <div className="text-[9px] text-[#737A86] font-semibold mt-0.5">
                            Created {new Date(est.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </td>

                        {/* 6. CUSTOMER COLUMN */}
                        <td className="px-5 py-3.5">
                          <div className="text-xs font-bold text-[#151A2D]">{est.customer_name}</div>
                          <div className="text-[9.5px] text-[#737A86] font-semibold mt-0.5">{est.customer_email}</div>
                        </td>

                        {/* 7. SERVICE COLUMN */}
                        <td className="px-5 py-3.5 text-xs text-[#171A1F] font-bold">
                          {est.insulation_type || 'Attic Insulation'}
                        </td>

                        {/* DATE COLUMN */}
                        <td className="px-5 py-3.5 text-xs text-[#737A86] font-medium">
                          {new Date(est.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>

                        {/* 8. STATUS DESIGN */}
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-0.5 border rounded-lg text-[9px] font-black uppercase tracking-wider ${getStatusStyle(est.status)}`}>
                            {est.status}
                          </span>
                        </td>

                        {/* 9. QUOTE TOTAL */}
                        <td className="px-5 py-3.5 font-black text-xs text-[#151A2D]">
                          ${Number(est.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* 10. VALID UNTIL */}
                        <td className="px-5 py-3.5 text-xs">
                          <span className={expiry.style}>{expiry.text}</span>
                        </td>

                        {/* 11. ACTIONS ROW */}
                        <td className="px-5 py-3.5 pr-6 text-right relative">
                          <div className="flex items-center justify-end gap-3 select-none">
                            {est.status === 'Approved' ? (
                              <button 
                                onClick={(e) => handleOpenConversion(e, est)}
                                className="px-3.5 py-1 bg-[#76C442]/10 hover:bg-[#76C442] hover:text-[#151A2D] text-[#76C442] border border-[#76C442]/20 text-[9.5px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer min-h-[28px]"
                              >
                                Convert to Job →
                              </button>
                            ) : (
                              <Link 
                                to={`/estimates/${est.id}`}
                                className="px-3 py-1 border border-[#E6E8EC] bg-white hover:bg-slate-50 text-[#171A1F] text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                              >
                                View →
                              </Link>
                            )}

                            {/* Dropdown Menu clicker */}
                            <div className="relative inline-block text-left" ref={menuRef}>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === est.id ? null : est.id);
                                }}
                                className="p-1 border border-transparent rounded-lg text-[#737A86] hover:bg-slate-100 hover:text-[#171A1F] cursor-pointer"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {activeMenuId === est.id && (
                                <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white border border-[#E2E8F0] shadow-xl z-20 overflow-hidden text-left py-1">
                                  <Link 
                                    to={`/estimates/${est.id}`}
                                    className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-bold text-[#1E293B] block select-none border-none bg-transparent"
                                  >
                                    View Estimate
                                  </Link>
                                  <Link 
                                    to={`/estimates/${est.id}`}
                                    className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-bold text-[#1E293B] block select-none border-none bg-transparent"
                                  >
                                    Edit
                                  </Link>
                                  <button 
                                    onClick={(e) => handleSendToCustomer(e, est)}
                                    className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-bold text-[#1E293B] text-left block select-none border-none bg-transparent cursor-pointer"
                                  >
                                    Send to Customer
                                  </button>
                                  <button 
                                    onClick={(e) => handleDuplicate(e, est)}
                                    className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-bold text-[#1E293B] text-left block select-none border-none bg-transparent cursor-pointer"
                                  >
                                    Duplicate
                                  </button>
                                  {est.status === 'Approved' && (
                                    <button 
                                      onClick={(e) => handleOpenConversion(e, est)}
                                      className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-black text-[#76C442] text-left block select-none border-none bg-transparent cursor-pointer"
                                    >
                                      Convert to Job
                                    </button>
                                  )}
                                  <div className="border-t border-[#E2E8F0] my-0.5" />
                                  <button 
                                    onClick={(e) => handleDelete(e, est.id, est.estimate_number)}
                                    className="w-full px-4 py-2 hover:bg-red-50 text-xs font-bold text-red-600 text-left block select-none border-none bg-transparent cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* FEATURE 18 — MOBILE VIEWPORTS RESPONSIVE CARDS */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {estimates.map((est) => {
                const expiry = getExpiryDetails(est.created_at, est.status);
                
                return (
                  <div key={`mob-est-${est.id}`} className="p-4 space-y-3 hover:bg-slate-50 transition-all select-none">
                    <div className="flex items-center justify-between">
                      <Link 
                        to={`/estimates/${est.id}`}
                        className="text-xs font-black text-[#151A2D] hover:underline"
                      >
                        {est.estimate_number}
                      </Link>
                      
                      <span className={`px-2.5 py-0.5 border rounded-lg text-[9px] font-black uppercase tracking-wider ${getStatusStyle(est.status)}`}>
                        {est.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#737A86] font-semibold">Customer:</span>
                        <span className="font-bold text-[#151A2D]">{est.customer_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#737A86] font-semibold">Service:</span>
                        <span className="font-bold text-[#171A1F]">{est.insulation_type || 'Attic Insulation'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#737A86] font-semibold">Total:</span>
                        <span className="font-black text-[#151A2D]">
                          ${Number(est.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10.5px]">
                        <span className="text-[#737A86] font-semibold">Date:</span>
                        <span className="text-[#737A86] font-bold">
                          {new Date(est.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10.5px]">
                        <span className="text-[#737A86] font-semibold">Valid until:</span>
                        <span className={expiry.style}>{expiry.text}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]/60">
                      {est.status === 'Approved' ? (
                        <button 
                          onClick={(e) => handleOpenConversion(e, est)}
                          className="px-4 py-1.5 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-[10px] font-black uppercase tracking-wider rounded-lg border-none cursor-pointer"
                        >
                          Convert to Job →
                        </button>
                      ) : (
                        <Link 
                          to={`/estimates/${est.id}`}
                          className="px-4 py-1.5 border border-[#E6E8EC] bg-white text-[#171A1F] text-[10px] font-black rounded-lg text-center"
                        >
                          View Estimate →
                        </Link>
                      )}

                      {/* Mobile ⋯ Actions menu */}
                      <div className="relative inline-block text-left" ref={menuRef}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === est.id ? null : est.id);
                          }}
                          className="p-1.5 border border-[#E2E8F0] rounded-lg text-[#737A86] bg-white cursor-pointer"
                        >
                          <MoreVertical size={14} />
                        </button>
                        
                        {activeMenuId === est.id && (
                          <div className="absolute right-0 mt-1 w-40 rounded-xl bg-white border border-[#E2E8F0] shadow-xl z-20 overflow-hidden text-left py-1">
                            <button 
                              onClick={(e) => handleSendToCustomer(e, est)}
                              className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-bold text-[#1E293B] text-left block select-none border-none bg-transparent cursor-pointer"
                            >
                              Send to Customer
                            </button>
                            <button 
                              onClick={(e) => handleDuplicate(e, est)}
                              className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-bold text-[#1E293B] text-left block select-none border-none bg-transparent cursor-pointer"
                            >
                              Duplicate
                            </button>
                            <button 
                              onClick={(e) => handleDelete(e, est.id, est.estimate_number)}
                              className="w-full px-4 py-2 hover:bg-red-50 text-xs font-bold text-red-650 text-left block select-none border-none bg-transparent cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* PAGINATION PANEL */}
        {!loading && !error && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between bg-slate-50/20 select-none">
            <span className="text-[10.5px] text-[#737A86] font-bold uppercase tracking-wider">
              Page {currentPage} of {totalPages} ({totalCount} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="px-3.5 py-1.5 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="px-3.5 py-1.5 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FEATURE 12 — APPROVED ESTIMATE → JOB CONVERSION DIALOG MODAL */}
      {conversionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs" 
            onClick={() => { if (!isConverting) setConversionTarget(null); }}
          />

          {/* Modal Container */}
          <div className="relative bg-white w-full max-w-sm mx-4 rounded-xl shadow-2xl overflow-hidden border border-[#E7E9ED] z-10 flex flex-col p-5 space-y-4 animate-scale-up">
            
            <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E2E8F0] pb-2 m-0 select-none">
              Create Job from {conversionTarget.estimate_number}?
            </h3>

            {convertedJobInfo ? (
              <div className="space-y-3 py-2 text-center select-none">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                  <Check size={22} className="stroke-[3]" />
                </div>
                <div className="text-xs font-bold text-[#151A2D]">
                  Job Created Successfully!
                </div>
                <Link
                  to={`/jobs/${convertedJobInfo.id}`}
                  onClick={() => setConversionTarget(null)}
                  className="inline-flex items-center gap-1 text-xs font-black text-[#76C442] hover:underline"
                >
                  <span>JOB-{convertedJobInfo.jobNumber}</span>
                  <ArrowRight size={13} className="stroke-[2.5]" />
                  <span>View Job →</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#737A86] font-semibold">Customer:</span>
                  <span className="font-bold text-[#151A2D]">{conversionTarget.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#737A86] font-semibold">Service:</span>
                  <span className="font-bold text-[#171A1F]">{conversionTarget.insulation_type || 'Attic Insulation'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#737A86] font-semibold">Estimate Total:</span>
                  <span className="font-black text-[#151A2D]">
                    ${Number(conversionTarget.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 select-none border-t border-[#E2E8F0]/60">
              {convertedJobInfo ? (
                <button
                  onClick={() => setConversionTarget(null)}
                  className="px-4 py-2 bg-[#151A2D] text-white text-xs font-bold rounded-lg cursor-pointer min-h-[36px] border-none"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    disabled={isConverting}
                    onClick={() => setConversionTarget(null)}
                    className="px-4 py-2 border border-[#E6E8EC] hover:bg-slate-50 text-[#737A86] text-xs font-bold rounded-lg cursor-pointer min-h-[36px] disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isConverting}
                    onClick={executeJobConversion}
                    className="px-4 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-lg cursor-pointer min-h-[36px] flex items-center gap-1.5 border-none"
                  >
                    {isConverting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>Create Job</span>
                    )}
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* FEATURE 19 — MOBILE FILTER BOTTOM SHEET */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center font-sans">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs" 
            onClick={() => setMobileFilterOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative bg-white w-full rounded-t-2xl shadow-2xl p-5 space-y-4 z-10 text-left border-t border-[#E7E9ED] animate-slide-up">
            
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
              <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">Filter Estimates</h3>
              <button 
                onClick={() => setMobileFilterOpen(false)}
                className="text-[#737A86] hover:text-[#171A1F] border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5 select-none">
              <label className="text-[10px] font-bold text-[#737A86] uppercase">Filter by Status</label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {STATUS_OPTIONS.map(status => (
                  <button
                    key={`mob-filter-${status}`}
                    onClick={() => setSelectedMobileStatus(status)}
                    className={`px-2 py-2 border rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                      selectedMobileStatus === status
                        ? 'bg-[#151A2D] text-white border-[#151A2D]'
                        : 'bg-white text-[#737A86] border-[#E2E8F0]'
                    }`}
                  >
                    {status === 'all' ? 'All' : status}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-[#E2E8F0] select-none">
              <button
                onClick={() => {
                  setSelectedMobileStatus('all');
                }}
                className="flex-grow py-2.5 border border-[#E2E8F0] hover:bg-slate-50 text-[#737A86] text-xs font-bold rounded-lg cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={handleApplyMobileFilter}
                className="flex-grow py-2.5 bg-[#151A2D] text-white text-xs font-black rounded-lg border-none cursor-pointer"
              >
                Apply Filters
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
