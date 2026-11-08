import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { CreateJobModal } from '../../components/CreateJobModal';
import { JobPhotos } from '../../components/JobPhotos';
import { SignatureModal } from '../../components/SignatureModal';
import { Badge, Button, Card, Page, Select, StatusBadge, Textarea } from '../../components/ui';
import { OverflowMenu } from '../../components/ui/list';
import { DetailGrid, DetailHeader, DetailLoading, DetailNotFound, InfoList, InfoRow, MobileActionBar, Tiles } from '../../components/ui/detail';
import { 
  Loader2, 
  Calendar, 
  MapPin, 
  AlertCircle, 
  Wrench, 
  CheckCircle2, 
  FileText,
  Building,
  Check,
  Edit2,
  Trash2,
  User,
  ClipboardCheck,
  PlayCircle
} from 'lucide-react';
import { InspectionReport } from '../../components/inspections/types';
import { CurrentConditionCard } from '../../components/inspections/CurrentConditionCard';
import { InspectionModal } from '../../components/inspections/InspectionModal';
import { fetchLatestInspectionForCustomer } from '../../components/inspections/inspectionService';


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
  job_crew?: Array<{
    worker_id: string;
    profiles?: {
      id: string;
      full_name: string;
    } | null;
  }>;
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

  // Inspection Report State
  const [currentInspection, setCurrentInspection] = useState<InspectionReport | null>(null);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);

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
        .select('*, customers(*), job_crew(worker_id, profiles:worker_id(id, full_name))')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (!data) {
        setError('Work order not found.');
        return;
      }

      setJob(data as any);
      setMaterialsInput((data as any).materials_used || '');

      // Fetch latest inspection for customer
      if (data.customer_id) {
        try {
          const insp = await fetchLatestInspectionForCustomer(data.customer_id);
          setCurrentInspection(insp);
        } catch (inspErr) {
          console.error('Error fetching inspection for job in admin view:', inspErr);
        }
      }
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

  // Robust Date Formatting Helper — jobs are stored at midnight UTC, so read the calendar date from the string.
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled';
    const parsedDate = new Date(`${dateStr.slice(0, 10)}T12:00:00`);
    if (isNaN(parsedDate.getTime())) return 'Invalid date';
    return parsedDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatSignedAt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

  const formatTime = (t?: string | null) => {
    if (!t) return null;
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  if (loading) return <DetailLoading label="Loading job…" />;

  if (error || !job) {
    return <DetailNotFound title="Job not found" message={error} back={{ to: '/jobs', label: 'Back to jobs' }} />;
  }

  const isOffice = currentUserRole !== 'field_worker';

  const crewNames: string[] = [];
  job.job_crew?.forEach(c => {
    if (c.profiles?.full_name && !crewNames.includes(c.profiles.full_name)) crewNames.push(c.profiles.full_name);
  });
  if (crewNames.length === 0 && job.assigned_worker_id) {
    const fallbackWorker = workers.find(w => w.id === job.assigned_worker_id);
    if (fallbackWorker) crewNames.push(fallbackWorker.full_name);
  }

  /** The one obvious next step for this job, based on its status. */
  const nextStep = (() => {
    if (job.status === 'Scheduled' || job.status === 'Quoted') {
      return { label: 'Start job', icon: PlayCircle, onClick: () => handleStatusChange('In Progress'), loading: isUpdatingStatus };
    }
    if (job.status === 'In Progress') {
      return { label: 'Mark complete', icon: CheckCircle2, onClick: () => handleStatusChange('Completed'), loading: isUpdatingStatus };
    }
    if (job.status === 'Completed' && isOffice) {
      return { label: 'Create invoice', icon: FileText, onClick: handleGenerateInvoice, loading: generatingInvoice };
    }
    return null;
  })();

  const statusOptions = isOffice
    ? ['Quoted', 'Scheduled', 'In Progress', 'Completed', 'Invoiced', 'Paid', 'Cancelled']
    : ['Scheduled', 'In Progress', 'Completed'];

  const mapsUrl = job.customers?.service_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customers.service_address)}`
    : null;

  const moreActions = [
    { label: currentInspection ? 'View inspection' : 'Add inspection', icon: ClipboardCheck, onClick: () => setIsInspectionModalOpen(true) },
    { label: 'Report a problem', icon: AlertCircle, onClick: () => setIsIssueModalOpen(true) },
    ...(isOffice ? [{ label: 'Delete job', icon: Trash2, onClick: handleDeleteJob, danger: true }] : []),
  ];

  return (
    <Page className="pb-28 md:pb-7">
      {toastMessage && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-navy text-white px-4 py-3 rounded-xl shadow-pop flex items-center gap-2 text-sm font-medium animate-slide-up">
          <Check size={16} className="text-brand" strokeWidth={3} />
          <span>{toastMessage}</span>
        </div>
      )}

      <DetailHeader
        back={{ to: '/jobs', label: 'Jobs' }}
        title={job.customers?.full_name || `Job #${job.job_number}`}
        badges={<StatusBadge status={job.status} />}
        meta={
          <>
            <span>Job #{job.job_number}</span>
            <span aria-hidden>·</span>
            <span>
              {formatDate(job.scheduled_date)}
              {formatTime(job.start_time) ? ` at ${formatTime(job.start_time)}` : ''}
            </span>
          </>
        }
        actions={
          <>
            <OverflowMenu actions={moreActions} />
            {isOffice && (
              <Button variant="secondary" icon={Edit2} onClick={() => setIsModalOpen(true)}>
                Edit
              </Button>
            )}
            {nextStep && (
              <Button icon={nextStep.icon} onClick={nextStep.onClick} loading={nextStep.loading}>
                {nextStep.label}
              </Button>
            )}
          </>
        }
      />

      <DetailGrid
        main={
          <>
            {/* Overview */}
            <Card title="Job details" padded>
              <div className="space-y-5">
                <InfoList>
                  <InfoRow icon={Building} label="Customer">
                    {job.customers ? (
                      <div className="space-y-0.5">
                        {isOffice ? (
                          <Link to={`/contacts/${job.customers.id}`} className="font-semibold text-navy no-underline hover:underline">
                            {job.customers.full_name}
                          </Link>
                        ) : (
                          <span className="font-semibold">{job.customers.full_name}</span>
                        )}
                        <div className="flex flex-wrap gap-x-3 text-sm">
                          {job.customers.phone && (
                            <a href={`tel:${job.customers.phone}`} className="text-brand-ink no-underline hover:underline">
                              {job.customers.phone}
                            </a>
                          )}
                          {job.customers.email && (
                            <a href={`mailto:${job.customers.email}`} className="text-brand-ink no-underline hover:underline break-all">
                              {job.customers.email}
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted">No customer linked</span>
                    )}
                  </InfoRow>
                  <InfoRow icon={MapPin} label="Address">
                    {job.customers?.service_address || <span className="text-muted">—</span>}
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block mt-1 text-sm font-medium text-brand-ink no-underline hover:underline">
                        Get directions →
                      </a>
                    )}
                  </InfoRow>
                  <InfoRow icon={Calendar} label="Scheduled">
                    {formatDate(job.scheduled_date)}
                    {formatTime(job.start_time) && <span className="text-muted"> · {formatTime(job.start_time)}</span>}
                  </InfoRow>
                  <InfoRow icon={User} label="Crew">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {crewNames.length === 0 ? (
                        <span className="text-amber-700 font-medium">Needs a crew</span>
                      ) : (
                        crewNames.map(name => (
                          <Badge key={name} tone="neutral">
                            {name}
                          </Badge>
                        ))
                      )}
                      {isOffice && (
                        <button type="button" onClick={() => setIsModalOpen(true)} className="text-sm font-medium text-brand-ink hover:underline border-0 bg-transparent">
                          {crewNames.length ? 'Change' : 'Assign'}
                        </button>
                      )}
                    </div>
                  </InfoRow>
                  <InfoRow icon={Wrench} label="Status">
                    <div className="flex items-center gap-2">
                      <Select
                        value={job.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        disabled={isUpdatingStatus}
                        className="!h-9 !w-auto min-w-[160px]"
                        aria-label="Job status"
                      >
                        {statusOptions.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                      {isUpdatingStatus && <Loader2 size={16} className="animate-spin text-brand" />}
                    </div>
                  </InfoRow>
                </InfoList>

                <div>
                  <div className="text-xs font-medium text-muted mb-2">Insulation</div>
                  <Tiles
                    items={[
                      { label: 'Attic sq ft', value: job.attic_sqft !== null ? job.attic_sqft.toLocaleString() : '—' },
                      { label: 'Existing R', value: job.existing_r_value !== null ? `R-${job.existing_r_value}` : '—' },
                      { label: 'Target R', value: job.target_r_value !== null ? `R-${job.target_r_value}` : '—' },
                    ]}
                  />
                </div>
              </div>
            </Card>

            <CurrentConditionCard
              inspection={currentInspection}
              onOpenNewInspection={() => setIsInspectionModalOpen(true)}
              onEditInspection={() => setIsInspectionModalOpen(true)}
              canEdit={true}
              showStepNumber={false}
            />

            <div id="job-photos-section">
              <JobPhotos jobId={job.id} />
            </div>

            <Card title="Scope of work">
              {job.scope_of_work ? (
                <p className="m-0 text-sm text-navy leading-relaxed whitespace-pre-wrap">{job.scope_of_work}</p>
              ) : (
                <p className="m-0 text-sm text-muted">No scope of work written for this job yet.</p>
              )}
            </Card>

            {Object.keys(job.checklist || {}).length > 0 && (
              <Card title="Checklist" description="Tick each item as it's done on site.">
                <div className="space-y-1">
                  {Object.entries(job.checklist || {}).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-3 min-h-[44px] px-2 -mx-2 rounded-lg hover:bg-canvas text-sm text-navy cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!value}
                        onChange={() => handleChecklistToggle(key, !value)}
                        className="w-5 h-5 accent-[#76C442] cursor-pointer"
                      />
                      <span className={`capitalize ${value ? 'text-muted line-through' : ''}`}>{key.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </Card>
            )}

            <Card title="Materials used">
              <div className="space-y-3">
                <Textarea
                  value={materialsInput}
                  onChange={e => setMaterialsInput(e.target.value)}
                  placeholder="e.g. 12 bags cellulose, 20 air baffles…"
                />
                <div className="flex justify-end">
                  <Button variant="secondary" onClick={handleSaveMaterials} loading={isSavingMaterials}>
                    Save materials
                  </Button>
                </div>
              </div>
            </Card>
          </>
        }
        side={
          <>
            {isOffice && (
              <Card title="Money">
                <InfoList>
                  <InfoRow label="Quoted">{formatCurrency(job.quoted_amount)}</InfoRow>
                  <InfoRow label="Est. materials">{formatCurrency(job.estimated_material_cost)}</InfoRow>
                  {job.quoted_amount !== null && job.estimated_material_cost !== null && (
                    <InfoRow label="Est. profit">
                      <span className="font-semibold text-brand-ink">{formatCurrency(job.quoted_amount - job.estimated_material_cost)}</span>
                    </InfoRow>
                  )}
                </InfoList>
                {job.status === 'Completed' && (
                  <Button block className="mt-4" icon={FileText} onClick={handleGenerateInvoice} loading={generatingInvoice}>
                    Create invoice
                  </Button>
                )}
              </Card>
            )}

            <Card title="Customer sign-off">
              {job.customer_signature_url ? (
                <div className="space-y-2">
                  <div className="rounded-lg border border-line bg-canvas h-32 flex items-center justify-center overflow-hidden p-2">
                    <img src={job.customer_signature_url} alt="Customer signature" className="max-h-full max-w-full object-contain" />
                  </div>
                  <p className="m-0 text-xs text-muted text-center">Signed {formatSignedAt(job.signed_at)}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-line-strong bg-canvas py-8 text-center text-sm text-muted">Not signed yet</div>
              )}
              <div className="mt-4 space-y-2">
                <Button
                  block
                  variant={job.customer_signature_url ? 'secondary' : 'primary'}
                  onClick={() => setIsSignatureModalOpen(true)}
                >
                  {job.customer_signature_url ? 'Capture a new signature' : 'Get customer signature'}
                </Button>
                <Button block variant="ghost" icon={AlertCircle} onClick={() => setIsIssueModalOpen(true)} className="!text-red-700 hover:!bg-red-50">
                  Report a problem
                </Button>
              </div>
            </Card>
          </>
        }
      />

      <MobileActionBar>
        {isOffice && (
          <Button variant="secondary" icon={Edit2} onClick={() => setIsModalOpen(true)}>
            Edit
          </Button>
        )}
        {nextStep ? (
          <Button icon={nextStep.icon} onClick={nextStep.onClick} loading={nextStep.loading}>
            {nextStep.label}
          </Button>
        ) : (
          <Button variant="secondary" icon={ClipboardCheck} onClick={() => setIsInspectionModalOpen(true)}>
            Inspection
          </Button>
        )}
      </MobileActionBar>

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
            <div className="px-5 py-4 bg-white text-navy border-b border-line flex items-center gap-2">
              <AlertCircle size={18} className="text-red-500" />
              <h3 className="text-sm font-bold text-navy m-0">Report a Problem / Delay</h3>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-brand-grey-dark leading-relaxed m-0 font-medium">
                Log an issue against this work order (e.g. access problems, unexpected attic layout, delayed schedule). The office admin will see this report immediately.
              </p>
              
              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                className="w-full h-32 p-3 border border-line rounded-lg text-sm focus:outline-none bg-white animate-fade-in text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
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
            <div className="px-5 py-4 bg-white text-navy border-b border-line flex items-center gap-2">
              <AlertCircle size={18} className="text-red-500" />
              <h3 className="text-sm font-bold text-navy m-0">Mandatory Pre-Completion Check</h3>
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
                      <div className="text-2xs text-red-600 font-medium">Add at least one "after" photo to document completed quality standards.</div>
                    </div>
                    <button
                      onClick={() => {
                        setCompletedValidationError(null);
                        setTimeout(() => {
                          const el = document.getElementById('job-photos-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      className="shrink-0 text-2xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
                    >
                      Upload Photo
                    </button>
                  </div>
                )}

                {completedValidationError.missingSignature && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-red-700">Customer Sign-off Required</div>
                      <div className="text-2xs text-red-600 font-medium">Obtain and capture customer signature authorization.</div>
                    </div>
                    <button
                      onClick={() => {
                        setCompletedValidationError(null);
                        setTimeout(() => {
                          setIsSignatureModalOpen(true);
                        }, 100);
                      }}
                      className="shrink-0 text-2xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
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

      {/* Inspection Modal */}
      {job?.customer_id && (
        <InspectionModal
          isOpen={isInspectionModalOpen}
          onClose={() => setIsInspectionModalOpen(false)}
          onSuccess={async () => {
            if (job.customer_id) {
              const insp = await fetchLatestInspectionForCustomer(job.customer_id);
              setCurrentInspection(insp);
            }
            setIsInspectionModalOpen(false);
          }}
          customerId={job.customer_id}
          jobId={job.id}
          reportToEdit={currentInspection}
        />
      )}

    </Page>
  );
};
