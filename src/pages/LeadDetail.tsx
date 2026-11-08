import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ScheduleAssessmentModal } from '../components/ScheduleAssessmentModal';
import { CompleteAssessmentModal } from '../components/CompleteAssessmentModal';
import { ConvertQuoteToJobModal } from '../components/ConvertQuoteToJobModal';
import { User, Phone, Mail, Calendar, Clock, CheckCircle2, FileText, Briefcase, ArrowRight, Check } from 'lucide-react';
import { Badge, Button, Card, Page, StatusBadge, buttonClasses } from '../components/ui';
import { OverflowMenu } from '../components/ui/list';
import { DetailGrid, DetailHeader, DetailLoading, DetailNotFound, InfoList, InfoRow, MobileActionBar } from '../components/ui/detail';

interface AssessmentInfo {
  id: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  notes: string | null;
  assigned_to: string | null;
  updated_at?: string | null;
  profiles: {
    full_name: string;
  } | null;
}

interface JobInfo {
  id: string;
  job_number: number;
  status: string;
  scheduled_date?: string | null;
}

interface EstimateInfo {
  id: string;
  estimate_number: string;
  title?: string | null;
  status: string;
  total_amount?: number;
  approved_at?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  property_address?: string | null;
  line_items?: any;
  intro_text?: string | null;
  client_message?: string | null;
  jobs?: JobInfo[];
}

interface Lead {
  id: string;
  facebook_lead_id: string | null;
  facebook_page_id: string | null;
  facebook_form_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string | null;
  pipeline_stage: string | null;
  customer_id?: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  assessments?: AssessmentInfo[];
  estimates?: EstimateInfo[];
  jobs?: JobInfo[];
}

