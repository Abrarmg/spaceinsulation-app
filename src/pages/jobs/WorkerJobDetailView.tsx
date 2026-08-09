import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { JobPhotos } from '../../components/JobPhotos';
import { SignatureModal } from '../../components/SignatureModal';
import { 
  ArrowLeft, Loader2, Calendar, MapPin, AlertCircle, CheckCircle2,
  Phone, Mail, Navigation, Wrench, FileText, Check, Trash2, Camera, User, Clock, Package, XCircle
} from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  service_address: string;
}

interface Profile {
  full_name: string;
}

interface Job {
  id: string;
  customer_id: string;
  job_number: number;
  status: string;
  scheduled_date: string | null;
  assigned_worker_id: string | null;
  attic_sqft: number | null;
  existing_r_value: number | null;
  target_r_value: number | null;
  scope_of_work: string | null;
  created_at: string;
  customers: Customer | null;
  profiles: Profile | null;
  customer_signature_url: string | null;
  signed_at: string | null;
  checklist: Record<string, boolean> | null;
  materials_used: string | null;
}

const CHECKLIST_ITEMS = [
  'Air Sealing',
  'R38 Blown In',
  'Hatch Insulation',
  'Baffle Installation'
];

export const WorkerJobDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');
  const [issueType, setIssueType] = useState('Customer unavailable');
  const [isReportingIssue, setIsReportingIssue] = useState(false);
  
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [materials, setMaterials] = useState<{name: string, quantity: string, unit: string}[]>([]);
  const [isSavingMaterials, setIsSavingMaterials] = useState(false);
  const [completedValidationError, setCompletedValidationError] = useState<any>(null);

  const fetchJobDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('jobs')
        .select('*, customers(*), profiles(full_name)')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!data) throw new Error('Work order not found.');

      setJob(data as any);
      
      try {
        if (data.materials_used) {
          const parsed = JSON.parse(data.materials_used);
          setMaterials(Array.isArray(parsed) ? parsed : []);
        }
      } catch (e) {
        setMaterials([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load job details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJobDetails();
  }, [fetchJobDetails]);

  const handleStatusChange = async (newStatus: string) => {
    if (!job) return;
    setIsUpdatingStatus(true);
    setCompletedValidationError(null);

    try {
      if (newStatus === 'Completed') {
        const { count } = await supabase
          .from('job_media')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.id)
          .eq('category', 'after');

        const missingPhoto = count === 0;
        const missingSignature = !job.customer_signature_url;
        const checklistCount = CHECKLIST_ITEMS.filter(item => job.checklist?.[item]).length;
        const missingChecklist = checklistCount < CHECKLIST_ITEMS.length;

        if (missingPhoto || missingSignature || missingChecklist) {
          setCompletedValidationError({ missingPhoto, missingSignature, missingChecklist });
          setIsUpdatingStatus(false);
          return;
        }

        const confirm = window.confirm('Are you sure you want to mark this job as COMPLETED?');
        if (!confirm) {
          setIsUpdatingStatus(false);
          return;
        }
      }

      const { error: updateErr } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', job.id);

      if (updateErr) throw updateErr;
      await fetchJobDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to update job status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleToggleChecklist = async (item: string) => {
    if (!job) return;
    const current = job.checklist || {};
    const updated = { ...current, [item]: !current[item] };
    
    // Optimistic update
    setJob({ ...job, checklist: updated });

    try {
      await supabase.from('jobs').update({ checklist: updated }).eq('id', job.id);
    } catch (err) {
      // Revert on error
      setJob({ ...job, checklist: current });
      console.error('Failed to update checklist', err);
    }
  };

  const handleAddMaterial = () => {
    setMaterials([...materials, { name: '', quantity: '', unit: '' }]);
  };

  const handleUpdateMaterial = (index: number, field: string, value: string) => {
    const newMaterials = [...materials];
    newMaterials[index] = { ...newMaterials[index], [field]: value };
    setMaterials(newMaterials);
  };

  const handleRemoveMaterial = (index: number) => {
    const newMaterials = [...materials];
    newMaterials.splice(index, 1);
    setMaterials(newMaterials);
  };

  const handleSaveMaterials = async () => {
    if (!job) return;
    setIsSavingMaterials(true);
    try {
      // Clean up empty rows
      const cleaned = materials.filter(m => m.name.trim() !== '');
      const { error } = await supabase
        .from('jobs')
        .update({ materials_used: JSON.stringify(cleaned) })
        .eq('id', job.id);

      if (error) throw error;
      setMaterials(cleaned);
      alert('Materials saved successfully');
    } catch (err: any) {
      alert('Failed to save materials: ' + err.message);
    } finally {
      setIsSavingMaterials(false);
    }
  };

  const handleReportIssue = async () => {
    if (!job) return;
    setIsReportingIssue(true);
    try {
      const fullIssue = `[${issueType}] ${issueDescription}`;
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'Hold - Issue', scope_of_work: (job.scope_of_work || '') + `\n\n[ISSUE REPORTED]: ${fullIssue}` })
        .eq('id', job.id);

      if (error) throw error;
      setIsIssueModalOpen(false);
      setIssueDescription('');
      await fetchJobDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to report issue.');
    } finally {
      setIsReportingIssue(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[#7CC242]" size={32} /></div>;
  if (error || !job) return <div className="p-8 text-center text-red-600 font-bold">{error || 'Not found'}</div>;

  const dateStr = job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unscheduled';
  const timeStr = job.scheduled_date ? new Date(job.scheduled_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Time not specified';

  const checklistCount = CHECKLIST_ITEMS.filter(item => job.checklist?.[item]).length;
  const checklistProgress = Math.round((checklistCount / CHECKLIST_ITEMS.length) * 100);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Quoted': return 'bg-purple-100 text-purple-700';
      case 'Scheduled': return 'bg-blue-100 text-blue-700';
      case 'In Progress': return 'bg-green-100 text-green-700';
      case 'Completed': return 'bg-green-600 text-white';
      case 'Cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-orange-100 text-orange-700';
    }
  };

  return (
    <div className="bg-[#F8FAFC] min-h-screen pb-24 font-sans text-[#151A2D]">
      {/* 1. Job Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 py-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <Link to="/worker-dashboard" className="inline-flex items-center text-[#64748B] hover:text-[#151A2D] text-xs font-bold transition-colors mb-4">
            <ArrowLeft size={16} className="mr-1" />
            Back to My Jobs
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-xs font-black text-[#94A3B8] tracking-wider uppercase mb-1">JOB-{job.job_number}</div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">{job.customers?.full_name || 'Unknown Customer'}</h1>
              <div className="flex items-center gap-2 mt-2 text-[#64748B] text-sm font-semibold">
                <span>Scheduled &middot; {dateStr}</span>
                <div className="relative">
                  <select
                    value={job.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={isUpdatingStatus}
                    className={`appearance-none px-2.5 py-1 pr-6 rounded-md text-[10px] font-black uppercase tracking-wider cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#7CC242]/50 ${getStatusColor(job.status)} disabled:opacity-50`}
                  >
                    <option value="Quoted">Quoted</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Hold - Issue">Hold - Issue</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 opacity-50">
                    <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
                {isUpdatingStatus && <Loader2 size={14} className="animate-spin text-[#94A3B8]" />}
              </div>
            </div>
            
            <button 
              onClick={() => setIsIssueModalOpen(true)}
              className="md:self-end flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors"
            >
              <AlertCircle size={16} />
              Report a Problem
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-between max-w-lg overflow-x-auto gap-2 pb-2 scrollbar-hide">
            {['Scheduled', 'In Progress', 'Completed'].map((step, idx, arr) => {
              let isPast = false;
              let isCurrent = false;
              if (job.status === 'Completed') {
                isPast = true;
                if (step === 'Completed') isCurrent = true;
              } else if (job.status === 'In Progress') {
                if (step === 'Scheduled') isPast = true;
                if (step === 'In Progress') isCurrent = true;
              } else {
                if (step === 'Scheduled') isCurrent = true;
              }

              return (
                <div key={step} className="flex items-center gap-2 shrink-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                    isCurrent ? 'bg-[#7CC242] text-white' : 
                    isPast ? 'bg-[#ECFDF5] text-[#10B981]' : 'bg-[#F1F5F9] text-[#94A3B8]'
                  }`}>
                    {isPast && !isCurrent && <CheckCircle2 size={14} />}
                    {step}
                  </div>
                  {idx < arr.length - 1 && (
                    <div className="w-4 h-[2px] bg-[#E2E8F0] shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT / MAIN COLUMN */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          
          {/* Photos */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden" id="job-photos-section">
            <div className="p-4 md:p-5 border-b border-[#E2E8F0]">
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <Camera className="text-[#94A3B8]" size={20} />
                Job Photos & Files
              </h2>
            </div>
            {/* The existing JobPhotos component is complex, so we will use it but we'd normally wrap it or modify it. 
                For now, we'll render it inside a clean container. */}
            <div className="p-0">
              <JobPhotos jobId={job.id} />
            </div>
          </div>

          {/* Scope of Work */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-5">
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2 mb-4">
              <FileText className="text-[#94A3B8]" size={20} />
              Scope of Work
            </h2>
            <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0] whitespace-pre-wrap text-sm text-[#475569] font-medium leading-relaxed">
              {job.scope_of_work || 'No specific scope of work provided.'}
            </div>
          </div>

          {/* Operational Checklist */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <CheckCircle2 className="text-[#94A3B8]" size={20} />
                Operational Checklist
              </h2>
              <div className="text-xs font-bold text-[#64748B]">
                {checklistCount} of {CHECKLIST_ITEMS.length} completed
              </div>
            </div>
            
            <div className="w-full bg-[#F1F5F9] rounded-full h-2.5 mb-5 overflow-hidden">
              <div className="bg-[#7CC242] h-2.5 rounded-full transition-all duration-500" style={{ width: `${checklistProgress}%` }}></div>
            </div>

            <div className="space-y-2">
              {CHECKLIST_ITEMS.map(item => {
                const isChecked = job.checklist?.[item] || false;
                return (
                  <button
                    key={item}
                    onClick={() => handleToggleChecklist(item)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors cursor-pointer text-left ${
                      isChecked 
                        ? 'border-[#7CC242] bg-[#F7FCEB]' 
                        : 'border-[#E2E8F0] hover:border-[#CBD5E1] bg-white'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                      isChecked ? 'bg-[#7CC242] border-[#7CC242]' : 'border-[#CBD5E1]'
                    }`}>
                      {isChecked && <Check size={14} className="text-white" />}
                    </div>
                    <span className={`text-sm font-bold ${isChecked ? 'text-[#151A2D]' : 'text-[#475569]'}`}>
                      {item}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Materials Used */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-5">
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2 mb-4">
              <Package className="text-[#94A3B8]" size={20} />
              Materials Used
            </h2>
            
            {materials.length === 0 ? (
              <div className="text-center p-8 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] border-dashed">
                <Package className="mx-auto text-[#CBD5E1] mb-2" size={32} />
                <p className="text-sm font-semibold text-[#64748B]">No materials recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {materials.map((mat, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0]">
                    <input 
                      type="text" 
                      placeholder="Material (e.g. Cellulose)"
                      value={mat.name}
                      onChange={(e) => handleUpdateMaterial(idx, 'name', e.target.value)}
                      className="flex-1 min-w-[100px] p-2.5 rounded-lg border border-[#CBD5E1] text-sm font-semibold focus:outline-none focus:border-[#7CC242]"
                    />
                    <input 
                      type="text" 
                      placeholder="Qty"
                      value={mat.quantity}
                      onChange={(e) => handleUpdateMaterial(idx, 'quantity', e.target.value)}
                      className="w-16 md:w-20 p-2.5 rounded-lg border border-[#CBD5E1] text-sm font-semibold focus:outline-none focus:border-[#7CC242]"
                    />
                    <input 
                      type="text" 
                      placeholder="Unit"
                      value={mat.unit}
                      onChange={(e) => handleUpdateMaterial(idx, 'unit', e.target.value)}
                      className="w-20 md:w-24 p-2.5 rounded-lg border border-[#CBD5E1] text-sm font-semibold focus:outline-none focus:border-[#7CC242]"
                    />
                    <button 
                      onClick={() => handleRemoveMaterial(idx)}
                      className="p-2.5 text-[#94A3B8] hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-[#E2E8F0]">
              <button 
                onClick={handleAddMaterial}
                className="flex-1 py-3 px-4 border-2 border-dashed border-[#CBD5E1] hover:border-[#7CC242] text-[#64748B] hover:text-[#7CC242] font-bold rounded-xl text-sm transition-colors cursor-pointer"
              >
                + Add Material
              </button>
              {(materials.length > 0 || (job.materials_used && job.materials_used !== '[]')) && (
                <button 
                  onClick={handleSaveMaterials}
                  disabled={isSavingMaterials}
                  className="flex-1 py-3 px-4 bg-[#151A2D] hover:bg-[#2A3441] text-white font-bold rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center"
                >
                  {isSavingMaterials ? <Loader2 size={18} className="animate-spin" /> : 'Save Materials'}
                </button>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT / SIDEBAR */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          
          {/* Client & Location */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-5">
            <h2 className="text-[10px] font-black text-[#94A3B8] tracking-wider uppercase mb-3">Client Information</h2>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#475569]">
                <User size={20} />
              </div>
              <div>
                <div className="font-bold text-[#151A2D]">{job.customers?.full_name}</div>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              {job.customers?.phone && (
                <a href={`tel:${job.customers.phone}`} className="flex items-center gap-3 text-[#475569] hover:text-[#7CC242] transition-colors">
                  <Phone size={16} className="text-[#94A3B8]" />
                  <span className="text-sm font-semibold">{job.customers.phone}</span>
                </a>
              )}
              {job.customers?.email && (
                <a href={`mailto:${job.customers.email}`} className="flex items-center gap-3 text-[#475569] hover:text-[#7CC242] transition-colors">
                  <Mail size={16} className="text-[#94A3B8]" />
                  <span className="text-sm font-semibold truncate">{job.customers.email}</span>
                </a>
              )}
            </div>

            <div className="pt-4 border-t border-[#E2E8F0]">
              <h2 className="text-[10px] font-black text-[#94A3B8] tracking-wider uppercase mb-2">Service Location</h2>
              <div className="flex items-start gap-2 text-[#151A2D] font-bold text-sm mb-4">
                <MapPin size={18} className="shrink-0 text-[#7CC242] mt-0.5" />
                <span>{job.customers?.service_address}</span>
              </div>
              
              <div className="flex gap-2">
                <a 
                  href={`https://maps.google.com/?q=${encodeURIComponent(job.customers?.service_address || '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#10B981] py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Navigation size={16} />
                  Get Directions
                </a>
                {job.customers?.phone && (
                  <a 
                    href={`tel:${job.customers.phone}`}
                    className="flex-1 bg-[#F8FAFC] hover:bg-[#E2E8F0] text-[#151A2D] py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Phone size={16} />
                    Call
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Insulation Specs */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-5">
            <h2 className="text-[10px] font-black text-[#94A3B8] tracking-wider uppercase mb-4">Insulation Specifications</h2>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <div className="text-[10px] font-black text-[#94A3B8] uppercase">Attic Size</div>
                <div className="text-xl font-black text-[#151A2D] mt-1">{job.attic_sqft || 0} <span className="text-xs text-[#64748B]">SQ FT</span></div>
              </div>
              
              <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <div className="text-[10px] font-black text-[#94A3B8] uppercase">Existing R</div>
                <div className="text-xl font-black text-[#151A2D] mt-1">R-{job.existing_r_value || 0}</div>
              </div>

              <div className="col-span-2 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-[#94A3B8] uppercase">Target R</div>
                  <div className="text-xl font-black text-[#151A2D] mt-1">R-{job.target_r_value || 0}</div>
                </div>
                {(job.target_r_value || 0) > (job.existing_r_value || 0) ? (
                  <div className="bg-[#7CC242]/10 text-[#7CC242] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                    <ArrowLeft size={14} className="rotate-90" /> Upgrade
                  </div>
                ) : (
                  <div className="text-xs font-bold text-[#64748B]">Target met</div>
                )}
              </div>
            </div>
          </div>

          {/* Scheduling & Crew */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-5">
            <h2 className="text-[10px] font-black text-[#94A3B8] tracking-wider uppercase mb-4">Scheduling & Crew</h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#64748B] shrink-0">
                  <Calendar size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-[#94A3B8] uppercase">Scheduled Date</div>
                  <div className="text-sm font-bold text-[#151A2D]">{dateStr}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#64748B] shrink-0">
                  <Clock size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-[#94A3B8] uppercase">Time</div>
                  <div className="text-sm font-bold text-[#151A2D]">{timeStr}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#64748B] shrink-0">
                  <Wrench size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-[#94A3B8] uppercase">Assigned Crew</div>
                  <div className="text-sm font-bold text-[#151A2D]">{job.profiles?.full_name || 'Unassigned'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Sign-Off */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-5">
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2 mb-4">
              <FileText className="text-[#94A3B8]" size={20} />
              Customer Sign-Off
            </h2>
            
            {job.customer_signature_url ? (
              <div className="bg-[#ECFDF5] rounded-xl border border-[#A7F3D0] p-4 text-center">
                <div className="flex justify-center mb-2">
                  <div className="w-10 h-10 bg-[#10B981] rounded-full flex items-center justify-center text-white">
                    <CheckCircle2 size={24} />
                  </div>
                </div>
                <h3 className="text-[#065F46] font-bold text-sm mb-1">Customer Signed</h3>
                <div className="text-xs text-[#047857] font-medium mb-3">
                  Signed on {job.signed_at ? new Date(job.signed_at).toLocaleString() : 'Unknown date'}
                </div>
                <div className="bg-white rounded-lg p-2 border border-[#A7F3D0] inline-block w-full max-w-[200px] mb-3">
                  <img src={job.customer_signature_url} alt="Customer Signature" className="h-16 object-contain mx-auto" />
                </div>
                <button
                  onClick={() => {
                    const confirm = window.confirm("Are you sure you want to replace this signature? This action cannot be undone.");
                    if (confirm) {
                      setIsSignatureModalOpen(true);
                    }
                  }}
                  className="w-full py-2 bg-[#D1FAE5] hover:bg-[#A7F3D0] text-[#065F46] font-bold rounded-xl transition-colors cursor-pointer text-sm"
                >
                  Capture New Signature
                </button>
              </div>
            ) : (
              <div className="bg-[#FFFBEB] rounded-xl border border-[#FDE68A] p-4 text-center">
                <AlertCircle size={24} className="text-[#D97706] mx-auto mb-2" />
                <h3 className="text-[#92400E] font-bold text-sm mb-1">Signature Required</h3>
                <p className="text-xs text-[#B45309] font-medium mb-4">
                  Customer approval is required before completing the job.
                </p>
                <button
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="w-full py-3 bg-[#D97706] hover:bg-[#B45309] text-white font-bold rounded-xl transition-colors cursor-pointer shadow-sm text-sm"
                >
                  Capture Signature
                </button>
              </div>
            )}
          </div>
          
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 md:hidden">
        <div className="flex gap-2 max-w-6xl mx-auto">
          {job.status === 'Scheduled' && (
            <button
              onClick={() => handleStatusChange('In Progress')}
              disabled={isUpdatingStatus}
              className="flex-1 bg-[#7CC242] hover:bg-[#6AB032] text-white py-3.5 rounded-xl font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUpdatingStatus ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Start Job</>}
            </button>
          )}
          
          {job.status === 'In Progress' && (
            <>
              <button
                onClick={() => handleStatusChange('Scheduled')}
                disabled={isUpdatingStatus}
                className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] text-[#475569] hover:bg-[#E2E8F0] py-3.5 rounded-xl font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUpdatingStatus ? <Loader2 size={18} className="animate-spin" /> : 'Pause'}
              </button>
              <button
                onClick={() => handleStatusChange('Completed')}
                disabled={isUpdatingStatus}
                className="flex-[2] bg-[#7CC242] hover:bg-[#6AB032] text-white py-3.5 rounded-xl font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUpdatingStatus ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Complete Job</>}
              </button>
            </>
          )}

          {job.status !== 'Completed' && job.status !== 'Cancelled' && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(job.customers?.service_address || '')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-[#151A2D] text-white hover:bg-[#2A3441] py-3.5 rounded-xl font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Navigation size={18} /> Directions
            </a>
          )}
        </div>
      </div>

      {/* Desktop Sticky Action Bar alternative (Optional: could place at top or side. We will use a floating pill on desktop) */}
      <div className="hidden md:block fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-[#E2E8F0] p-2 rounded-2xl shadow-xl z-40 max-w-2xl w-full">
        <div className="flex gap-2">
          {job.status === 'Scheduled' && (
            <button
              onClick={() => handleStatusChange('In Progress')}
              disabled={isUpdatingStatus}
              className="flex-1 bg-[#7CC242] hover:bg-[#6AB032] text-white py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUpdatingStatus ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Start Job</>}
            </button>
          )}
          
          {job.status === 'In Progress' && (
            <>
              <button
                onClick={() => handleStatusChange('Scheduled')}
                disabled={isUpdatingStatus}
                className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] text-[#475569] hover:bg-[#E2E8F0] py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUpdatingStatus ? <Loader2 size={18} className="animate-spin" /> : 'Pause'}
              </button>
              <button
                onClick={() => handleStatusChange('Completed')}
                disabled={isUpdatingStatus}
                className="flex-[2] bg-[#7CC242] hover:bg-[#6AB032] text-white py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUpdatingStatus ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Complete Job</>}
              </button>
            </>
          )}

          {job.status !== 'Completed' && job.status !== 'Cancelled' && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(job.customers?.service_address || '')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-[#151A2D] text-white hover:bg-[#2A3441] py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Navigation size={18} /> Directions
            </a>
          )}
        </div>
      </div>

      {/* Signature Capture Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        jobId={job.id}
        onSuccess={fetchJobDetails}
      />

      {/* Report Issue Modal */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-sm" onClick={() => setIsIssueModalOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden z-10 animate-fade-in">
            <div className="p-4 bg-red-50 flex items-center gap-2 border-b border-red-100">
              <AlertCircle size={20} className="text-red-600" />
              <h3 className="font-bold text-red-900">Report a Problem</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Problem Type</label>
                <select 
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#CBD5E1] font-semibold text-sm focus:outline-none focus:border-red-400"
                >
                  <option>Customer unavailable</option>
                  <option>Access issue</option>
                  <option>Safety concern</option>
                  <option>Material shortage</option>
                  <option>Existing damage</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Description</label>
                <textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Describe the issue..."
                  className="w-full h-24 p-2.5 rounded-xl border border-[#CBD5E1] font-semibold text-sm focus:outline-none focus:border-red-400 resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-[#E2E8F0] flex gap-2 bg-[#F8FAFC]">
              <button 
                onClick={() => setIsIssueModalOpen(false)}
                className="flex-1 py-2.5 bg-white border border-[#CBD5E1] text-[#475569] font-bold rounded-xl text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleReportIssue}
                disabled={isReportingIssue || !issueDescription.trim()}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex justify-center items-center"
              >
                {isReportingIssue ? <Loader2 size={16} className="animate-spin" /> : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Modal */}
      {completedValidationError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-sm" onClick={() => setCompletedValidationError(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden z-10 animate-fade-in p-5">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                <AlertCircle size={28} />
              </div>
            </div>
            <h3 className="text-center font-black text-xl text-[#151A2D] mb-2">Job isn't ready to complete</h3>
            <p className="text-center text-sm font-semibold text-[#64748B] mb-6">
              You must complete the following items before marking this job as finished:
            </p>
            
            <div className="space-y-3 mb-6 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                {completedValidationError.missingChecklist ? <XCircle size={18} className="text-red-500" /> : <CheckCircle2 size={18} className="text-[#10B981]" />}
                <span className={`text-sm font-bold ${completedValidationError.missingChecklist ? 'text-red-700' : 'text-[#475569]'}`}>
                  Operational Checklist
                </span>
              </div>
              <div className="flex items-center gap-3">
                {completedValidationError.missingPhoto ? <XCircle size={18} className="text-red-500" /> : <CheckCircle2 size={18} className="text-[#10B981]" />}
                <span className={`text-sm font-bold ${completedValidationError.missingPhoto ? 'text-red-700' : 'text-[#475569]'}`}>
                  At least 1 After Photo
                </span>
              </div>
              <div className="flex items-center gap-3">
                {completedValidationError.missingSignature ? <XCircle size={18} className="text-red-500" /> : <CheckCircle2 size={18} className="text-[#10B981]" />}
                <span className={`text-sm font-bold ${completedValidationError.missingSignature ? 'text-red-700' : 'text-[#475569]'}`}>
                  Customer Signature
                </span>
              </div>
            </div>

            <button 
              onClick={() => setCompletedValidationError(null)}
              className="w-full py-3 bg-[#151A2D] hover:bg-[#2A3441] text-white font-bold rounded-xl text-sm"
            >
              Back to Job
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
