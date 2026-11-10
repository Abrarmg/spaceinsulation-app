import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { JobPhotos } from '../../components/JobPhotos';
import { SignatureModal } from '../../components/SignatureModal';
import { Loader2, Calendar, MapPin, AlertCircle, CheckCircle2, Phone, Mail, Navigation, Wrench, FileText, Check, Trash2, Camera, User, Clock, Package, XCircle, ClipboardCheck, Plus, PlayCircle, RotateCcw, Send, Truck, PenLine } from 'lucide-react';
import { Page, StatusBadge } from '../../components/ui';
import { OverflowMenu } from '../../components/ui/list';
import { BackLink } from '../../components/ui/detail';
import { useConfirm } from '../../hooks/useFeedback';
import { todayLocal } from '../../utils/dates';
import { InspectionReport } from '../../components/inspections/types';
import { DetailLoading, DetailNotFound } from '../../components/ui/detail';
import { CurrentConditionCard } from '../../components/inspections/CurrentConditionCard';
import { InspectionModal } from '../../components/inspections/InspectionModal';
import { fetchLatestInspectionForCustomer } from '../../components/inspections/inspectionService';

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
  start_time?: string | null;
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

// Quick site checks before work starts. Optional (not needed to complete the job);
// saved alongside the job checklist.
const PRE_CHECKS = ['Homeowner knows we have arrived', 'Floors and work area protected', 'Attic access is clear'];

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

  const [tab, setTab] = useState<'job' | 'details' | 'materials'>('job');
  // Whether this crew member is clocked in right now (null while checking).
  const [clockedIn, setClockedIn] = useState<boolean | null>(null);
  const [myFirstName, setMyFirstName] = useState('');
  const { confirm, confirmDialog } = useConfirm();

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user;
      if (!user) {
        if (!cancelled) setClockedIn(false);
        return;
      }
      if (!cancelled) setMyFirstName(((user.user_metadata?.full_name as string) || '').split(' ')[0]);
      const { data } = await supabase.from('time_entries').select('id').eq('worker_id', user.id).is('clock_out', null).limit(1);
      if (!cancelled) setClockedIn(!!data && data.length > 0);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Inspection Report State
  const [currentInspection, setCurrentInspection] = useState<InspectionReport | null>(null);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);

  const fetchJobDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('jobs')
        .select('*, customers(*), profiles(full_name), job_crew(worker_id, profiles:worker_id(id, full_name))')
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

      // Fetch latest inspection for the job's customer
      if (data.customer_id) {
        try {
          const insp = await fetchLatestInspectionForCustomer(data.customer_id);
          setCurrentInspection(insp);
        } catch (inspErr) {
          console.error('Error fetching inspection for job:', inspErr);
        }
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

        const ok = await confirm({
          title: 'Mark this job complete?',
          message: 'The office will be told it is ready to invoice.',
          confirmLabel: 'Complete job',
        });
        if (!ok) {
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

  if (loading) return <DetailLoading label="Loading job…" />;
  if (error || !job) return <DetailNotFound title="Job not found" message={error} back={{ to: '/jobs', label: 'Back to my jobs' }} />;

  const jobDay = job.scheduled_date ? job.scheduled_date.slice(0, 10) : null;
  const dateStr = jobDay
    ? new Date(`${jobDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Not scheduled';
  const dayLabel = !jobDay ? null : jobDay === todayLocal() ? 'Today' : jobDay === todayLocal(1) ? 'Tomorrow' : jobDay === todayLocal(-1) ? 'Yesterday' : null;

  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };
  const timeStr = job.start_time ? formatTime(job.start_time) : 'Anytime';

  const checklistCount = CHECKLIST_ITEMS.filter(item => job.checklist?.[item]).length;
  const checklistProgress = Math.round((checklistCount / CHECKLIST_ITEMS.length) * 100);

  const crewNames: string[] = [];
  ((job as any).job_crew || []).forEach((c: any) => {
    if (c.profiles?.full_name && !crewNames.includes(c.profiles.full_name)) crewNames.push(c.profiles.full_name);
  });
  if (crewNames.length === 0 && job.profiles?.full_name) crewNames.push(job.profiles.full_name);

  const address = job.customers?.service_address || '';
  const phone = job.customers?.phone || '';
  const directionsUrl = address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` : null;
  // "On my way": opens the phone's messages app with a ready-written text to the customer.
  const customerFirst = (job.customers?.full_name || '').split(' ')[0];
  const onMyWayText = `Hi${customerFirst ? ` ${customerFirst}` : ''}, this is ${myFirstName || 'your installer'} from Space Insulation. We're on our way and will be there soon.`;
  const onMyWayUrl = phone ? `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(onMyWayText)}` : null;

  const isDone = job.status === 'Completed';
  const isClosed = isDone || job.status === 'Cancelled';
  const inProgress = job.status === 'In Progress';
  const primary = isClosed
    ? null
    : inProgress
      ? { label: 'Complete job', icon: CheckCircle2, onClick: () => handleStatusChange('Completed') }
      : { label: 'Start job', icon: PlayCircle, onClick: () => handleStatusChange('In Progress') };

  const moreActions = [
    ...(inProgress ? [{ label: 'Move back to scheduled', icon: RotateCcw, onClick: () => handleStatusChange('Scheduled') }] : []),
    { label: currentInspection ? 'View inspection' : 'Add inspection', icon: ClipboardCheck, onClick: () => setIsInspectionModalOpen(true) },
    { label: 'Report a problem', icon: AlertCircle, onClick: () => setIsIssueModalOpen(true), danger: true },
  ];

  const quickBtn = 'h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white text-sm font-semibold text-navy no-underline hover:bg-mist';
  const card = 'bg-white rounded-xl border border-line shadow-card';

  return (
    <Page className="pb-32 md:pb-10">
      <BackLink to="/jobs" label="My jobs" />

      {/* Header: who, where, when, and the one big next step */}
      <section className={`${card} rounded-2xl p-4 md:p-6 space-y-4`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-9 h-9 rounded-xl bg-brand-soft text-brand-ink flex items-center justify-center shrink-0">
            <Truck size={18} />
          </span>
          {dayLabel && <span className="text-sm font-semibold text-navy">{dayLabel}</span>}
          <StatusBadge status={job.status} />
          <span className="text-sm text-muted">Job #{job.job_number}</span>
          {isUpdatingStatus && <Loader2 size={16} className="animate-spin text-subtle" />}
        </div>

        <h1 className="m-0 text-2xl md:text-3xl font-bold text-navy tracking-tight leading-tight">
          Job for {job.customers?.full_name || 'customer'}
        </h1>

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 text-[0.9375rem] text-ink-soft min-w-0">
            <MapPin size={18} className="shrink-0 mt-0.5 text-muted" />
            <span>{address || 'No address on file'}</span>
          </div>
          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Directions"
              className="w-11 h-11 shrink-0 rounded-full bg-brand-soft text-brand-ink flex items-center justify-center hover:bg-brand/25"
            >
              <Navigation size={18} />
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs font-medium text-muted">Schedule</div>
            <div className="mt-0.5 font-semibold text-navy">
              {dateStr} · {timeStr}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted">Crew</div>
            <div className="mt-0.5 font-semibold text-navy truncate">{crewNames.length ? crewNames.join(', ') : 'Not assigned'}</div>
          </div>
        </div>

        {isDone ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-brand-soft text-brand-ink text-sm font-semibold">
            <CheckCircle2 size={18} /> Job completed{job.signed_at ? ' and signed off' : ''}.
          </div>
        ) : null}

        <div className="flex gap-2 md:max-w-xl">
          {primary && (
            <button
              type="button"
              onClick={primary.onClick}
              disabled={isUpdatingStatus}
              className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-navy text-base font-semibold border-0 shadow-card disabled:opacity-60"
            >
              {isUpdatingStatus ? <Loader2 size={18} className="animate-spin" /> : <primary.icon size={18} />}
              {primary.label}
            </button>
          )}
          <OverflowMenu actions={moreActions} size="lg" label="More job actions" />
        </div>

        <div className="grid grid-cols-3 gap-2 md:max-w-xl">
          {directionsUrl ? (
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className={quickBtn}>
              <Navigation size={16} className="text-brand-ink" /> Directions
            </a>
          ) : (
            <span className={`${quickBtn} text-subtle`}>No address</span>
          )}
          {phone ? (
            <a href={`tel:${phone}`} className={quickBtn}>
              <Phone size={16} className="text-brand-ink" /> Call
            </a>
          ) : (
            <span className={`${quickBtn} text-subtle`}>No phone</span>
          )}
          {onMyWayUrl && !isClosed ? (
            <a href={onMyWayUrl} className={quickBtn}>
              <Send size={16} className="text-brand-ink" /> On my way
            </a>
          ) : (
            <span className={`${quickBtn} text-subtle`}>{isClosed ? 'Done' : 'No phone'}</span>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="flex border-b border-line" role="tablist">
        {(
          [
            { id: 'job', label: 'Job' },
            { id: 'details', label: 'Details' },
            { id: 'materials', label: 'Materials' },
          ] as const
        ).map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 sm:flex-none sm:px-6 h-12 text-sm border-0 border-b-[3px] border-solid bg-transparent -mb-px ${
              tab === t.id ? 'border-brand text-navy font-semibold' : 'border-transparent text-muted font-medium hover:text-navy'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'job' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-start">
          <div className="space-y-4 md:space-y-5">
            {/* Instructions */}
            <section className={`${card} p-4 md:p-5`}>
              <h2 className="m-0 text-base font-semibold text-navy flex items-center gap-2">
                <FileText size={18} className="text-muted" /> Instructions
              </h2>
              <p className="m-0 mt-2 text-[0.9375rem] text-ink-soft leading-relaxed whitespace-pre-wrap">
                {job.scope_of_work?.trim() || 'No instructions from the office for this job.'}
              </p>
            </section>

            {/* Before you start */}
            <section className={`${card} overflow-hidden`}>
              <div className="px-4 md:px-5 pt-4 pb-2">
                <h2 className="m-0 text-base font-semibold text-navy">Before you start</h2>
              </div>
              <ul className="m-0 p-0 list-none divide-y divide-line">
                <li className="flex items-center justify-between gap-3 px-4 md:px-5 py-3.5">
                  <span className="text-[0.9375rem] font-medium text-navy">Clocked in?</span>
                  {clockedIn === null ? (
                    <Loader2 size={18} className="animate-spin text-subtle" />
                  ) : clockedIn ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
                      <span className="w-7 h-7 rounded-md bg-brand text-navy flex items-center justify-center">
                        <Check size={16} strokeWidth={3} />
                      </span>
                      Yes
                    </span>
                  ) : (
                    <Link to="/worker-dashboard" className="text-sm font-semibold text-amber-700 no-underline hover:underline">
                      Not yet — clock in
                    </Link>
                  )}
                </li>
                {PRE_CHECKS.map(item => {
                  const checked = !!job.checklist?.[item];
                  return (
                    <li key={item}>
                      <button
                        type="button"
                        onClick={() => handleToggleChecklist(item)}
                        aria-pressed={checked}
                        className="w-full flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 bg-transparent border-0 text-left hover:bg-canvas"
                      >
                        <span className="text-[0.9375rem] font-medium text-navy">{item}</span>
                        <span
                          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border-2 ${
                            checked ? 'bg-brand border-brand text-navy' : 'border-line-strong bg-white'
                          }`}
                        >
                          {checked && <Check size={16} strokeWidth={3} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Job checklist */}
            <section className={`${card} overflow-hidden`} id="job-checklist">
              <div className="px-4 md:px-5 pt-4 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="m-0 text-base font-semibold text-navy">Job checklist</h2>
                  <span className="text-sm font-medium text-muted tabular-nums">
                    {checklistCount} of {CHECKLIST_ITEMS.length}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-mist overflow-hidden">
                  <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${checklistProgress}%` }} />
                </div>
              </div>
              <ul className="m-0 p-0 list-none divide-y divide-line border-t border-line">
                {CHECKLIST_ITEMS.map(item => {
                  const checked = !!job.checklist?.[item];
                  return (
                    <li key={item}>
                      <button
                        type="button"
                        onClick={() => handleToggleChecklist(item)}
                        aria-pressed={checked}
                        className="w-full flex items-center justify-between gap-3 px-4 md:px-5 py-4 bg-transparent border-0 text-left hover:bg-canvas"
                      >
                        <span className={`text-[0.9375rem] ${checked ? 'text-muted' : 'text-navy font-medium'}`}>{item}</span>
                        <span
                          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border-2 ${
                            checked ? 'bg-brand border-brand text-navy' : 'border-line-strong bg-white'
                          }`}
                        >
                          {checked && <Check size={16} strokeWidth={3} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="space-y-4 md:space-y-5">
            {/* Photos */}
            <section id="job-photos-section" className="space-y-1.5">
              <JobPhotos jobId={job.id} />
              <p className="m-0 px-1 text-xs text-muted flex items-center gap-1.5">
                <Camera size={13} /> At least one “after” photo is needed to complete the job.
              </p>
            </section>

            {/* Customer sign-off */}
            <section className={`${card} p-4 md:p-5`}>
              <h2 className="m-0 text-base font-semibold text-navy flex items-center gap-2">
                <PenLine size={18} className="text-muted" /> Customer sign-off
              </h2>
              {job.customer_signature_url ? (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                    <CheckCircle2 size={18} /> Signed {job.signed_at ? new Date(job.signed_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                  </div>
                  <div className="bg-canvas rounded-lg p-2 border border-line">
                    <img src={job.customer_signature_url} alt="Customer signature" className="h-16 object-contain mx-auto" />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await confirm({ title: 'Replace the signature?', message: 'The current signature will be replaced with a new one.', confirmLabel: 'Replace' })) {
                        setIsSignatureModalOpen(true);
                      }
                    }}
                    className="w-full h-11 rounded-xl border border-line bg-white text-sm font-semibold text-navy hover:bg-mist"
                  >
                    Capture a new signature
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <p className="m-0 text-sm text-muted">The customer signs on your phone when the work is done. It's needed to complete the job.</p>
                  <button
                    type="button"
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-navy hover:bg-navy-soft text-white text-base font-semibold border-0"
                  >
                    <PenLine size={18} /> Get customer signature
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-start">
          <div className="space-y-4 md:space-y-5">
            <section className={`${card} p-4 md:p-5`}>
              <h2 className="m-0 text-base font-semibold text-navy">Customer</h2>
              <div className="mt-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-mist flex items-center justify-center text-ink-soft">
                  <User size={20} />
                </div>
                <div className="font-semibold text-navy">{job.customers?.full_name}</div>
              </div>
              <div className="mt-3 space-y-2.5 text-sm">
                {phone && (
                  <a href={`tel:${phone}`} className="flex items-center gap-2.5 text-ink-soft no-underline hover:text-brand-ink">
                    <Phone size={16} className="text-subtle" /> {phone}
                  </a>
                )}
                {job.customers?.email && (
                  <a href={`mailto:${job.customers.email}`} className="flex items-center gap-2.5 text-ink-soft no-underline hover:text-brand-ink break-all">
                    <Mail size={16} className="text-subtle shrink-0" /> {job.customers.email}
                  </a>
                )}
                <div className="flex items-start gap-2.5 text-ink-soft">
                  <MapPin size={16} className="text-subtle shrink-0 mt-0.5" /> {address || 'No address on file'}
                </div>
              </div>
            </section>

            <section className={`${card} p-4 md:p-5`}>
              <h2 className="m-0 text-base font-semibold text-navy">Insulation</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: 'Attic size', value: job.attic_sqft ? `${job.attic_sqft.toLocaleString()} sq ft` : '—' },
                  { label: 'Existing', value: job.existing_r_value ? `R-${job.existing_r_value}` : '—' },
                  { label: 'Target', value: job.target_r_value ? `R-${job.target_r_value}` : '—' },
                ].map(t => (
                  <div key={t.label} className="rounded-lg bg-canvas border border-line p-3">
                    <div className="text-2xs text-muted">{t.label}</div>
                    <div className="mt-0.5 text-base font-bold text-navy">{t.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className={`${card} p-4 md:p-5 space-y-3`}>
              <h2 className="m-0 text-base font-semibold text-navy">Schedule & crew</h2>
              <div className="flex items-center gap-2.5 text-sm text-ink-soft">
                <Calendar size={16} className="text-subtle" /> {dateStr}
              </div>
              <div className="flex items-center gap-2.5 text-sm text-ink-soft">
                <Clock size={16} className="text-subtle" /> {timeStr}
              </div>
              <div className="flex items-center gap-2.5 text-sm text-ink-soft">
                <Wrench size={16} className="text-subtle" /> {crewNames.length ? crewNames.join(', ') : 'Not assigned'}
              </div>
            </section>
          </div>

          <CurrentConditionCard
            inspection={currentInspection}
            onOpenNewInspection={() => setIsInspectionModalOpen(true)}
            onEditInspection={() => setIsInspectionModalOpen(true)}
            canEdit={true}
            showStepNumber={false}
          />
        </div>
      )}

      {tab === 'materials' && (
        <section className={`${card} p-4 md:p-5 max-w-3xl`}>
          <h2 className="m-0 text-base font-semibold text-navy flex items-center gap-2">
            <Package size={18} className="text-muted" /> Materials used
          </h2>
          <p className="m-0 mt-0.5 text-sm text-muted">Log what went into this job, like bags of cellulose or baffles.</p>

          {materials.length === 0 ? (
            <div className="mt-4 text-center p-8 bg-canvas rounded-xl border border-line border-dashed">
              <Package className="mx-auto text-line-strong mb-2" size={32} />
              <p className="m-0 text-sm font-medium text-muted">No materials recorded yet</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {materials.map((mat, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Material"
                    value={mat.name}
                    onChange={e => handleUpdateMaterial(idx, 'name', e.target.value)}
                    className="flex-1 min-w-0 h-11 px-3 rounded-lg border border-line text-sm text-navy focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Qty"
                    value={mat.quantity}
                    onChange={e => handleUpdateMaterial(idx, 'quantity', e.target.value)}
                    className="w-16 h-11 px-3 rounded-lg border border-line text-sm text-navy focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={mat.unit}
                    onChange={e => handleUpdateMaterial(idx, 'unit', e.target.value)}
                    className="w-20 h-11 px-3 rounded-lg border border-line text-sm text-navy focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveMaterial(idx)}
                    aria-label="Remove material"
                    className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-lg text-subtle hover:text-red-600 hover:bg-red-50 border-0 bg-transparent"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-line">
            <button
              type="button"
              onClick={handleAddMaterial}
              className="flex-1 h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line-strong text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand-ink bg-transparent"
            >
              <Plus size={16} /> Add material
            </button>
            {(materials.length > 0 || (job.materials_used && job.materials_used !== '[]')) && (
              <button
                type="button"
                onClick={handleSaveMaterials}
                disabled={isSavingMaterials}
                className="flex-1 h-11 inline-flex items-center justify-center rounded-xl bg-navy hover:bg-navy-soft text-white text-sm font-semibold border-0 disabled:opacity-60"
              >
                {isSavingMaterials ? <Loader2 size={18} className="animate-spin" /> : 'Save materials'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Phone: the next step stays within thumb reach */}
      {primary && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-40">
          <button
            type="button"
            onClick={primary.onClick}
            disabled={isUpdatingStatus}
            className="w-full h-13 py-3.5 inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-navy text-base font-semibold border-0 disabled:opacity-60"
          >
            {isUpdatingStatus ? <Loader2 size={18} className="animate-spin" /> : <primary.icon size={18} />}
            {primary.label}
          </button>
        </div>
      )}

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
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setIsIssueModalOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden z-10 animate-fade-in">
            <div className="p-4 bg-red-50 flex items-center gap-2 border-b border-red-100">
              <AlertCircle size={20} className="text-red-600" />
              <h3 className="font-bold text-red-900">Report a Problem</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted mb-1">Problem Type</label>
                <select 
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-line-strong text-sm focus:outline-none focus:border-red-400 text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
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
                <label className="block text-xs font-bold text-muted mb-1">Description</label>
                <textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Describe the issue..."
                  className="w-full h-24 p-2.5 rounded-lg border border-line-strong text-sm focus:outline-none focus:border-red-400 resize-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                />
              </div>
            </div>
            <div className="p-4 border-t border-line flex gap-2 bg-canvas">
              <button 
                onClick={() => setIsIssueModalOpen(false)}
                className="flex-1 py-2.5 bg-white border border-line-strong text-ink-soft font-bold rounded-xl text-sm"
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
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setCompletedValidationError(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden z-10 animate-fade-in p-5">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                <AlertCircle size={28} />
              </div>
            </div>
            <h3 className="text-center font-bold text-xl text-navy mb-2">Job isn't ready to complete</h3>
            <p className="text-center text-sm font-semibold text-muted mb-6">
              You must complete the following items before marking this job as finished:
            </p>
            
            <div className="space-y-3 mb-6 bg-canvas p-4 rounded-xl border border-line">
              <div className="flex items-center gap-3">
                {completedValidationError.missingChecklist ? <XCircle size={18} className="text-red-500" /> : <CheckCircle2 size={18} className="text-[#10B981]" />}
                <span className={`text-sm font-bold ${completedValidationError.missingChecklist ? 'text-red-700' : 'text-ink-soft'}`}>
                  Job checklist (all items ticked)
                </span>
              </div>
              <div className="flex items-center gap-3">
                {completedValidationError.missingPhoto ? <XCircle size={18} className="text-red-500" /> : <CheckCircle2 size={18} className="text-[#10B981]" />}
                <span className={`text-sm font-bold ${completedValidationError.missingPhoto ? 'text-red-700' : 'text-ink-soft'}`}>
                  At least 1 After Photo
                </span>
              </div>
              <div className="flex items-center gap-3">
                {completedValidationError.missingSignature ? <XCircle size={18} className="text-red-500" /> : <CheckCircle2 size={18} className="text-[#10B981]" />}
                <span className={`text-sm font-bold ${completedValidationError.missingSignature ? 'text-red-700' : 'text-ink-soft'}`}>
                  Customer Signature
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setCompletedValidationError(null);
                setTab('job');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full py-3 bg-navy hover:bg-navy-soft text-white font-bold rounded-xl text-sm"
            >
              Back to the job
            </button>
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

      {confirmDialog}
    </Page>
  );
};
