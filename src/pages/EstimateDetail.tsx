import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getValidUntil, relativeTime } from '../utils/estimates';
import { useConfirm, useToast } from '../hooks/useFeedback';
import { supabase } from '../supabaseClient';
import { Loader2, CheckCircle2, Briefcase, MapPin, Download, Edit, Trash2, Plus, Send, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button, ButtonLink, Card, Page, Select, StatusBadge } from '../components/ui';
import { OverflowMenu } from '../components/ui/list';
import { DetailGrid, DetailHeader, DetailLoading, DetailNotFound, InfoList, InfoRow, MobileActionBar } from '../components/ui/detail';
import { EstimateDocument, EstimateDocumentData } from '../components/estimate/EstimateDocument';
import { generateEstimateJsPdf, generateEstimatePdfBase64 } from '../utils/estimatePdf';

interface Estimate extends EstimateDocumentData {
  id: string;
  estimate_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  home_size: number;
  insulation_type: string;
  insulation_rate: number;
  extra_work_description: string | null;
  extra_work_amount: number;
  line_items?: Array<{
    type?: 'item' | 'section';
    name?: string;
    service?: string;
    description: string;
    quantity: number | string;
    unit_price: number;
    is_optional?: boolean;
    is_recommended?: boolean;
  }> | null;
  total_amount: number;
  intro_text: string | null;
  status: string;
  sent_at: string | null;
  approved_at?: string | null;
  first_viewed_at?: string | null;
  last_viewed_at?: string | null;
  view_count?: number | null;
  last_followup_at?: string | null;
  created_at: string;
  approval_token?: string | null;
  lead_id?: string | null;
  assessment_id?: string | null;
  customers?: {
    id?: string;
    full_name: string;
    email: string;
    service_address: string;
    phone: string | null;
  };
  expert_name?: string | null;
  expert_role?: string | null;
  expert_email?: string | null;
  expert_phone?: string | null;
  expert_address?: string | null;
  property_address?: string | null;
  customer_phone?: string | null;
  discount_type?: string;
  discount_value?: number;
  tax_rate?: number;
  deposit_type?: string;
  deposit_value?: number;
  client_message?: string | null;
  terms?: string | null;
  contract_disclaimer?: string | null;
}

