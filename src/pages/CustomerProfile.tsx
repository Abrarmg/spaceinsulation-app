import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CreateCustomerModal, CUSTOMER_NEEDS_OPTIONS } from '../components/CreateCustomerModal';
import { DeleteContactModal } from '../components/DeleteContactModal';
import { Badge, Button, ButtonLink, Card, Page, buttonClasses } from '../components/ui';
import { OverflowMenu } from '../components/ui/list';
import { DetailGrid, DetailHeader, DetailLoading, DetailNotFound, InfoList, InfoRow, MobileActionBar } from '../components/ui/detail';
import { 
  Loader2, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Edit2,
  ExternalLink,
  Briefcase,
  FileText,
  FileSpreadsheet,
  TrendingUp,
  Trash2,
  Archive,
  RotateCcw,
  Check,
  ClipboardList,
  Plus
} from 'lucide-react';
import { InspectionReport, InspectionPhoto } from '../components/inspections/types';
import { CurrentConditionCard } from '../components/inspections/CurrentConditionCard';
import { InspectionModal } from '../components/inspections/InspectionModal';
import { fetchInspectionReportsForCustomer } from '../components/inspections/inspectionService';


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
  inquiry_date?: string | null;
  customer_needs?: string[] | null;
  square_footage?: number | null;
  asked_about_rebate?: boolean | null;
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

  // Inspection Reports state
  const [inspections, setInspections] = useState<InspectionReport[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<InspectionReport | null>(null);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);

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

      // 6. Fetch inspection reports with photos and signed URLs
      try {
        const reports = await fetchInspectionReportsForCustomer(id);
        setInspections(reports);
      } catch (inspErr) {
        console.error('Error fetching inspection reports:', inspErr);
      }

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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1877F2]" />
            Facebook
          </span>
        );
      case 'csv_import':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            CSV Import
          </span>
        );
      case 'existing_customer':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            Existing
          </span>
        );
      case 'manual':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-mist text-ink-soft border border-line">
            <span className="w-1.5 h-1.5 rounded-full bg-subtle" />
            Manual
          </span>
        );
    }
  };

  const renderTypeBadge = (type?: string, isArchived?: boolean) => {
    if (isArchived) return <Badge tone="neutral">Archived</Badge>;
    return type === 'customer' ? <Badge tone="green">Customer</Badge> : <Badge tone="amber">Prospect</Badge>;
  };

  if (loading) return <DetailLoading label="Loading contact…" />;

  if (error || !contact) {
    return <DetailNotFound title="Contact not found" message={error} back={{ to: '/contacts', label: 'Back to contacts' }} />;
  }

  // Inspections helpers
  const currentInspection = inspections.find(r => r.status === 'completed') || inspections[0] || null;
  const historicalInspections = inspections.filter(r => r.id !== currentInspection?.id);

  const handleOpenNewInspection = () => {
    setSelectedInspection(null);
    setIsInspectionModalOpen(true);
  };

  const handleEditInspection = (report: InspectionReport) => {
    setSelectedInspection(report);
    setIsInspectionModalOpen(true);
  };

  const handleInspectionSuccess = async () => {
    if (id) {
      try {
        const reports = await fetchInspectionReportsForCustomer(id);
        setInspections(reports);
      } catch (err) {
        console.error('Failed to refetch inspections:', err);
      }
    }
    setIsInspectionModalOpen(false);
    setSelectedInspection(null);
    setToastMessage('Inspection saved successfully.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const notProvided = <span className="text-muted">Not provided</span>;
  const mapsUrl = contact.service_address ? `https://maps.google.com/?q=${encodeURIComponent(contact.service_address)}` : null;

  const moreActions = [
    contact.is_archived
      ? { label: 'Restore contact', icon: RotateCcw, onClick: () => handleToggleArchive(false) }
      : { label: 'Archive contact', icon: Archive, onClick: () => handleToggleArchive(true) },
    { label: 'Add inspection', icon: ClipboardList, onClick: handleOpenNewInspection },
    { label: 'Delete contact', icon: Trash2, onClick: () => setIsDeleteModalOpen(true), danger: true },
  ];

  return (
    <Page className="pb-28 md:pb-7">
      <DetailHeader
        back={{ to: '/contacts', label: 'Contacts' }}
        title={contact.full_name || 'Unnamed contact'}
        badges={
          <>
            {renderTypeBadge(contact.contact_type, contact.is_archived)}
            {isArchiving && <Loader2 size={16} className="animate-spin text-brand" />}
          </>
        }
        meta={
          <>
            {contact.phone && <a href={`tel:${contact.phone}`} className="text-ink-soft no-underline hover:underline">{contact.phone}</a>}
            {contact.phone && contact.email && <span aria-hidden>·</span>}
            {contact.email && <a href={`mailto:${contact.email}`} className="text-ink-soft no-underline hover:underline break-all">{contact.email}</a>}
            {!contact.phone && !contact.email && <span>Added {formatDate(contact.created_at)}</span>}
          </>
        }
        actions={
          <>
            <OverflowMenu actions={moreActions} />
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className={buttonClasses('secondary', 'md')}>
                <Phone size={16} /> Call
              </a>
            )}
            <Button variant="secondary" icon={Edit2} onClick={() => setIsModalOpen(true)}>
              Edit
            </Button>
            <ButtonLink to={`/estimates/new?customer=${contact.id}`} icon={Plus}>
              New estimate
            </ButtonLink>
          </>
        }
      />

      {contact.is_archived && (
        <div className="p-3.5 bg-mist border border-line rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-ink-soft">
          <div className="flex items-center gap-2">
            <Archive size={16} className="text-muted shrink-0" />
            <span>This contact is archived and hidden from your lists.</span>
          </div>
          <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => handleToggleArchive(false)} loading={isArchiving}>
            Restore
          </Button>
        </div>
      )}

      <DetailGrid
        main={
          <>
      {/* 4. Related Data Summary Tabs & Cards */}
            <div className="bg-white rounded-xl shadow-card border border-line overflow-hidden">
              
              {/* Tab Headers Strip */}
              <div className="flex border-b border-line overflow-x-auto no-scrollbar select-none px-2">
                <button
                  onClick={() => setActiveTab('opportunities')}
                  className={`flex items-center gap-2 px-3 h-12 text-sm transition-colors border-0 border-b-2 border-solid bg-transparent whitespace-nowrap cursor-pointer ${
                    activeTab === 'opportunities'
                      ? 'border-brand text-navy font-semibold'
                      : 'border-transparent text-muted hover:text-navy font-medium'
                  }`}
                >
                  <TrendingUp size={14} className={activeTab === 'opportunities' ? 'text-brand' : ''} />
                  <span>Leads</span>
                  <span className={`px-2 py-0.2 rounded-full text-2xs ${
                    activeTab === 'opportunities' ? 'bg-navy text-white' : 'bg-mist text-ink-soft'
                  }`}>
                    {leads.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('quotes')}
                  className={`flex items-center gap-2 px-3 h-12 text-sm transition-colors border-0 border-b-2 border-solid bg-transparent whitespace-nowrap cursor-pointer ${
                    activeTab === 'quotes'
                      ? 'border-brand text-navy font-semibold'
                      : 'border-transparent text-muted hover:text-navy font-medium'
                  }`}
                >
                  <FileText size={14} className={activeTab === 'quotes' ? 'text-brand' : ''} />
                  <span>Estimates</span>
                  <span className={`px-2 py-0.2 rounded-full text-2xs ${
                    activeTab === 'quotes' ? 'bg-navy text-white' : 'bg-mist text-ink-soft'
                  }`}>
                    {estimates.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('jobs')}
                  className={`flex items-center gap-2 px-3 h-12 text-sm transition-colors border-0 border-b-2 border-solid bg-transparent whitespace-nowrap cursor-pointer ${
                    activeTab === 'jobs'
                      ? 'border-brand text-navy font-semibold'
                      : 'border-transparent text-muted hover:text-navy font-medium'
                  }`}
                >
                  <Briefcase size={14} className={activeTab === 'jobs' ? 'text-brand' : ''} />
                  <span>Jobs</span>
                  <span className={`px-2 py-0.2 rounded-full text-2xs ${
                    activeTab === 'jobs' ? 'bg-navy text-white' : 'bg-mist text-ink-soft'
                  }`}>
                    {jobs.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('invoices')}
                  className={`flex items-center gap-2 px-3 h-12 text-sm transition-colors border-0 border-b-2 border-solid bg-transparent whitespace-nowrap cursor-pointer ${
                    activeTab === 'invoices'
                      ? 'border-brand text-navy font-semibold'
                      : 'border-transparent text-muted hover:text-navy font-medium'
                  }`}
                >
                  <FileSpreadsheet size={14} className={activeTab === 'invoices' ? 'text-brand' : ''} />
                  <span>Invoices</span>
                  <span className={`px-2 py-0.2 rounded-full text-2xs ${
                    activeTab === 'invoices' ? 'bg-navy text-white' : 'bg-mist text-ink-soft'
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
                      <div className="py-12 flex flex-col items-center justify-center text-center text-muted">
                        <TrendingUp size={36} className="text-gray-300 mb-2 stroke-[1.5]" />
                        <div className="text-xs font-bold text-navy">No Sales Opportunities</div>
                        <p className="text-2xs text-muted mt-1 max-w-sm">
                          No lead opportunities have been linked to this contact yet.
                        </p>
                        <Link
                          to="/leads"
                          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white rounded-lg text-sm font-semibold hover:bg-navy-soft transition-colors"
                        >
                          <span>View Sales Pipeline</span>
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs font-semibold text-navy">
                          <thead>
                            <tr className="bg-canvas text-muted border-b border-line select-none text-2xs font-semibold uppercase tracking-wider">
                              <th className="px-5 py-3">Opportunity</th>
                              <th className="px-5 py-3">Pipeline Stage</th>
                              <th className="px-5 py-3">Source</th>
                              <th className="px-5 py-3">Received Date</th>
                              <th className="px-5 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {leads.map((lead) => (
                              <tr key={lead.id} className="hover:bg-canvas/60 transition-colors">
                                <td className="px-5 py-3">
                                  <div className="font-bold text-navy">
                                    {lead.name || 'Sales Lead'}
                                  </div>
                                </td>
                                <td className="px-5 py-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold border ${getStageBadgeClass(lead.pipeline_stage)}`}>
                                    {formatPipelineStage(lead.pipeline_stage)}
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  {renderSourceBadge(lead.source || 'facebook')}
                                </td>
                                <td className="px-5 py-3 text-muted text-2xs">
                                  {formatDate(lead.received_at || lead.created_at)}
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <Link
                                    to={`/leads`}
                                    className="inline-flex items-center gap-1 text-2xs font-bold text-brand hover:underline"
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
                      <div className="py-12 flex flex-col items-center justify-center text-center text-muted">
                        <FileText size={36} className="text-gray-300 mb-2 stroke-[1.5]" />
                        <div className="text-xs font-bold text-navy">No Quotes Created</div>
                        <p className="text-2xs text-muted mt-1 max-w-sm">
                          No quotes or estimates have been generated for this contact yet.
                        </p>
                        <Link
                          to={`/estimates/new?customer=${contact.id}`}
                          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-navy rounded-lg text-sm font-semibold transition-all"
                        >
                          <span>+ Create First Quote</span>
                        </Link>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs font-semibold text-navy">
                          <thead>
                            <tr className="bg-canvas text-muted border-b border-line select-none text-2xs font-semibold uppercase tracking-wider">
                              <th className="px-5 py-3">Quote #</th>
                              <th className="px-5 py-3">Title</th>
                              <th className="px-5 py-3">Status</th>
                              <th className="px-5 py-3 text-right">Total Amount</th>
                              <th className="px-5 py-3">Created Date</th>
                              <th className="px-5 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {estimates.map((est) => (
                              <tr key={est.id} className="hover:bg-canvas/60 transition-colors">
                                <td className="px-5 py-3">
                                  <Link to={`/estimates/${est.id}`} className="font-bold text-brand hover:underline">
                                    {est.estimate_number || 'EST-DRAFT'}
                                  </Link>
                                </td>
                                <td className="px-5 py-3 font-bold text-navy">
                                  {est.title || 'Attic Insulation Estimate'}
                                </td>
                                <td className="px-5 py-3">
                                  <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-gray-100 text-gray-700">
                                    {est.status}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right font-semibold">
                                  ${Number(est.total_amount || 0).toLocaleString()}
                                </td>
                                <td className="px-5 py-3 text-muted text-2xs">
                                  {formatDate(est.created_at)}
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <Link 
                                    to={`/estimates/${est.id}`} 
                                    className="inline-flex items-center gap-1 text-2xs font-bold text-navy hover:text-brand"
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
                      <div className="py-12 flex flex-col items-center justify-center text-center text-muted">
                        <Calendar size={36} className="text-gray-300 mb-2 stroke-[1.5]" />
                        <div className="text-xs font-bold text-navy">No Jobs Booked</div>
                        <p className="text-2xs text-muted mt-1 max-w-sm">
                          There are no insulation jobs recorded for this contact.
                        </p>
                        <Link
                          to={`/scheduling?customer=${contact.id}`}
                          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white hover:bg-navy-soft rounded-lg text-sm font-semibold transition-all"
                        >
                          <span>Schedule Job</span>
                        </Link>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs font-semibold text-navy">
                          <thead>
                            <tr className="bg-canvas text-muted border-b border-line select-none text-2xs font-semibold uppercase tracking-wider">
                              <th className="px-5 py-3">Job Number</th>
                              <th className="px-5 py-3">Service Scope</th>
                              <th className="px-5 py-3">Status</th>
                              <th className="px-5 py-3">Scheduled Date</th>
                              <th className="px-5 py-3 text-right">Quoted Amount</th>
                              <th className="px-5 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {jobs.map((job) => (
                              <tr key={job.id} className="hover:bg-canvas/60 transition-colors">
                                <td className="px-5 py-3">
                                  <Link to={`/jobs/${job.id}`} className="font-bold text-brand hover:underline">
                                    JOB-{job.job_number}
                                  </Link>
                                </td>
                                <td className="px-5 py-3 font-bold text-navy">
                                  {job.scope_of_work || 'Attic Insulation'}
                                </td>
                                <td className="px-5 py-3">
                                  <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-gray-100 text-gray-700">
                                    {job.status}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-muted">
                                  {job.scheduled_date ? formatDate(job.scheduled_date) : 'Unscheduled'}
                                </td>
                                <td className="px-5 py-3 text-right font-semibold">
                                  ${(job.quoted_amount || 0).toLocaleString()}
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <Link 
                                    to={`/jobs/${job.id}`} 
                                    className="inline-flex items-center gap-1 text-2xs font-bold text-navy hover:text-brand"
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
                      <div className="py-12 flex flex-col items-center justify-center text-center text-muted">
                        <FileSpreadsheet size={36} className="text-gray-300 mb-2 stroke-[1.5]" />
                        <div className="text-xs font-bold text-navy">No Invoices Issued</div>
                        <p className="text-2xs text-muted mt-1 max-w-sm">
                          No billing invoices have been created for this contact yet.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs font-semibold text-navy">
                          <thead>
                            <tr className="bg-canvas text-muted border-b border-line select-none text-2xs font-semibold uppercase tracking-wider">
                              <th className="px-5 py-3">Invoice #</th>
                              <th className="px-5 py-3">Status</th>
                              <th className="px-5 py-3 text-right">Total</th>
                              <th className="px-5 py-3">Issued Date</th>
                              <th className="px-5 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {invoices.map((inv) => (
                              <tr key={inv.id} className="hover:bg-canvas/60 transition-colors">
                                <td className="px-5 py-3">
                                  <Link to={`/invoices/${inv.id}`} className="font-bold text-brand hover:underline">
                                    {inv.invoice_number || 'INV-DRAFT'}
                                  </Link>
                                </td>
                                <td className="px-5 py-3">
                                  <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-gray-100 text-gray-700">
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right font-semibold">
                                  ${Number(inv.total || 0).toLocaleString()}
                                </td>
                                <td className="px-5 py-3 text-muted text-2xs">
                                  {formatDate(inv.created_at)}
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <Link 
                                    to={`/invoices/${inv.id}`} 
                                    className="inline-flex items-center gap-1 text-2xs font-bold text-navy hover:text-brand"
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

      {/* Current Condition Card */}
            <CurrentConditionCard
              inspection={currentInspection}
              onOpenNewInspection={handleOpenNewInspection}
              onEditInspection={handleEditInspection}
              canEdit={true}
              showStepNumber={false}
            />

            {/* Historical Inspections List (if multiple inspections exist) */}
            {historicalInspections.length > 0 && (
              <div className="bg-white rounded-xl border border-line p-5 shadow-card space-y-3">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <h3 className="m-0 text-base font-semibold text-navy flex items-center gap-1.5">
                    <ClipboardList size={13} className="text-brand" />
                    <span>Inspection History ({historicalInspections.length} Previous)</span>
                  </h3>
                </div>

                <div className="divide-y divide-mist">
                  {historicalInspections.map((pastReport) => {
                    const dateStr = pastReport.inspection_date
                      ? new Date(pastReport.inspection_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      : 'Unknown Date';
                    const photoCount = pastReport.photos?.length || 0;
                    return (
                      <div
                        key={pastReport.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-navy">{dateStr}</span>
                            {pastReport.status === 'completed' ? (
                              <span className="px-2 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Completed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-2xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Draft
                              </span>
                            )}
                            {pastReport.current_r_value && (
                              <span className="font-bold text-navy bg-gray-100 px-2 py-0.5 rounded text-2xs">
                                {pastReport.current_r_value}
                              </span>
                            )}
                          </div>
                          <div className="text-2xs text-muted flex items-center gap-2">
                            <span>Inspector: {pastReport.inspector?.full_name || 'Staff'}</span>
                            <span>&bull;</span>
                            <span>{pastReport.attic_sqft ? `${pastReport.attic_sqft.toLocaleString()} sqft` : 'Sqft not recorded'}</span>
                            <span>&bull;</span>
                            <span>{photoCount} {photoCount === 1 ? 'photo' : 'photos'}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleEditInspection(pastReport)}
                          className="self-start sm:self-auto px-3 py-1.5 border border-line hover:border-navy text-navy font-bold rounded-lg transition-colors cursor-pointer text-xs"
                        >
                          View / Edit Report
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </>
        }
        side={
          <>
            <Card title="Contact details">
              <InfoList>
                <InfoRow icon={Phone} label="Phone">
                  {contact.phone ? <a href={`tel:${contact.phone}`} className="text-navy no-underline hover:underline">{contact.phone}</a> : notProvided}
                </InfoRow>
                <InfoRow icon={Mail} label="Email">
                  {contact.email ? <a href={`mailto:${contact.email}`} className="text-brand-ink no-underline hover:underline break-all">{contact.email}</a> : notProvided}
                </InfoRow>
                <InfoRow icon={MapPin} label="Service address">
                  {contact.service_address ? (
                    <>
                      {contact.service_address}
                      {mapsUrl && (
                        <a href={mapsUrl} target="_blank" rel="noreferrer" className="block mt-0.5 text-sm font-medium text-brand-ink no-underline hover:underline">
                          Open in Maps →
                        </a>
                      )}
                    </>
                  ) : notProvided}
                </InfoRow>
                <InfoRow label="Billing address">{contact.billing_address || <span className="text-muted">Same as service address</span>}</InfoRow>
                <InfoRow label="Prefers">
                  <span className="capitalize">{contact.preferred_contact_method || 'Email'}</span>
                </InfoRow>
              </InfoList>
              {contact.notes && (
                <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-navy leading-relaxed whitespace-pre-wrap">{contact.notes}</div>
              )}
            </Card>

            <Card title="Project needs">
              <InfoList>
                <InfoRow label="Enquired">{contact.inquiry_date || notProvided}</InfoRow>
                <InfoRow label="Square footage">
                  {contact.square_footage !== undefined && contact.square_footage !== null ? `${contact.square_footage.toLocaleString()} sq ft` : notProvided}
                </InfoRow>
                <InfoRow label="Rebate">
                  {contact.asked_about_rebate === true ? (
                    <Badge tone="green">Interested</Badge>
                  ) : contact.asked_about_rebate === false ? (
                    'Not interested'
                  ) : (
                    <span className="text-muted">Not asked</span>
                  )}
                </InfoRow>
                <InfoRow label="Services">
                  {contact.customer_needs && contact.customer_needs.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {contact.customer_needs.map(needKey => {
                        const match = CUSTOMER_NEEDS_OPTIONS.find(opt => opt.id === needKey);
                        return (
                          <Badge key={needKey} tone="neutral">
                            {match ? match.label : needKey.replace(/_/g, ' ')}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-muted">None specified</span>
                  )}
                </InfoRow>
              </InfoList>
            </Card>

            <Card title="Record">
              <InfoList>
                <InfoRow label="Source">{renderSourceBadge(contact.source)}</InfoRow>
                <InfoRow label="Added">{formatDate(contact.created_at)}</InfoRow>
                <InfoRow label="Last updated">{formatDate(contact.updated_at)}</InfoRow>
              </InfoList>
            </Card>
          </>
        }
      />

      <MobileActionBar>
        {contact.phone ? (
          <a href={`tel:${contact.phone}`} className={buttonClasses('secondary', 'md')}>
            <Phone size={16} /> Call
          </a>
        ) : (
          <Button variant="secondary" icon={Edit2} onClick={() => setIsModalOpen(true)}>
            Edit
          </Button>
        )}
        <ButtonLink to={`/estimates/new?customer=${contact.id}`} icon={Plus}>
          New estimate
        </ButtonLink>
      </MobileActionBar>

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

      {/* Inspection Modal */}
      {contact && (
        <InspectionModal
          isOpen={isInspectionModalOpen}
          onClose={() => {
            setIsInspectionModalOpen(false);
            setSelectedInspection(null);
          }}
          onSuccess={handleInspectionSuccess}
          customerId={contact.id}
          reportToEdit={selectedInspection}
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
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-navy text-white px-4 py-3 rounded-xl shadow-pop flex items-center gap-2 text-sm font-medium animate-slide-up">
          <Check size={16} className="text-brand stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </Page>
  );
};
