import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { 
  X, Loader2, Search, CheckCircle2, 
  AlertTriangle, AlertCircle, ChevronDown, 
  Info, DollarSign, LayoutTemplate, Layers
} from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  service_address: string;
}

interface Worker {
  id: string;
  full_name: string;
}

interface Job {
  id: string;
  customer_id: string;
  job_number: number;
  status: string;
  scheduled_date: string | null;
  start_time?: string | null;
  end_time?: string | null;
  assigned_worker_id: string | null;
  attic_sqft: number | null;
  existing_r_value: number | null;
  target_r_value: number | null;
  scope_of_work: string | null;
  quoted_amount: number | null;
  estimated_material_cost: number | null;
  
  // New UI fields
  project_type?: string | null;
  priority?: string | null;
  property_type?: string | null;
  access_type?: string | null;
  special_instructions?: string | null;
  internal_notes?: string | null;
  notify_customer?: boolean | null;
}

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  jobToEdit?: Job | null;
  initialDate?: string;
}

const STATUSES = ['Quoted', 'Scheduled', 'In Progress', 'On Hold', 'Completed'];
const PROJECT_TYPES = ['Attic Insulation', 'Wall Insulation', 'Basement Insulation', 'Crawl Space', 'Air Sealing', 'Blown-In', 'Batt Insulation', 'Spray Foam', 'Other'];
const SCOPE_TEMPLATES = [
  '+ Attic Insulation',
  '+ Air Sealing',
  '+ Blown-In Insulation',
  '+ Baffle Installation',
  '+ Hatch Insulation'
];

