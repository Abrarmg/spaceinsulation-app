import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CreateCustomerModal } from '../components/CreateCustomerModal';
import { DeleteContactModal } from '../components/DeleteContactModal';
import { 
  ArrowLeft, 
  Loader2, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  AlertCircle,
  Edit2,
  ExternalLink,
  Briefcase,
  FileText,
  FileSpreadsheet,
  TrendingUp,
  User,
  Trash2,
  Archive,
  RotateCcw,
  Check
} from 'lucide-react';

interface Contact {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  service_address: string | null;
  billing_address: string | null;
  preferred_contact_method: string | null;
  notes: string | null;
  source: string;
  contact_type: string;
  created_from: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

interface Job {
  id: string;
  job_number: number;
  status: string;
  scheduled_date: string | null;
  scope_of_work: string | null;
  quoted_amount: number | null;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  created_at: string;
}

interface Estimate {
  id: string;
  estimate_number: string;
  title: string | null;
  total_amount: number;
  status: string;
  created_at: string;
}

interface LeadOpportunity {
  id: string;
  name: string | null;
  status: string | null;
  pipeline_stage: string | null;
  source: string | null;
  received_at: string | null;
  created_at: string;
}

type RelatedTab = 'opportunities' | 'quotes' | 'jobs' | 'invoices';

export const CustomerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [contact, setContact] = useState<Contact | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [leads, setLeads] = useState<LeadOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<RelatedTab>('opportunities');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Toggle archive / restore status
  const handleToggleArchive = async (targetArchived: boolean) => {
    if (!contact) return;
    setIsArchiving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;

      let success = false;
      try {
        const res = await fetch('/api/contacts/archive', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({ contactId: contact.id, is_archived: targetArchived, auth_token: authToken })
        });

        if (res.ok) {
          success = true;
        } else if (res.status !== 404) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to update archive status.');
        }
      } catch (fetchErr: any) {
        if (!fetchErr.message?.includes('404')) {
          throw fetchErr;
        }
      }

      if (!success) {
        // Direct database fallback
        const { error: dbErr } = await supabase
          .from('customers')
          .update({ is_archived: targetArchived, updated_at: new Date().toISOString() })
          .eq('id', contact.id);

        if (dbErr) throw dbErr;
      }

      setContact(prev => prev ? { ...prev, is_archived: targetArchived } : null);
      setToastMessage(targetArchived ? 'Contact archived successfully.' : 'Contact restored successfully.');
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error('[contact-profile] Error toggling archive:', err);
      alert(err.message || 'Failed to update archive status.');
    } finally {
      setIsArchiving(false);
    }
  };

  // Fetch all related contact and CRM records
  const fetchContactData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    
    try {
      // 1. Fetch contact details
      const { data: contactData, error: contactErr } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (contactErr) throw contactErr;
      
      if (!contactData) {
        setError('Contact record not found.');
        setLoading(false);
        return;
      }

      setContact(contactData as Contact);

      // 2. Fetch linked leads (Sales Opportunities)
      const { data: leadsData, error: leadsErr } = await supabase
        .from('leads')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (leadsErr) throw leadsErr;
      setLeads((leadsData as LeadOpportunity[]) || []);

      // 3. Fetch jobs
      const { data: jobsData, error: jobsErr } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (jobsErr) throw jobsErr;
      setJobs((jobsData as Job[]) || []);

      // 4. Fetch invoices
      const { data: invoicesData, error: invoicesErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (invoicesErr) throw invoicesErr;
      setInvoices((invoicesData as Invoice[]) || []);

      // 5. Fetch estimates / quotes
      const { data: estimatesData, error: estimatesErr } = await supabase
        .from('estimates')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (estimatesErr) throw estimatesErr;
      setEstimates((estimatesData as Estimate[]) || []);

    } catch (err: any) {
      console.error('Error fetching contact profile:', err);
      setError(err.message || 'Failed to load contact profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchContactData();
    }
  }, [id, fetchContactData]);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '--';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatPipelineStage = (stage?: string | null) => {
    if (!stage) return 'New Request';
    return stage
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const getStageBadgeClass = (stage?: string | null) => {
    const s = (stage || '').toLowerCase();
    if (s === 'won') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s.includes('assessment')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (s.includes('quote')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const renderSourceBadge = (source?: string) => {
    switch (source) {
      case 'facebook':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1877F2]" />
            Facebook
          </span>
        );
      case 'csv_import':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            CSV Import
          </span>
        );
      case 'existing_customer':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-teal-50 text-teal-700 border border-teal-200">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            Existing
          </span>
        );
      case 'manual':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Manual
          </span>
        );
    }
  };

  const renderTypeBadge = (type?: string, isArchived?: boolean) => {
    if (isArchived) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-wider">
          Archived
        </span>
      );
    }

    if (type === 'customer') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Customer
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
        Prospect
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-screen gap-3 text-[#737A86] bg-[#F6F7F9]">
        <Loader2 className="w-9 h-9 animate-spin text-[#76C442]" />
        <span className="text-xs font-bold uppercase tracking-wider">Loading Contact Profile...</span>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="flex-grow p-6 flex flex-col items-center justify-center min-h-screen text-center bg-[#F6F7F9]">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-base font-extrabold text-[#171A1F] uppercase tracking-wider">Failed to Load Profile</h2>
        <p className="text-xs text-[#737A86] max-w-md mt-1 leading-relaxed">
          {error || 'The requested contact profile could not be loaded.'}
        </p>
        <button
          onClick={() => navigate('/contacts')}
          className="mt-6 inline-flex items-center gap-2 bg-[#151A2D] hover:bg-[#20273f] text-white px-5 py-2.5 rounded-lg font-bold transition-all cursor-pointer text-xs min-h-[40px]"
        >
          <ArrowLeft size={14} className="stroke-[2.5]" />
          <span>Back to Contacts</span>
        </button>
      </div>
    );
  }

  const initials = (contact.full_name || 'Contact')
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || 'C';

  return (
    <div className="flex-grow p-4 md:p-6 space-y-4 overflow-y-auto max-h-screen bg-[#F6F7F9] font-sans pb-16">
      
      {/* 1. Navigation Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E7E9ED] pb-3">
        <button
          onClick={() => navigate('/contacts')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#151A2D] hover:text-[#76C442] transition-colors cursor-pointer border-none bg-transparent"
        >
          <ArrowLeft size={14} className="stroke-[2.5]" />
          <span>Back to Contacts</span>
        </button>
        
        <div className="flex items-center gap-2">
          {contact.is_archived ? (
            <button
              onClick={() => handleToggleArchive(false)}
              disabled={isArchiving}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 text-xs font-bold bg-white rounded-lg transition-colors cursor-pointer min-h-[38px] disabled:opacity-50"
            >
              {isArchiving ? <Loader2 size={13} className="animate-spin text-[#76C442]" /> : <RotateCcw size={13} />}
              <span>Restore Contact</span>
            </button>
          ) : (
            <button
              onClick={() => handleToggleArchive(true)}
              disabled={isArchiving}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-[#E7E9ED] hover:border-[#737A86] text-[#737A86] hover:text-[#171A1F] text-xs font-bold bg-white rounded-lg transition-colors cursor-pointer min-h-[38px] disabled:opacity-50"
            >
              {isArchiving ? <Loader2 size={13} className="animate-spin text-[#76C442]" /> : <Archive size={13} />}
              <span>Archive</span>
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-[#E7E9ED] hover:border-[#737A86] text-[#171A1F] text-xs font-bold bg-white rounded-lg transition-colors cursor-pointer min-h-[38px]"
          >
            <Edit2 size={13} />
            <span>Edit Contact</span>
          </button>

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-red-200 hover:border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold bg-white rounded-lg transition-colors cursor-pointer min-h-[38px]"
          >
            <Trash2 size={13} />
            <span>Delete Contact</span>
          </button>
        </div>
      </div>

      {/* Archived Status Alert */}
      {contact.is_archived && (
        <div className="p-3.5 bg-gray-100 border border-gray-300 rounded-xl flex items-center justify-between gap-3 text-xs text-gray-700 font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <Archive size={16} className="text-gray-500" />
            <span>This contact is archived and hidden from active views.</span>
          </div>
          <button
            onClick={() => handleToggleArchive(false)}
            disabled={isArchiving}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {isArchiving ? <Loader2 size={12} className="animate-spin text-[#76C442]" /> : <RotateCcw size={12} />}
            <span>Restore Contact</span>
          </button>
        </div>
      )}

      {/* 2. Contact Overview Header Card */}
      <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-sm font-black select-none shrink-0 font-mono shadow-xs">
              {initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-[#171A1F] m-0 tracking-tight leading-none">
                  {contact.full_name || 'Unnamed Contact'}
                </h1>
                {renderTypeBadge(contact.contact_type, contact.is_archived)}
                {renderSourceBadge(contact.source)}
              </div>
              <div className="text-xs text-[#737A86] font-medium mt-1 select-none">
                Contact added {formatDate(contact.created_at)}
              </div>
            </div>
          </div>

          {/* Quick contact buttons */}
          <div className="flex items-center gap-2 font-bold text-xs select-none">
            {contact.phone && (
              <a 
                href={`tel:${contact.phone}`}
                className="px-3.5 py-2 bg-[#F6F7F9] hover:bg-[#E7E9ED] border border-[#E7E9ED] rounded-lg text-[#171A1F] flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <Phone size={12} className="text-[#76C442]" />
                <span>Call</span>
              </a>
            )}
            {contact.email && (
              <a 
                href={`mailto:${contact.email}`}
                className="px-3.5 py-2 bg-[#F6F7F9] hover:bg-[#E7E9ED] border border-[#E7E9ED] rounded-lg text-[#171A1F] flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <Mail size={12} className="text-blue-500" />
                <span>Email</span>
              </a>
            )}
            <Link 
              to={`/estimates/new?customer=${contact.id}`}
              className="px-3.5 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] rounded-lg flex items-center gap-1 shrink-0 transition-all font-black"
            >
              <span>+ New Quote</span>
            </Link>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg flex items-center gap-1.5 shrink-0 transition-all font-bold cursor-pointer"
              title="Delete Contact"
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Two Columns: Contact Information & CRM Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact Information Panel */}
        <div className="bg-white rounded-xl border border-[#E7E9ED] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3.5">
          <h3 className="text-xs font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-2 flex items-center gap-1.5">
            <User size={13} className="text-[#76C442]" />
            <span>Contact Information</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Full Name</span>
              <span className="col-span-2 font-bold text-[#171A1F]">{contact.full_name || '--'}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#F0F2F5] pt-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Phone</span>
              <span className="col-span-2 font-bold text-[#171A1F]">
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="hover:text-[#76C442] hover:underline">
                    {contact.phone}
                  </a>
                ) : (
                  <span className="text-gray-400 font-normal italic">Not provided</span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#F0F2F5] pt-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Email</span>
              <span className="col-span-2 font-bold text-[#171A1F]">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-gray-400 font-normal italic">Not provided</span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#F0F2F5] pt-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Service Address</span>
              <span className="col-span-2 font-semibold text-[#171A1F] leading-relaxed">
                {contact.service_address ? (
                  <a 
                    href={`https://maps.google.com/?q=${encodeURIComponent(contact.service_address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#76C442] hover:underline flex items-start gap-1"
                  >
                    <MapPin size={12} className="text-[#76C442] shrink-0 mt-0.5" />
                    <span>{contact.service_address}</span>
                  </a>
                ) : (
                  <span className="text-gray-400 font-normal italic">Not provided</span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#F0F2F5] pt-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Billing Address</span>
              <span className="col-span-2 font-semibold text-[#171A1F]">
                {contact.billing_address || contact.service_address || (
                  <span className="text-gray-400 font-normal italic">Same as service address</span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#F0F2F5] pt-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Preferred Contact</span>
              <span className="col-span-2 font-bold text-[#171A1F] capitalize">
                {contact.preferred_contact_method || 'Email'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#F0F2F5] pt-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Notes</span>
              <span className="col-span-2 text-[#171A1F] leading-relaxed">
                {contact.notes ? (
                  <span className="bg-amber-50/70 border border-amber-200/60 p-2 rounded-lg block font-medium">
                    {contact.notes}
                  </span>
                ) : (
                  <span className="text-gray-400 font-normal italic">No notes added</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* CRM Information Panel */}
        <div className="bg-white rounded-xl border border-[#E7E9ED] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3.5">
          <h3 className="text-xs font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-2 flex items-center gap-1.5">
            <TrendingUp size={13} className="text-blue-500" />
            <span>CRM Information</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Source</span>
              <div className="col-span-2">
                {renderSourceBadge(contact.source)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#F0F2F5] pt-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Contact Type</span>
              <div className="col-span-2">
                {renderTypeBadge(contact.contact_type, contact.is_archived)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#F0F2F5] pt-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Created Date</span>
              <span className="col-span-2 font-bold text-[#171A1F]">
                {formatDate(contact.created_at)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#F0F2F5] pt-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Created From</span>
              <span className="col-span-2 font-mono font-semibold text-[#171A1F] text-[11px]">
                {contact.created_from || 'manual_ui'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#F0F2F5] pt-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Archived Status</span>
              <span className="col-span-2 font-semibold">
                {contact.is_archived ? (
                  <span className="text-red-600 font-bold">Yes (Archived)</span>
                ) : (
                  <span className="text-emerald-600 font-bold">Active</span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#F0F2F5] pt-2">
              <span className="font-bold text-[#737A86] uppercase text-[10px]">Last Updated</span>
              <span className="col-span-2 text-[#737A86]">
                {formatDate(contact.updated_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Related Data Summary Tabs & Cards */}
      <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] overflow-hidden">
        
        {/* Tab Headers Strip */}
        <div className="flex border-b border-[#E7E9ED] bg-[#F6F7F9] overflow-x-auto select-none">
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'opportunities'
                ? 'border-[#76C442] bg-white text-[#151A2D] font-black'
                : 'border-transparent text-[#737A86] hover:text-[#171A1F]'
            }`}
          >
            <TrendingUp size={14} className={activeTab === 'opportunities' ? 'text-[#76C442]' : ''} />
            <span>Sales Opportunities</span>
            <span className={`px-2 py-0.2 rounded-full text-[10px] ${
              activeTab === 'opportunities' ? 'bg-[#76C442]/15 text-[#151A2D]' : 'bg-gray-200 text-gray-700'
            }`}>
              {leads.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('quotes')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'quotes'
                ? 'border-[#76C442] bg-white text-[#151A2D] font-black'
                : 'border-transparent text-[#737A86] hover:text-[#171A1F]'
            }`}
          >
            <FileText size={14} className={activeTab === 'quotes' ? 'text-[#76C442]' : ''} />
            <span>Quotes / Estimates</span>
            <span className={`px-2 py-0.2 rounded-full text-[10px] ${
              activeTab === 'quotes' ? 'bg-[#76C442]/15 text-[#151A2D]' : 'bg-gray-200 text-gray-700'
            }`}>
              {estimates.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'jobs'
                ? 'border-[#76C442] bg-white text-[#151A2D] font-black'
                : 'border-transparent text-[#737A86] hover:text-[#171A1F]'
            }`}
          >
            <Briefcase size={14} className={activeTab === 'jobs' ? 'text-[#76C442]' : ''} />
            <span>Jobs</span>
            <span className={`px-2 py-0.2 rounded-full text-[10px] ${
              activeTab === 'jobs' ? 'bg-[#76C442]/15 text-[#151A2D]' : 'bg-gray-200 text-gray-700'
            }`}>
              {jobs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'invoices'
                ? 'border-[#76C442] bg-white text-[#151A2D] font-black'
                : 'border-transparent text-[#737A86] hover:text-[#171A1F]'
            }`}
          >
            <FileSpreadsheet size={14} className={activeTab === 'invoices' ? 'text-[#76C442]' : ''} />
            <span>Invoices</span>
            <span className={`px-2 py-0.2 rounded-full text-[10px] ${
              activeTab === 'invoices' ? 'bg-[#76C442]/15 text-[#151A2D]' : 'bg-gray-200 text-gray-700'
            }`}>
              {invoices.length}
            </span>
          </button>
        </div>

        {/* Tab Content Panes */}
        <div className="p-5">

          {/* 1. Opportunities Tab */}
          {activeTab === 'opportunities' && (
            <div>
              {leads.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-[#737A86]">
                  <TrendingUp size={36} className="text-gray-300 mb-2 stroke-[1.5]" />
                  <div className="text-xs font-bold text-[#171A1F]">No Sales Opportunities</div>
                  <p className="text-[11px] text-[#737A86] mt-1 max-w-sm">
                    No lead opportunities have been linked to this contact yet.
                  </p>
                  <Link
                    to="/leads"
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#151A2D] text-white rounded-lg text-xs font-bold hover:bg-[#1f263e] transition-colors"
                  >
                    <span>View Sales Pipeline</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs font-semibold text-[#171A1F]">
                    <thead>
                      <tr className="bg-[#151A2D] text-white border-b border-[#111624] select-none text-[9.5px] font-bold uppercase tracking-wider">
                        <th className="px-5 py-3">Opportunity</th>
                        <th className="px-5 py-3">Pipeline Stage</th>
                        <th className="px-5 py-3">Source</th>
                        <th className="px-5 py-3">Received Date</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E9ED]">
                      {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-[#F6F7F9]/60 transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-extrabold text-[#171A1F]">
                              {lead.name || 'Sales Lead'}
                            </div>
                            <div className="text-[10px] text-[#737A86] font-mono">
                              ID: {lead.id.slice(0, 8)}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${getStageBadgeClass(lead.pipeline_stage)}`}>
                              {formatPipelineStage(lead.pipeline_stage)}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {renderSourceBadge(lead.source || 'facebook')}
                          </td>
                          <td className="px-5 py-3 text-[#737A86] text-[11px]">
                            {formatDate(lead.received_at || lead.created_at)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              to={`/leads`}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#76C442] hover:underline"
                            >
                              <span>View Pipeline</span>
                              <ExternalLink size={11} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 2. Quotes Tab */}
          {activeTab === 'quotes' && (
            <div>
              {estimates.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-[#737A86]">
                  <FileText size={36} className="text-gray-300 mb-2 stroke-[1.5]" />
                  <div className="text-xs font-bold text-[#171A1F]">No Quotes Created</div>
                  <p className="text-[11px] text-[#737A86] mt-1 max-w-sm">
                    No quotes or estimates have been generated for this contact yet.
                  </p>
                  <Link
                    to={`/estimates/new?customer=${contact.id}`}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] rounded-lg text-xs font-black transition-all"
                  >
                    <span>+ Create First Quote</span>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs font-semibold text-[#171A1F]">
                    <thead>
                      <tr className="bg-[#151A2D] text-white border-b border-[#111624] select-none text-[9.5px] font-bold uppercase tracking-wider">
                        <th className="px-5 py-3">Quote #</th>
                        <th className="px-5 py-3">Title</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Total Amount</th>
                        <th className="px-5 py-3">Created Date</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E9ED]">
                      {estimates.map((est) => (
                        <tr key={est.id} className="hover:bg-[#F6F7F9]/60 transition-colors">
                          <td className="px-5 py-3">
                            <Link to={`/estimates/${est.id}`} className="font-extrabold text-[#76C442] hover:underline">
                              {est.estimate_number || 'EST-DRAFT'}
                            </Link>
                          </td>
                          <td className="px-5 py-3 font-bold text-[#171A1F]">
                            {est.title || 'Attic Insulation Estimate'}
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-gray-100 text-gray-700">
                              {est.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-bold">
                            ${Number(est.total_amount || 0).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-[#737A86] text-[11px]">
                            {formatDate(est.created_at)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link 
                              to={`/estimates/${est.id}`} 
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#151A2D] hover:text-[#76C442]"
                            >
                              <span>View</span>
                              <ExternalLink size={11} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. Jobs Tab */}
          {activeTab === 'jobs' && (
            <div>
              {jobs.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-[#737A86]">
                  <Calendar size={36} className="text-gray-300 mb-2 stroke-[1.5]" />
                  <div className="text-xs font-bold text-[#171A1F]">No Jobs Booked</div>
                  <p className="text-[11px] text-[#737A86] mt-1 max-w-sm">
                    There are no insulation jobs recorded for this contact.
                  </p>
                  <Link
                    to={`/scheduling?customer=${contact.id}`}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#151A2D] text-white hover:bg-[#1f263e] rounded-lg text-xs font-bold transition-all"
                  >
                    <span>Schedule Job</span>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs font-semibold text-[#171A1F]">
                    <thead>
                      <tr className="bg-[#151A2D] text-white border-b border-[#111624] select-none text-[9.5px] font-bold uppercase tracking-wider">
                        <th className="px-5 py-3">Job Number</th>
                        <th className="px-5 py-3">Service Scope</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Scheduled Date</th>
                        <th className="px-5 py-3 text-right">Quoted Amount</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E9ED]">
                      {jobs.map((job) => (
                        <tr key={job.id} className="hover:bg-[#F6F7F9]/60 transition-colors">
                          <td className="px-5 py-3">
                            <Link to={`/jobs/${job.id}`} className="font-extrabold text-[#76C442] hover:underline">
                              JOB-{job.job_number}
                            </Link>
                          </td>
                          <td className="px-5 py-3 font-bold text-[#171A1F]">
                            {job.scope_of_work || 'Attic Insulation'}
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-gray-100 text-gray-700">
                              {job.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[#737A86]">
                            {job.scheduled_date ? formatDate(job.scheduled_date) : 'Unscheduled'}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-bold">
                            ${(job.quoted_amount || 0).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link 
                              to={`/jobs/${job.id}`} 
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#151A2D] hover:text-[#76C442]"
                            >
                              <span>View</span>
                              <ExternalLink size={11} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 4. Invoices Tab */}
          {activeTab === 'invoices' && (
            <div>
              {invoices.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-[#737A86]">
                  <FileSpreadsheet size={36} className="text-gray-300 mb-2 stroke-[1.5]" />
                  <div className="text-xs font-bold text-[#171A1F]">No Invoices Issued</div>
                  <p className="text-[11px] text-[#737A86] mt-1 max-w-sm">
                    No billing invoices have been created for this contact yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs font-semibold text-[#171A1F]">
                    <thead>
                      <tr className="bg-[#151A2D] text-white border-b border-[#111624] select-none text-[9.5px] font-bold uppercase tracking-wider">
                        <th className="px-5 py-3">Invoice #</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Total</th>
                        <th className="px-5 py-3">Issued Date</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E9ED]">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-[#F6F7F9]/60 transition-colors">
                          <td className="px-5 py-3">
                            <Link to={`/invoices/${inv.id}`} className="font-extrabold text-[#76C442] hover:underline">
                              {inv.invoice_number || 'INV-DRAFT'}
                            </Link>
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-gray-100 text-gray-700">
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-bold">
                            ${Number(inv.total || 0).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-[#737A86] text-[11px]">
                            {formatDate(inv.created_at)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link 
                              to={`/invoices/${inv.id}`} 
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#151A2D] hover:text-[#76C442]"
                            >
                              <span>View</span>
                              <ExternalLink size={11} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Edit Contact Modal */}
      {contact && (
        <CreateCustomerModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            fetchContactData();
          }}
          onSuccess={fetchContactData}
          customerToEdit={contact}
        />
      )}

      {/* Delete Contact Modal */}
      {contact && (
        <DeleteContactModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          contactId={contact.id}
          contactName={contact.full_name || 'Contact'}
          onDeleted={() => {
            navigate('/contacts', { state: { toastMessage: 'Contact deleted successfully.' } });
          }}
          onArchived={(isArchived) => {
            setContact(prev => prev ? { ...prev, is_archived: isArchived } : null);
            setToastMessage(isArchived ? 'Contact archived successfully.' : 'Contact restored successfully.');
            setTimeout(() => setToastMessage(null), 3500);
          }}
        />
      )}

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#151A2D] text-white px-4 py-3 rounded-xl shadow-2xl border border-gray-800 flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-5">
          <Check size={16} className="text-[#76C442] stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
