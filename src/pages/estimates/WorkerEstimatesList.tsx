import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { 
  Search, Loader2, FileText, Send, CheckCircle2,
  MoreVertical, Briefcase, Plus, Filter
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
  home_size?: number;
  existing_r_value?: number;
  target_r_value?: number;
  scope_of_work?: string;
  materials?: any;
}

interface Stats {
  total: number;
  draft: number;
  sent: number;
  approved: number;
}

const STATUS_OPTIONS = ['all', 'Draft', 'Sent', 'Approved', 'Rejected', 'Expired'];

export const WorkerEstimatesList: React.FC = () => {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [stats, setStats] = useState<Stats>({ total: 0, draft: 0, sent: 0, approved: 0 });
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  
  const [isConverting, setIsConverting] = useState(false);

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

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('estimates').select('*');

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (debouncedQuery.trim()) {
        const queryTerm = debouncedQuery.trim();
        query = query.or(`estimate_number.ilike.%${queryTerm}%,customer_name.ilike.%${queryTerm}%,insulation_type.ilike.%${queryTerm}%`);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      setEstimates(data || []);

      // Fetch global stats for this user
      const { data: allData } = await supabase.from('estimates').select('status');
      if (allData) {
        setStats({
          total: allData.length,
          draft: allData.filter(e => e.status === 'Draft').length,
          sent: allData.filter(e => e.status === 'Sent').length,
          approved: allData.filter(e => e.status === 'Approved').length,
        });
      }
    } catch (err: any) {
      console.error('Failed to load estimates:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]';
      case 'Sent': return 'bg-[#EFF6FF] text-[#3B82F6] border-[#BFDBFE]';
      case 'Approved': return 'bg-[#ECFDF5] text-[#10B981] border-[#A7F3D0]';
      case 'Rejected': return 'bg-[#FEF2F2] text-[#EF4444] border-[#FECACA]';
      case 'Expired': return 'bg-[#FFF7ED] text-[#F97316] border-[#FFEDD5]';
      default: return 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]';
    }
  };

  const handleCreateJob = async (estimate: Estimate) => {
    try {
      setIsConverting(true);
      
      const { data: latestJob } = await supabase
        .from('jobs')
        .select('job_number')
        .order('job_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextJobNumber = latestJob ? latestJob.job_number + 1 : 1000;

      const newJob = {
        customer_id: estimate.customer_id,
        job_number: nextJobNumber,
        status: 'Quoted',
        attic_sqft: estimate.home_size || null,
        existing_r_value: estimate.existing_r_value || null,
        target_r_value: estimate.target_r_value || null,
        scope_of_work: estimate.scope_of_work || estimate.insulation_type || null,
        quoted_amount: estimate.total_amount,
        materials_used: estimate.materials ? JSON.stringify(estimate.materials) : null,
      };

      const { data: job, error: insertErr } = await supabase
        .from('jobs')
        .insert([newJob])
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      // Mark estimate as converted
      await supabase.from('estimates').update({ status: 'Converted' }).eq('id', estimate.id);
      
      navigate(`/jobs/${job.id}`);
    } catch (err: any) {
      console.error('Job conversion error:', err);
      alert('Failed to convert estimate to job: ' + err.message);
    } finally {
      setIsConverting(false);
      setActiveMenuId(null);
    }
  };

  return (
    <div className="bg-[#F8FAFC] min-h-screen pb-20 font-sans text-[#151A2D]">
      
      {/* HEADER */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 py-6 md:px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#151A2D]">Estimates</h1>
            <p className="text-sm font-semibold text-[#64748B] mt-1">View estimates and track their status.</p>
          </div>
          <Link 
            to="/estimates/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] rounded-xl text-sm font-bold transition-colors border border-[#CBD5E1]"
          >
            <Plus size={16} /> New Estimate
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        
        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] text-[#64748B] flex items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
            <div>
              <div className="text-[10px] font-black text-[#94A3B8] tracking-wider uppercase mb-0.5">Total</div>
              <div className="text-2xl font-black text-[#151A2D] leading-none">{stats.total}</div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#94A3B8] flex items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
            <div>
              <div className="text-[10px] font-black text-[#94A3B8] tracking-wider uppercase mb-0.5">Draft</div>
              <div className="text-2xl font-black text-[#151A2D] leading-none">{stats.draft}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center shrink-0">
              <Send size={24} />
            </div>
            <div>
              <div className="text-[10px] font-black text-[#94A3B8] tracking-wider uppercase mb-0.5">Sent</div>
              <div className="text-2xl font-black text-[#151A2D] leading-none">{stats.sent}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="text-[10px] font-black text-[#94A3B8] tracking-wider uppercase mb-0.5">Approved</div>
              <div className="text-2xl font-black text-[#151A2D] leading-none">{stats.approved}</div>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative w-full md:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-[#94A3B8]" />
            </div>
            <input
              type="text"
              placeholder="Search by estimate #, customer, service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 border border-[#CBD5E1] rounded-xl text-sm font-semibold text-[#151A2D] focus:ring-2 focus:ring-[#7CC242]/20 focus:border-[#7CC242] transition-colors"
            />
          </div>

          {/* Desktop Tabs */}
          <div className="hidden md:flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${
                  statusFilter === status 
                    ? 'bg-[#7CC242] text-white border-[#7CC242]' 
                    : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:border-[#CBD5E1]'
                }`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>
          
          {/* Mobile Filter Button */}
          <button 
            className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 border border-[#CBD5E1] rounded-xl font-bold text-sm text-[#475569]"
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
          >
            <Filter size={16} /> Filters
          </button>
        </div>
        
        {/* Mobile Filter Sheet */}
        {mobileFilterOpen && (
          <div className="md:hidden bg-white p-4 rounded-2xl border border-[#E2E8F0] mb-6 shadow-sm flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(status => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setMobileFilterOpen(false);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${
                  statusFilter === status 
                    ? 'bg-[#7CC242] text-white border-[#7CC242]' 
                    : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                }`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>
        )}

        {/* ESTIMATES LIST */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-[#7CC242]" /></div>
        ) : estimates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] border-dashed p-12 text-center">
            <FileText size={48} className="mx-auto text-[#CBD5E1] mb-4" />
            <h3 className="text-lg font-black text-[#151A2D] mb-2">No estimates found</h3>
            <p className="text-sm font-semibold text-[#64748B]">
              {searchQuery || statusFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Estimates assigned to you will appear here.'}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <button 
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                className="mt-4 px-4 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#151A2D] rounded-xl text-sm font-bold transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-5 py-4 font-black text-[#94A3B8] text-[10px] tracking-wider uppercase">Estimate</th>
                    <th className="px-5 py-4 font-black text-[#94A3B8] text-[10px] tracking-wider uppercase">Customer</th>
                    <th className="px-5 py-4 font-black text-[#94A3B8] text-[10px] tracking-wider uppercase">Service</th>
                    <th className="px-5 py-4 font-black text-[#94A3B8] text-[10px] tracking-wider uppercase">Status</th>
                    <th className="px-5 py-4 font-black text-[#94A3B8] text-[10px] tracking-wider uppercase">Total</th>
                    <th className="px-5 py-4 font-black text-[#94A3B8] text-[10px] tracking-wider uppercase">Date</th>
                    <th className="px-5 py-4 font-black text-[#94A3B8] text-[10px] tracking-wider uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {estimates.map(est => {
                    const dateStr = new Date(est.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <tr key={est.id} className="hover:bg-[#F8FAFC] transition-colors group">
                        <td className="px-5 py-4">
                          <div className="font-bold text-[#151A2D]">{est.estimate_number}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-[#151A2D]">{est.customer_name}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-[#64748B]">{est.insulation_type || 'General'}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${getStatusColor(est.status)}`}>
                            {est.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-black text-[#151A2D]">${est.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-[#64748B]">{dateStr}</div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link 
                              to={`/estimates/${est.id}`}
                              className="px-3 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#151A2D] rounded-lg text-xs font-bold transition-colors"
                            >
                              View &rarr;
                            </Link>
                            
                            <div className="relative" ref={activeMenuId === est.id ? menuRef : null}>
                              <button 
                                onClick={() => setActiveMenuId(activeMenuId === est.id ? null : est.id)}
                                className="p-1.5 text-[#94A3B8] hover:text-[#151A2D] rounded-lg hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                              >
                                <MoreVertical size={16} />
                              </button>
                              
                              {activeMenuId === est.id && (
                                <div className="absolute right-0 mt-1 w-48 bg-white border border-[#E2E8F0] shadow-xl rounded-xl py-1 z-50">
                                  <Link to={`/estimates/${est.id}`} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC]">
                                    <FileText size={14} /> View Estimate
                                  </Link>
                                  {est.status === 'Approved' && (
                                    <button 
                                      onClick={() => handleCreateJob(est)}
                                      disabled={isConverting}
                                      className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm font-bold text-[#7CC242] hover:bg-[#F7FCEB]"
                                    >
                                      <Briefcase size={14} /> Create Job
                                    </button>
                                  )}
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

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {estimates.map(est => {
                const dateStr = new Date(est.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div key={est.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm flex flex-col gap-3 relative">
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-black text-[#151A2D] text-lg">{est.estimate_number}</div>
                        <div className="text-xs font-semibold text-[#64748B] mt-0.5">Created {dateStr}</div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${getStatusColor(est.status)}`}>
                        {est.status}
                      </span>
                    </div>

                    <div className="border-y border-[#E2E8F0] py-3 my-1">
                      <div className="font-bold text-[#151A2D] mb-1">{est.customer_name}</div>
                      <div className="text-sm font-semibold text-[#64748B]">{est.insulation_type || 'General Service'}</div>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <div className="font-black text-[#151A2D] text-xl">
                        ${est.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </div>
                      <Link 
                        to={`/estimates/${est.id}`}
                        className="px-4 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#151A2D] rounded-xl text-xs font-bold transition-colors uppercase tracking-wide"
                      >
                        View &rarr;
                      </Link>
                    </div>

                    {est.status === 'Approved' && (
                      <button 
                        onClick={() => handleCreateJob(est)}
                        disabled={isConverting}
                        className="w-full mt-2 py-2.5 bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#10B981] border border-[#A7F3D0] rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Briefcase size={16} /> Create Job
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