export const CreateJobModal: React.FC<CreateJobModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  jobToEdit = null,
  initialDate = ''
}) => {
  const isEditMode = !!jobToEdit;

  // --- UI Layout States ---
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);

  // --- Form States ---
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [status, setStatus] = useState('Quoted');
  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [assignedWorkerId, setAssignedWorkerId] = useState('');
  
  const [atticSqft, setAtticSqft] = useState<number | ''>('');
  const [existingRValue, setExistingRValue] = useState<number | ''>('');
  const [targetRValue, setTargetRValue] = useState<number | ''>('');
  
  const [quotedAmount, setQuotedAmount] = useState<number | ''>('');
  const [estimatedMaterialCost, setEstimatedMaterialCost] = useState<number | ''>('');
  
  const [scopeOfWork, setScopeOfWork] = useState('');
  
  const [projectType, setProjectType] = useState('Attic Insulation');
  const [priority, setPriority] = useState('Normal');
  const [propertyType, setPropertyType] = useState('Residential');
  const [accessType, setAccessType] = useState('Attic Hatch');
  // const [specialInstructions, setSpecialInstructions] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);

  // --- Data States ---
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [crewConflict, setCrewConflict] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [unconfirmedTimeWarning, setUnconfirmedTimeWarning] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // --- Init ---
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (jobToEdit) {
        setScheduledDate(jobToEdit.scheduled_date ? jobToEdit.scheduled_date.split('T')[0] : '');
        setStartTime(jobToEdit.start_time ? jobToEdit.start_time.substring(0, 5) : '');
        setEndTime(jobToEdit.end_time ? jobToEdit.end_time.substring(0, 5) : '');
        setAssignedWorkerId(jobToEdit.assigned_worker_id || '');
        setAtticSqft(jobToEdit.attic_sqft || '');
        setExistingRValue(jobToEdit.existing_r_value || '');
        setTargetRValue(jobToEdit.target_r_value || '');
        setScopeOfWork(jobToEdit.scope_of_work || '');
        setQuotedAmount(jobToEdit.quoted_amount || '');
        setEstimatedMaterialCost(jobToEdit.estimated_material_cost || '');
        setStatus(jobToEdit.status || 'Quoted');
        
        setProjectType(jobToEdit.project_type || 'Attic Insulation');
        setPriority(jobToEdit.priority || 'Normal');
        setPropertyType(jobToEdit.property_type || 'Residential');
        setAccessType(jobToEdit.access_type || 'Attic Hatch');
        // setSpecialInstructions(jobToEdit.special_instructions || '');
        setInternalNotes(jobToEdit.internal_notes || '');
        setNotifyCustomer(jobToEdit.notify_customer ?? true);

        // Fetch customer
        supabase.from('customers').select('*').eq('id', jobToEdit.customer_id).single().then(({ data }) => {
          if (data) {
            setSelectedCustomer(data);
            setCustomerSearch('');
          }
        });
      } else {
        // Reset
        setSelectedCustomer(null);
        setCustomerSearch('');
        setScheduledDate(initialDate || '');
        setStartTime('');
        setEndTime('');
        setAssignedWorkerId('');
        setAtticSqft('');
        setExistingRValue('');
        setTargetRValue('');
        setScopeOfWork('');
        setQuotedAmount('');
        setEstimatedMaterialCost('');
        setStatus('Quoted');
        setProjectType('Attic Insulation');
        setPriority('Normal');
        setPropertyType('Residential');
        setAccessType('Attic Hatch');
        // setSpecialInstructions('');
        setInternalNotes('');
        setNotifyCustomer(true);
        setSuccessMessage('');
      }
      setErrors({});
      setDuplicateWarning(false);
      setCrewConflict(false);
      setConflictMessage('');
      setUnconfirmedTimeWarning(false);
      
      // Load workers
      supabase.from('profiles').select('id, full_name').eq('role', 'field_worker').then(({ data }) => {
        setWorkers(data || []);
      });
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, jobToEdit, initialDate]);


  
  // --- Customer Search ---
  useEffect(() => {
    if (!customerSearch.trim() || selectedCustomer) {
      setCustomers([]);
      setIsDropdownOpen(false);
      return;
    }

    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      const { data } = await supabase
        .from('customers')
        .select('*')
        .ilike('full_name', `%${customerSearch}%`)
        .limit(10);
      
      setCustomers(data || []);
      setIsDropdownOpen(true);
      setLoadingCustomers(false);
    };

    const delay = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(delay);
  }, [customerSearch, selectedCustomer]);

  // Check duplicate job
  useEffect(() => {
    if (selectedCustomer && !isEditMode) {
      supabase.from('jobs')
        .select('id')
        .eq('customer_id', selectedCustomer.id)
        .in('status', ['Quoted', 'Scheduled', 'In Progress'])
        .then(({ data }) => {
          if (data && data.length > 0) {
            setDuplicateWarning(true);
          } else {
            setDuplicateWarning(false);
          }
        });
    }
  }, [selectedCustomer, isEditMode]);

  // Check crew conflict
  useEffect(() => {
    if (assignedWorkerId && scheduledDate && startTime && endTime) {
      supabase.from('jobs')
        .select('id, start_time, end_time, job_number, customers(full_name)')
        .eq('assigned_worker_id', assignedWorkerId)
        .eq('scheduled_date', scheduledDate)
        .neq('id', isEditMode ? jobToEdit?.id : '00000000-0000-0000-0000-000000000000')
        .then(({ data }) => {
          let hasOverlap = false;
          let hasNullTime = false;
          let conflictDesc = '';

          if (data && data.length > 0) {
            for (const existingJob of data) {
              if (!existingJob.start_time || !existingJob.end_time) {
                hasNullTime = true;
                continue;
              }
              const newStart = startTime;
              const newEnd = endTime;
              
              if (existingJob.start_time < newEnd && existingJob.end_time > newStart) {
                hasOverlap = true;
                const workerName = workers.find(w => w.id === assignedWorkerId)?.full_name || 'Worker';
                
                const formatTime = (t: string) => {
                  const [h, m] = t.split(':');
                  let hour = parseInt(h, 10);
                  const ampm = hour >= 12 ? 'PM' : 'AM';
                  hour = hour % 12 || 12;
                  return `${hour}:${m} ${ampm}`;
                };
                
                const existingCustName = Array.isArray(existingJob.customers) ? existingJob.customers[0]?.full_name : (existingJob.customers as any)?.full_name || 'a customer';
                conflictDesc = `${workerName} already has a job scheduled from ${formatTime(existingJob.start_time)} to ${formatTime(existingJob.end_time)} for ${existingCustName}.`;
                break;
              }
            }
          }

          setCrewConflict(hasOverlap);
          setConflictMessage(conflictDesc);
          setUnconfirmedTimeWarning(!hasOverlap && hasNullTime);
        });
    } else if (assignedWorkerId && scheduledDate && (!startTime || !endTime)) {
      supabase.from('jobs')
        .select('id, start_time, end_time')
        .eq('assigned_worker_id', assignedWorkerId)
        .eq('scheduled_date', scheduledDate)
        .neq('id', isEditMode ? jobToEdit?.id : '00000000-0000-0000-0000-000000000000')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setUnconfirmedTimeWarning(true);
          } else {
            setUnconfirmedTimeWarning(false);
          }
        });
    } else {
      setCrewConflict(false);
      setConflictMessage('');
      setUnconfirmedTimeWarning(false);
    }
  }, [assignedWorkerId, scheduledDate, startTime, endTime, isEditMode, jobToEdit, workers]);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!selectedCustomer) newErrors.customer = 'Please select a customer.';
    if (status === 'Scheduled') {
      if (!scheduledDate) newErrors.scheduledDate = 'Scheduled date is required for Scheduled jobs.';
      if (!startTime) newErrors.startTime = 'Start time is required for Scheduled jobs.';
      if (!endTime) newErrors.endTime = 'End time is required for Scheduled jobs.';
    } else {
      if (!scheduledDate) newErrors.scheduledDate = 'Scheduled date is required.';
    }
    
    if (startTime && endTime && startTime >= endTime) {
      newErrors.time = 'End time must be later than start time.';
    }
    
    if (crewConflict) {
      newErrors.submit = 'Cannot save due to crew schedule conflict.';
    }

    if (!projectType) newErrors.projectType = 'Project type is required.';
    if (!atticSqft) newErrors.atticSqft = 'Attic area is required.';
    if (!quotedAmount) newErrors.quotedAmount = 'Quoted amount is required.';
    
    const d = new Date(scheduledDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (d < today) {
      newErrors.scheduledDate = 'Scheduled date cannot be in the past.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      // Scroll to top to show errors
      const modalElement = document.getElementById('modal-content');
      if (modalElement) modalElement.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<Job> = {
        customer_id: selectedCustomer!.id,
        status,
        scheduled_date: scheduledDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        assigned_worker_id: assignedWorkerId || null,
        attic_sqft: atticSqft ? Number(atticSqft) : null,
        existing_r_value: existingRValue ? Number(existingRValue) : null,
        target_r_value: targetRValue ? Number(targetRValue) : null,
        scope_of_work: scopeOfWork,
        quoted_amount: quotedAmount ? Number(quotedAmount) : null,
        estimated_material_cost: estimatedMaterialCost ? Number(estimatedMaterialCost) : null,
        
        // These fields require DB migration. We cannot pass them to Supabase until they exist.
        // project_type: projectType,
        // priority,
        // property_type: propertyType,
        // access_type: accessType,
        // special_instructions: specialInstructions,
        // internal_notes: internalNotes,
        // notify_customer: notifyCustomer
      };

      if (isEditMode && jobToEdit) {
        const { error } = await supabase.from('jobs').update(payload).eq('id', jobToEdit.id);
        if (error) throw error;
        setSuccessMessage(`Job JOB-${jobToEdit.job_number} updated successfully!`);
      } else {
        const { data: maxJob, error: maxJobError } = await supabase.from('jobs').select('job_number').order('job_number', { ascending: false }).limit(1);
        if (maxJobError) throw maxJobError;
        const nextJobNumber = maxJob && maxJob.length > 0 ? maxJob[0].job_number + 1 : 1000;
        
        const { error } = await supabase.from('jobs').insert([{ ...payload, job_number: nextJobNumber }]);
        if (error) throw error;
        setSuccessMessage(`Job JOB-${nextJobNumber} created successfully!`);
      }
      
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('Failed to save job:', err);
      setErrors({ submit: err.message || 'Failed to save job.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTemplateClick = (template: string) => {
    const textToAdd = template.replace('+ ', '');
    setScopeOfWork(prev => prev ? `${prev}\n- ${textToAdd}` : `- ${textToAdd}`);
  };

  if (successMessage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#151A2D]/60 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-sm animate-fade-in">
          <div className="w-16 h-16 bg-[#F0FDF4] rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="text-[#15803D]" size={32} />
          </div>
          <h2 className="text-xl font-black text-[#151A2D] mb-2">{successMessage}</h2>
          <p className="text-sm font-semibold text-[#64748B] mb-6">The job board has been updated.</p>
          <button onClick={onClose} className="w-full py-2.5 bg-[#7CC242] text-white font-black uppercase tracking-wider rounded-xl hover:bg-[#6ab331] transition-colors">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-[#151A2D]/70 backdrop-blur-sm transition-opacity">
      <div className="bg-white w-full max-w-5xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col relative animate-fade-in">
        
        {/* Header */}
        <div className="px-6 py-5 bg-[#151A2D] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
              <Layers size={20} className="text-[#7CC242]" />
            </div>
            <div>
              <h2 className="text-lg font-black m-0">{isEditMode ? `Edit Job JOB-${jobToEdit?.job_number}` : 'Book New Insulation Job'}</h2>
              <p className="text-xs font-semibold text-[#94A3B8] m-0 mt-0.5">Create and schedule a new insulation work order.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#94A3B8] hover:text-white hover:bg-white/10 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar (Visual Only) */}
        <div className="w-full h-1 bg-[#F1F5F9]">
          <div className="h-full bg-[#7CC242] w-1/3"></div>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSave} className="flex-1 min-h-0 overflow-y-auto" id="modal-content">
          <div className="p-6 md:p-8 flex flex-col gap-10">
            
            {errors.submit && (
              <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex gap-3 items-start">
                <AlertCircle size={16} className="text-[#DC2626] shrink-0 mt-0.5" />
                <span className="text-xs font-bold text-[#991B1B]">{errors.submit}</span>
              </div>
            )}

            {/* SECTION: Customer */}
            <section className="flex flex-col gap-4">
              <h3 className="text-[11px] font-black text-[#151A2D] uppercase tracking-widest border-b border-[#E2E8F0] pb-2">1. Customer Selection</h3>
              
              {!selectedCustomer ? (
                <div className="relative" ref={searchRef}>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={18} />
                    <input 
                      type="text"
                      placeholder="Search by name, phone, email, or address..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 bg-[#F8FAFC] border ${errors.customer ? 'border-red-500' : 'border-[#E2E8F0]'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20`}
                    />
                    {loadingCustomers && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-[#94A3B8]" size={16} />}
                  </div>
                  {errors.customer && <p className="text-xs text-red-500 mt-1 font-bold">{errors.customer}</p>}

                  {isDropdownOpen && customers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E2E8F0] rounded-xl shadow-xl overflow-hidden z-20">
                      {customers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setIsDropdownOpen(false); }}
                          className="w-full text-left px-4 py-3 hover:bg-[#F8FAFC] flex items-center gap-3 border-b border-[#E2E8F0] last:border-0"
                        >
                          <div className="w-10 h-10 bg-[#151A2D] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {c.full_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#151A2D]">{c.full_name}</div>
                            <div className="text-xs text-[#64748B] flex gap-2">
                              {c.phone && <span>📞 {c.phone}</span>}
                              <span>📍 {c.service_address.split(',')[0]}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#7CC242] to-[#151A2D] rounded-full flex items-center justify-center text-white font-black text-lg">
                      {selectedCustomer.full_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-base font-black text-[#151A2D]">{selectedCustomer.full_name}</div>
                      <div className="text-xs font-semibold text-[#64748B] flex flex-col sm:flex-row sm:gap-4 mt-0.5">
                        {selectedCustomer.phone && <span>📞 {selectedCustomer.phone}</span>}
                        <span>📍 {selectedCustomer.service_address}</span>
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedCustomer(null)} className="text-xs font-bold text-[#3B82F6] hover:underline px-2 py-1">
                    Change
                  </button>
                </div>
              )}

              {duplicateWarning && (
                <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl flex gap-2 items-start mt-2">
                  <AlertTriangle size={16} className="text-[#D97706] shrink-0 mt-0.5" />
                  <div className="text-xs font-bold text-[#92400E]">
                    ⚠️ Existing Job Found: This customer already has an active job. Creating this will book a duplicate/additional job.
                  </div>
                </div>
              )}
            </section>

            {/* SECTION: Schedule & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="flex flex-col gap-4">
                <h3 className="text-[11px] font-black text-[#151A2D] uppercase tracking-widest border-b border-[#E2E8F0] pb-2">2. Scheduling</h3>
                
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Scheduled Date <span className="text-red-500">*</span></label>
                    <input 
                      type="date"
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                      className={`w-full px-4 py-2.5 bg-white border ${errors.scheduledDate ? 'border-red-500' : 'border-[#E2E8F0]'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20`}
                    />
                    {errors.scheduledDate && <p className="text-xs text-red-500 mt-1 font-bold">{errors.scheduledDate}</p>}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Start Time {status === 'Scheduled' && <span className="text-red-500">*</span>}</label>
                      <input 
                        type="time"
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                        className={`w-full px-3 py-2.5 bg-white border ${errors.startTime || errors.time ? 'border-red-500' : 'border-[#E2E8F0]'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20`}
                      />
                      {errors.startTime && <p className="text-xs text-red-500 mt-1 font-bold">{errors.startTime}</p>}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">End Time {status === 'Scheduled' && <span className="text-red-500">*</span>}</label>
                      <input 
                        type="time"
                        value={endTime}
                        onChange={e => setEndTime(e.target.value)}
                        className={`w-full px-3 py-2.5 bg-white border ${errors.endTime || errors.time ? 'border-red-500' : 'border-[#E2E8F0]'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20`}
                      />
                      {errors.endTime && <p className="text-xs text-red-500 mt-1 font-bold">{errors.endTime}</p>}
                    </div>
                  </div>
                  {errors.time && <p className="text-xs text-red-500 font-bold">{errors.time}</p>}

                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Assigned Crew</label>
                    <select 
                      value={assignedWorkerId}
                      onChange={e => setAssignedWorkerId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20"
                    >
                      <option value="">Unassigned</option>
                      {workers.map(w => (
                        <option key={w.id} value={w.id}>{w.full_name}</option>
                      ))}
                    </select>
                    {crewConflict && (
                      <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex gap-2 items-start mt-2">
                        <AlertTriangle size={16} className="text-[#DC2626] shrink-0 mt-0.5" />
                        <div className="text-xs font-bold text-[#991B1B]">
                          {conflictMessage}
                        </div>
                      </div>
                    )}
                    {unconfirmedTimeWarning && !crewConflict && (
                      <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl flex gap-2 items-start mt-2">
                        <AlertTriangle size={16} className="text-[#D97706] shrink-0 mt-0.5" />
                        <div className="text-xs font-bold text-[#92400E]">
                          This worker already has a job on this date with no scheduled time.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-4">
                <h3 className="text-[11px] font-black text-[#151A2D] uppercase tracking-widest border-b border-[#E2E8F0] pb-2">3. Job Status</h3>
                
                <div className="grid grid-cols-2 gap-2">
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                        status === s 
                          ? 'bg-[#F0FDF4] border-[#7CC242] text-[#15803D] shadow-sm' 
                          : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Project Type <span className="text-red-500">*</span></label>
                    <select 
                      value={projectType}
                      onChange={e => setProjectType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm font-semibold"
                    >
                      {PROJECT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {errors.projectType && <p className="text-xs text-red-500 mt-1 font-bold">{errors.projectType}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Priority</label>
                    <select 
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                      className={`w-full px-3 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm font-bold ${
                        priority === 'Urgent' ? 'text-red-600' : priority === 'High' ? 'text-orange-500' : 'text-[#64748B]'
                      }`}
                    >
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>

            {/* SECTION: Specifications & Financials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-[#F8FAFC] -mx-6 md:-mx-8 px-6 md:px-8 py-8 border-y border-[#E2E8F0]">
              
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                  <LayoutTemplate size={16} className="text-[#64748B]" />
                  <h3 className="text-[11px] font-black text-[#151A2D] uppercase tracking-widest">Insulation Specifications</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-sm">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Attic Area</label>
                    <div className="flex items-end gap-1 mt-1">
                      <input 
                        type="number" 
                        value={atticSqft} 
                        onChange={e => setAtticSqft(e.target.value === '' ? '' : Number(e.target.value))}
                        className={`w-full text-xl font-black text-[#151A2D] focus:outline-none ${errors.atticSqft ? 'text-red-500' : ''}`}
                        placeholder="0"
                      />
                      <span className="text-[10px] font-bold text-[#94A3B8] mb-1">SQFT</span>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-sm">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">Existing R <span title="Current insulation rating"><Info size={10} /></span></label>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xl font-black text-[#151A2D]">R-</span>
                      <input 
                        type="number" 
                        value={existingRValue} 
                        onChange={e => setExistingRValue(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full text-xl font-black text-[#151A2D] focus:outline-none"
                        placeholder="20"
                      />
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-sm">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">Target R <span title="Desired insulation rating"><Info size={10} /></span></label>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xl font-black text-[#151A2D]">R-</span>
                      <input 
                        type="number" 
                        value={targetRValue} 
                        onChange={e => setTargetRValue(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full text-xl font-black text-[#151A2D] focus:outline-none"
                        placeholder="60"
                      />
                    </div>
                  </div>
                </div>
                {errors.atticSqft && <p className="text-xs text-red-500 font-bold">{errors.atticSqft}</p>}
              </section>


              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={16} className="text-[#64748B]" />
                  <h3 className="text-[11px] font-black text-[#151A2D] uppercase tracking-widest">Project Financials</h3>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-sm">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Quoted Amount <span className="text-red-500">*</span></label>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xl font-black text-[#151A2D]">$</span>
                      <input 
                        type="number" 
                        value={quotedAmount} 
                        onChange={e => setQuotedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className={`w-full text-xl font-black text-[#151A2D] focus:outline-none ${errors.quotedAmount ? 'text-red-500' : ''}`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

              </section>
            </div>

            {/* SECTION: Scope of Work */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                <h3 className="text-[11px] font-black text-[#151A2D] uppercase tracking-widest">Scope of Work</h3>
                <div className="flex gap-2">
                  {SCOPE_TEMPLATES.map(t => (
                    <button key={t} type="button" onClick={() => handleTemplateClick(t)} className="text-[10px] font-bold text-[#3B82F6] bg-[#EFF6FF] px-2 py-1 rounded-md hover:bg-[#DBEAFE] transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              
              <textarea 
                value={scopeOfWork}
                onChange={e => setScopeOfWork(e.target.value)}
                placeholder="Describe the work to be completed... You can use bullet points."
                rows={5}
                className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 resize-y"
              />
            </section>

            {/* SECTION: Additional Details */}
            <section className="flex flex-col gap-4">
              <button 
                type="button"
                onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
                className="flex items-center gap-2 text-sm font-bold text-[#151A2D] bg-[#F1F5F9] px-4 py-3 rounded-xl w-full hover:bg-[#E2E8F0] transition-colors"
              >
                <ChevronDown size={18} className={`transform transition-transform ${showAdditionalDetails ? 'rotate-180' : ''}`} />
                Additional Details & Internal Notes
              </button>

              {showAdditionalDetails && (
                <div className="space-y-6 pt-2 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Property Type</label>
                      <select value={propertyType} onChange={e => setPropertyType(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm font-semibold">
                        <option value="Residential">Residential</option>
                        <option value="Commercial">Commercial</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Access Type</label>
                      <select value={accessType} onChange={e => setAccessType(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm font-semibold">
                        <option value="Attic Hatch">Attic Hatch</option>
                        <option value="Pull-down Ladder">Pull-down Ladder</option>
                        <option value="Exterior Access">Exterior Access</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Internal Notes <span className="text-[#94A3B8] lowercase normal-case ml-1">(Only your team can see this)</span></label>
                    <textarea 
                      value={internalNotes}
                      onChange={e => setInternalNotes(e.target.value)}
                      placeholder="Add private notes for office staff or technicians..."
                      rows={3}
                      className="w-full px-4 py-3 bg-[#FEF9C3] border border-[#FEF08A] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/20"
                    />
                  </div>

                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)} className="w-5 h-5 rounded border-[#CBD5E1] text-[#7CC242] focus:ring-[#7CC242]" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#151A2D]">Notify Customer</span>
                        <span className="text-xs text-[#64748B]">Send SMS and Email booking confirmation</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Sticky Footer */}
          <div className="px-6 py-4 bg-white border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="text-xs font-semibold text-[#64748B] hidden lg:block max-w-sm truncate">
              {selectedCustomer ? (
                <>Summary: {selectedCustomer.full_name} • {scheduledDate ? new Date(scheduledDate).toLocaleDateString() : 'No date'} • ${quotedAmount || 0}</>
              ) : 'Please select a customer'}
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-white border border-[#E2E8F0] text-[#151A2D] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#F8FAFC] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-8 py-2.5 bg-[#7CC242] text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-[#6ab331] transition-all shadow-md shadow-[#7CC242]/20 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {status === 'Quoted' ? 'Save Draft' : status === 'Scheduled' ? 'Schedule Job' : 'Book Job'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
