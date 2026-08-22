import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Loader2, CheckCircle2, Briefcase, MapPin, Download, Edit, Trash2, Plus, Send, AlertCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';

interface Estimate {
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
    description: string;
    quantity: number;
    unit_price: number;
  }> | null;
  total_amount: number;
  intro_text: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  approval_token?: string | null;
  customers?: {
    id: string;
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

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'text-slate-600 bg-slate-50 border-slate-200';
      case 'sent':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'approved':
        return 'text-green-700 bg-green-50 border-green-200 font-extrabold';
      case 'rejected':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'expired':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      default:
        return 'text-slate-650 bg-slate-50 border-slate-200';
    }
  };

  const getValidUntilDate = (createdAtStr: string) => {
    const createdDate = new Date(createdAtStr);
    return new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  };

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
      alert('Status update failed: ' + err.message);
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
      ? (estimate.home_size > 0 && estimate.line_items.length > 1 ? estimate.line_items.slice(1).map(item => ({ ...item })) : estimate.line_items.map(item => ({ ...item })))
      : [];
    setEditExtraItems(extraItemsList);
    setShowEditModal(true);
  };

  const handleSaveEditEstimate = async () => {
    if (!estimate) return;
    if (estimate.home_size > 0) {
      if (editHomeSize === '' || Number(editHomeSize) <= 0) {
        alert('Home size must be greater than zero for legacy estimates.');
        return;
      }
      if (editInsulationRate === '' || Number(editInsulationRate) < 0) {
        alert('Insulation rate must be non-negative for legacy estimates.');
        return;
      }
    }
    
    if (!editExpertName.trim()) {
      alert('Expert Name is required.');
      return;
    }

    for (let i = 0; i < editExtraItems.length; i++) {
      const item = editExtraItems[i];
      if (!item.description.trim()) {
        alert(`Line Item #${i + 1} is missing a description.`);
        return;
      }
      if (item.quantity <= 0) {
        alert(`Line Item #${i + 1} must have a quantity greater than zero.`);
        return;
      }
      if (item.unit_price < 0) {
        alert(`Line Item #${i + 1} must have a non-negative unit price.`);
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
        alert('Estimate updated successfully!');
      }
      setShowEditModal(false);
    } catch (err: any) {
      console.error('Estimate edit failed:', err);
      alert('Failed to update estimate: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteEstimate = async () => {
    console.log('[estimate-delete] handler entered', estimate?.id);
    if (!estimate || isDeleting) return;
    console.log('[estimate-delete] before confirm');
    const confirmed = confirm(`Delete this estimate permanently? This action cannot be undone.`);
    console.log('[estimate-delete] confirm result', confirmed);
    if (!confirmed) return;
    
    setIsDeleting(true);
    try {
      console.log('[estimate-delete] getting session');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      console.log('[estimate-delete] session result', {
        hasSession: !!sessionData.session,
        hasAccessToken: !!token,
        sessionError: sessionError?.message || null
      });
      
      if (sessionError || !token) {
        throw new Error('Not authenticated');
      }

      console.log('[estimate-delete] about to fetch');
      const response = await fetch('/api/delete-estimate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estimateId: estimate.id, auth_token: token })
      });

      console.log('[estimate-delete] response status', response.status);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error();
      }
      
      alert(`Estimate deleted successfully.`);
      navigate('/estimates');
    } catch (err: any) {
      alert('Unable to delete this estimate. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendEstimate = async () => {
    if (!estimate) return;
    if (!sendEmailAddress.trim()) {
      alert('Recipient email address cannot be empty.');
      return;
    }

    setIsSending(true);
    try {
      const { error: sendError } = await supabase.functions.invoke('send-document-email', {
        body: {
          documentId: estimate.id,
          documentType: 'estimate',
          recipientEmail: sendEmailAddress.trim(),
          personalMessage: coordinatorMessage.trim()
        }
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

      setStatusMessage({ type: 'success', text: `Estimate ${estimate.estimate_number} sent successfully to ${sendEmailAddress}!` });
      setTimeout(() => setStatusMessage(null), 5000);
      setEstimate(prev => prev ? { ...prev, status: 'Sent' } : null);
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
      const element = document.getElementById('estimate-document-body');
      if (!element) throw new Error('Estimate container element not found');

      // Capture snapshot at scale 1.5 with absolute style isolation
      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Clean oklch and oklab from all stylesheets text content to prevent html2canvas parsing errors
          Array.from(clonedDoc.getElementsByTagName('style')).forEach(styleEl => {
            if (styleEl.textContent) {
              styleEl.textContent = styleEl.textContent
                .replace(/oklch\([^)]+\)/g, '#76C442')
                .replace(/oklab\([^)]+\)/g, '#76C442');
            }
          });

          // Clean rules that contain oklch or oklab
          Array.from(clonedDoc.styleSheets).forEach(sheet => {
            try {
              const rules = sheet.cssRules || sheet.rules;
              if (!rules) return;
              for (let i = rules.length - 1; i >= 0; i--) {
                const rule = rules[i];
                if (rule.cssText && (rule.cssText.includes('oklch') || rule.cssText.includes('oklab'))) {
                  sheet.deleteRule(i);
                }
              }
            } catch (e) {
              // Ignore CORS restrictions on external sheets
            }
          });

          // Inject custom CSS to force desktop PDF rendering layout in the clone
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            #estimate-document-body {
              width: 800px !important;
              max-width: 800px !important;
              padding: 40px !important;
              box-sizing: border-box !important;
            }
            #estimate-document-body .grid {
              display: grid !important;
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 16px !important;
            }
            .pdf-brand-container {
              display: flex !important;
              flex-direction: row !important;
              justify-content: space-between !important;
              align-items: flex-start !important;
              gap: 16px !important;
            }
            .pdf-align-right {
              text-align: right !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width
      const pageHeight = 295; // A4 height
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`estimate_${estimate.estimate_number}.pdf`);
    } catch (err: any) {
      console.error('Estimate PDF download failed:', err);
      alert('Failed to generate PDF download: ' + err.message);
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
      alert('A valid service address is required to create a customer profile.');
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
      alert('Failed to establish customer profile: ' + err.message);
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
        .update({ status: 'Approved' })
        .eq('id', estimate!.id);

      if (estErr) throw estErr;

      setEstimate(prev => prev ? { ...prev, status: 'Approved' } : null);
      if (jobData) {
        setConvertedJobId(jobData.id);
        alert(`Quote converted to Job #${nextJobNum} successfully!`);
      }
    } catch (err: any) {
      alert('Conversion failed: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-screen gap-3 text-brand-grey-dark">
        <Loader2 className="w-10 h-10 animate-spin text-brand-green" />
        <span className="text-sm font-semibold">Loading quote specification...</span>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="flex-grow p-6 text-center text-xs text-brand-grey-dark italic">
        Estimate details not found.
      </div>
    );
  }

  const baseEstimate = Number(estimate.home_size) * Number(estimate.insulation_rate);
  const lineItems = Array.isArray(estimate.line_items) ? estimate.line_items : [];

  // Determine subtotal, tax, and total
  let subtotal = 0;
  let tax = 0;
  let total = estimate.total_amount;

  if (lineItems.length > 0) {
    subtotal = lineItems.reduce((sum, item) => sum + (Number(item.quantity || 1) * Number(item.unit_price || 0)), 0);
    tax = Number((subtotal * 0.13).toFixed(2));
    total = Number((subtotal + tax).toFixed(2));
  } else {
    // Fallback for legacy database records
    subtotal = baseEstimate + Number(estimate.extra_work_amount || 0);
    total = estimate.total_amount;
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const getInsulationDescription = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('cellulose')) return 'Blown-In Cellulose';
    if (t.includes('fiberglass') || t.includes('glass')) return 'Blown-In Fiberglass';
    return 'Blown-In Insulation';
  };

  const tableItems = lineItems.length > 0 ? lineItems.map((item, idx) => {
    if (estimate.home_size > 0 && idx === 0) {
      return {
        service: 'Attic Insulation',
        description: getInsulationDescription(estimate.insulation_type),
        quantity: `${estimate.home_size.toLocaleString()} sq ft`,
        rate: Number(estimate.insulation_rate),
        total: Number(estimate.home_size) * Number(estimate.insulation_rate)
      };
    }
    const rawDesc = item.description.includes(':') ? item.description.split(':').slice(1).join(':').trim() : item.description;
    const isLegacy = estimate.home_size > 0;
    return {
      service: isLegacy ? (item.description.includes(':') ? item.description.split(':')[0].trim() : item.description) : (item.description?.split(' ')[0] || 'Service'),
      description: isLegacy ? (rawDesc === 'Service item' ? 'Attic Air Sealing' : rawDesc) : item.description,
      quantity: String(item.quantity),
      rate: Number(item.unit_price),
      total: Number(item.quantity) * Number(item.unit_price)
    };
  }) : [
    {
      service: 'Attic Insulation',
      description: getInsulationDescription(estimate.insulation_type),
      quantity: `${estimate.home_size.toLocaleString()} sq ft`,
      rate: Number(estimate.insulation_rate),
      total: baseEstimate
    },
    ...(Number(estimate.extra_work_amount || 0) > 0 ? [{
      service: 'Air Sealing',
      description: estimate.extra_work_description || 'Attic Air Sealing',
      quantity: '1',
      rate: Number(estimate.extra_work_amount),
      total: Number(estimate.extra_work_amount)
    }] : [])
  ];

  const cust = Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers;
  const formattedIssueDate = new Date(estimate.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const validUntilDate = getValidUntilDate(estimate.created_at);
  const formattedValidUntil = validUntilDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex-grow p-6 md:p-8 space-y-6 overflow-y-auto max-h-screen bg-brand-grey pb-16 print:bg-white print:p-0 print:overflow-visible print:max-h-none">
      
      {/* CSS stylesheet print overrides block to solve overflow and page truncations */}
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
          .bg-brand-grey {
            background-color: #ffffff !important;
          }
        }
      `}} />

      {/* Header bar controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/estimates')}
            className="p-2 bg-white border border-brand-grey-medium hover:bg-brand-grey rounded-xl text-brand-charcoal cursor-pointer transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-2xl font-black text-brand-charcoal tracking-tight m-0">Estimate {estimate.estimate_number}</h2>
            <p className="text-xs text-brand-grey-dark mt-1">Review specifications and convert to scheduled jobs.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {updating && <Loader2 size={16} className="animate-spin text-brand-green" />}

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-brand-grey-dark uppercase tracking-wider">Status:</span>
            <select
              value={estimate.status}
              disabled={updating}
              onChange={(e) => handleDropdownStatusChange(e.target.value)}
              className="px-3 py-1.5 bg-white border border-brand-grey-medium hover:bg-brand-grey text-brand-charcoal text-xs font-black uppercase rounded-xl shadow cursor-pointer transition-colors focus:outline-none min-h-[44px]"
            >
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          <button
            onClick={handleOpenEdit}
            disabled={updating}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-brand-charcoal hover:bg-brand-grey text-brand-charcoal font-extrabold text-xs uppercase tracking-wider rounded-xl shadow cursor-pointer transition-colors min-h-[44px]"
          >
            <Edit size={14} />
            <span>Edit</span>
          </button>

          <button
            onClick={() => { console.log('[estimate-delete] menu click', estimate?.id); handleDeleteEstimate(); }}
            disabled={isDeleting}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow cursor-pointer transition-colors min-h-[44px] ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
          </button>

          {estimate.status !== 'Approved' && (
            <button
              onClick={() => setShowSendModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal font-black text-xs uppercase tracking-wider rounded-xl shadow cursor-pointer transition-colors min-h-[44px]"
            >
              <Send size={14} />
              <span>Send Estimate</span>
            </button>
          )}

          {estimate.status === 'Sent' && (
            <button
              onClick={handleConvertToJob}
              disabled={updating}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal font-black text-xs uppercase tracking-wider rounded-xl shadow cursor-pointer transition-colors min-h-[44px]"
            >
              <CheckCircle2 size={14} />
              <span>Convert to Job</span>
            </button>
          )}

          {estimate.status === 'Approved' && convertedJobId && (
            <Link
              to={`/jobs/${convertedJobId}`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-charcoal hover:bg-brand-dark text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow transition-colors min-h-[44px]"
            >
              <Briefcase size={14} className="text-brand-green" />
              <span>Go to Converted Job</span>
            </Link>
          )}
        </div>
      </div>

      {/* Success/Error Banner (Hidden on Print) */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-start gap-2.5 print:hidden ${
          statusMessage.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" /> : <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />}
          <div className="text-xs font-semibold leading-relaxed">{statusMessage.text}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Letterhead Preview Style (Col-span 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div 
            id="estimate-document-body" 
            className="p-6 md:p-12 bg-white border border-[#E5E7EB] rounded-2xl shadow-sm max-w-[850px] mx-auto text-[#171A1F] relative overflow-hidden"
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            {/* 1. Page Header */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }} className="select-none">
              <tbody>
                <tr>
                  <td style={{ width: '64px', verticalAlign: 'top', padding: 0 }}>
                    <img 
                      src="/logo.png" 
                      alt="Logo" 
                      style={{ width: '64px', height: '64px', display: 'block', objectFit: 'contain' }}
                    />
                  </td>
                  <td style={{ paddingLeft: '16px', verticalAlign: 'top', textAlign: 'left', paddingTop: '2px' }}>
                    <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#151A2D', letterSpacing: '-0.025em', margin: 0, lineHeight: '1.2' }}>SPACE INSULATION</h1>
                    <span style={{ fontSize: '9px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, display: 'block', marginTop: '2px' }}>Ontario's Trusted Insulation Experts</span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Accent Line */}
            <div style={{ height: '2px', backgroundColor: '#76C442', width: '100%', marginBottom: '16px' }} />

            {/* Document Metadata (Stacked under divider) */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '11px', color: '#64748B', fontWeight: 600, textAlign: 'left' }} className="pdf-brand-container select-none flex-col sm:flex-row gap-2">
              <div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#151A2D' }}>Estimate # {estimate.estimate_number}</div>
              </div>
              <div style={{ textAlign: 'left' }} className="pdf-align-right sm:text-right">
                <div>Date Issued: {formattedIssueDate}</div>
                <div>Valid Until: {formattedValidUntil}</div>
              </div>
            </div>

            {/* 2. Document Title */}
            <div style={{ marginBottom: '24px', textAlign: 'left' }} className="select-none">
              <h2 style={{ fontSize: '24px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em', color: '#151A2D', margin: 0 }}>Insulation Estimate</h2>
              <p style={{ fontSize: '11.5px', color: '#64748B', margin: 0, marginTop: '2px', fontWeight: 550 }}>
                Thank you for considering Space Insulation for your insulation project.
              </p>
            </div>

            {/* 3. Customer + Project Summary Cards (Equal Height via items-stretch) */}
            <div style={{ marginBottom: '24px' }} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch select-none">
              {/* Prepared For Card */}
              <div style={{ backgroundColor: '#F8F9FA', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                <span style={{ fontSize: '9px', color: '#64748B', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Prepared For</span>
                <div style={{ fontSize: '11px', color: '#171A1F', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px' }}>👤</span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#151A2D' }}>{estimate.customer_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px' }}>📞</span>
                    <span>{cust?.phone || 'Not Provided'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px' }}>✉</span>
                    <span style={{ color: '#64748B' }}>{cust?.email || estimate.customer_email}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontWeight: 700 }}>
                    <span style={{ fontSize: '12px' }}>📍</span>
                    <span style={{ textTransform: 'capitalize' }}>{cust?.service_address || 'Address Not Registered'}</span>
                  </div>
                </div>
              </div>

              {/* Your Insulation Expert Card */}
              <div style={{ backgroundColor: '#F8F9FA', border: '1px solid #E5E7EB', borderLeft: '4px solid #76C442', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                <span style={{ fontSize: '9px', color: '#64748B', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Your Insulation Expert</span>
                <div style={{ fontSize: '11px', color: '#171A1F', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px' }}>👤</span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#151A2D' }}>{estimate.expert_name || 'N/A'}</span>
                    {estimate.expert_role && <span style={{ color: '#64748B', fontSize: '10px' }}>({estimate.expert_role})</span>}
                  </div>
                  {estimate.expert_phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px' }}>📞</span>
                      <span>{estimate.expert_phone}</span>
                    </div>
                  )}
                  {estimate.expert_email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px' }}>✉</span>
                      <span style={{ color: '#64748B' }}>{estimate.expert_email}</span>
                    </div>
                  )}
                  {estimate.expert_address && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontWeight: 700 }}>
                      <span style={{ fontSize: '12px' }}>📍</span>
                      <span style={{ textTransform: 'capitalize' }}>{estimate.expert_address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Project Details Specifications list (Table structure prevents overlap in pdf capture) */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#151A2D', borderBottom: '1px solid #E5E7EB', paddingBottom: '6px', margin: 0, marginBottom: '10px', textAlign: 'left' }} className="select-none">
                Project Specifications
              </h3>
              <div style={{ display: 'flex', gap: '4%', width: '100%' }} className="select-none">
                {/* Left Spec Table */}
                {estimate.home_size > 0 && (
                  <table style={{ width: '48%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #F3F4F6', height: '28px' }}>
                        <td style={{ color: '#64748B', fontWeight: 600, textAlign: 'left', padding: '4px 0' }}>Home Size</td>
                        <td style={{ color: '#151A2D', fontWeight: 800, textAlign: 'right', padding: '4px 0' }}>{estimate.home_size.toLocaleString()} sq ft</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #F3F4F6', height: '28px' }}>
                        <td style={{ color: '#64748B', fontWeight: 600, textAlign: 'left', padding: '4px 0' }}>Insulation Type</td>
                        <td style={{ color: '#151A2D', fontWeight: 800, textAlign: 'right', padding: '4px 0' }}>{estimate.insulation_type || 'Blown-in'}</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* Right Spec Table */}
                <table style={{ width: estimate.home_size > 0 ? '48%' : '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <tbody>
                    {estimate.home_size > 0 && (
                      <tr style={{ borderBottom: '1px solid #F3F4F6', height: '28px' }}>
                        <td style={{ color: '#64748B', fontWeight: 600, textAlign: 'left', padding: '4px 0' }}>Rate</td>
                        <td style={{ color: '#151A2D', fontWeight: 800, textAlign: 'right', padding: '4px 0' }}>{formatCurrency(Number(estimate.insulation_rate))} / sq ft</td>
                      </tr>
                    )}
                    <tr style={{ borderBottom: '1px solid #F3F4F6', height: '28px' }}>
                      <td style={{ color: '#64748B', fontWeight: 600, textAlign: 'left', padding: '4px 0' }}>Service Location</td>
                      <td style={{ color: '#151A2D', fontWeight: 800, textAlign: 'right', padding: '4px 0', textTransform: 'capitalize' }}>
                        {cust?.service_address || 'Address Not Registered'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. Services & Pricing Quotation Table */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#151A2D', borderBottom: '1px solid #E5E7EB', paddingBottom: '6px', margin: 0, marginBottom: '10px', textAlign: 'left' }} className="select-none">
                Proposed Quotation & Services
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#151A2D', color: '#FFFFFF', fontWeight: 800, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.05em' }} className="select-none">
                    <th style={{ padding: '8px 12px', borderTopLeftRadius: '6px', borderBottomLeftRadius: '6px' }}>Service</th>
                    <th style={{ padding: '8px 12px' }}>Description</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', borderTopRightRadius: '6px', borderBottomRightRadius: '6px' }}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {tableItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/40">
                      <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#151A2D' }}>{item.service}</td>
                      <td style={{ padding: '8px 12px', color: '#64748B', fontWeight: 550 }}>{item.description}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(item.rate)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#151A2D' }}>
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 6. Total Summary Sections */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
              <table style={{ width: '300px', borderCollapse: 'collapse', fontSize: '11px' }}>
                <tbody>
                  <tr style={{ height: '22px' }} className="select-none">
                    <td style={{ color: '#64748B', fontWeight: 600, padding: 0, textAlign: 'left' }}>Subtotal</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', padding: 0, color: '#151A2D' }}>{formatCurrency(subtotal)}</td>
                  </tr>
                  <tr style={{ height: '22px' }} className="select-none">
                    <td style={{ color: '#64748B', fontWeight: 600, padding: 0, textAlign: 'left' }}>HST (13%)</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', padding: 0, color: '#151A2D' }}>{formatCurrency(tax)}</td>
                  </tr>
                  <tr style={{ height: '56px' }}>
                    <td colSpan={2} style={{ padding: '8px 0 0 0' }}>
                      <div style={{ backgroundColor: '#EAF7EC', border: '1px solid #A5D6A7', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#1B5E20', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL ESTIMATE</span>
                        <span style={{ fontSize: '18px', fontWeight: 950, color: '#2E7D32', fontFamily: 'monospace' }}>
                          {formatCurrency(total)} CAD
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 7. Next Steps & Why Space Insulation Trust */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-[#E5E7EB] pt-4 select-none">
              {/* Next steps */}
              <div style={{ textAlign: 'left' }}>
                <div>
                  <h4 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#151A2D', margin: 0, marginBottom: '6px' }}>
                    Next Steps
                  </h4>
                  <div style={{ fontSize: '11px', color: '#171A1F', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>1️⃣ Review this estimate</div>
                    <div>2️⃣ Approve the quotation</div>
                    <div>3️⃣ Schedule installation</div>
                    <div>4️⃣ Our crew completes the work</div>
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748B', fontWeight: 'bold', marginTop: '8px' }}>
                    This estimate is valid until {formattedValidUntil}.
                  </div>
                  {/* QR Code - Scan to Review & Approve */}
                  {estimate.approval_token && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <QRCodeSVG
                        value={`${window.location.origin}/approve-estimate/${estimate.approval_token}`}
                        size={64}
                        bgColor="#ffffff"
                        fgColor="#151A2D"
                        level="M"
                      />
                      <div style={{ fontSize: '9px', color: '#64748B', fontWeight: 600, lineHeight: 1.4 }}>
                        Scan to review<br />and approve
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Why space insulation (Mini feature cards grid) */}
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#151A2D', margin: 0, marginBottom: '6px' }}>
                  Why Space Insulation
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }} className="select-none">
                  <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '6px 10px', fontSize: '9.5px', fontWeight: 700, color: '#151A2D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#76C442', fontWeight: 'bold' }}>✓</span> Licensed
                  </div>
                  <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '6px 10px', fontSize: '9.5px', fontWeight: 700, color: '#151A2D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#76C442', fontWeight: 'bold' }}>✓</span> Energy Efficient
                  </div>
                  <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '6px 10px', fontSize: '9.5px', fontWeight: 700, color: '#151A2D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#76C442', fontWeight: 'bold' }}>✓</span> Warranty Included
                  </div>
                  <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '6px 10px', fontSize: '9.5px', fontWeight: 700, color: '#151A2D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#76C442', fontWeight: 'bold' }}>✓</span> Pro Installation
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Indicators Bar */}
            <div style={{ borderTop: '1px solid #E5E7EB', marginTop: '16px', paddingTop: '10px', display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '9px', color: '#64748B', fontWeight: 700 }} className="select-none flex-wrap">
              <div>✓ WSIB Covered</div>
              <div>|</div>
              <div>✓ Fully Insured</div>
              <div>|</div>
              <div>✓ Ontario Licensed</div>
              <div>|</div>
              <div>✓ Satisfaction Guaranteed</div>
            </div>

            {/* Customer CTA approve button */}
            {estimate.status !== 'Approved' && (
              <div className="border-t border-[#E5E7EB] mt-4 pt-4 flex flex-col items-center justify-center gap-1.5 print:hidden" data-html2canvas-ignore="true">
                <span className="text-[10px] text-[#64748B] font-bold uppercase select-none">Ready to get started? Contact us today.</span>
                <button
                  type="button"
                  onClick={handleConvertToJob}
                  className="px-6 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors flex items-center gap-1.5 border-none cursor-pointer"
                >
                  <span>Approve Estimate →</span>
                </button>
              </div>
            )}

            {/* Muted Footer */}
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '12px', marginTop: '16px', textAlign: 'center', fontSize: '9px', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '2px', fontWeight: 550 }} className="select-none">
              <div style={{ fontWeight: 800, color: '#151A2D', fontSize: '10px' }}>Questions? Call us today.</div>
              <div style={{ fontWeight: 700, color: '#151A2D' }}>Space Insulation Inc.</div>
              <div>Phone: (647) 704-9021 | Email: info@spaceinsulation.ca | Website: spaceinsulation.ca</div>
            </div>

            {/* Download PDF Button (Ignored on PDF capture / Hidden on Print) */}
            <div className="border-t border-[#E5E7EB] mt-4 pt-4 flex justify-center print:hidden" data-html2canvas-ignore="true">
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="inline-flex items-center gap-2 px-5 py-2 border border-[#E5E7EB] bg-white hover:bg-slate-50 text-[#171A1F] font-bold text-xs rounded-xl shadow-3xs cursor-pointer transition-all disabled:opacity-50 min-h-[36px]"
              >
                {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} className="text-[#64748B]" />}
                <span>{isDownloading ? 'Generating PDF...' : 'Download PDF Proposal'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recommended Detail Structure Card */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-brand-grey-medium shadow-sm space-y-5 select-none text-xs text-[#171A1F]">
            <div className="flex items-center justify-between border-b border-brand-grey-medium pb-3">
              <div>
                <span className="text-[10px] text-[#737A86] uppercase font-bold">Estimate Ref</span>
                <h3 className="text-base font-black text-[#151A2D] m-0">{estimate.estimate_number}</h3>
              </div>
              <span className={`px-2.5 py-0.5 border rounded-lg text-[9px] font-black uppercase tracking-wider ${getStatusStyle(estimate.status)}`}>
                {estimate.status}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[9px] text-[#737A86] uppercase font-bold block">Customer</span>
                <span className="font-bold text-[#151A2D] block mt-0.5">{estimate.customer_name}</span>
                <span className="text-[10px] text-[#737A86] block">{estimate.customer_email}</span>
              </div>

              <div>
                <span className="text-[9px] text-[#737A86] uppercase font-bold block">Service Address</span>
                <span className="font-bold text-[#151A2D] block mt-0.5">
                  {estimate.customers?.service_address || 'Richmond Hill'}
                </span>
              </div>

              <div>
                <span className="text-[9px] text-[#737A86] uppercase font-bold block">Created Date</span>
                <span className="font-bold text-[#151A2D] block mt-0.5">
                  {new Date(estimate.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>

              <div>
                <span className="text-[9px] text-[#737A86] uppercase font-bold block">Valid Until</span>
                <span className="font-bold text-[#151A2D] block mt-0.5">
                  {getValidUntilDate(estimate.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Side-Panel Primary Actions */}
            <div className="pt-4 border-t border-brand-grey-medium flex flex-col gap-2">
              <button
                onClick={handleOpenEdit}
                disabled={updating}
                className="w-full py-2 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#1E293B] rounded-lg text-xs font-black shadow-3xs cursor-pointer min-h-[36px]"
              >
                Edit Estimate
              </button>

              {estimate.status !== 'Approved' && (
                <button
                  onClick={() => setShowSendModal(true)}
                  disabled={updating}
                  className="w-full py-2 bg-[#151A2D] text-white hover:bg-slate-800 rounded-lg text-xs font-bold cursor-pointer min-h-[36px] border-none"
                >
                  Send Estimate
                </button>
              )}

              {estimate.status !== 'Approved' && (
                <button
                  onClick={handleConvertToJob}
                  disabled={updating}
                  className="w-full py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] rounded-lg text-xs font-black cursor-pointer min-h-[36px] border-none"
                >
                  Convert to Job
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Address prompt modal for unlinked estimates */}
      {showAddressPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-brand-charcoal/65 backdrop-blur-sm"
            onClick={() => setShowAddressPrompt(false)}
          />

          <div className="relative bg-white w-full max-w-md rounded-2xl border border-brand-grey-medium shadow-2xl overflow-hidden z-10 flex flex-col">
            <div className="p-4 bg-brand-charcoal text-white flex items-center gap-2">
              <MapPin size={16} className="text-brand-green" />
              <h3 className="text-sm font-bold text-white m-0">Establish Customer Profile</h3>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-brand-grey-dark leading-relaxed">
                Converting a quote to a Job requires a Customer record with a service address. Please enter the service address for <strong>{estimate.customer_name}</strong> to create their customer profile.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Service Address</label>
                <input
                  type="text"
                  value={serviceAddress}
                  onChange={(e) => setServiceAddress(e.target.value)}
                  placeholder="e.g. 123 Main St, Toronto, ON"
                  className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20"
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
                className="px-4 py-1.5 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer"
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
            <div className="p-4 bg-brand-charcoal text-white flex items-center gap-2">
              <Edit size={16} className="text-brand-green" />
              <h3 className="text-sm font-bold text-white m-0">Edit Estimate {estimate?.estimate_number}</h3>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-left">
              {/* Expert Details */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-brand-grey-dark uppercase border-b border-brand-grey-medium pb-1 block">Insulation Expert</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-brand-grey-dark uppercase block">Name *</label>
                    <input type="text" value={editExpertName} onChange={e => setEditExpertName(e.target.value)} className="w-full px-3 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-brand-grey-dark uppercase block">Role / Title</label>
                    <input type="text" value={editExpertRole} onChange={e => setEditExpertRole(e.target.value)} className="w-full px-3 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-brand-grey-dark uppercase block">Email</label>
                    <input type="email" value={editExpertEmail} onChange={e => setEditExpertEmail(e.target.value)} className="w-full px-3 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-brand-grey-dark uppercase block">Phone</label>
                    <input type="text" value={editExpertPhone} onChange={e => setEditExpertPhone(e.target.value)} className="w-full px-3 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20" />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[9px] font-bold text-brand-grey-dark uppercase block">Address</label>
                    <input type="text" value={editExpertAddress} onChange={e => setEditExpertAddress(e.target.value)} className="w-full px-3 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20" />
                  </div>
                </div>
              </div>

              {/* Scope Wording (intro text) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-grey-dark uppercase block border-b border-brand-grey-medium pb-1 mt-4">Scope Wording / Intro Greeting</label>
                <textarea
                  value={editIntroText}
                  onChange={(e) => setEditIntroText(e.target.value)}
                  placeholder="Scope intro wording..."
                  rows={2}
                  className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                />
              </div>

              {/* Core specifications (Legacy only) */}
              {estimate.home_size > 0 && (
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-brand-grey-dark uppercase block border-b border-brand-grey-medium pb-1 mt-4">Legacy Specifications</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-grey-dark uppercase block">Home Size (sq ft)</label>
                      <input
                        type="number"
                        value={editHomeSize}
                        min="1"
                        onChange={(e) => setEditHomeSize(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-grey-dark uppercase block">Insulation Type</label>
                      <select
                        value={editInsulationType}
                        onChange={(e) => setEditInsulationType(e.target.value)}
                        className="w-full px-3 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                      >
                        <option value="Attic Insulation Installation">Attic Insulation Installation</option>
                        <option value="Blown In Insulation">Blown In Insulation</option>
                        <option value="Insulation Removal">Insulation Removal</option>
                        <option value="Attic Mold Removal">Attic Mold Removal</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-grey-dark uppercase block">Rate per sq ft ($)</label>
                      <input
                        type="number"
                        value={editInsulationRate}
                        min="0"
                        step="0.01"
                        onChange={(e) => setEditInsulationRate(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Line items section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-brand-grey-medium pb-2">
                  <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Additional Services / Extra Work</label>
                  <button
                    type="button"
                    onClick={() => setEditExtraItems([...editExtraItems, { description: '', quantity: 1, unit_price: 0 }])}
                    className="inline-flex items-center gap-1 px-2.5 py-1 border border-brand-grey-dark/40 hover:bg-brand-grey text-brand-charcoal font-extrabold text-[9px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
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
                          <label className="text-[9px] font-bold text-brand-grey-dark uppercase block">Description</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              const newItems = [...editExtraItems];
                              newItems[idx].description = e.target.value;
                              setEditExtraItems(newItems);
                            }}
                            placeholder="Extra service description..."
                            className="w-full px-3 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                          />
                        </div>

                        {/* Quantity */}
                        <div className="col-span-2 space-y-1">
                          <label className="text-[9px] font-bold text-brand-grey-dark uppercase block text-center">Qty</label>
                          <input
                            type="number"
                            value={item.quantity}
                            min="1"
                            onChange={(e) => {
                              const newItems = [...editExtraItems];
                              newItems[idx].quantity = e.target.value === '' ? 1 : Number(e.target.value);
                              setEditExtraItems(newItems);
                            }}
                            className="w-full px-2 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="col-span-3 space-y-1">
                          <label className="text-[9px] font-bold text-brand-grey-dark uppercase block text-center">Unit Price ($)</label>
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
                            className="w-full px-2 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-green/20"
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
                className="px-5 py-1.5 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all shadow cursor-pointer"
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
            <div className="p-4 bg-brand-charcoal text-white flex items-center gap-2">
              <Send size={16} className="text-brand-green" />
              <h3 className="text-sm font-bold text-white m-0">Send Quote Confirmation</h3>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Recipient Email</label>
                <input
                  type="email"
                  value={sendEmailAddress}
                  onChange={(e) => setSendEmailAddress(e.target.value)}
                  placeholder="Enter recipient email..."
                  className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Short Personal Message (Optional)</label>
                <textarea
                  value={coordinatorMessage}
                  onChange={(e) => setCoordinatorMessage(e.target.value)}
                  placeholder="Hello, please review your custom attic insulation quote..."
                  className="w-full h-24 p-3 border border-brand-grey-medium rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-green/20"
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
                className="px-4 py-1.5 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer"
              >
                {isSending ? <Loader2 size={12} className="animate-spin mr-1 inline" /> : null}
                <span>Send Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
