import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Loader2, 
  AlertCircle, 
  Layers
} from 'lucide-react';

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
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

export const LeadDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLead = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchErr } = await supabase
          .from('leads')
          .select('*')
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
    };

    fetchLead();
  }, [id]);

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
              {hasName ? lead.name : '—'}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#737A86] mt-1 font-medium">
              <span>Received: {formatReceivedDate(lead.received_at)}</span>
              <span>•</span>
              <span>Source: {lead.source ? lead.source : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CRM Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: Lead Information */}
        <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E7E9ED] bg-[#F9FAFB] flex items-center gap-2">
            <User size={15} className="text-[#151A2D]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-[#151A2D] m-0">
              Lead Information
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
                  <span className="font-semibold text-[#171A1F]">{lead.status || '—'}</span>
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
    </div>
  );
};
