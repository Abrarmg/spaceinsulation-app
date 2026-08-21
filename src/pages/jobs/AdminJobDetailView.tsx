import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { CreateJobModal } from '../../components/CreateJobModal';
import { JobPhotos } from '../../components/JobPhotos';
import { SignatureModal } from '../../components/SignatureModal';
import { 
  ArrowLeft, 
  Loader2, 
  Calendar, 
  MapPin, 
  DollarSign, 
  AlertCircle, 
  Wrench, 
  CheckCircle2, 
  XCircle,
  FileText,
  Bookmark,
  Building,
  Check,
  Edit2,
  Trash2,
  User
} from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  service_address: string;
  billing_address: string | null;
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
  created_at: string;
  customers: Customer | null;
  customer_signature_url: string | null;
  signed_at: string | null;
  checklist: Record<string, boolean> | null;
  materials_used: string | null;
}

interface Worker {
  id: string;
  full_name: string;
}

export const AdminJobDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal and Status updating states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingWorker, setIsUpdatingWorker] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // User Session & Role States
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Materials & Issue States
  const [materialsInput, setMaterialsInput] = useState<string>('');
  const [isSavingMaterials, setIsSavingMaterials] = useState<boolean>(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState<boolean>(false);
  const [issueDescription, setIssueDescription] = useState<string>('');
  const [isReportingIssue, setIsReportingIssue] = useState<boolean>(false);

  // Pre-completion check state
  const [completedValidationError, setCompletedValidationError] = useState<{ missingPhoto: boolean; missingSignature: boolean } | null>(null);

  // Invoice Generation State
  const [generatingInvoice, setGeneratingInvoice] = useState<boolean>(false);

  // Monitor auth state and load user role
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setCurrentUserRole(data.role);
          });
      }
    });
  }, []);

  // Fetch job details joined with customer
  const fetchJobDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('jobs')
        .select('*, customers(*)')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (!data) {
        setError('Work order not found.');
        return;
      }

      setJob(data as any);
      setMaterialsInput((data as any).materials_used || '');
    } catch (err: any) {
      console.error('Error fetching job details:', err);
      setError(err.message || 'Failed to load job details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch eligible workers for dispatch dropdown
  const fetchWorkers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'field_worker')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setWorkers(data || []);
    } catch (err) {
      console.error('Failed to load field workers:', err);
    }
  }, []);

  useEffect(() => {
    fetchJobDetails();
    fetchWorkers();
  }, [fetchJobDetails, fetchWorkers]);

  // Delete Job Handler
  const handleDeleteJob = async () => {
    if (!job) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete job order #JOB-${job.job_number}?`
    );

    if (!confirmDelete) return;

    try {
      setLoading(true);
      const { error: deleteErr } = await supabase
        .from('jobs')
        .delete()
        .eq('id', job.id);

      if (deleteErr) throw deleteErr;

      navigate('/jobs');
    } catch (err: any) {
      console.error('Error deleting job from detail view:', err);
      alert(err.message || 'Failed to delete the job.');
      setLoading(false);
    }
  };

  // Handle status update directly in Supabase on dropdown change
  const handleStatusChange = async (newStatus: string) => {
    if (!job) return;
    setIsUpdatingStatus(true);
    setToastMessage(null);

    try {
      // 1. Mandatory Pre-Completion Checks
      if (newStatus === 'Completed') {
        const { count, error: countErr } = await supabase
          .from('job_media')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.id)
          .eq('category', 'after');

        const hasAfterPhoto = !countErr && count !== null && count > 0;
        const hasSignature = !!job.customer_signature_url;

        if (currentUserRole === 'field_worker') {
          if (!hasAfterPhoto || !hasSignature) {
            setCompletedValidationError({
              missingPhoto: !hasAfterPhoto,
              missingSignature: !hasSignature
            });
            setIsUpdatingStatus(false);
            return;
          }
        } else {
          // Admin override warning dialog
          if (!hasAfterPhoto || !hasSignature) {
            const missingText = [];
            if (!hasAfterPhoto) missingText.push('an after photo');
            if (!hasSignature) missingText.push('a customer signature');
            
            const confirmOverride = window.confirm(
              `WARNING: This job is missing ${missingText.join(' and ')}. Are you sure you want to mark this job as Completed?`
            );
            if (!confirmOverride) {
              setIsUpdatingStatus(false);
              return;
            }
          }
        }
      }

      const { error: updateErr } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', job.id);

      if (updateErr) throw updateErr;

      setJob((prev) => prev ? { ...prev, status: newStatus } : null);
      
      // Show brief success confirmation toast
      setToastMessage('Status updated successfully!');
      setTimeout(() => {
        setToastMessage(null);
      }, 3000);
    } catch (err: any) {
      console.error('Failed to update job status:', err);
      alert('Failed to update job status: ' + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle worker assignment change in Supabase on dropdown change
  const handleAssignWorker = async (workerId: string) => {
    if (!job) return;
    setIsUpdatingWorker(true);
    setToastMessage(null);

    try {
      const { error } = await supabase
        .from('jobs')
        .update({ assigned_worker_id: workerId || null })
        .eq('id', job.id);

      if (error) throw error;

      setJob((prev) => prev ? { ...prev, assigned_worker_id: workerId || null } : null);

      setToastMessage('Worker assignment updated successfully!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to assign worker:', err);
      alert('Failed to assign worker: ' + err.message);
    } finally {
      setIsUpdatingWorker(false);
    }
  };

  // Toggle checklist item status in Supabase
  const handleChecklistToggle = async (key: string, newValue: boolean) => {
    if (!job) return;
    const updatedChecklist = {
      ...(job.checklist || {}),
      [key]: newValue
    };

    try {
      const { error } = await supabase
        .from('jobs')
        .update({ checklist: updatedChecklist })
        .eq('id', job.id);

      if (error) throw error;

      setJob((prev: any) => prev ? { ...prev, checklist: updatedChecklist } : null);
      setToastMessage('Checklist updated!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to update checklist:', err);
      alert('Update checklist failed: ' + err.message);
    }
  };

  // Save materials log to Supabase
  const handleSaveMaterials = async () => {
    if (!job) return;
    setIsSavingMaterials(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ materials_used: materialsInput })
        .eq('id', job.id);

      if (error) throw error;

      setToastMessage('Materials log saved!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to save materials:', err);
      alert('Failed to save materials: ' + err.message);
    } finally {
      setIsSavingMaterials(false);
    }
  };

  // Generate Draft Invoice from Completed Job
  const handleGenerateInvoice = async () => {
    if (!job) return;
    setGeneratingInvoice(true);
    try {
      // 0. Check if invoice already exists
      const { data: existing, error: existErr } = await supabase
        .from('invoices')
        .select('id')
        .eq('job_id', job.id)
        .maybeSingle();

      if (!existErr && existing) {
        alert('An invoice has already been generated for this job.');
        navigate(`/invoices/${existing.id}`);
        return;
      }

      // 1. Calculate dates (Net 15)
      const today = new Date();
      const dueDate = new Date();
      dueDate.setDate(today.getDate() + 15);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      // 2. Prepare line items
      const subtotal = job.quoted_amount || 0;
      const tax = parseFloat((subtotal * 0.13).toFixed(2));
      const total = parseFloat((subtotal + tax).toFixed(2));

      const lineItems = [
        {
          description: `Insulation Installation Services (Job #${job.job_number})`,
          quantity: 1,
          unit_price: subtotal
        }
      ];

      // 3. Create Draft Invoice in Supabase
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          job_id: job.id,
          customer_id: job.customer_id,
          line_items: lineItems,
          subtotal: subtotal,
          tax: tax,
          total: total,
          status: 'Draft',
          due_date: dueDateStr
        }])
        .select()
        .maybeSingle();

      if (invoiceError) throw invoiceError;

      alert('Invoice generated successfully in Draft mode!');
      if (invoiceData) {
        navigate(`/invoices/${invoiceData.id}`);
      }
    } catch (err: any) {
      console.error('Invoice generation failed:', err);
      alert('Failed to generate invoice: ' + err.message);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  // Submit problem report to public.job_issues table
  const handleReportIssue = async () => {
    if (!job || !issueDescription.trim()) return;
    setIsReportingIssue(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('You must be signed in.');

      const { error } = await supabase
        .from('job_issues')
        .insert([{
          job_id: job.id,
          worker_id: session.user.id,
          description: issueDescription.trim(),
          photo_url: null
        }]);

      if (error) throw error;

      setIsIssueModalOpen(false);
      setIssueDescription('');
      setToastMessage('Problem reported successfully!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to report issue:', err);
      alert('Failed to report issue: ' + err.message);
    } finally {
      setIsReportingIssue(false);
    }
  };

  // Helper to format currency
  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  // Robust Date Formatting Helper
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unscheduled';
    try {
      const parsedDate = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
      if (isNaN(parsedDate.getTime())) return 'Invalid Date';
      return parsedDate.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  // Render visual status icon
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'quoted':
        return <Bookmark size={20} className="text-stone-500" />;
      case 'scheduled':
        return <Calendar size={20} className="text-blue-500" />;
      case 'in_progress':
      case 'in progress':
        return <Wrench size={20} className="text-sky-500" />;
      case 'completed':
        return <CheckCircle2 size={20} className="text-green-500" />;
      case 'invoiced':
        return <FileText size={20} className="text-purple-500" />;
      case 'paid':
        return <DollarSign size={20} className="text-brand-green" />;
      case 'cancelled':
        return <XCircle size={20} className="text-red-500" />;
      default:
        return <AlertCircle size={20} className="text-brand-grey-dark" />;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-3 text-brand-grey-dark">
        <Loader2 className="w-10 h-10 animate-spin text-brand-green" />
        <span className="text-sm font-medium">Loading work order details...</span>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex-1 p-6 md:p-8 flex flex-col items-center justify-center min-h-screen text-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-brand-charcoal m-0">Work Order Not Found</h2>
        <p className="text-sm text-brand-grey-dark max-w-md mt-2">
          {error || 'The requested insulation job details could not be loaded.'}
        </p>
        <button
          onClick={() => navigate('/jobs')}
          className="mt-6 inline-flex items-center gap-2 bg-brand-charcoal hover:bg-brand-dark text-white px-5 py-2.5 rounded-lg font-bold transition-all cursor-pointer text-sm"
        >
          <ArrowLeft size={16} />
          <span>Back to Jobs Pipeline</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto max-h-screen relative">
      
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-brand-charcoal text-white px-4 py-3 rounded-lg shadow-xl border border-brand-dark flex items-center gap-2 text-sm font-semibold animate-slide-up">
          <Check size={16} className="text-brand-green stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar Navigation & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/jobs')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-charcoal hover:text-brand-green transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} className="stroke-[2.5]" />
          <span>Back to Jobs</span>
        </button>

        {/* Job Actions (Admin/Office Only) */}
        {currentUserRole !== 'field_worker' && (
          <div className="flex items-center gap-2">
            {job.status === 'Completed' && (
              <button
                onClick={handleGenerateInvoice}
                disabled={generatingInvoice}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal text-xs font-black uppercase tracking-wider rounded-lg shadow cursor-pointer transition-colors"
                title="Generate Invoice"
              >
                {generatingInvoice ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                <span>Generate Invoice</span>
              </button>
            )}

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-brand-grey-medium hover:border-brand-grey-dark text-brand-charcoal text-xs font-bold bg-white rounded-lg transition-colors cursor-pointer"
              title="Edit Details"
            >
              <Edit2 size={14} />
              <span>Edit Job</span>
            </button>
            
            <button
              onClick={handleDeleteJob}
              className="flex items-center gap-1.5 px-4 py-2 border border-red-200 hover:border-red-400 hover:bg-red-50 text-red-600 text-xs font-bold bg-white rounded-lg transition-colors cursor-pointer"
              title="Delete Job"
            >
              <Trash2 size={14} />
              <span>Delete Job</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Detail Dashboard Card */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-grey-medium overflow-hidden">
        {/* Top Lime-green brand accent */}
        <div className="h-2 bg-brand-green w-full" />

        <div className="p-6 md:p-8 space-y-6">
          
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-grey-medium pb-6">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-grey-dark">
                Residential Insulation Work Order
              </span>
              <h1 className="text-3xl font-black text-brand-charcoal tracking-tight m-0 leading-none">
                JOB-{job.job_number}
              </h1>
            </div>

            {/* Status Live Dropdown Selector */}
            <div className="flex items-center gap-3 bg-brand-grey-light p-3 rounded-xl border border-brand-grey-medium shrink-0">
              <div className="p-1.5 bg-white rounded-lg border border-brand-grey-medium">
                {getStatusIcon(job.status)}
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] uppercase font-bold tracking-wider text-brand-grey-dark leading-none mb-1">
                  Job Status
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={job.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={isUpdatingStatus}
                    className="text-sm font-bold bg-transparent text-brand-charcoal border-none focus:outline-none focus:ring-0 cursor-pointer capitalize pr-8"
                  >
                    {currentUserRole === 'field_worker' ? (
                      <>
                        <option value="Scheduled">Scheduled</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </>
                    ) : (
                      <>
                        <option value="Quoted">Quoted</option>
                        <option value="Scheduled">Scheduled</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Invoiced">Invoiced</option>
                        <option value="Paid">Paid</option>
                        <option value="Cancelled">Cancelled</option>
                      </>
                    )}
                  </select>
                  {isUpdatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-green" />}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Customer Details Link */}
            <div className="bg-brand-grey-light border border-brand-grey-medium rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-brand-grey-medium pb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-charcoal">
                  <Building size={16} className="text-brand-green" />
                  <span>Client Information</span>
                </div>
                {job.customers && currentUserRole !== 'field_worker' && (
                  <Link 
                    to={`/customers/${job.customers.id}`}
                    className="text-xs font-bold text-brand-green hover:underline"
                  >
                    View Profile &rarr;
                  </Link>
                )}
              </div>
              
              {job.customers ? (
                <div className="space-y-2">
                  <div className="text-base font-extrabold text-brand-charcoal">{job.customers.full_name}</div>
                  
                  {job.customers.phone && (
                    <div className="text-xs font-medium text-brand-charcoal">
                      <span className="text-brand-grey-dark">Phone:</span>{' '}
                      <a href={`tel:${job.customers.phone}`} className="hover:text-brand-green font-bold">
                        {job.customers.phone}
                      </a>
                    </div>
                  )}

                  {job.customers.email && (
                    <div className="text-xs font-medium text-brand-charcoal break-all">
                      <span className="text-brand-grey-dark">Email:</span>{' '}
                      <a href={`mailto:${job.customers.email}`} className="hover:text-brand-green font-bold">
                        {job.customers.email}
                      </a>
                    </div>
                  )}

                  <div className="text-xs font-medium text-brand-charcoal leading-relaxed pt-1.5 border-t border-brand-grey/50">
                    <div className="text-[10px] uppercase font-bold text-brand-grey-dark mb-0.5">Service Location</div>
                    <div className="flex items-start gap-1 font-semibold">
                      <MapPin size={12} className="text-brand-green shrink-0 mt-0.5" />
                      <span>{job.customers.service_address}</span>
                    </div>
                    {/* Get Directions Button for Field Workers */}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customers.service_address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-brand-green hover:bg-brand-green-light/40 text-brand-charcoal text-xs font-bold rounded-lg transition-all"
                    >
                      <MapPin size={12} className="text-brand-green" />
                      <span>Get Directions</span>
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-brand-grey-dark italic">Customer record unassociated.</p>
              )}
            </div>

            {/* Insulation Specifications Summary */}
            <div className="bg-brand-grey-light border border-brand-grey-medium rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-charcoal border-b border-brand-grey-medium pb-2.5">
                  <Wrench size={16} className="text-brand-green" />
                  <span>Insulation Specs</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-brand-grey-medium">
                    <div className="text-[10px] font-bold text-brand-grey-dark uppercase">Attic Sqft</div>
                    <div className="text-base font-extrabold text-brand-charcoal mt-1">
                      {job.attic_sqft !== null ? job.attic_sqft.toLocaleString() : '--'}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-brand-grey-medium">
                    <div className="text-[10px] font-bold text-brand-grey-dark uppercase">Existing R</div>
                    <div className="text-base font-extrabold text-brand-charcoal mt-1">
                      {job.existing_r_value !== null ? `R-${job.existing_r_value}` : '--'}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-brand-grey-medium">
                    <div className="text-[10px] font-bold text-brand-grey-dark uppercase">Target R</div>
                    <div className="text-base font-extrabold text-brand-charcoal mt-1">
                      {job.target_r_value !== null ? `R-${job.target_r_value}` : '--'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3.5 border-t border-brand-grey/50">
                {/* Date scheduling */}
                <div className="space-y-0.5">
                  <div className="text-[9px] uppercase font-bold text-brand-grey-dark leading-none">Scheduling Info</div>
                  <div className="flex flex-col gap-1 text-xs font-semibold text-brand-charcoal pt-1">
                    <div className="flex items-center gap-1">
                      <Calendar size={13} className="text-brand-green shrink-0" />
                      <span className="truncate">{formatDate(job.scheduled_date)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-green shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span className="truncate text-[11px]">
                        {job.start_time && job.end_time ? (() => {
                          const formatTime = (t: string) => {
                            const [h, m] = t.split(':');
                            let hour = parseInt(h, 10);
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            hour = hour % 12 || 12;
                            return `${hour}:${m} ${ampm}`;
                          };
                          return `${formatTime(job.start_time)} – ${formatTime(job.end_time)}`;
                        })() : 'Not set'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Worker assignment dispatch */}
                <div className="space-y-0.5 flex flex-col">
                  <div className="text-[9px] uppercase font-bold text-brand-grey-dark leading-none">Crew Assigned</div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-brand-charcoal pt-0.5">
                    <User size={13} className="text-brand-green shrink-0" />
                    {currentUserRole === 'field_worker' ? (
                      <span className="text-xs font-bold text-brand-charcoal">
                        {workers.find(w => w.id === job.assigned_worker_id)?.full_name || 'Unassigned'}
                      </span>
                    ) : (
                      <select
                        value={job.assigned_worker_id || ''}
                        onChange={(e) => handleAssignWorker(e.target.value)}
                        disabled={isUpdatingWorker}
                        className="text-xs font-bold bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer text-brand-charcoal pr-8 py-0 leading-none h-auto select-none"
                      >
                        <option value="">Unassigned</option>
                        {workers.map(w => (
                          <option key={w.id} value={w.id}>{w.full_name}</option>
                        ))}
                      </select>
                    )}
                    {!isUpdatingWorker && currentUserRole === 'field_worker' && <span className="text-[10px] text-brand-grey-dark italic ml-1.5">(Read-only)</span>}
                    {isUpdatingWorker && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-green shrink-0 ml-1" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Ledger Details (Admin/Office Only) */}
            {currentUserRole !== 'field_worker' && (
              <div className="bg-brand-grey-light border border-brand-grey-medium rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-charcoal border-b border-brand-grey-medium pb-2.5">
                  <DollarSign size={16} className="text-brand-green" />
                  <span>Financial Ledger</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-brand-grey-medium">
                    <span className="text-xs text-brand-grey-dark font-medium">Quoted Amount</span>
                    <span className="text-sm font-extrabold text-brand-charcoal">
                      {formatCurrency(job.quoted_amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-brand-grey-medium">
                    <span className="text-xs text-brand-grey-dark font-medium">Est. Material Cost</span>
                    <span className="text-sm font-bold text-brand-charcoal">
                      {formatCurrency(job.estimated_material_cost)}
                    </span>
                  </div>

                  {job.quoted_amount !== null && job.estimated_material_cost !== null && (
                    <div className="flex items-center justify-between px-2 pt-2 border-t border-brand-grey-medium">
                      <span className="text-[10px] text-brand-grey-dark uppercase font-bold">Est. Gross Profit</span>
                      <span className="text-xs font-extrabold text-brand-green">
                        {formatCurrency(job.quoted_amount - job.estimated_material_cost)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Photos and Sign-off Workspace Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6 border-t border-brand-grey-medium">
            
            {/* Left Column: Photos Gallery and Scope Details (Col-span 2) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Photo Uploads Gallery Component */}
              <div id="job-photos-section">
                <JobPhotos jobId={job.id} />
              </div>
              
              {/* Scope of Work Section */}
              <div className="bg-brand-grey-light border border-brand-grey-medium rounded-xl p-5 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-grey-dark m-0">
                  Scope of Work & Audit Details
                </h3>
                <div className="bg-white border border-brand-grey-medium rounded-xl p-4 min-h-24">
                  {job.scope_of_work ? (
                    <p className="text-sm text-brand-charcoal leading-relaxed whitespace-pre-wrap m-0 font-medium">
                      {job.scope_of_work}
                    </p>
                  ) : (
                    <p className="text-sm text-brand-grey-dark italic m-0">
                      No explicit scope of work details documented for this job.
                    </p>
                  )}
                </div>
              </div>

              {/* Operational Audit Checklist Section */}
              <div className="bg-brand-grey-light border border-brand-grey-medium rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-grey-dark m-0">
                  Operational Audit Checklist
                </h3>
                <div className="bg-white border border-brand-grey-medium rounded-xl p-4 space-y-3">
                  {Object.entries(job.checklist || {}).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-3 text-sm font-semibold text-brand-charcoal cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={!!value}
                        onChange={() => handleChecklistToggle(key, !value)}
                        className="w-4 h-4 text-brand-green border-brand-grey-medium focus:ring-brand-green/20 rounded"
                      />
                      <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Materials Used Section */}
              <div className="bg-brand-grey-light border border-brand-grey-medium rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-grey-dark m-0">
                  Materials Used Log
                </h3>
                <div className="space-y-3">
                  <textarea
                    value={materialsInput}
                    onChange={(e) => setMaterialsInput(e.target.value)}
                    placeholder="List materials and quantities used (e.g. 12 bags cellulose, air baffle sheets...)"
                    className="w-full h-24 p-3 border border-brand-grey-medium rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                  />
                  <button
                    onClick={handleSaveMaterials}
                    disabled={isSavingMaterials}
                    className="w-full py-2 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isSavingMaterials && <Loader2 size={13} className="animate-spin" />}
                    <span>Save Materials Log</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Right Column: Customer Sign-off Card (Col-span 1) */}
            <div className="lg:col-span-1">
              <div className="bg-brand-grey-light border border-brand-grey-medium rounded-xl p-5 space-y-4 flex flex-col justify-between h-full min-h-[300px]">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-charcoal border-b border-brand-grey-medium pb-2.5">
                    <CheckCircle2 size={16} className="text-brand-green" />
                    <span>Customer Sign-off</span>
                  </div>

                  {job.customer_signature_url ? (
                    <div className="mt-4 space-y-3 flex flex-col items-center">
                      <div className="bg-white border border-brand-grey-medium rounded-lg p-2 shadow-inner w-full flex items-center justify-center h-32 overflow-hidden">
                        <img 
                          src={job.customer_signature_url} 
                          alt="Customer Signature" 
                          className="max-h-full max-w-full object-contain" 
                        />
                      </div>
                      <div className="text-[10px] text-brand-grey-dark font-medium text-center">
                        Signed on: <span className="font-bold text-brand-charcoal">{formatDate(job.signed_at)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 py-12 text-center flex flex-col items-center justify-center border border-dashed border-brand-grey-dark/40 rounded-xl bg-white/50 select-none">
                      <span className="text-xs text-brand-grey-dark italic">Unsigned work order</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-brand-grey/50 flex flex-col gap-2">
                  {job.customer_signature_url ? (
                    <button
                      onClick={() => setIsSignatureModalOpen(true)}
                      className="w-full py-2 border border-brand-grey-dark/40 hover:bg-brand-grey text-brand-charcoal text-xs font-bold rounded-lg transition-colors cursor-pointer text-center"
                    >
                      Capture New Signature
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsSignatureModalOpen(true)}
                      className="w-full py-2 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal text-xs font-bold rounded-full shadow-sm hover:shadow transition-all cursor-pointer text-center"
                    >
                      Sign Completed Work
                    </button>
                  )}

                  <button
                    onClick={() => setIsIssueModalOpen(true)}
                    className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
                  >
                    <span>Report a Problem</span>
                  </button>
                </div>

          </div>
        </div>
      </div>
    </div>
  </div>

      {/* Edit Job Modal */}
      <CreateJobModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchJobDetails}
        jobToEdit={job}
      />

      {/* Signature Capture Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        jobId={job.id}
        onSuccess={fetchJobDetails}
      />

      {/* Report a Problem Modal */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-brand-charcoal/65 backdrop-blur-sm"
            onClick={() => setIsIssueModalOpen(false)}
          />

          <div className="relative bg-white w-full max-w-md rounded-2xl border border-brand-grey-medium shadow-2xl overflow-hidden z-10 flex flex-col animate-scale-up">
            <div className="p-4 bg-brand-charcoal text-white flex items-center gap-2">
              <AlertCircle size={18} className="text-red-500" />
              <h3 className="text-sm font-bold text-white m-0">Report a Problem / Delay</h3>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-brand-grey-dark leading-relaxed m-0 font-medium">
                Log an issue against this work order (e.g. access problems, unexpected attic layout, delayed schedule). The office admin will see this report immediately.
              </p>
              
              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                className="w-full h-32 p-3 border border-brand-grey-medium rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white animate-fade-in"
              />
            </div>

            <div className="px-5 py-3.5 bg-brand-grey border-t border-brand-grey-medium flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="px-3.5 py-1.5 border border-brand-grey-dark/40 hover:bg-brand-grey-medium text-brand-charcoal text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleReportIssue}
                disabled={isReportingIssue || !issueDescription.trim()}
                className="px-4.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isReportingIssue && <Loader2 size={13} className="animate-spin inline mr-1" />}
                <span>Submit Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Completion Validation Blocker Modal */}
      {completedValidationError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-brand-charcoal/65 backdrop-blur-sm"
            onClick={() => setCompletedValidationError(null)}
          />

          <div className="relative bg-white w-full max-w-md rounded-2xl border border-brand-grey-medium shadow-2xl overflow-hidden z-10 flex flex-col animate-scale-up">
            <div className="p-4 bg-brand-charcoal text-white flex items-center gap-2">
              <AlertCircle size={18} className="text-red-500" />
              <h3 className="text-sm font-bold text-white m-0">Mandatory Pre-Completion Check</h3>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-brand-grey-dark leading-relaxed m-0 font-medium">
                To transition this job to "Completed", the following mandatory field checklist audits must be resolved:
              </p>

              <div className="space-y-3">
                {completedValidationError.missingPhoto && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-red-700">Missing Post-Audit Media</div>
                      <div className="text-[10px] text-red-600 font-medium">Add at least one "after" photo to document completed quality standards.</div>
                    </div>
                    <button
                      onClick={() => {
                        setCompletedValidationError(null);
                        setTimeout(() => {
                          const el = document.getElementById('job-photos-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      className="shrink-0 text-[10px] font-extrabold bg-red-600 hover:bg-red-700 text-white rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
                    >
                      Upload Photo
                    </button>
                  </div>
                )}

                {completedValidationError.missingSignature && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-red-700">Customer Sign-off Required</div>
                      <div className="text-[10px] text-red-600 font-medium">Obtain and capture customer signature authorization.</div>
                    </div>
                    <button
                      onClick={() => {
                        setCompletedValidationError(null);
                        setTimeout(() => {
                          setIsSignatureModalOpen(true);
                        }, 100);
                      }}
                      className="shrink-0 text-[10px] font-extrabold bg-red-600 hover:bg-red-700 text-white rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
                    >
                      Sign Job
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 bg-brand-grey border-t border-brand-grey-medium flex items-center justify-end">
              <button
                type="button"
                onClick={() => setCompletedValidationError(null)}
                className="px-5 py-1.5 border border-brand-grey-dark/40 hover:bg-brand-grey-medium text-brand-charcoal text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Close Blocker
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
