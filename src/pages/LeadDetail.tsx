import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ScheduleAssessmentModal } from '../components/ScheduleAssessmentModal';
import { CompleteAssessmentModal } from '../components/CompleteAssessmentModal';
import { ConvertQuoteToJobModal } from '../components/ConvertQuoteToJobModal';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Clock,
  Loader2, 
  AlertCircle, 
  Layers,
  CheckCircle2,
  FileText,
  Briefcase,
  ArrowRight
} from 'lucide-react';

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

  if (loading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-[60vh] gap-3 text-[#737A86]">
        <Loader2 className="w-8 h-8 animate-spin text-[#76C442]" />
        <span className="text-xs font-bold uppercase tracking-wider">Loading Lead Information...</span>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-black text-[#151A2D] uppercase tracking-wider">Lead Not Found</h2>
        <p className="text-xs text-[#737A86] max-w-md mt-1 leading-relaxed">
          {error || 'The requested lead could not be found or has been removed.'}
        </p>
        <button
          onClick={() => navigate('/leads')}
          className="mt-6 inline-flex items-center gap-2 bg-[#151A2D] hover:bg-[#20273f] text-white px-5 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-xs min-h-[40px]"
        >
          <ArrowLeft size={14} className="stroke-[2.5]" />
          <span>Back to Leads</span>
        </button>
      </div>
    );
  }

  const hasName = Boolean(lead.name && lead.name.trim());
  const hasPhone = Boolean(lead.phone && lead.phone.trim());
  const hasEmail = Boolean(lead.email && lead.email.trim());

  // Assessment & Estimate resolution
  const selectedAssessment = lead.assessments?.find(
    (a) => a.status === 'completed'
  ) || lead.assessments?.find(
    (a) => a.status === 'scheduled'
  ) || lead.assessments?.[0];

  const isAssessmentCompleted = 
    lead.pipeline_stage === 'assessment_completed' || 
    selectedAssessment?.status === 'completed';

  const isWon = lead.pipeline_stage === 'won';
  const selectedEstimate = lead.estimates?.find(
    (e) => e.status?.toLowerCase() === 'approved'
  ) || lead.estimates?.[0];

  const linkedJob = selectedEstimate?.jobs?.[0] || lead.jobs?.[0];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* 1. Top Navigation Bar */}
      <div className="flex items-center justify-between border-b border-[#E7E9ED] pb-3">
        <button
          onClick={() => navigate('/leads')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#151A2D] hover:text-[#76C442] transition-colors cursor-pointer border-none bg-transparent"
        >
          <ArrowLeft size={14} className="stroke-[2.5]" />
          <span>Back to Leads</span>
        </button>

        <div className="flex items-center gap-2">
          {lead.status?.toLowerCase() === 'new' ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#22C55E]/10 text-[#16A34A] border border-[#22C55E]/30 tracking-wider uppercase">
              New
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200 capitalize">
              {lead.status || '—'}
            </span>
          )}

          {lead.source?.toLowerCase() === 'facebook' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </span>
          )}
        </div>
      </div>

      {/* 2. Lead Profile Header Card */}
      <div className="bg-white rounded-xl p-5 md:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-sm font-black shrink-0 font-mono shadow-sm">
            {hasName && lead.name ? (
              lead.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
            ) : (
              <User size={20} />
            )}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-[#151A2D] m-0 tracking-tight">
              {hasName ? lead.name : 'Unknown Lead'}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#737A86] mt-1 font-medium">
              <span>Received: {formatReceivedDate(lead.received_at)}</span>
              <span>•</span>
              <span>Source: {lead.source ? lead.source : '—'}</span>
            </div>
          </div>
        </div>

        {/* Quick Lead Actions */}
        <div className="flex items-center gap-2">
          {hasPhone && (
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E7E9ED] hover:bg-[#F6F7F9] text-[#151A2D] text-xs font-bold transition-all shadow-xs"
            >
              <Phone size={13} className="text-[#76C442]" />
              <span>Call Lead</span>
            </a>
          )}
          {hasEmail && (
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E7E9ED] hover:bg-[#F6F7F9] text-[#151A2D] text-xs font-bold transition-all shadow-xs"
            >
              <Mail size={13} className="text-indigo-600" />
              <span>Email Lead</span>
            </a>
          )}
        </div>
      </div>

      {/* 3. CRM Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: Lead Information */}
        <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E7E9ED] bg-[#F9FAFB] flex items-center gap-2">
            <User size={15} className="text-[#151A2D]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-[#151A2D] m-0">
              Contact Information
            </h2>
          </div>

          <div className="p-5 space-y-4 text-xs">
            {/* Name */}
            <div>
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider block mb-1">
                Name
              </label>
              <div className="font-semibold text-[#171A1F]">
                {hasName ? lead.name : '—'}
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider block mb-1">
                Phone
              </label>
              <div className="font-semibold text-[#171A1F] flex items-center gap-2">
                <Phone size={13} className="text-[#737A86] shrink-0" />
                {hasPhone ? (
                  <a href={'tel:' + lead.phone} className="hover:text-[#76C442] transition-colors">
                    {lead.phone}
                  </a>
                ) : (
                  <span className="text-[#737A86] font-normal">—</span>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider block mb-1">
                Email
              </label>
              <div className="font-semibold text-[#171A1F] flex items-center gap-2">
                <Mail size={13} className="text-[#737A86] shrink-0" />
                {hasEmail ? (
                  <a href={'mailto:' + lead.email} className="hover:text-[#76C442] transition-colors break-all">
                    {lead.email}
                  </a>
                ) : (
                  <span className="text-[#737A86] font-normal">—</span>
                )}
              </div>
            </div>

            {/* Source */}
            <div>
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider block mb-1">
                Source
              </label>
              <div>
                {lead.source?.toLowerCase() === 'facebook' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">
                    <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </span>
                ) : (
                  <span className="font-semibold text-[#171A1F]">{lead.source || '—'}</span>
                )}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider block mb-1">
                Status
              </label>
              <div>
                {lead.status?.toLowerCase() === 'new' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#22C55E]/10 text-[#16A34A] border border-[#22C55E]/30 tracking-wider uppercase">
                    New
                  </span>
                ) : (
                  <span className="font-semibold text-[#171A1F] capitalize">{lead.status || '—'}</span>
                )}
              </div>
            </div>

            {/* Received Date */}
            <div>
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider block mb-1">
                Received Date
              </label>
              <div className="font-semibold text-[#171A1F] flex items-center gap-2">
                <Calendar size={13} className="text-[#737A86] shrink-0" />
                <span>{formatReceivedDate(lead.received_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card B: Facebook Information */}
        <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E7E9ED] bg-[#F9FAFB] flex items-center gap-2">
            <Layers size={15} className="text-[#1877F2]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-[#151A2D] m-0">
              Facebook Information
            </h2>
          </div>

          <div className="p-5 space-y-4 text-xs">
            {/* Facebook Lead ID */}
            <div>
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider block mb-1">
                Facebook Lead ID
              </label>
              <div className="font-mono text-xs font-semibold text-[#171A1F] bg-[#F6F7F9] px-3 py-2 rounded-lg border border-[#E7E9ED] break-all select-all">
                {lead.facebook_lead_id || '—'}
              </div>
            </div>

            {/* Facebook Page ID */}
            <div>
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider block mb-1">
                Facebook Page ID
              </label>
              <div className="font-mono text-xs font-semibold text-[#171A1F] bg-[#F6F7F9] px-3 py-2 rounded-lg border border-[#E7E9ED] break-all select-all">
                {lead.facebook_page_id || '—'}
              </div>
            </div>

            {/* Facebook Form ID */}
            <div>
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider block mb-1">
                Facebook Form ID
              </label>
              <div className="font-mono text-xs font-semibold text-[#171A1F] bg-[#F6F7F9] px-3 py-2 rounded-lg border border-[#E7E9ED] break-all select-all">
                {lead.facebook_form_id || '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CRM / Workflow Information & Actions Card */}
      <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E7E9ED] bg-[#F9FAFB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase size={15} className="text-[#151A2D]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-[#151A2D] m-0">
              Workflow & Opportunity Actions
            </h2>
          </div>
          {isAssessmentCompleted && (
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded">
              Ready for Quote
            </span>
          )}
        </div>

        <div className="p-5 space-y-5">
          {/* Assessment Section if Scheduled or Completed */}
          {selectedAssessment && (
            <div className={`p-4 rounded-xl border space-y-3 ${
              selectedAssessment.status === 'completed' 
                ? 'bg-emerald-50/80 border-emerald-200' 
                : 'bg-indigo-50/80 border-indigo-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg text-white flex items-center justify-center ${
                    selectedAssessment.status === 'completed' ? 'bg-emerald-600' : 'bg-indigo-600'
                  }`}>
                    <Calendar size={13} />
                  </div>
                  <span className={`text-xs font-black uppercase tracking-wider ${
                    selectedAssessment.status === 'completed' ? 'text-emerald-950' : 'text-indigo-950'
                  }`}>
                    Assessment Status
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  selectedAssessment.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                }`}>
                  {selectedAssessment.status}
                </span>
              </div>

              <div className="text-xs space-y-1.5 pt-1">
                <div className="font-extrabold text-sm text-[#151A2D]">
                  {formatAssessmentDate(selectedAssessment.scheduled_date)}
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <Clock size={12} className="shrink-0 text-slate-500" />
                  <span>{formatTimeRange(selectedAssessment.start_time, selectedAssessment.end_time)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-800 font-bold pt-0.5">
                  <User size={12} className="shrink-0 text-slate-500" />
                  <span>Assigned to: {selectedAssessment.profiles?.full_name || 'Unassigned'}</span>
                </div>
                {selectedAssessment.notes && (
                  <div className="text-[11px] text-slate-700 bg-white/80 p-2.5 rounded-lg border border-slate-200 mt-1 font-medium">
                    {selectedAssessment.notes}
                  </div>
                )}
              </div>

              {selectedAssessment.status === 'scheduled' && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCompleteModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                  >
                    <CheckCircle2 size={14} />
                    <span>Complete Assessment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/scheduling')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 text-indigo-900 border border-indigo-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    <Calendar size={13} className="text-indigo-600" />
                    <span>View in Schedule</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#737A86] m-0">
              Available Actions
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Schedule / Reschedule Assessment */}
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(true)}
                className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-[0.99] ${
                  selectedAssessment
                    ? 'bg-white text-[#151A2D] border border-[#E7E9ED] hover:bg-[#F6F7F9]'
                    : 'bg-[#151A2D] text-white hover:bg-[#1f263e]'
                }`}
              >
                <Calendar size={14} className={selectedAssessment ? 'text-[#151A2D]' : 'text-[#76C442]'} />
                <span>{selectedAssessment ? 'Reschedule Assessment' : 'Schedule Assessment'}</span>
              </button>

              {/* 2. Convert to Quote / View Quote */}
              {selectedEstimate ? (
                <button
                  type="button"
                  onClick={() => navigate(`/estimates/${selectedEstimate.id}`)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <FileText size={14} className="text-amber-600" />
                  <span>View Quote #{selectedEstimate.estimate_number}</span>
                  <ArrowRight size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (lead.id) params.set('leadId', lead.id);
                    if (selectedAssessment?.id) params.set('assessmentId', selectedAssessment.id);
                    navigate(`/estimates/new?${params.toString()}`);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#151A2D] text-white text-xs font-bold hover:bg-[#1f263e] transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <FileText size={14} className="text-[#76C442]" />
                  <span>Convert to Quote</span>
                </button>
              )}

              {/* 3. Convert to Job / View Job (if Quote is approved or won) */}
              {linkedJob ? (
                <button
                  type="button"
                  onClick={() => navigate(`/jobs/${linkedJob.id}`)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <Briefcase size={14} />
                  <span>View Job #{linkedJob.job_number}</span>
                  <ArrowRight size={13} />
                </button>
              ) : selectedEstimate?.status?.toLowerCase() === 'approved' || isWon ? (
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#151A2D] text-white text-xs font-bold hover:bg-[#1f263e] transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <Briefcase size={14} className="text-[#76C442]" />
                  <span>Convert to Job</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

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
        <div className="fixed bottom-6 right-6 z-50 bg-[#151A2D] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-[#76C442]/40 animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 size={16} className="text-[#76C442]" />
          <span>{toastSuccess}</span>
        </div>
      )}
    </div>
  );
};
