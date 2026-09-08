import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  X, 
  Loader2, 
  Calendar, 
  User, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle,
  Briefcase,
  Layers,
  ArrowRight,
  UserCheck,
  Building
} from 'lucide-react';

interface WorkerProfile {
  id: string;
  full_name: string;
  role: string;
}

interface CustomerRecord {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  service_address: string;
}

export interface ConvertQuoteToJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (job: { id: string; job_number: number }) => void;
  estimate: {
    id: string;
    estimate_number: string;
    title?: string | null;
    status: string;
    total_amount: number;
    customer_id?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    property_address?: string | null;
    line_items?: any;
    intro_text?: string | null;
    client_message?: string | null;
  };
  leadId?: string | null;
}

export const ConvertQuoteToJobModal: React.FC<ConvertQuoteToJobModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  estimate,
  leadId = null,
}) => {
  // --- Form States ---
  const [jobTitle, setJobTitle] = useState(estimate.title || 'Insulation Project');
  const [internalNotes, setInternalNotes] = useState('');

  // Customer resolution states
  const [existingCustomer, setExistingCustomer] = useState<CustomerRecord | null>(null);
  const [matchedCustomer, setMatchedCustomer] = useState<CustomerRecord | null>(null);
  const [customerName, setCustomerName] = useState(estimate.customer_name || '');
  const [customerEmail, setCustomerEmail] = useState(estimate.customer_email || '');
  const [customerPhone, setCustomerPhone] = useState(estimate.customer_phone || '');
  const [customerAddress, setCustomerAddress] = useState(estimate.property_address || '');
  const [useMatchedCustomer, setUseMatchedCustomer] = useState(false);

  // Scheduling States
  const [schedulingMode, setSchedulingMode] = useState<'now' | 'later'>('now');
  
  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [scheduledDate, setScheduledDate] = useState(getTomorrowDate());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [assignedWorkerId, setAssignedWorkerId] = useState('');

  // Workers & Conflicts
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [crewConflict, setCrewConflict] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');

  // Duplicate Check / Submission State
  const [alreadyConvertedJob, setAlreadyConvertedJob] = useState<{ id: string; job_number: number } | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize and check for existing linked job / customer
  useEffect(() => {
    if (!isOpen) return;

    setJobTitle(estimate.title || 'Insulation Project');
    setCustomerName(estimate.customer_name || '');
    setCustomerEmail(estimate.customer_email || '');
    setCustomerPhone(estimate.customer_phone || '');
    setCustomerAddress(estimate.property_address || '');
    setInternalNotes(estimate.intro_text || estimate.client_message || '');
    setError(null);
    setAlreadyConvertedJob(null);
    setMatchedCustomer(null);
    setUseMatchedCustomer(false);

    // 1. Check if this quote is already converted to a Job
    const checkDuplicate = async () => {
      setCheckingExisting(true);
      try {
        const { data: existingJob, error: jobCheckErr } = await supabase
          .from('jobs')
          .select('id, job_number, status')
          .eq('estimate_id', estimate.id)
          .maybeSingle();

        if (jobCheckErr) throw jobCheckErr;
        if (existingJob) {
          setAlreadyConvertedJob(existingJob);
        }
      } catch (err) {
        console.error('Error checking existing job:', err);
      } finally {
        setCheckingExisting(false);
      }
    };

    checkDuplicate();

    // 2. Fetch linked or matching customer
    const resolveCustomer = async () => {
      if (estimate.customer_id) {
        const { data: cust } = await supabase
          .from('customers')
          .select('*')
          .eq('id', estimate.customer_id)
          .maybeSingle();
        if (cust) {
          setExistingCustomer(cust);
          setCustomerName(cust.full_name || '');
          setCustomerEmail(cust.email || '');
          setCustomerPhone(cust.phone || '');
          setCustomerAddress(cust.service_address || '');
          return;
        }
      }

      // If no customer_id, check for matching email or phone in customers table
      const email = estimate.customer_email?.trim();
      const phone = estimate.customer_phone?.trim();
      const name = estimate.customer_name?.trim();

      let query = supabase.from('customers').select('*');
      if (email && phone) {
        query = query.or(`email.eq.${email},phone.eq.${phone}`);
      } else if (email) {
        query = query.eq('email', email);
      } else if (phone) {
        query = query.eq('phone', phone);
      } else if (name) {
        query = query.ilike('full_name', `%${name}%`);
      } else {
        return;
      }

      const { data: matches } = await query.limit(1);
      if (matches && matches.length > 0) {
        setMatchedCustomer(matches[0]);
      }
    };

    resolveCustomer();

    // 3. Load field workers for dispatch
    const loadWorkers = async () => {
      setLoadingWorkers(true);
      try {
        const { data, error: workersErr } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('role', 'field_worker')
          .order('full_name');

        if (workersErr) throw workersErr;
        setWorkers(data || []);
      } catch (err) {
        console.error('Error loading workers:', err);
      } finally {
        setLoadingWorkers(false);
      }
    };

    loadWorkers();
  }, [isOpen, estimate]);

  // Check worker schedule conflicts
  useEffect(() => {
    if (schedulingMode !== 'now' || !assignedWorkerId || !scheduledDate || !startTime) {
      setCrewConflict(false);
      setConflictMessage('');
      return;
    }

    supabase
      .from('jobs')
      .select('id, start_time, end_time, job_number, customers(full_name)')
      .eq('assigned_worker_id', assignedWorkerId)
      .eq('scheduled_date', scheduledDate)
      .then(({ data }) => {
        if (data && data.length > 0) {
          for (const existingJob of data) {
            if (existingJob.start_time === startTime) {
              const workerName = workers.find(w => w.id === assignedWorkerId)?.full_name || 'Selected worker';
              const custName = Array.isArray(existingJob.customers) 
                ? existingJob.customers[0]?.full_name 
                : (existingJob.customers as any)?.full_name || 'another customer';
              setCrewConflict(true);
              setConflictMessage(`${workerName} already has Job #${existingJob.job_number} scheduled at ${startTime} for ${custName}.`);
              return;
            }
          }
        }
        setCrewConflict(false);
        setConflictMessage('');
      });
  }, [schedulingMode, assignedWorkerId, scheduledDate, startTime, workers]);

  if (!isOpen) return null;

  // Filter approved included line items (exclude is_optional = true per requirements)
  const rawItems = Array.isArray(estimate.line_items) ? estimate.line_items : [];
  const includedItems = rawItems.filter((item: any) => !item.is_optional);
  const optionalCount = rawItems.filter((item: any) => item.is_optional).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (alreadyConvertedJob) {
      setError(`This quote has already been converted to Job #${alreadyConvertedJob.job_number}.`);
      return;
    }

    if (schedulingMode === 'now') {
      if (!scheduledDate) {
        setError('Please select a scheduled date for the job.');
        return;
      }
      if (!startTime) {
        setError('Please select a start time for the job.');
        return;
      }
    }

    setSubmitting(true);

    try {
      // 1. Double check at runtime that Job doesn't already exist for this estimate
      const { data: existingCheck } = await supabase
        .from('jobs')
        .select('id, job_number')
        .eq('estimate_id', estimate.id)
        .maybeSingle();

      if (existingCheck) {
        setAlreadyConvertedJob(existingCheck);
        throw new Error(`This quote has already been converted to Job #${existingCheck.job_number}.`);
      }

      // 2. Resolve Customer ID
      let finalCustomerId = estimate.customer_id || null;

      if (!finalCustomerId && useMatchedCustomer && matchedCustomer) {
        finalCustomerId = matchedCustomer.id;
      } else if (!finalCustomerId) {
        // Customer profile fields validation
        if (!customerName.trim()) {
          throw new Error('Customer full name is required to establish a customer profile.');
        }
        if (!customerPhone.trim()) {
          throw new Error('Customer phone number is required to establish a customer profile.');
        }
        if (!customerAddress.trim()) {
          throw new Error('Service address is required to establish a customer profile.');
        }

        // Create Customer
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert([{
            full_name: customerName.trim(),
            email: customerEmail.trim() || null,
            phone: customerPhone.trim(),
            service_address: customerAddress.trim(),
            billing_address: customerAddress.trim(),
            preferred_contact_method: 'Phone'
          }])
          .select()
          .single();

        if (custErr || !newCust) {
          throw new Error(custErr?.message || 'Failed to establish customer record.');
        }

        finalCustomerId = newCust.id;
      }

      // 3. Update estimate and lead with resolved customer_id if not linked
      if (finalCustomerId) {
        if (!estimate.customer_id) {
          await supabase
            .from('estimates')
            .update({ customer_id: finalCustomerId })
            .eq('id', estimate.id);
        }

        if (leadId) {
          await supabase
            .from('leads')
            .update({ customer_id: finalCustomerId })
            .eq('id', leadId);
        }
      }

      // 4. Safe sequential Job Number generation
      const { data: maxJob, error: maxJobErr } = await supabase
        .from('jobs')
        .select('job_number')
        .order('job_number', { ascending: false })
        .limit(1);

      if (maxJobErr) throw maxJobErr;

      const nextJobNumber = maxJob && maxJob.length > 0 && maxJob[0].job_number
        ? Number(maxJob[0].job_number) + 1
        : 1001;

      // 5. Build scope of work summary from included line items
      const itemsList = includedItems.map((item: any) => {
        if (item.type === 'section') {
          return `\n[ ${item.name || item.description || 'Section'} ]`;
        }
        const qty = item.quantity || 1;
        const price = Number(item.unit_price || 0);
        const tot = Number(item.total || qty * price);
        return `- ${item.name || item.description} (Qty: ${qty} × $${price.toFixed(2)} = $${tot.toFixed(2)})`;
      }).join('\n');

      const scopeOfWork = [
        `Converted from Quote #${estimate.estimate_number}`,
        `Quote Title: ${estimate.title || 'Insulation Upgrade'}`,
        `Approved Total: $${Number(estimate.total_amount || 0).toFixed(2)} CAD`,
        itemsList ? `\nApproved Included Items:\n${itemsList}` : null,
        internalNotes.trim() ? `\nInstructions & Notes:\n${internalNotes.trim()}` : null
      ].filter(Boolean).join('\n');

      // 6. Insert Job record
      const jobPayload = {
        job_number: nextJobNumber,
        customer_id: finalCustomerId,
        estimate_id: estimate.id,
        lead_id: leadId || null,
        title: jobTitle.trim() || estimate.title || 'Insulation Project',
        quoted_amount: Number(estimate.total_amount || 0),
        line_items: includedItems,
        scope_of_work: scopeOfWork,
        internal_notes: internalNotes.trim() || null,
        status: schedulingMode === 'now' ? 'Scheduled' : 'Quoted',
        scheduled_date: schedulingMode === 'now' ? scheduledDate : null,
        start_time: schedulingMode === 'now' ? startTime : null,
        end_time: schedulingMode === 'now' ? endTime : null,
        assigned_worker_id: schedulingMode === 'now' ? (assignedWorkerId || null) : null
      };

      const { data: createdJob, error: jobInsertErr } = await supabase
        .from('jobs')
        .insert([jobPayload])
        .select('id, job_number')
        .single();

      if (jobInsertErr) {
        // Handle unique constraint 23505 duplicate protection
        if (jobInsertErr.code === '23505' || jobInsertErr.message.includes('idx_jobs_unique_estimate_id')) {
          const { data: dupJob } = await supabase
            .from('jobs')
            .select('id, job_number')
            .eq('estimate_id', estimate.id)
            .maybeSingle();

          if (dupJob) {
            setAlreadyConvertedJob(dupJob);
            throw new Error(`This quote has already been converted to Job #${dupJob.job_number}.`);
          }
        }
        throw jobInsertErr;
      }

      onSuccess({ id: createdJob.id, job_number: createdJob.job_number });
      onClose();

    } catch (err: any) {
      console.error('Failed to convert quote to job:', err);
      setError(err.message || 'Failed to convert quote to job.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-[#DFE2E8] w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E7E9ED] flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#151A2D] flex items-center justify-center text-white shadow-xs">
              <Briefcase size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-[#151A2D] m-0">
                  Convert Quote to Job
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#151A2D]/10 text-[#151A2D]">
                  #{estimate.estimate_number}
                </span>
              </div>
              <p className="text-xs text-[#737A86] font-medium m-0">
                Create an operational work order from this approved proposal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[#737A86] hover:text-[#151A2D] hover:bg-gray-200/60 flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Already Converted Warning Banner */}
          {alreadyConvertedJob && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-amber-900">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span>Quote already converted to Job #{alreadyConvertedJob.job_number}</span>
              </div>
              <p className="text-xs text-amber-800 m-0 leading-relaxed">
                This quote has already been converted into an active Job. To prevent duplicate jobs, re-conversion is blocked.
              </p>
              <div className="pt-1">
                <a
                  href={`/jobs/${alreadyConvertedJob.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151A2D] text-white text-xs font-bold hover:bg-[#1f263e] transition-colors"
                >
                  <span>View Job #{alreadyConvertedJob.job_number}</span>
                  <ArrowRight size={13} />
                </a>
              </div>
            </div>
          )}

          {/* 1. Source Quote Overview Card */}
          <div className="p-4 rounded-xl bg-[#F6F7F9] border border-[#E7E9ED] space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-[#E7E9ED] pb-2.5">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[#737A86]" />
                <span className="text-xs font-black uppercase tracking-wider text-[#151A2D]">
                  Approved Quote Summary
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                Approved ✓
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-[#737A86] block font-semibold">Quote Title</span>
                <span className="font-bold text-[#151A2D]">{estimate.title || 'Insulation Upgrade'}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#737A86] block font-semibold">Approved Total</span>
                <span className="font-bold text-emerald-700 text-sm">
                  ${Number(estimate.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#737A86] block font-semibold">Customer Name</span>
                <span className="font-medium text-[#151A2D]">{estimate.customer_name || 'Prospect'}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#737A86] block font-semibold">Property Address</span>
                <span className="font-medium text-[#151A2D]">{estimate.property_address || '—'}</span>
              </div>
            </div>
          </div>

          {/* 2. Approved Work (Included Line Items) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#151A2D] flex items-center gap-1.5 m-0">
                <Layers size={13} className="text-[#7CB342]" />
                <span>Approved Work ({includedItems.length} items)</span>
              </h4>
              {optionalCount > 0 && (
                <span className="text-[10px] font-semibold text-[#737A86] bg-gray-100 px-2 py-0.5 rounded">
                  {optionalCount} optional upgrade{optionalCount > 1 ? 's' : ''} excluded
                </span>
              )}
            </div>

            <div className="rounded-xl border border-[#E7E9ED] bg-white divide-y divide-[#F0F2F5] max-h-48 overflow-y-auto">
              {includedItems.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#737A86]">
                  No itemized line items found on quote. Full total will transfer as quoted amount.
                </div>
              ) : (
                includedItems.map((item: any, idx: number) => {
                  if (item.type === 'section') {
                    return (
                      <div key={idx} className="px-3.5 py-2 bg-[#F8F9FA] text-xs font-bold text-[#151A2D]">
                        § {item.name || item.description || 'Scope Section'}
                      </div>
                    );
                  }
                  const qty = item.quantity || 1;
                  const price = Number(item.unit_price || 0);
                  const total = Number(item.total || qty * price);

                  return (
                    <div key={idx} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[#151A2D] truncate">
                          {item.name || item.description || 'Line Item'}
                        </div>
                        {item.name && item.description && (
                          <div className="text-[11px] text-[#737A86] truncate">
                            {item.description}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-[#151A2D]">
                          ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <div className="text-[10px] text-[#737A86]">
                          {qty} × ${price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. Customer Profile Resolution */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#151A2D] flex items-center gap-1.5 m-0">
              <User size={13} className="text-[#151A2D]" />
              <span>Customer Information</span>
            </h4>

            {existingCustomer ? (
              /* Already established customer */
              <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <UserCheck size={16} className="text-emerald-700 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-950 block">{existingCustomer.full_name}</span>
                    <span className="text-[11px] text-emerald-800">
                      Existing Customer · {existingCustomer.phone || existingCustomer.email}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                  Verified
                </span>
              </div>
            ) : matchedCustomer ? (
              /* Deduplication Match Found */
              <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 space-y-2.5 text-xs text-indigo-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    <Building size={14} className="text-indigo-600" />
                    <span>Existing Customer Match Found</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                    Match
                  </span>
                </div>
                <div className="text-xs text-indigo-900">
                  <span className="font-bold">{matchedCustomer.full_name}</span> ({matchedCustomer.phone || matchedCustomer.email})
                  <div className="text-[11px] text-indigo-700">{matchedCustomer.service_address}</div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUseMatchedCustomer(true);
                      setCustomerName(matchedCustomer.full_name);
                      setCustomerEmail(matchedCustomer.email || '');
                      setCustomerPhone(matchedCustomer.phone || '');
                      setCustomerAddress(matchedCustomer.service_address || '');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      useMatchedCustomer
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-50'
                    }`}
                  >
                    {useMatchedCustomer ? '✓ Using This Customer' : 'Use Existing Customer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseMatchedCustomer(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      !useMatchedCustomer
                        ? 'bg-gray-900 text-white shadow-xs'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Create Separate Customer
                  </button>
                </div>
              </div>
            ) : (
              /* Review / create new customer */
              <div className="p-4 rounded-xl bg-gray-50 border border-[#E7E9ED] space-y-3">
                <div className="text-[11px] text-[#737A86] font-medium">
                  A new customer profile will be established from these quote details:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-[#151A2D] mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#DFE2E8] rounded-lg text-xs font-medium text-[#151A2D] focus:border-[#151A2D] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#151A2D] mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#DFE2E8] rounded-lg text-xs font-medium text-[#151A2D] focus:border-[#151A2D] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#151A2D] mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#DFE2E8] rounded-lg text-xs font-medium text-[#151A2D] focus:border-[#151A2D] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#151A2D] mb-1">
                      Service Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#DFE2E8] rounded-lg text-xs font-medium text-[#151A2D] focus:border-[#151A2D] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Job Details Section */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#151A2D] flex items-center gap-1.5 m-0">
              <Briefcase size={13} className="text-[#151A2D]" />
              <span>Job Specifications</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#151A2D] mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Attic Insulation Upgrade"
                  className="w-full px-3 py-2 bg-white border border-[#DFE2E8] rounded-lg text-xs font-medium text-[#151A2D] focus:border-[#151A2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#151A2D] mb-1">
                  Quoted Amount
                </label>
                <div className="px-3 py-2 bg-[#F6F7F9] border border-[#DFE2E8] rounded-lg text-xs font-bold text-[#151A2D]">
                  ${Number(estimate.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD (Read-only)
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#151A2D] mb-1">
                Internal Instructions & Work Notes
              </label>
              <textarea
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Access notes, crew instructions, site hazards..."
                className="w-full px-3 py-2 bg-white border border-[#DFE2E8] rounded-lg text-xs font-medium text-[#151A2D] focus:border-[#151A2D] focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* 5. Scheduling — Jobber Style (Schedule Now vs Schedule Later) */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#151A2D] flex items-center gap-1.5 m-0">
              <Calendar size={13} className="text-[#151A2D]" />
              <span>Scheduling Options</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option: Schedule Now */}
              <label 
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  schedulingMode === 'now'
                    ? 'border-[#151A2D] bg-[#151A2D]/5 shadow-xs ring-1 ring-[#151A2D]'
                    : 'border-[#DFE2E8] bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="schedulingMode"
                  value="now"
                  checked={schedulingMode === 'now'}
                  onChange={() => setSchedulingMode('now')}
                  className="mt-0.5 text-[#151A2D] focus:ring-[#151A2D]"
                />
                <div>
                  <span className="text-xs font-bold text-[#151A2D] block">
                    Schedule Now
                  </span>
                  <span className="text-[11px] text-[#737A86] leading-tight block mt-0.5">
                    Select work date, time window, and assign crew right away.
                  </span>
                </div>
              </label>

              {/* Option: Schedule Later */}
              <label 
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  schedulingMode === 'later'
                    ? 'border-[#151A2D] bg-[#151A2D]/5 shadow-xs ring-1 ring-[#151A2D]'
                    : 'border-[#DFE2E8] bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="schedulingMode"
                  value="later"
                  checked={schedulingMode === 'later'}
                  onChange={() => setSchedulingMode('later')}
                  className="mt-0.5 text-[#151A2D] focus:ring-[#151A2D]"
                />
                <div>
                  <span className="text-xs font-bold text-[#151A2D] block">
                    Schedule Later
                  </span>
                  <span className="text-[11px] text-[#737A86] leading-tight block mt-0.5">
                    Save as unscheduled work order. Assign date & crew later.
                  </span>
                </div>
              </label>
            </div>

            {/* Schedule Now Inputs */}
            {schedulingMode === 'now' && (
              <div className="p-4 rounded-xl bg-gray-50 border border-[#E7E9ED] space-y-3 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-[#151A2D] mb-1">
                      Work Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#DFE2E8] rounded-lg text-xs font-medium text-[#151A2D] focus:border-[#151A2D] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#151A2D] mb-1">
                      Start Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#DFE2E8] rounded-lg text-xs font-medium text-[#151A2D] focus:border-[#151A2D] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#151A2D] mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#DFE2E8] rounded-lg text-xs font-medium text-[#151A2D] focus:border-[#151A2D] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#151A2D] mb-1">
                    Assigned Crew / Worker
                  </label>
                  {loadingWorkers ? (
                    <div className="flex items-center gap-2 text-xs text-[#737A86] py-2">
                      <Loader2 size={13} className="animate-spin text-[#7CB342]" />
                      <span>Loading technicians...</span>
                    </div>
                  ) : (
                    <select
                      value={assignedWorkerId}
                      onChange={(e) => setAssignedWorkerId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#DFE2E8] rounded-lg text-xs font-medium text-[#151A2D] focus:border-[#151A2D] focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Unassigned (Dispatch Later) --</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.full_name} ({w.role.replace(/_/g, ' ')})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Crew Conflict Warning */}
                {crewConflict && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-[11px] text-amber-800">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>{conflictMessage}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#E7E9ED] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-[#DFE2E8] bg-white text-xs font-bold text-[#525866] hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            {alreadyConvertedJob ? (
              <a
                href={`/jobs/${alreadyConvertedJob.id}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#151A2D] text-white text-xs font-bold hover:bg-[#1f263e] transition-all cursor-pointer shadow-xs"
              >
                <span>View Job #{alreadyConvertedJob.job_number}</span>
                <ArrowRight size={14} />
              </a>
            ) : (
              <button
                type="submit"
                disabled={submitting || checkingExisting}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#151A2D] text-white text-xs font-bold hover:bg-[#1f263e] transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-white" />
                    <span>Creating Job...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} className="text-[#7CB342]" />
                    <span>Create Job #{estimate.estimate_number.replace('EST-', 'JOB-')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