export const LeadDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Action States
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);

  const fetchLead = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await supabase
        .from('leads')
        .select(`
          *,
          assessments (
            id,
            scheduled_date,
            start_time,
            end_time,
            status,
            notes,
            assigned_to,
            updated_at,
            profiles:assigned_to (
              full_name
            )
          ),
          estimates (
            id,
            estimate_number,
            title,
            status,
            total_amount,
            approved_at,
            customer_id,
            customer_name,
            customer_email,
            customer_phone,
            property_address,
            line_items,
            intro_text,
            client_message,
            jobs (
              id,
              job_number,
              status,
              scheduled_date
            )
          ),
          jobs (
            id,
            job_number,
            status,
            scheduled_date
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) {
        throw fetchErr;
      }

      if (!data) {
        setError('Lead record not found.');
      } else {
        setLead(data);
      }
    } catch (err: any) {
      console.error('Error loading lead detail:', err);
      setError(err?.message || 'Failed to load lead details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const formatReceivedDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '—';
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return '—';
    }
  };

  const formatAssessmentDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const [year, month, day] = datePart.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const formatTime12h = (timeStr: string | null | undefined) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

  const formatTimeRange = (start: string | null | undefined, end: string | null | undefined) => {
    if (!start) return 'Time not set';
    const startFormatted = formatTime12h(start);
    if (!end) return startFormatted;
    const endFormatted = formatTime12h(end);
    return `${startFormatted} – ${endFormatted}`;
  };

  if (loading) return <DetailLoading label="Loading lead…" />;

  if (error || !lead) {
    return <DetailNotFound title="Lead not found" message={error} back={{ to: '/leads', label: 'Back to leads' }} />;
  }

  const hasName = Boolean(lead.name && lead.name.trim());
  const hasPhone = Boolean(lead.phone && lead.phone.trim());
  const hasEmail = Boolean(lead.email && lead.email.trim());

  // Assessment & Estimate resolution
  const selectedAssessment =
    lead.assessments?.find(a => a.status === 'completed') || lead.assessments?.find(a => a.status === 'scheduled') || lead.assessments?.[0];

  const isAssessmentCompleted = lead.pipeline_stage === 'assessment_completed' || selectedAssessment?.status === 'completed';

  const isWon = lead.pipeline_stage === 'won';
  const selectedEstimate = lead.estimates?.find(e => e.status?.toLowerCase() === 'approved') || lead.estimates?.[0];
  const canConvertToJob = selectedEstimate?.status?.toLowerCase() === 'approved' || isWon;

  const linkedJob = selectedEstimate?.jobs?.[0] || lead.jobs?.[0];

  const goToNewEstimate = () => {
    const params = new URLSearchParams();
    if (lead.id) params.set('leadId', lead.id);
    if (selectedAssessment?.id) params.set('assessmentId', selectedAssessment.id);
    navigate(`/estimates/new?${params.toString()}`);
  };

  /** Where the lead is in the workflow, shown as a progress tracker. */
  const steps = [
    { label: 'Lead received', done: true },
    { label: 'Assessment', done: isAssessmentCompleted || !!selectedEstimate || !!linkedJob },
    { label: 'Estimate', done: !!selectedEstimate && (selectedEstimate.status?.toLowerCase() === 'approved' || isWon || !!linkedJob) },
    { label: 'Job', done: !!linkedJob },
  ];
  const currentStep = steps.findIndex(s => !s.done);

  /** The one obvious next step for this lead. */
  const nextStep = (() => {
    if (linkedJob) return { label: `Open job #${linkedJob.job_number}`, icon: Briefcase, onClick: () => navigate(`/jobs/${linkedJob.id}`) };
    if (canConvertToJob && selectedEstimate) return { label: 'Convert to job', icon: Briefcase, onClick: () => setIsConvertModalOpen(true) };
    if (selectedEstimate) return { label: `Open estimate #${selectedEstimate.estimate_number}`, icon: FileText, onClick: () => navigate(`/estimates/${selectedEstimate.id}`) };
    if (selectedAssessment?.status === 'scheduled') return { label: 'Complete assessment', icon: CheckCircle2, onClick: () => setIsCompleteModalOpen(true) };
    if (isAssessmentCompleted) return { label: 'Create estimate', icon: FileText, onClick: goToNewEstimate };
    return { label: 'Schedule assessment', icon: Calendar, onClick: () => setIsScheduleModalOpen(true) };
  })();

  const moreActions = [
    { label: selectedAssessment ? 'Reschedule assessment' : 'Schedule assessment', icon: Calendar, onClick: () => setIsScheduleModalOpen(true) },
    ...(!selectedEstimate ? [{ label: 'Create estimate', icon: FileText, onClick: goToNewEstimate }] : []),
    ...(selectedAssessment?.status === 'scheduled' ? [{ label: 'View in schedule', icon: Calendar, onClick: () => navigate('/scheduling') }] : []),
  ];

  const facebookBadge = (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold bg-[#1877F2]/10 text-[#1877F2]">
      <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24" aria-hidden>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
      Facebook
    </span>
  );

  return (
    <Page className="pb-28 md:pb-7">
      <DetailHeader
        back={{ to: '/leads', label: 'Leads' }}
        title={hasName ? lead.name : 'Unknown lead'}
        badges={
          <>
            <StatusBadge status={lead.status || 'new'} />
            {lead.source?.toLowerCase() === 'facebook' && facebookBadge}
          </>
        }
        meta={
          <>
            <span>Received {formatReceivedDate(lead.received_at)}</span>
            {lead.source && lead.source.toLowerCase() !== 'facebook' && (
              <>
                <span aria-hidden>·</span>
                <span className="capitalize">{lead.source}</span>
              </>
            )}
          </>
        }
        actions={
          <>
            <OverflowMenu actions={moreActions} />
            {hasPhone && (
              <a href={`tel:${lead.phone}`} className={buttonClasses('secondary', 'md')}>
                <Phone size={16} /> Call
              </a>
            )}
            <Button icon={nextStep.icon} onClick={nextStep.onClick}>
              {nextStep.label}
            </Button>
          </>
        }
      />

      {/* Progress through the workflow */}
      <Card padded={false}>
        <ol className="m-0 p-4 md:px-6 list-none grid grid-cols-4 gap-2">
          {steps.map((s, i) => {
            const active = i === currentStep;
            return (
              <li key={s.label} className="flex flex-col items-center text-center gap-1.5 relative">
                {i > 0 && <span className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${s.done || active ? 'bg-brand' : 'bg-line'}`} aria-hidden />}
                <span
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                    s.done ? 'bg-brand text-navy' : active ? 'bg-white border-2 border-brand text-navy' : 'bg-mist text-muted'
                  }`}
                >
                  {s.done ? <Check size={16} strokeWidth={3} /> : i + 1}
                </span>
                <span className={`text-xs ${s.done || active ? 'text-navy font-medium' : 'text-muted'}`}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      <DetailGrid
        main={
          <>
            <Card
              title="Assessment"
              actions={
                <Button size="sm" variant="secondary" icon={Calendar} onClick={() => setIsScheduleModalOpen(true)}>
                  {selectedAssessment ? 'Reschedule' : 'Schedule'}
                </Button>
              }
            >
              {selectedAssessment ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-navy">{formatAssessmentDate(selectedAssessment.scheduled_date)}</span>
                    <Badge tone={selectedAssessment.status === 'completed' ? 'green' : 'blue'} dot>
                      {selectedAssessment.status}
                    </Badge>
                  </div>
                  <InfoList>
                    <InfoRow icon={Clock} label="Time">{formatTimeRange(selectedAssessment.start_time, selectedAssessment.end_time)}</InfoRow>
                    <InfoRow icon={User} label="Assigned to">{selectedAssessment.profiles?.full_name || <span className="text-amber-700">Unassigned</span>}</InfoRow>
                  </InfoList>
                  {selectedAssessment.notes && (
                    <div className="rounded-lg bg-canvas border border-line p-3 text-sm text-navy whitespace-pre-wrap">{selectedAssessment.notes}</div>
                  )}
                  {selectedAssessment.status === 'scheduled' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button icon={CheckCircle2} onClick={() => setIsCompleteModalOpen(true)}>
                        Complete assessment
                      </Button>
                      <Button variant="secondary" icon={Calendar} onClick={() => navigate('/scheduling')}>
                        View in schedule
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="m-0 text-sm text-muted">No assessment booked yet. Schedule a visit to measure the attic and check current insulation.</p>
              )}
            </Card>

            <Card title="Estimate & job">
              <div className="space-y-3">
                {selectedEstimate ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/estimates/${selectedEstimate.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-line hover:bg-canvas text-left bg-white"
                  >
                    <FileText size={18} className="text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-navy">Estimate #{selectedEstimate.estimate_number}</div>
                      <div className="text-xs text-muted">${Number(selectedEstimate.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                    <StatusBadge status={selectedEstimate.status} />
                    <ArrowRight size={16} className="text-subtle" />
                  </button>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-dashed border-line-strong">
                    <span className="text-sm text-muted">No estimate yet.</span>
                    <Button size="sm" variant="secondary" icon={FileText} onClick={goToNewEstimate}>
                      Create estimate
                    </Button>
                  </div>
                )}

                {linkedJob ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/jobs/${linkedJob.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-line hover:bg-canvas text-left bg-white"
                  >
                    <Briefcase size={18} className="text-muted shrink-0" />
                    <div className="flex-1 text-sm font-semibold text-navy">Job #{linkedJob.job_number}</div>
                    <ArrowRight size={16} className="text-subtle" />
                  </button>
                ) : canConvertToJob ? (
                  <Button block icon={Briefcase} onClick={() => setIsConvertModalOpen(true)}>
                    Convert to job
                  </Button>
                ) : null}
              </div>
            </Card>
          </>
        }
        side={
          <>
            <Card title="Contact">
              <InfoList>
                <InfoRow icon={Phone} label="Phone">
                  {hasPhone ? <a href={'tel:' + lead.phone} className="text-navy no-underline hover:underline">{lead.phone}</a> : <span className="text-muted">—</span>}
                </InfoRow>
                <InfoRow icon={Mail} label="Email">
                  {hasEmail ? <a href={'mailto:' + lead.email} className="text-brand-ink no-underline hover:underline break-all">{lead.email}</a> : <span className="text-muted">—</span>}
                </InfoRow>
                <InfoRow icon={Calendar} label="Received">{formatReceivedDate(lead.received_at)}</InfoRow>
                <InfoRow label="Source">{lead.source?.toLowerCase() === 'facebook' ? facebookBadge : <span className="capitalize">{lead.source || '—'}</span>}</InfoRow>
              </InfoList>
              {(hasPhone || hasEmail) && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {hasPhone && (
                    <a href={`sms:${lead.phone}`} className={buttonClasses('secondary', 'sm')}>
                      <Phone size={14} /> Text
                    </a>
                  )}
                  {hasEmail && (
                    <a href={`mailto:${lead.email}`} className={buttonClasses('secondary', 'sm')}>
                      <Mail size={14} /> Email
                    </a>
                  )}
                </div>
              )}
            </Card>

            {(lead.facebook_lead_id || lead.facebook_page_id || lead.facebook_form_id) && (
              <Card title="Facebook details" description="For matching this lead in Meta Ads Manager">
                <InfoList>
                  <InfoRow label="Lead ID"><span className="font-mono text-xs select-all break-all">{lead.facebook_lead_id || '—'}</span></InfoRow>
                  <InfoRow label="Page ID"><span className="font-mono text-xs select-all break-all">{lead.facebook_page_id || '—'}</span></InfoRow>
                  <InfoRow label="Form ID"><span className="font-mono text-xs select-all break-all">{lead.facebook_form_id || '—'}</span></InfoRow>
                </InfoList>
              </Card>
            )}
          </>
        }
      />

      <MobileActionBar>
        {hasPhone ? (
          <a href={`tel:${lead.phone}`} className={buttonClasses('secondary', 'md')}>
            <Phone size={16} /> Call
          </a>
        ) : (
          <Button variant="secondary" icon={Calendar} onClick={() => setIsScheduleModalOpen(true)}>
            Schedule
          </Button>
        )}
        <Button icon={nextStep.icon} onClick={nextStep.onClick}>
          {nextStep.label}
        </Button>
      </MobileActionBar>

      {/* Schedule Assessment Modal */}
      {lead && (
        <ScheduleAssessmentModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          lead={{
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
          }}
          onSuccess={() => {
            fetchLead();
            setToastSuccess('✓ Assessment Scheduled');
            setTimeout(() => setToastSuccess(null), 4000);
          }}
        />
      )}

      {/* Complete Assessment Confirmation Modal */}
      {lead && selectedAssessment && (
        <CompleteAssessmentModal
          isOpen={isCompleteModalOpen}
          onClose={() => setIsCompleteModalOpen(false)}
          assessment={{
            id: selectedAssessment.id,
            notes: selectedAssessment.notes,
            lead_id: lead.id,
          }}
          leadName={lead.name}
          onSuccess={() => {
            fetchLead();
            setToastSuccess('✓ Assessment Completed');
            setTimeout(() => setToastSuccess(null), 4000);
          }}
        />
      )}

      {/* Convert Quote to Job Modal */}
      {lead && selectedEstimate && isConvertModalOpen && (
        <ConvertQuoteToJobModal
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          leadId={lead.id}
          estimate={{
            id: selectedEstimate.id,
            estimate_number: selectedEstimate.estimate_number,
            title: selectedEstimate.title,
            status: selectedEstimate.status,
            total_amount: Number(selectedEstimate.total_amount || 0),
            customer_id: selectedEstimate.customer_id,
            customer_name: selectedEstimate.customer_name || lead.name,
            customer_email: selectedEstimate.customer_email || lead.email,
            customer_phone: selectedEstimate.customer_phone || lead.phone,
            property_address: selectedEstimate.property_address,
            line_items: selectedEstimate.line_items,
            intro_text: selectedEstimate.intro_text,
            client_message: selectedEstimate.client_message
          }}
          onSuccess={(job) => {
            setToastSuccess(`✓ Job #${job.job_number} Created`);
            fetchLead();
            setTimeout(() => setToastSuccess(null), 4500);
          }}
        />
      )}

      {/* Floating Success Toast */}
      {toastSuccess && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-navy text-white px-4 py-3 rounded-xl shadow-pop flex items-center gap-2.5 text-sm font-medium animate-slide-up">
          <CheckCircle2 size={16} className="text-brand" />
          <span>{toastSuccess}</span>
        </div>
      )}
    </Page>
  );
};