export const EstimateDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [convertedJobId, setConvertedJobId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Address prompt states for unlinked estimates
  const [showAddressPrompt, setShowAddressPrompt] = useState(false);
  const [serviceAddress, setServiceAddress] = useState('');

  // Send estimate email states
  const [showSendModal, setShowSendModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { confirm, confirmDialog } = useConfirm();
  const { showToast, toastElement } = useToast();

  // The estimates list links here with ?send=1 (and &followup=1) to open the send dialog directly.
  useEffect(() => {
    if (!estimate || searchParams.get('send') !== '1') return;
    if (searchParams.get('followup') === '1' && estimate.sent_at) {
      const firstName = (estimate.customer_name || '').split(' ')[0];
      setCoordinatorMessage(
        `Hi${firstName ? ` ${firstName}` : ''}, just following up on the quote we sent on ${new Date(estimate.sent_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}. ` +
          `Let us know if you have any questions or would like to make changes — we're happy to help.`
      );
    }
    setShowSendModal(true);
    setSearchParams({}, { replace: true });
  }, [estimate, searchParams, setSearchParams]);
  const [sendEmailAddress, setSendEmailAddress] = useState('');
  const [coordinatorMessage, setCoordinatorMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dbClient = supabase;

  const loadEstimate = async () => {
    if (!id) return;
    try {
      const { data, error } = await dbClient
        .from('estimates')
        .select('*, customers(id, full_name, email, service_address, phone)')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setEstimate(data);
    } catch (err) {
      console.error('Failed to load estimate details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEstimate();
  }, [id]);

  useEffect(() => {
    if (estimate) {
      const cust = Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers;
      setSendEmailAddress(cust?.email || estimate.customer_email || '');
    }
  }, [estimate]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!estimate) return;
    setUpdating(true);
    try {
      const { error } = await dbClient
        .from('estimates')
        .update({ status: newStatus })
        .eq('id', estimate.id);

      if (error) throw error;
      setEstimate(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err: any) {
      showToast('Status update failed: ' + err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDropdownStatusChange = async (newStatus: string) => {
    if (newStatus === 'Approved') {
      await handleConvertToJob();
    } else {
      await handleUpdateStatus(newStatus);
    }
  };

  // Edit Estimate States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editHomeSize, setEditHomeSize] = useState<number | ''>('');
  const [editInsulationType, setEditInsulationType] = useState('Attic Insulation Installation');
  const [editInsulationRate, setEditInsulationRate] = useState<number | ''>('');
  const [editIntroText, setEditIntroText] = useState('');
  
  const [editExpertName, setEditExpertName] = useState('');
  const [editExpertRole, setEditExpertRole] = useState('');
  const [editExpertEmail, setEditExpertEmail] = useState('');
  const [editExpertPhone, setEditExpertPhone] = useState('');
  const [editExpertAddress, setEditExpertAddress] = useState('');

  const [editExtraItems, setEditExtraItems] = useState<Array<{ description: string; quantity: number; unit_price: number }>>([]);

  const handleOpenEdit = () => {
    if (!estimate) return;
    setEditHomeSize(estimate.home_size);
    setEditInsulationType(estimate.insulation_type || 'Line Items');
    setEditInsulationRate(estimate.insulation_rate);
    setEditIntroText(estimate.intro_text || '');
    
    setEditExpertName(estimate.expert_name || '');
    setEditExpertRole(estimate.expert_role || '');
    setEditExpertEmail(estimate.expert_email || '');
    setEditExpertPhone(estimate.expert_phone || '');
    setEditExpertAddress(estimate.expert_address || '');
    
    // Legacy items have a base cost at index 0, but line items mode just has all items in line_items
    const extraItemsList = estimate.line_items 
      ? (estimate.home_size > 0 && estimate.line_items.length > 1 ? estimate.line_items.slice(1) : estimate.line_items).map(item => ({
          description: item.description || '',
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
        }))
      : [];
    setEditExtraItems(extraItemsList);
    setShowEditModal(true);
  };

  const handleSaveEditEstimate = async () => {
    if (!estimate) return;
    if (estimate.home_size > 0) {
      if (editHomeSize === '' || Number(editHomeSize) <= 0) {
        showToast('Home size must be greater than zero for legacy estimates.', 'error');
        return;
      }
      if (editInsulationRate === '' || Number(editInsulationRate) < 0) {
        showToast('Insulation rate must be non-negative for legacy estimates.', 'error');
        return;
      }
    }
    
    if (!editExpertName.trim()) {
      showToast('Expert Name is required.', 'error');
      return;
    }

    for (let i = 0; i < editExtraItems.length; i++) {
      const item = editExtraItems[i];
      if (!item.description.trim()) {
        showToast(`Line Item #${i + 1} is missing a description.`, 'error');
        return;
      }
      if (item.quantity <= 0) {
        showToast(`Line Item #${i + 1} must have a quantity greater than zero.`, 'error');
        return;
      }
      if (item.unit_price < 0) {
        showToast(`Line Item #${i + 1} must have a non-negative unit price.`, 'error');
        return;
      }
    }

    setUpdating(true);
    try {
      let rebuiltLineItems: Array<{ description: string; quantity: number; unit_price: number }> = [];
      let baseCost = 0;
      
      if (estimate.home_size > 0) {
        baseCost = Number(editHomeSize) * Number(editInsulationRate);
        rebuiltLineItems.push({
          description: `Insulation Services: ${editInsulationType} (${editHomeSize} sq ft at $${Number(editInsulationRate).toFixed(2)}/sq ft)`,
          quantity: 1,
          unit_price: baseCost
        });
      }

      editExtraItems.forEach(item => {
        rebuiltLineItems.push({
          description: item.description.trim(),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price)
        });
      });

      const extrasSubtotal = editExtraItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
      const subtotalVal = baseCost + extrasSubtotal;
      const taxVal = Number((subtotalVal * 0.13).toFixed(2));
      const totalVal = Number((subtotalVal + taxVal).toFixed(2));

      const { data, error } = await dbClient
        .from('estimates')
        .update({
          home_size: Number(editHomeSize || 0),
          insulation_type: editInsulationType,
          insulation_rate: Number(editInsulationRate || 0),
          intro_text: editIntroText,
          expert_name: editExpertName.trim(),
          expert_role: editExpertRole.trim(),
          expert_email: editExpertEmail.trim(),
          expert_phone: editExpertPhone.trim(),
          expert_address: editExpertAddress.trim(),
          line_items: rebuiltLineItems,
          total_amount: totalVal
        })
        .eq('id', estimate.id)
        .select()
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setEstimate(prev => prev ? { 
          ...prev, 
          home_size: data.home_size,
          insulation_type: data.insulation_type,
          insulation_rate: data.insulation_rate,
          intro_text: data.intro_text,
          expert_name: data.expert_name,
          expert_role: data.expert_role,
          expert_email: data.expert_email,
          expert_phone: data.expert_phone,
          expert_address: data.expert_address,
          line_items: data.line_items,
          total_amount: Number(data.total_amount)
        } : null);
        showToast('Estimate updated successfully!');
      }
      setShowEditModal(false);
    } catch (err: any) {
      console.error('Estimate edit failed:', err);
      showToast('Failed to update estimate: ' + err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteEstimate = async () => {
    if (!estimate || isDeleting) return;
    const confirmed = await confirm({
      title: 'Delete this estimate?',
      message: 'It will be permanently removed. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    
    setIsDeleting(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      
      if (sessionError || !token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/delete-estimate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estimateId: estimate.id, auth_token: token })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error();
      }
      
      showToast(`Estimate deleted successfully.`);
      navigate('/estimates');
    } catch (err: any) {
      showToast('Unable to delete this estimate. Please try again.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendEstimate = async () => {
    if (!estimate) return;
    if (!sendEmailAddress.trim()) {
      showToast('Recipient email address cannot be empty.', 'error');
      return;
    }

    setIsSending(true);
    try {
      // 1. Establish single source of truth for sent_at timestamp
      const sendTimestamp = estimate.sent_at || new Date().toISOString();

      // Persist sent status and timestamp prior to PDF capture if not already sent
      if (!estimate.sent_at || estimate.status !== 'Sent') {
        const { error: updErr } = await dbClient
          .from('estimates')
          .update({
            status: 'Sent',
            sent_at: sendTimestamp,
            updated_at: sendTimestamp,
          })
          .eq('id', estimate.id);
        if (updErr) {
          console.warn('Could not update estimate sent_at before PDF capture:', updErr);
        }
        setEstimate((prev) => (prev ? { ...prev, status: 'Sent', sent_at: sendTimestamp } : null));
        // Allow React a tick to update DOM with the persisted sent date
        await new Promise((r) => setTimeout(r, 60));
      }

      // 2. Capture exact client-rendered EstimateDocument
      const element = document.getElementById('estimate-document');
      if (!element) {
        throw new Error('Estimate preview element (#estimate-document) not found for PDF generation.');
      }

      const { pdfBase64 } = await generateEstimatePdfBase64(element);
      if (!pdfBase64) {
        throw new Error('Failed to generate client PDF attachment.');
      }

      // 3. Dispatch via edge function enforcing client PDF
      const { error: sendError } = await supabase.functions.invoke('send-document-email', {
        body: {
          documentId: estimate.id,
          documentType: 'estimate',
          recipientEmail: sendEmailAddress.trim(),
          personalMessage: coordinatorMessage.trim(),
          pdfBase64,
          requireClientPdf: true,
          pdfFilename: `estimate_${estimate.estimate_number || 'document'}.pdf`,
        },
      });

      if (sendError) {
        let customMsg = sendError.message;
        try {
          const bodyText = await sendError.context.json();
          if (bodyText && bodyText.error) {
            customMsg = bodyText.error;
          }
        } catch (_) {}
        throw new Error(customMsg);
      }

      if (estimate.lead_id) {
        await dbClient
          .from('leads')
          .update({
            pipeline_stage: 'awaiting_response',
            updated_at: new Date().toISOString(),
          })
          .eq('id', estimate.lead_id);
      }

      // Re-sending a quote the customer already has counts as a follow-up.
      if (estimate.sent_at && estimate.status === 'Sent') {
        const followedUpAt = new Date().toISOString();
        await dbClient.from('estimates').update({ last_followup_at: followedUpAt }).eq('id', estimate.id);
        setEstimate(prev => (prev ? { ...prev, last_followup_at: followedUpAt } : null));
      }

      setStatusMessage({ type: 'success', text: `Estimate ${estimate.estimate_number} sent successfully to ${sendEmailAddress}!` });
      setTimeout(() => setStatusMessage(null), 5000);
      setEstimate((prev) => (prev ? { ...prev, status: 'Sent', sent_at: sendTimestamp } : null));
      setShowSendModal(false);
    } catch (err: any) {
      console.error('Estimate dispatch failed:', err);
      setStatusMessage({ type: 'error', text: 'Failed to send estimate: ' + err.message });
      setTimeout(() => setStatusMessage(null), 7000);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!estimate) return;
    setIsDownloading(true);
    try {
      const element = document.getElementById('estimate-document');
      if (!element) throw new Error('Estimate container element not found');

      const pdf = await generateEstimateJsPdf(element);
      pdf.save(`estimate_${estimate.estimate_number || 'document'}.pdf`);
    } catch (err: any) {
      console.error('Estimate PDF download failed:', err);
      showToast('Failed to generate PDF download: ' + err.message, 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleConvertToJob = async () => {
    if (!estimate) return;

    // If estimate is not linked to a customer, we must create a customer record first
    if (!estimate.customer_id) {
      setShowAddressPrompt(true);
      return;
    }

    await executeJobConversion(estimate.customer_id);
  };

  const handleCreateCustomerAndConvert = async () => {
    if (!estimate) return;
    if (!serviceAddress.trim()) {
      showToast('A valid service address is required to create a customer profile.', 'error');
      return;
    }
    setUpdating(true);
    try {
      // 1. Insert new Customer record
      const { data: newCust, error: custErr } = await dbClient
        .from('customers')
        .insert([{
          full_name: estimate.customer_name,
          email: estimate.customer_email || null,
          service_address: serviceAddress.trim(),
          billing_address: serviceAddress.trim(),
          preferred_contact_method: 'Email'
        }])
        .select()
        .maybeSingle();

      if (custErr || !newCust) throw new Error(custErr?.message || 'Failed to create customer');

      // 2. Link estimate to customer
      const { error: linkErr } = await dbClient
        .from('estimates')
        .update({ customer_id: newCust.id })
        .eq('id', estimate.id);

      if (linkErr) throw linkErr;

      // Update local state
      setEstimate(prev => prev ? { ...prev, customer_id: newCust.id } : null);
      setShowAddressPrompt(false);

      // 3. Convert job
      await executeJobConversion(newCust.id);

    } catch (err: any) {
      showToast('Failed to establish customer profile: ' + err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const executeJobConversion = async (customerId: string) => {
    setUpdating(true);
    try {
      // 1. Fetch maximum job number for incremental generation
      const { data: maxJobData, error: maxJobError } = await dbClient
        .from('jobs')
        .select('job_number')
        .order('job_number', { ascending: false })
        .limit(1);

      if (maxJobError) throw maxJobError;

      const nextJobNum = maxJobData && maxJobData.length > 0 
        ? Number(maxJobData[0].job_number) + 1 
        : 1001;

      // 2. Generate scope summary
      const lineItems = Array.isArray(estimate!.line_items) ? estimate!.line_items : [];
      const itemsList = lineItems.map((item) => 
        `- ${item.description} (Qty: ${item.quantity || 1} × $${Number(item.unit_price || 0).toFixed(2)} = $${(Number(item.quantity || 1) * Number(item.unit_price || 0)).toFixed(2)})`
      ).join('\n');

      const scopeOfWork = [
        `Converted from Estimate ${estimate!.estimate_number}`,
        `Home Size: ${estimate!.home_size} sq ft`,
        `Insulation Type: ${estimate!.insulation_type} (Rate: $${Number(estimate!.insulation_rate).toFixed(2)}/sq ft)`,
        itemsList ? `\nDetailed Scope Items:\n${itemsList}` : (estimate!.extra_work_description ? `Extra Work: ${estimate!.extra_work_description} ($${Number(estimate!.extra_work_amount).toFixed(2)})` : null),
        estimate!.intro_text ? `\nIntro Greeting Wording:\n"${estimate!.intro_text}"` : null
      ].filter(Boolean).join('\n');

      // 3. Insert Job record
      const { data: jobData, error: jobErr } = await dbClient
        .from('jobs')
        .insert([{
          customer_id: customerId,
          job_number: nextJobNum,
          status: 'Scheduled',
          scope_of_work: scopeOfWork,
          quoted_amount: estimate!.total_amount
        }])
        .select()
        .maybeSingle();

      if (jobErr) throw jobErr;

      // 4. Update estimate status to Approved
      const { error: estErr } = await dbClient
        .from('estimates')
        .update({ status: 'Approved', approved_at: estimate!.approved_at || new Date().toISOString() })
        .eq('id', estimate!.id);

      if (estErr) throw estErr;

      setEstimate(prev => prev ? { ...prev, status: 'Approved' } : null);
      if (jobData) {
        setConvertedJobId(jobData.id);
        showToast(`Quote converted to Job #${nextJobNum} successfully!`);
      }
    } catch (err: any) {
      showToast('Conversion failed: ' + err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <DetailLoading label="Loading estimate…" />;

  if (!estimate) {
    return <DetailNotFound title="Estimate not found" back={{ to: '/estimates', label: 'Back to estimates' }} />;
  }

  const cust = Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers;
  const longDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const total = `$${Number(estimate.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /** The one obvious next step, based on where the estimate is. */
  const nextStep = (() => {
    if (estimate.status === 'Approved') {
      return convertedJobId ? (
        <ButtonLink to={`/jobs/${convertedJobId}`} icon={Briefcase}>
          Open job
        </ButtonLink>
      ) : null;
    }
    if (estimate.status === 'Sent') {
      return (
        <Button icon={CheckCircle2} onClick={handleConvertToJob} loading={updating}>
          Convert to job
        </Button>
      );
    }
    return (
      <Button icon={Send} onClick={() => setShowSendModal(true)}>
        Send estimate
      </Button>
    );
  })();

  const moreActions = [
    { label: isDownloading ? 'Preparing PDF…' : 'Download PDF', icon: Download, onClick: handleDownloadPDF },
    ...(estimate.status === 'Sent' ? [{ label: 'Resend / follow up', icon: Send, onClick: () => setShowSendModal(true) }] : []),
    ...(estimate.status === 'Draft' ? [{ label: 'Mark approved & convert', icon: CheckCircle2, onClick: handleConvertToJob }] : []),
    { label: isDeleting ? 'Deleting…' : 'Delete estimate', icon: Trash2, onClick: () => handleDeleteEstimate(), danger: true },
  ];

  return (
    <Page className="pb-28 md:pb-7 print:p-0 print:max-w-none">
      {/* Print overrides so the estimate prints cleanly without the app around it */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body, html, #root, #root > div, main {
            height: auto !important;
            overflow: visible !important;
            max-height: none !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          aside, header, nav, button {
            display: none !important;
          }
        }
      `}} />

      <div className="print:hidden">
        <DetailHeader
          back={{ to: '/estimates', label: 'Estimates' }}
          title={estimate.customer_name || `Estimate ${estimate.estimate_number}`}
          badges={
            <>
              <StatusBadge status={estimate.status} />
              {updating && <Loader2 size={16} className="animate-spin text-brand" />}
            </>
          }
          meta={
            <>
              <span>Estimate #{estimate.estimate_number}</span>
              <span aria-hidden>·</span>
              <span className="font-semibold text-navy">{total}</span>
            </>
          }
          actions={
            <>
              <OverflowMenu actions={moreActions} />
              <Button variant="secondary" icon={Edit} onClick={handleOpenEdit} disabled={updating}>
                Edit
              </Button>
              {nextStep}
            </>
          }
        />
      </div>

      {confirmDialog}
      {toastElement}

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-2.5 print:hidden ${
            statusMessage.type === 'success' ? 'bg-brand-soft border-brand/30 text-brand-ink' : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
          <div className="text-sm leading-relaxed">{statusMessage.text}</div>
        </div>
      )}

      <DetailGrid
        main={
          <div className="bg-white border border-line rounded-xl shadow-card p-3 md:p-8 overflow-x-auto print:border-0 print:shadow-none print:p-0">
            <EstimateDocument
              estimate={estimate}
              containerId="estimate-document"
              approvalUrl={estimate.approval_token ? `${window.location.origin}/approve-estimate/${estimate.approval_token}` : null}
            />
          </div>
        }
        side={
          <div className="space-y-4 md:space-y-5 print:hidden">
            <Card title="Summary">
              <InfoList>
                <InfoRow label="Customer">
                  <div className="font-semibold">{estimate.customer_name}</div>
                  {estimate.customer_email && <div className="text-xs text-muted break-all">{estimate.customer_email}</div>}
                </InfoRow>
                <InfoRow label="Address">{cust?.service_address || <span className="text-muted">Not set</span>}</InfoRow>
                <InfoRow label="Total">
                  <span className="font-semibold">{total}</span>
                </InfoRow>
                <InfoRow label="Created">{longDate(new Date(estimate.created_at))}</InfoRow>
                <InfoRow label="Valid until">{longDate(getValidUntil(estimate))}</InfoRow>
                <InfoRow label="Status">
                  <Select
                    value={estimate.status}
                    disabled={updating}
                    onChange={e => handleDropdownStatusChange(e.target.value)}
                    className="!h-9"
                    aria-label="Estimate status"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Expired">Expired</option>
                  </Select>
                </InfoRow>
              </InfoList>
            </Card>

            {estimate.sent_at && (
              <Card title="Customer activity">
                <div className="flex items-start gap-3">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${estimate.last_viewed_at ? 'bg-brand-soft text-brand-ink' : 'bg-mist text-muted'}`}>
                    {estimate.last_viewed_at ? <Eye size={17} /> : <EyeOff size={17} />}
                  </span>
                  <div className="text-sm">
                    <div className="font-semibold text-navy">
                      {estimate.last_viewed_at
                        ? `Viewed ${relativeTime(estimate.last_viewed_at)}${(estimate.view_count || 0) > 1 ? ` · ${estimate.view_count} times` : ''}`
                        : 'Not opened yet'}
                    </div>
                    <div className="text-xs text-muted">Sent {relativeTime(estimate.sent_at)}</div>
                    {estimate.last_followup_at && <div className="text-xs text-muted">Last follow-up {relativeTime(estimate.last_followup_at)}</div>}
                  </div>
                </div>
              </Card>
            )}

            <Button block variant="secondary" icon={Download} onClick={handleDownloadPDF} loading={isDownloading}>
              {isDownloading ? 'Preparing PDF…' : 'Download PDF'}
            </Button>
          </div>
        }
      />

      <MobileActionBar>
        <Button variant="secondary" icon={Edit} onClick={handleOpenEdit} disabled={updating}>
          Edit
        </Button>
        {nextStep ?? (
          <Button variant="secondary" icon={Download} onClick={handleDownloadPDF} loading={isDownloading}>
            PDF
          </Button>
        )}
      </MobileActionBar>

      {/* Address prompt modal for unlinked estimates */}
      {showAddressPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-brand-charcoal/65 backdrop-blur-sm"
            onClick={() => setShowAddressPrompt(false)}
          />

          <div className="relative bg-white w-full max-w-md rounded-2xl border border-brand-grey-medium shadow-2xl overflow-hidden z-10 flex flex-col">
            <div className="px-5 py-4 bg-white text-navy border-b border-line flex items-center gap-2">
              <MapPin size={16} className="text-brand-green" />
              <h3 className="text-sm font-bold text-navy m-0">Establish Customer Profile</h3>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-brand-grey-dark leading-relaxed">
                Converting a quote to a Job requires a Customer record with a service address. Please enter the service address for <strong>{estimate.customer_name}</strong> to create their customer profile.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-soft">Service Address</label>
                <input
                  type="text"
                  value={serviceAddress}
                  onChange={(e) => setServiceAddress(e.target.value)}
                  placeholder="e.g. 123 Main St, Toronto, ON"
                  className="w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-brand-grey border-t border-brand-grey-medium flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowAddressPrompt(false)}
                className="px-3.5 py-1.5 border border-brand-grey-dark/40 hover:bg-brand-grey text-brand-charcoal text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCreateCustomerAndConvert}
                disabled={updating}
                className="px-4 py-1.5 bg-brand-green hover:bg-brand-green-hover text-navy text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer"
              >
                {updating ? <Loader2 size={12} className="animate-spin mr-1 inline" /> : null}
                <span>Create & Convert</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Estimate Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-brand-charcoal/65 backdrop-blur-sm"
            onClick={() => setShowEditModal(false)}
          />

          <div className="relative bg-white w-full max-w-2xl rounded-2xl border border-brand-grey-medium shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 bg-white text-navy border-b border-line flex items-center gap-2">
              <Edit size={16} className="text-brand-green" />
              <h3 className="text-sm font-bold text-navy m-0">Edit Estimate {estimate?.estimate_number}</h3>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-left">
              {/* Expert Details */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-ink-soft border-b border-brand-grey-medium pb-1 block">Insulation Expert</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-soft block">Name *</label>
                    <input type="text" value={editExpertName} onChange={e => setEditExpertName(e.target.value)} className="w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-soft block">Role / Title</label>
                    <input type="text" value={editExpertRole} onChange={e => setEditExpertRole(e.target.value)} className="w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-soft block">Email</label>
                    <input type="email" value={editExpertEmail} onChange={e => setEditExpertEmail(e.target.value)} className="w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-soft block">Phone</label>
                    <input type="text" value={editExpertPhone} onChange={e => setEditExpertPhone(e.target.value)} className="w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15" />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-ink-soft block">Address</label>
                    <input type="text" value={editExpertAddress} onChange={e => setEditExpertAddress(e.target.value)} className="w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15" />
                  </div>
                </div>
              </div>

              {/* Scope Wording (intro text) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-soft block border-b border-brand-grey-medium pb-1 mt-4">Scope Wording / Intro Greeting</label>
                <textarea
                  value={editIntroText}
                  onChange={(e) => setEditIntroText(e.target.value)}
                  placeholder="Scope intro wording..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                />
              </div>

              {/* Core specifications (Legacy only) */}
              {estimate.home_size > 0 && (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-ink-soft block border-b border-brand-grey-medium pb-1 mt-4">Legacy Specifications</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink-soft block">Home Size (sq ft)</label>
                      <input
                        type="number"
                        value={editHomeSize}
                        min="1"
                        onChange={(e) => setEditHomeSize(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2.5 border border-line rounded-lg text-sm font-mono font-bold text-center focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink-soft block">Insulation Type</label>
                      <select
                        value={editInsulationType}
                        onChange={(e) => setEditInsulationType(e.target.value)}
                        className="w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                      >
                        <option value="Attic Insulation Installation">Attic Insulation Installation</option>
                        <option value="Blown In Insulation">Blown In Insulation</option>
                        <option value="Insulation Removal">Insulation Removal</option>
                        <option value="Attic Mold Removal">Attic Mold Removal</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink-soft block">Rate per sq ft ($)</label>
                      <input
                        type="number"
                        value={editInsulationRate}
                        min="0"
                        step="0.01"
                        onChange={(e) => setEditInsulationRate(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2.5 border border-line rounded-lg text-sm font-mono font-bold text-center focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Line items section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-brand-grey-medium pb-2">
                  <label className="text-xs font-semibold text-ink-soft">Additional Services / Extra Work</label>
                  <button
                    type="button"
                    onClick={() => setEditExtraItems([...editExtraItems, { description: '', quantity: 1, unit_price: 0 }])}
                    className="inline-flex items-center gap-1 px-2.5 py-1 border border-brand-grey-dark/40 hover:bg-brand-grey text-brand-charcoal font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus size={10} className="stroke-[2.5]" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {editExtraItems.length === 0 ? (
                    <div className="text-center italic text-xs text-brand-grey-dark py-4">No additional line items added yet.</div>
                  ) : (
                    editExtraItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-3 items-center border-b border-brand-grey-light/40 pb-3 last:border-b-0">
                        {/* Description */}
                        <div className="col-span-6 space-y-1">
                          <label className="text-xs font-semibold text-ink-soft block">Description</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              const newItems = [...editExtraItems];
                              newItems[idx].description = e.target.value;
                              setEditExtraItems(newItems);
                            }}
                            placeholder="Extra service description..."
                            className="w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                          />
                        </div>

                        {/* Quantity */}
                        <div className="col-span-2 space-y-1">
                          <label className="text-xs font-semibold text-ink-soft block text-center">Qty</label>
                          <input
                            type="number"
                            value={item.quantity}
                            min="1"
                            onChange={(e) => {
                              const newItems = [...editExtraItems];
                              newItems[idx].quantity = e.target.value === '' ? 1 : Number(e.target.value);
                              setEditExtraItems(newItems);
                            }}
                            className="w-full px-2 py-2.5 border border-line rounded-lg text-sm font-mono font-bold text-center focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="col-span-3 space-y-1">
                          <label className="text-xs font-semibold text-ink-soft block text-center">Unit Price ($)</label>
                          <input
                            type="number"
                            value={item.unit_price}
                            min="0"
                            step="0.01"
                            onChange={(e) => {
                              const newItems = [...editExtraItems];
                              newItems[idx].unit_price = e.target.value === '' ? 0 : Number(e.target.value);
                              setEditExtraItems(newItems);
                            }}
                            className="w-full px-2 py-2.5 border border-line rounded-lg text-sm font-mono font-bold text-center focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                          />
                        </div>

                        {/* Delete button */}
                        <div className="col-span-1 text-right pt-4">
                          <button
                            type="button"
                            onClick={() => setEditExtraItems(editExtraItems.filter((_, i) => i !== idx))}
                            className="p-1.5 text-brand-grey-dark hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-brand-grey border-t border-brand-grey-medium flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-3.5 py-1.5 border border-brand-grey-dark/40 hover:bg-brand-grey text-brand-charcoal text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveEditEstimate}
                disabled={updating}
                className="px-5 py-1.5 bg-brand-green hover:bg-brand-green-hover text-navy text-sm font-semibold rounded-lg transition-all shadow cursor-pointer"
              >
                {updating ? <Loader2 size={12} className="animate-spin mr-1 inline" /> : null}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal Overlay */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-brand-charcoal/65 backdrop-blur-sm"
            onClick={() => setShowSendModal(false)}
          />

          <div className="relative bg-white w-full max-w-md rounded-2xl border border-brand-grey-medium shadow-2xl overflow-hidden z-10 flex flex-col">
            <div className="px-5 py-4 bg-white text-navy border-b border-line flex items-center gap-2">
              <Send size={16} className="text-brand-green" />
              <h3 className="text-sm font-bold text-navy m-0">Send Quote Confirmation</h3>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-soft">Recipient Email</label>
                <input
                  type="email"
                  value={sendEmailAddress}
                  onChange={(e) => setSendEmailAddress(e.target.value)}
                  placeholder="Enter recipient email..."
                  className="w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-soft">Short Personal Message (Optional)</label>
                <textarea
                  value={coordinatorMessage}
                  onChange={(e) => setCoordinatorMessage(e.target.value)}
                  placeholder="Hello, please review your custom attic insulation quote..."
                  className="w-full h-24 p-3 border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-brand-grey border-t border-brand-grey-medium flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                className="px-3.5 py-1.5 border border-brand-grey-dark/40 hover:bg-brand-grey text-brand-charcoal text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSendEstimate}
                disabled={isSending}
                className="px-4 py-1.5 bg-brand-green hover:bg-brand-green-hover text-navy text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer"
              >
                {isSending ? <Loader2 size={12} className="animate-spin mr-1 inline" /> : null}
                <span>Send Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </Page>
  );
};
