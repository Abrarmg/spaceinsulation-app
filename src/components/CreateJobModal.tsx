import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { X, Loader2, Search, CheckCircle2, AlertTriangle, AlertCircle, ChevronDown, DollarSign, LayoutTemplate, Layers, UserPlus, Phone, Mail, MapPin, Plus } from 'lucide-react';
import { HelpTip } from './ui/HelpTip';
import { recall, remember } from '../utils/formMemory';
import { todayLocal } from '../utils/dates';

interface JobFormMemory {
  workerIds?: string[];
  startTime?: string;
  projectType?: string;
  propertyType?: string;
  accessType?: string;
}
import { CrewMultiSelect } from './CrewMultiSelect';

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  service_address: string | null;
  billing_address?: string | null;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits.length >= 10 ? digits.slice(-10) : (digits || null);
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const cleaned = String(email).trim().toLowerCase();
  return cleaned.includes('@') ? cleaned : null;
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
  job_crew?: Array<{
    worker_id: string;
    profiles?: {
      id: string;
      full_name: string;
    };
  }>;
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
  type ContactMode = 'search' | 'create';
  const [contactMode, setContactMode] = useState<ContactMode>('search');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Manual Contact Fields
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactServiceAddress, setNewContactServiceAddress] = useState('');
  const [newContactBillingAddress, setNewContactBillingAddress] = useState('');

  // Duplicate Check States
  interface MatchedContact {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    service_address: string | null;
    matchReason: string;
  }
  const [duplicateMatch, setDuplicateMatch] = useState<MatchedContact | null>(null);
  const [forceCreateNew, setForceCreateNew] = useState(false);
  
  const [status, setStatus] = useState('Quoted');
  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  
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
      setContactMode('search');
      setNewContactName('');
      setNewContactPhone('');
      setNewContactEmail('');
      setNewContactServiceAddress('');
      setNewContactBillingAddress('');
      setDuplicateMatch(null);
      setForceCreateNew(false);

      if (jobToEdit) {
        setScheduledDate(jobToEdit.scheduled_date ? jobToEdit.scheduled_date.split('T')[0] : '');
        setStartTime(jobToEdit.start_time ? jobToEdit.start_time.substring(0, 5) : '');
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

        // Fetch customer
        supabase.from('customers').select('*').eq('id', jobToEdit.customer_id).single().then(({ data }) => {
          if (data) {
            setSelectedCustomer(data);
            setCustomerSearch('');
          }
        });

        // Fetch assigned crew from job_crew table
        supabase
          .from('job_crew')
          .select('worker_id')
          .eq('job_id', jobToEdit.id)
          .then(({ data: crewData }) => {
            if (crewData && crewData.length > 0) {
              setSelectedWorkerIds(crewData.map((c: any) => c.worker_id));
            } else if (jobToEdit.assigned_worker_id) {
              setSelectedWorkerIds([jobToEdit.assigned_worker_id]);
            } else {
              setSelectedWorkerIds([]);
            }
          });
      } else {
        // Reset
        setSelectedCustomer(null);
        setCustomerSearch('');
        // Start from what was used on the last new job (crew, start time, job type).
        const last = recall<JobFormMemory>('newJob');
        setSelectedWorkerIds(Array.isArray(last.workerIds) ? last.workerIds : []);
        setScheduledDate(initialDate || '');
        setStartTime(last.startTime || '');
        setAtticSqft('');
        setExistingRValue('');
        setTargetRValue('');
        setScopeOfWork('');
        setQuotedAmount('');
        setEstimatedMaterialCost('');
        // Opened from a day on the schedule → it's being booked.
        setStatus(initialDate ? 'Scheduled' : 'Quoted');
        setProjectType(last.projectType || 'Attic Insulation');
        setPriority('Normal');
        setPropertyType(last.propertyType || 'Residential');
        setAccessType(last.accessType || 'Attic Hatch');
        // setSpecialInstructions('');
        setInternalNotes('');
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
        if (!jobToEdit && data) setSelectedWorkerIds(ids => ids.filter(wid => data.some(w => w.id === wid)));
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
      const term = customerSearch.trim();
      const { data } = await supabase
        .from('customers')
        .select('id, full_name, phone, email, service_address, billing_address')
        .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,service_address.ilike.%${term}%`)
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
    if (selectedWorkerIds.length > 0 && scheduledDate && startTime) {
      supabase.from('jobs')
        .select('id, start_time, end_time, job_number, assigned_worker_id, customers(full_name), job_crew(worker_id)')
        .eq('scheduled_date', scheduledDate)
        .neq('id', isEditMode ? jobToEdit?.id : '00000000-0000-0000-0000-000000000000')
        .then(({ data }) => {
          let hasOverlap = false;
          let hasNullTime = false;
          let conflictDesc = '';

          if (data && data.length > 0) {
            for (const existingJob of data) {
              const existingWorkerIds: string[] = [];
              if (existingJob.assigned_worker_id) existingWorkerIds.push(existingJob.assigned_worker_id);
              if (Array.isArray(existingJob.job_crew)) {
                existingJob.job_crew.forEach((jc: any) => {
                  if (jc.worker_id && !existingWorkerIds.includes(jc.worker_id)) {
                    existingWorkerIds.push(jc.worker_id);
                  }
                });
              }

              const conflictingWorkerId = selectedWorkerIds.find(wid => existingWorkerIds.includes(wid));

              if (conflictingWorkerId) {
                if (!existingJob.start_time) {
                  hasNullTime = true;
                  continue;
                }
                const newStart = startTime;
                
                if (existingJob.start_time === newStart) {
                  hasOverlap = true;
                  const workerName = workers.find(w => w.id === conflictingWorkerId)?.full_name || 'Worker';
                  
                  const formatTime = (t: string) => {
                    const [h, m] = t.split(':');
                    let hour = parseInt(h, 10);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    hour = hour % 12 || 12;
                    return `${hour}:${m} ${ampm}`;
                  };
                  
                  const existingCustName = Array.isArray(existingJob.customers) ? existingJob.customers[0]?.full_name : (existingJob.customers as any)?.full_name || 'a customer';
                  conflictDesc = `${workerName} already has a job scheduled at ${formatTime(existingJob.start_time)} for ${existingCustName}.`;
                  break;
                }
              }
            }
          }

          setCrewConflict(hasOverlap);
          setConflictMessage(conflictDesc);
          setUnconfirmedTimeWarning(!hasOverlap && hasNullTime);
        });
    } else if (selectedWorkerIds.length > 0 && scheduledDate && !startTime) {
      supabase.from('jobs')
        .select('id, start_time, assigned_worker_id, job_crew(worker_id)')
        .eq('scheduled_date', scheduledDate)
        .neq('id', isEditMode ? jobToEdit?.id : '00000000-0000-0000-0000-000000000000')
        .then(({ data }) => {
          let hasUnconfirmed = false;
          if (data && data.length > 0) {
            for (const existingJob of data) {
              const existingWorkerIds: string[] = [];
              if (existingJob.assigned_worker_id) existingWorkerIds.push(existingJob.assigned_worker_id);
              if (Array.isArray(existingJob.job_crew)) {
                existingJob.job_crew.forEach((jc: any) => {
                  if (jc.worker_id && !existingWorkerIds.includes(jc.worker_id)) {
                    existingWorkerIds.push(jc.worker_id);
                  }
                });
              }
              if (selectedWorkerIds.some(wid => existingWorkerIds.includes(wid))) {
                hasUnconfirmed = true;
                break;
              }
            }
          }
          setUnconfirmedTimeWarning(hasUnconfirmed);
        });
    } else {
      setCrewConflict(false);
      setConflictMessage('');
      setUnconfirmedTimeWarning(false);
    }
  }, [selectedWorkerIds, scheduledDate, startTime, isEditMode, jobToEdit, workers]);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (contactMode === 'search') {
      if (!selectedCustomer) {
        newErrors.customer = 'Please search and select an existing contact, or choose "Create New Contact".';
      }
    } else {
      if (!newContactName.trim()) {
        newErrors.newContactName = 'Contact Name is required.';
      }
      if (newContactEmail.trim() && !/\S+@\S+\.\S+/.test(newContactEmail.trim())) {
        newErrors.newContactEmail = 'Please enter a valid email address.';
      }
    }

    // A date is only needed once the job is booked; a quote can wait for one.
    if (status !== 'Quoted' && status !== 'Cancelled' && !scheduledDate) {
      newErrors.scheduledDate = 'Pick a date to book this job.';
    }
    
    if (crewConflict) {
      newErrors.submit = 'Cannot save due to crew schedule conflict.';
    }

    if (!projectType) newErrors.projectType = 'Project type is required.';
    if (quotedAmount === '') newErrors.quotedAmount = 'Enter the quoted price.';

    // Compare calendar dates as text so the local "today" is used (not UTC).
    if (!isEditMode && scheduledDate && scheduledDate < todayLocal()) {
      newErrors.scheduledDate = 'Pick today or a later date.';
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
      let finalCustomerId = selectedCustomer?.id;

      if (contactMode === 'create') {
        // 1. Duplicate Safety check if not forced and phone or email was provided
        if (!forceCreateNew && (newContactPhone.trim() || newContactEmail.trim())) {
          const normPhone = normalizePhone(newContactPhone);
          const normEmail = normalizeEmail(newContactEmail);

          const { data: existingList } = await supabase
            .from('customers')
            .select('id, full_name, phone, email, service_address');

          if (existingList) {
            let matched: any = null;
            let matchReason = '';

            if (normPhone) {
              const found = existingList.find(c => normalizePhone(c.phone) === normPhone);
              if (found) {
                matched = found;
                matchReason = `Phone number matches existing contact "${found.full_name}"`;
              }
            }

            if (!matched && normEmail) {
              const found = existingList.find(c => normalizeEmail(c.email) === normEmail);
              if (found) {
                matched = found;
                matchReason = `Email address matches existing contact "${found.full_name}"`;
              }
            }

            if (matched) {
              setDuplicateMatch({
                id: matched.id,
                full_name: matched.full_name,
                phone: matched.phone,
                email: matched.email,
                service_address: matched.service_address,
                matchReason
              });
              setIsSubmitting(false);
              const modalElement = document.getElementById('modal-content');
              if (modalElement) modalElement.scrollTo({ top: 0, behavior: 'smooth' });
              return;
            }
          }
        }

        // 2. Create the Contact record in public.customers
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert([{
            full_name: newContactName.trim(),
            email: newContactEmail.trim() || null,
            phone: newContactPhone.trim() || null,
            service_address: newContactServiceAddress.trim() || null,
            billing_address: newContactBillingAddress.trim() || (newContactServiceAddress.trim() || null),
            source: 'manual',
            created_from: 'job_booking',
            contact_type: 'customer',
            is_archived: false,
            updated_at: new Date().toISOString()
          }])
          .select('id, full_name, phone, email, service_address')
          .single();

        if (custErr || !newCust) {
          throw new Error(custErr?.message || 'Failed to create new contact for this job.');
        }

        finalCustomerId = newCust.id;
      }

      if (!finalCustomerId) {
        throw new Error('Valid contact is required to book a job.');
      }

      const payload: Partial<Job> = {
        customer_id: finalCustomerId,
        status,
        scheduled_date: scheduledDate || null,
        start_time: startTime || null,
        assigned_worker_id: selectedWorkerIds[0] || null,
        attic_sqft: atticSqft ? Number(atticSqft) : null,
        existing_r_value: existingRValue ? Number(existingRValue) : null,
        target_r_value: targetRValue ? Number(targetRValue) : null,
        scope_of_work: scopeOfWork,
        quoted_amount: quotedAmount ? Number(quotedAmount) : null,
        estimated_material_cost: estimatedMaterialCost ? Number(estimatedMaterialCost) : null,
      };

      if (isEditMode && jobToEdit) {
        const { error } = await supabase.from('jobs').update(payload).eq('id', jobToEdit.id);
        if (error) throw error;

        // Synchronize job_crew records
        await supabase.from('job_crew').delete().eq('job_id', jobToEdit.id);
        if (selectedWorkerIds.length > 0) {
          const crewRows = selectedWorkerIds.map(worker_id => ({
            job_id: jobToEdit.id,
            worker_id
          }));
          const { error: crewErr } = await supabase.from('job_crew').insert(crewRows);
          if (crewErr) console.error('Failed to sync job_crew:', crewErr);
        }

        setSuccessMessage(`Job JOB-${jobToEdit.job_number} updated successfully!`);
      } else {
        const { data: maxJob, error: maxJobError } = await supabase.from('jobs').select('job_number').order('job_number', { ascending: false }).limit(1);
        if (maxJobError) throw maxJobError;
        const nextJobNumber = maxJob && maxJob.length > 0 ? maxJob[0].job_number + 1 : 1000;
        
        const { data: createdJob, error } = await supabase
          .from('jobs')
          .insert([{ ...payload, job_number: nextJobNumber }])
          .select()
          .single();
        if (error) throw error;

        // Insert job_crew records for created job
        if (createdJob && selectedWorkerIds.length > 0) {
          const crewRows = selectedWorkerIds.map(worker_id => ({
            job_id: createdJob.id,
            worker_id
          }));
          const { error: crewErr } = await supabase.from('job_crew').insert(crewRows);
          if (crewErr) console.error('Failed to insert job_crew:', crewErr);
        }

        remember<JobFormMemory>('newJob', {
          workerIds: selectedWorkerIds,
          startTime,
          projectType,
          propertyType,
          accessType,
        });
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-sm animate-fade-in">
          <div className="w-16 h-16 bg-[#F0FDF4] rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="text-[#15803D]" size={32} />
          </div>
          <h2 className="text-xl font-bold text-navy mb-2">{successMessage}</h2>
          <p className="text-sm font-semibold text-muted mb-6">The job board has been updated.</p>
          <button onClick={onClose} className="w-full py-2.5 bg-brand text-navy font-semibold rounded-lg hover:bg-brand-hover transition-colors">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-navy/70 backdrop-blur-sm transition-opacity">
      <div className="bg-white w-full max-w-5xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col relative animate-fade-in">
        
        {/* Header */}
        <div className="px-5 md:px-6 py-4 bg-white text-navy border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex w-10 h-10 bg-brand-soft rounded-xl items-center justify-center">
              <Layers size={20} className="text-brand-ink" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-navy m-0">{isEditMode ? `Edit job #${jobToEdit?.job_number}` : 'New job'}</h2>
              <p className="text-sm text-muted m-0 mt-0.5">{isEditMode ? 'Update the details, schedule or crew.' : 'Pick the customer, then set the date and crew.'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 flex items-center justify-center text-muted hover:text-navy hover:bg-mist rounded-lg transition-colors border-0 bg-transparent">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSave} className="flex-1 min-h-0 overflow-y-auto" id="modal-content">
          <div className="p-5 md:p-8 flex flex-col gap-8">
            
            {errors.submit && (
              <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex gap-3 items-start">
                <AlertCircle size={16} className="text-[#DC2626] shrink-0 mt-0.5" />
                <span className="text-xs font-bold text-[#991B1B]">{errors.submit}</span>
              </div>
            )}

            {/* SECTION: Contact */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-2">
                <h3 className="text-sm font-semibold text-navy">
                  1. Contact
                </h3>

                <div className="flex items-center gap-1.5 p-1 bg-mist rounded-xl self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setContactMode('search');
                      setDuplicateMatch(null);
                      setErrors(prev => ({ ...prev, customer: '', newContactName: '' }));
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      contactMode === 'search'
                        ? 'bg-white text-navy shadow-sm'
                        : 'text-muted hover:text-navy'
                    }`}
                  >
                    <Search size={13} />
                    <span>Search Existing Contact</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContactMode('create');
                      setSelectedCustomer(null);
                      setDuplicateMatch(null);
                      setErrors(prev => ({ ...prev, customer: '', newContactName: '' }));
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      contactMode === 'create'
                        ? 'bg-white text-navy shadow-sm'
                        : 'text-muted hover:text-navy'
                    }`}
                  >
                    <UserPlus size={13} />
                    <span>Create New Contact</span>
                  </button>
                </div>
              </div>

              {/* DUPLICATE WARNING MODAL / PROMPT (for Create New Contact) */}
              {duplicateMatch && (
                <div className="p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl flex flex-col gap-3">
                  <div className="flex gap-2.5 items-start">
                    <AlertTriangle size={18} className="text-[#D97706] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-[#92400E]">Possible Existing Contact Found</div>
                      <p className="text-xs font-semibold text-[#B45309] mt-0.5">
                        {duplicateMatch.matchReason}: <strong>{duplicateMatch.full_name}</strong>
                      </p>
                      <p className="text-xs font-semibold text-[#B45309] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {duplicateMatch.phone && <span className="inline-flex items-center gap-1"><Phone size={12} />{duplicateMatch.phone}</span>}
                        {duplicateMatch.email && <span className="inline-flex items-center gap-1"><Mail size={12} />{duplicateMatch.email}</span>}
                        {duplicateMatch.service_address && <span className="inline-flex items-center gap-1"><MapPin size={12} />{duplicateMatch.service_address}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-1 border-t border-[#FDE68A]/60">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer({
                          id: duplicateMatch.id,
                          full_name: duplicateMatch.full_name,
                          phone: duplicateMatch.phone,
                          email: duplicateMatch.email,
                          service_address: duplicateMatch.service_address
                        });
                        setContactMode('search');
                        setDuplicateMatch(null);
                        setForceCreateNew(false);
                      }}
                      className="px-3 py-1.5 bg-navy text-white rounded-lg text-xs font-bold hover:bg-[#202744] transition-colors"
                    >
                      Use Existing Contact
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForceCreateNew(true);
                        setDuplicateMatch(null);
                      }}
                      className="px-3 py-1.5 bg-white border border-[#D97706] text-[#B45309] rounded-lg text-xs font-bold hover:bg-[#FFFBEB] transition-colors"
                    >
                      Create New Anyway
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 1: SEARCH EXISTING CONTACT */}
              {contactMode === 'search' && (
                <>
                  {!selectedCustomer ? (
                    <div className="relative" ref={searchRef}>
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" size={18} />
                        <input 
                          type="text"
                          placeholder="Search by name, phone, email, or address..."
                          value={customerSearch}
                          onChange={e => setCustomerSearch(e.target.value)}
                          className={`w-full pl-10 pr-4 py-3 bg-canvas border ${errors.customer ? 'border-red-500' : 'border-line'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand/20`}
                        />
                        {loadingCustomers && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-subtle" size={16} />}
                      </div>
                      {errors.customer && <p className="text-xs text-red-500 mt-1 font-bold">{errors.customer}</p>}

                      {isDropdownOpen && customers.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-line rounded-xl shadow-xl overflow-hidden z-20 max-h-60 overflow-y-auto">
                          {customers.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setIsDropdownOpen(false); }}
                              className="w-full text-left px-4 py-3 hover:bg-canvas flex items-center gap-3 border-b border-line last:border-0"
                            >
                              <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {(c.full_name || 'C').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-navy truncate">{c.full_name}</div>
                                <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-0.5">
                                  {c.phone && <span className="inline-flex items-center gap-1"><Phone size={12} />{c.phone}</span>}
                                  {c.email && <span className="inline-flex items-center gap-1"><Mail size={12} />{c.email}</span>}
                                  {c.service_address && <span className="inline-flex items-center gap-1"><MapPin size={12} />{c.service_address.split(',')[0]}</span>}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white border border-line rounded-xl p-4 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-brand to-navy rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                          {(selectedCustomer.full_name || 'C').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-base font-bold text-navy truncate">{selectedCustomer.full_name}</div>
                          <div className="text-xs font-semibold text-muted flex flex-wrap gap-x-4 gap-y-1 mt-0.5">
                            {selectedCustomer.phone && <span className="inline-flex items-center gap-1"><Phone size={12} />{selectedCustomer.phone}</span>}
                            {selectedCustomer.email && <span className="inline-flex items-center gap-1"><Mail size={12} />{selectedCustomer.email}</span>}
                            {selectedCustomer.service_address && <span className="inline-flex items-center gap-1 min-w-0"><MapPin size={12} className="shrink-0" /><span className="truncate">{selectedCustomer.service_address}</span></span>}
                          </div>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setSelectedCustomer(null)} 
                        className="text-xs font-bold text-[#3B82F6] hover:underline px-2 py-1 shrink-0 ml-2"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {duplicateWarning && (
                    <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl flex gap-2 items-start mt-1">
                      <AlertTriangle size={16} className="text-[#D97706] shrink-0 mt-0.5" />
                      <div className="text-xs font-bold text-[#92400E]">
                        Existing job found: this contact already has an active job. Creating this will book an additional job.
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* MODE 2: CREATE NEW CONTACT */}
              {contactMode === 'create' && (
                <div className="bg-canvas border border-line rounded-xl p-4 flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="e.g. John Doe"
                        value={newContactName}
                        onChange={e => setNewContactName(e.target.value)}
                        className={`w-full px-3.5 py-2.5 bg-white border ${errors.newContactName ? 'border-red-500' : 'border-line'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand/20`}
                      />
                      {errors.newContactName && <p className="text-xs text-red-500 mt-1 font-bold">{errors.newContactName}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                        Phone <span className="text-subtle font-normal lowercase">(optional)</span>
                      </label>
                      <input 
                        type="tel"
                        placeholder="e.g. 647-555-1234"
                        value={newContactPhone}
                        onChange={e => { setNewContactPhone(e.target.value); setForceCreateNew(false); }}
                        className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                        Email <span className="text-subtle font-normal lowercase">(optional)</span>
                      </label>
                      <input 
                        type="email"
                        placeholder="e.g. john@example.com"
                        value={newContactEmail}
                        onChange={e => { setNewContactEmail(e.target.value); setForceCreateNew(false); }}
                        className={`w-full px-3.5 py-2.5 bg-white border ${errors.newContactEmail ? 'border-red-500' : 'border-line'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand/20`}
                      />
                      {errors.newContactEmail && <p className="text-xs text-red-500 mt-1 font-bold">{errors.newContactEmail}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                        Service Address <span className="text-subtle font-normal lowercase">(optional)</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="e.g. 123 Main St, Toronto, ON"
                        value={newContactServiceAddress}
                        onChange={e => setNewContactServiceAddress(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                      Billing Address <span className="text-subtle font-normal lowercase">(optional - defaults to service address if empty)</span>
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. 123 Main St, Toronto, ON"
                      value={newContactBillingAddress}
                      onChange={e => setNewContactBillingAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* SECTION: Schedule & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-navy border-b border-line pb-2">2. Scheduling</h3>
                
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink-soft mb-1.5">Scheduled Date {status === 'Quoted' ? <span className="font-normal text-muted">(optional for quotes)</span> : <span className="text-red-500">*</span>}</label>
                    <input 
                      type="date"
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                      className={`w-full px-4 py-2.5 bg-white border ${errors.scheduledDate ? 'border-red-500' : 'border-line'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand/20`}
                    />
                    {errors.scheduledDate && <p className="text-xs text-red-500 mt-1 font-bold">{errors.scheduledDate}</p>}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink-soft mb-1.5">Start Time <span className="font-normal text-muted">(optional)</span></label>
                      <input 
                        type="time"
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                        className={`w-full px-3 py-2.5 bg-white border ${errors.startTime || errors.time ? 'border-red-500' : 'border-line'} rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand/20`}
                      />
                      {errors.startTime && <p className="text-xs text-red-500 mt-1 font-bold">{errors.startTime}</p>}
                    </div>
                  </div>
                  {errors.time && <p className="text-xs text-red-500 font-bold">{errors.time}</p>}

                  <div>
                    <label className="block text-xs font-semibold text-ink-soft mb-1.5">Assigned Crew</label>
                    <CrewMultiSelect 
                      workers={workers}
                      selectedWorkerIds={selectedWorkerIds}
                      onChange={setSelectedWorkerIds}
                    />
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
                          One or more selected workers already have a job on this date with no scheduled time.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-navy border-b border-line pb-2 flex items-center gap-1.5">3. Job Status <HelpTip><b>Quoted</b>: priced but not booked yet.<br /><b>Scheduled</b>: booked with a date — it shows on the schedule and the crew’s phone.<br /><b>In progress</b>: the crew is on site.<br /><b>Completed</b>: work done, ready to invoice.</HelpTip></h3>
                
                <div className="grid grid-cols-2 gap-2">
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                        status === s 
                          ? 'bg-[#F0FDF4] border-brand text-[#15803D] shadow-sm' 
                          : 'bg-canvas border-line text-muted hover:bg-mist'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-ink-soft mb-1.5">Project Type <span className="text-red-500">*</span></label>
                    <select 
                      value={projectType}
                      onChange={e => setProjectType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm text-navy placeholder:text-subtle focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                    >
                      {PROJECT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {errors.projectType && <p className="text-xs text-red-500 mt-1 font-bold">{errors.projectType}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-soft mb-1.5 flex items-center gap-1">Priority <HelpTip>Only changes how the job is flagged for the office. High-priority jobs stand out on lists so they get booked first.</HelpTip></label>
                    <select 
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                      className={`w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm text-navy placeholder:text-subtle focus:outline-none focus:ring-3 focus:ring-brand/15 ${
                        priority === 'Urgent' ? 'text-red-600' : priority === 'High' ? 'text-orange-500' : 'text-muted'
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-canvas -mx-6 md:-mx-8 px-6 md:px-8 py-8 border-y border-line">
              
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                  <LayoutTemplate size={16} className="text-muted" />
                  <h3 className="text-sm font-semibold text-navy">Insulation Specifications</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-line shadow-sm">
                    <label className="text-xs font-semibold text-ink-soft flex items-center gap-1">Attic Area <HelpTip>Optional. The floor area of the attic in square feet. Used to work out how much insulation the crew needs.</HelpTip></label>
                    <div className="flex items-end gap-1 mt-1">
                      <input 
                        type="number" 
                        value={atticSqft} 
                        onChange={e => setAtticSqft(e.target.value === '' ? '' : Number(e.target.value))}
                        className={`w-full text-xl font-bold text-navy focus:outline-none ${errors.atticSqft ? 'text-red-500' : ''}`}
                        placeholder="0"
                      />
                      <span className="text-2xs font-bold text-subtle mb-1">SQFT</span>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-line shadow-sm">
                    <label className="text-xs font-semibold text-ink-soft flex items-center gap-1">Existing R <HelpTip>The R-value of the insulation already in the attic. Higher means it keeps heat in better. Older homes are often around R-12 to R-20.</HelpTip></label>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xl font-bold text-navy">R-</span>
                      <input 
                        type="number" 
                        value={existingRValue} 
                        onChange={e => setExistingRValue(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full text-xl font-bold text-navy focus:outline-none"
                        placeholder="20"
                      />
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-line shadow-sm">
                    <label className="text-xs font-semibold text-ink-soft flex items-center gap-1">Target R <HelpTip>The R-value the attic should reach after the job. Ontario building code recommends R-50 to R-60 for attics.</HelpTip></label>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xl font-bold text-navy">R-</span>
                      <input 
                        type="number" 
                        value={targetRValue} 
                        onChange={e => setTargetRValue(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full text-xl font-bold text-navy focus:outline-none"
                        placeholder="60"
                      />
                    </div>
                  </div>
                </div>
                {errors.atticSqft && <p className="text-xs text-red-500 font-bold">{errors.atticSqft}</p>}
              </section>


              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={16} className="text-muted" />
                  <h3 className="text-sm font-semibold text-navy">Project Financials</h3>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-line shadow-sm">
                    <label className="text-xs font-semibold text-ink-soft flex items-center gap-1">Quoted Amount <span className="text-red-500">*</span> <HelpTip>The price agreed with the customer, before tax. It becomes the starting amount on the invoice.</HelpTip></label>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xl font-bold text-navy">$</span>
                      <input 
                        type="number" 
                        value={quotedAmount} 
                        onChange={e => setQuotedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className={`w-full text-xl font-bold text-navy focus:outline-none ${errors.quotedAmount ? 'text-red-500' : ''}`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

              </section>
            </div>

            {/* SECTION: Scope of Work */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h3 className="text-sm font-semibold text-navy">Scope of Work</h3>
                <div className="flex gap-2">
                  {SCOPE_TEMPLATES.map(t => (
                    <button key={t} type="button" onClick={() => handleTemplateClick(t)} className="inline-flex items-center gap-1 text-2xs font-bold text-[#3B82F6] bg-[#EFF6FF] px-2 py-1 rounded-md hover:bg-[#DBEAFE] transition-colors">
                      <Plus size={12} strokeWidth={3} />
                      {t.replace(/^\+ /, '')}
                    </button>
                  ))}
                </div>
              </div>
              
              <textarea 
                value={scopeOfWork}
                onChange={e => setScopeOfWork(e.target.value)}
                placeholder="Describe the work to be completed... You can use bullet points."
                rows={5}
                className="w-full px-4 py-3 bg-white border border-line rounded-lg text-sm focus:outline-none resize-y text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
              />
            </section>

            {/* SECTION: Additional Details */}
            <section className="flex flex-col gap-4">
              <button 
                type="button"
                onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
                className="flex items-center gap-2 text-sm font-bold text-navy bg-mist px-4 py-3 rounded-xl w-full hover:bg-line transition-colors"
              >
                <ChevronDown size={18} className={`transform transition-transform ${showAdditionalDetails ? 'rotate-180' : ''}`} />
                Additional Details & Internal Notes
              </button>

              {showAdditionalDetails && (
                <div className="space-y-6 pt-2 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink-soft mb-1.5">Property Type</label>
                      <select value={propertyType} onChange={e => setPropertyType(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm text-navy placeholder:text-subtle focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15">
                        <option value="Residential">Residential</option>
                        <option value="Commercial">Commercial</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-soft mb-1.5">Access Type</label>
                      <select value={accessType} onChange={e => setAccessType(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm text-navy placeholder:text-subtle focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15">
                        <option value="Attic Hatch">Attic Hatch</option>
                        <option value="Pull-down Ladder">Pull-down Ladder</option>
                        <option value="Exterior Access">Exterior Access</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-soft mb-1.5">Internal Notes <span className="text-subtle lowercase normal-case ml-1">(Only your team can see this)</span></label>
                    <textarea 
                      value={internalNotes}
                      onChange={e => setInternalNotes(e.target.value)}
                      placeholder="Add private notes for office staff or technicians..."
                      rows={3}
                      className="w-full px-4 py-3 bg-[#FEF9C3] border border-[#FEF08A] rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                    />
                  </div>


                </div>
              )}
            </section>
          </div>

          {/* Sticky Footer */}
          <div className="px-5 md:px-6 py-3 bg-white border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="text-xs font-semibold text-muted hidden lg:block max-w-sm truncate">
              {selectedCustomer ? (
                <>Summary: {selectedCustomer.full_name} • {scheduledDate ? new Date(`${scheduledDate.slice(0, 10)}T12:00:00`).toLocaleDateString() : 'No date'} • ${quotedAmount || 0}</>
              ) : 'Please select a customer'}
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-white border border-line text-navy text-sm font-semibold rounded-lg hover:bg-canvas transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-8 py-2.5 bg-brand text-navy text-sm font-semibold rounded-lg hover:bg-brand-hover transition-all flex items-center justify-center gap-2 disabled:opacity-70"
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
