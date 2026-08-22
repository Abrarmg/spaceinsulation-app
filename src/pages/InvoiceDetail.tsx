import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Download, 
  CreditCard, 
  Edit, 
  Trash2, 
  Plus, 
  X 
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  service_address: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  job_id: string | null;
  customer_id: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  paid_at: string | null;
  stripe_payment_id: string | null;
  stripe_checkout_url: string | null;
  created_at: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
  customers: Customer;
}

interface PaymentRecord {
  amount: number;
  method: string;
  date: string;
  notes?: string;
}

export const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Send Invoice Drawer / Modal States
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmailAddress, setSendEmailAddress] = useState('');
  const [coordinatorMessage, setCoordinatorMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Record Payment Dialog States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState('2026-07-31'); // system mock today date
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const dbClient = supabase;

  // Dynamic payment parser helper
  const parseInvoicePayments = (stripePaymentId: string | null, total: number, status: string) => {
    if (!stripePaymentId) {
      if (status.toLowerCase() === 'paid') {
        return { paid: total, balance: 0, payments: [] as PaymentRecord[] };
      }
      return { paid: 0, balance: total, payments: [] as PaymentRecord[] };
    }

    try {
      if (stripePaymentId.trim().startsWith('{') || stripePaymentId.trim().startsWith('[')) {
        const parsed = JSON.parse(stripePaymentId);
        if (parsed && Array.isArray(parsed.payments)) {
          const paymentsList = parsed.payments as PaymentRecord[];
          const paid = paymentsList.reduce((sum, p) => sum + Number(p.amount || 0), 0);
          return { paid, balance: Math.max(0, total - paid), payments: paymentsList };
        }
      }
    } catch (e) {
      // standard text payment id fallback
    }

    if (status.toLowerCase() === 'paid') {
      return { paid: total, balance: 0, payments: [] as PaymentRecord[] };
    }
    return { paid: 0, balance: total, payments: [] as PaymentRecord[] };
  };

  const loadInvoice = async () => {
    if (!id) return;
    try {
      const { data, error } = await dbClient
        .from('invoices')
        .select('*, customers(id, full_name, email, service_address)')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const todayStr = '2026-07-31';
        
        // compute status: if sent, unpaid and past due date
        const { balance } = parseInvoicePayments(data.stripe_payment_id, data.total, data.status);
        if (data.status === 'Sent' && data.due_date < todayStr && balance > 0) {
          data.status = 'Overdue';
        }

        const cust = data.customers;
        setSendEmailAddress(cust?.email || '');
      }
      setInvoice(data);
    } catch (err) {
      console.error('Failed to load invoice details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const [updating, setUpdating] = useState(false);



  // Edit Invoice States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDueDate, setEditDueDate] = useState('');
  const [editLineItems, setEditLineItems] = useState<Array<{ description: string; quantity: number; unit_price: number }>>([]);

  const handleOpenEdit = () => {
    if (!invoice) return;
    setEditDueDate(invoice.due_date);
    setEditLineItems(invoice.line_items.map(item => ({ ...item })));
    setShowEditModal(true);
  };

  const handleSaveEditInvoice = async () => {
    if (!invoice) return;

    for (let i = 0; i < editLineItems.length; i++) {
      const item = editLineItems[i];
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
      const subtotalVal = editLineItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
      const taxVal = Number((subtotalVal * 0.13).toFixed(2));
      const totalVal = Number((subtotalVal + taxVal).toFixed(2));

      const { error } = await dbClient
        .from('invoices')
        .update({
          due_date: editDueDate,
          line_items: editLineItems,
          subtotal: subtotalVal,
          tax: taxVal,
          total: totalVal
        })
        .eq('id', invoice.id);

      if (error) throw error;

      setShowEditModal(false);
      loadInvoice();
      setStatusMessage({ type: 'success', text: 'Invoice updated successfully.' });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      console.error('Invoice edits save failed:', err);
      alert('Save failed: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoice) return;
    if (!confirm('Are you sure you want to delete this invoice? This cannot be undone.')) return;

    setUpdating(true);
    try {
      const { error } = await dbClient
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;
      alert('Invoice deleted successfully.');
      navigate('/invoices');
    } catch (err: any) {
      console.error('Failed to delete invoice:', err);
      alert('Delete failed: ' + err.message);
      setUpdating(false);
    }
  };

  const handleConfirmSendEmail = async () => {
    if (!invoice) return;
    const recipientEmail = sendEmailAddress.trim();
    if (!recipientEmail) {
      alert('Please enter a valid customer email address.');
      return;
    }

    setIsSending(true);
    try {
      const { data, error: sendError } = await dbClient.functions.invoke('send-document-email', {
        body: {
          documentId: invoice.id,
          documentType: 'invoice',
          recipientEmail: recipientEmail,
        }
      });

      if (sendError) throw sendError;
      if (data?.success === false || data?.error) {
        throw new Error(data?.message || data?.error || 'Email sending failed');
      }

      setShowSendModal(false);
      loadInvoice();
      setStatusMessage({ type: 'success', text: 'Invoice sent successfully.' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to send invoice email:', err);
      alert('Unable to send this invoice. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    setIsDownloading(true);
    try {
      const input = document.getElementById('invoice-receipt-body');
      if (!input) throw new Error('Invoice container element not found.');

      // Clone node to alter styling dynamically for cleaner PDF print scaling
      const clone = input.cloneNode(true) as HTMLElement;
      clone.style.width = '800px';
      clone.style.padding = '40px';
      clone.style.boxShadow = 'none';
      clone.style.border = 'none';
      
      const customStyles = document.createElement('style');
      customStyles.innerHTML = `
        #invoice-receipt-body .grid {
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
      clone.appendChild(customStyles);
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
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
        }
      });
      
      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
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

      pdf.save(`invoice_${invoice.invoice_number}.pdf`);
    } catch (err: any) {
      console.error('Invoice PDF download failed:', err);
      alert('Failed to generate PDF download: ' + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // Open Payment modal trigger
  const handleOpenPaymentModal = () => {
    if (!invoice) return;
    const { balance } = parseInvoicePayments(invoice.stripe_payment_id, invoice.total, invoice.status);
    setPaymentAmount(balance.toFixed(2));
    setPaymentMethod('Cash');
    setPaymentDate('2026-07-31');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleRecordPaymentSubmit = async () => {
    if (!invoice) return;
    const amountVal = Number(paymentAmount);
    
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    const { paid, balance, payments } = parseInvoicePayments(
      invoice.stripe_payment_id, 
      invoice.total, 
      invoice.status
    );

    if (amountVal > balance) {
      alert(`Amount exceeds the remaining balance of $${balance.toFixed(2)}.`);
      return;
    }

    setIsRecording(true);
    try {
      const newPayment: PaymentRecord = {
        amount: amountVal,
        method: paymentMethod,
        date: paymentDate,
        notes: paymentNotes.trim() || undefined
      };

      const updatedPayments = [...payments, newPayment];
      const newPaidTotal = paid + amountVal;
      const isFullyPaid = newPaidTotal >= invoice.total;

      const stripePayload = JSON.stringify({
        payments: updatedPayments
      });

      const { error } = await dbClient
        .from('invoices')
        .update({
          stripe_payment_id: stripePayload,
          status: isFullyPaid ? 'Paid' : 'Sent',
          paid_at: isFullyPaid ? new Date().toISOString() : null
        })
        .eq('id', invoice.id);

      if (error) throw error;

      alert(`Payment of $${amountVal.toFixed(2)} recorded successfully!`);
      setShowPaymentModal(false);
      loadInvoice();
    } catch (err: any) {
      alert('Failed to record payment: ' + err.message);
    } finally {
      setIsRecording(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8 bg-[#F6F7F9] select-none min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-[#76C442]" />
        <span className="text-xs font-black uppercase tracking-wider text-[#737A86] mt-2">Loading Invoice details...</span>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8 bg-[#F6F7F9] min-h-screen">
        <AlertCircle size={40} className="text-red-500 mb-3" />
        <h3 className="text-base font-black text-[#151A2D] uppercase tracking-wider m-0">Invoice Not Found</h3>
        <p className="text-xs text-[#737A86] font-semibold mt-1">This invoice does not exist or has been deleted.</p>
        <button 
          onClick={() => navigate('/invoices')}
          className="mt-4 px-4 py-2 bg-[#151A2D] text-white text-xs font-black rounded-lg uppercase tracking-wider"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  const cust = invoice.customers;
  const { paid, balance, payments } = parseInvoicePayments(invoice.stripe_payment_id, invoice.total, invoice.status);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  // Status Style Picker
  const getStatusBadgeStyle = (status: string, balance: number, total: number) => {
    const paidAmt = total - balance;
    if (status === 'Sent' && paidAmt > 0 && balance > 0) {
      return 'text-purple-700 bg-purple-50 border-purple-200';
    }

    switch (status.toLowerCase()) {
      case 'draft':
        return 'text-slate-650 bg-slate-50 border-slate-200';
      case 'sent':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'paid':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'overdue':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-slate-650 bg-slate-50 border-slate-200';
    }
  };

  const getStatusBadgeLabel = (status: string, balance: number, total: number) => {
    const paidAmt = total - balance;
    if (status === 'Sent' && paidAmt > 0 && balance > 0) {
      return 'Partially Paid';
    }
    return status;
  };

  return (
    <div className="flex-grow p-4 md:p-6 space-y-6 overflow-y-auto max-h-screen bg-[#F6F7F9] font-sans pb-16">
      
      {/* HEADER ACTIONS BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#E7E9ED] pb-3.5 select-none">
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/invoices')}
            className="p-2 bg-white border border-[#E2E8F0] hover:bg-slate-50 rounded-xl text-[#151A2D] cursor-pointer transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-black text-[#151A2D] tracking-tight m-0">{invoice.invoice_number}</h2>
              <span className={`px-2.5 py-0.5 border rounded-lg text-[9px] font-black uppercase tracking-wider ${getStatusBadgeStyle(invoice.status, balance, invoice.total)}`}>
                {getStatusBadgeLabel(invoice.status, balance, invoice.total)}
              </span>
            </div>
            <p className="text-xs text-[#737A86] mt-0.5 font-semibold">Review ledger transactions and record collections.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {updating && <Loader2 size={14} className="animate-spin text-[#76C442] shrink-0" />}

          {/* EDIT */}
          <button
            onClick={handleOpenEdit}
            disabled={updating}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#171A1F] font-bold text-xs rounded-xl shadow-3xs cursor-pointer min-h-[38px] transition-colors"
          >
            <Edit size={13} className="text-[#737A86]" />
            <span>Edit</span>
          </button>

          {/* DELETE */}
          <button
            onClick={handleDeleteInvoice}
            disabled={updating}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-650 font-bold text-xs rounded-xl shadow-3xs cursor-pointer min-h-[38px] transition-colors"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>

          {/* DOWNLOAD PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#171A1F] font-bold text-xs rounded-xl shadow-3xs cursor-pointer min-h-[38px] transition-colors"
          >
            {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} className="text-[#737A86]" />}
            <span>PDF</span>
          </button>

          {/* RECORD PAYMENT */}
          {balance > 0 && (
            <button
              onClick={handleOpenPaymentModal}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] font-black text-xs uppercase tracking-wider rounded-xl shadow-xs cursor-pointer min-h-[38px] transition-all border-none"
            >
              <CreditCard size={13} />
              <span>Record Payment</span>
            </button>
          )}

          {/* SEND EMAIL */}
          {invoice.status !== 'Paid' && (
            <button
              onClick={() => setShowSendModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#151A2D] hover:bg-[#20273D] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs cursor-pointer min-h-[38px] transition-all border-none"
            >
              <Send size={13} className="text-[#76C442]" />
              <span>Send Invoice</span>
            </button>
          )}
        </div>

      </div>

      {/* SUCCESS / ERROR NOTIFICATION */}
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

      {/* PREMIUM INVOICE VIEW CONTAINER */}
      <div 
        id="invoice-receipt-body" 
        className="p-6 md:p-12 bg-white border border-[#E2E8F0] rounded-xl shadow-2xs max-w-[850px] mx-auto text-[#171A1F]"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
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
                <span style={{ fontSize: '9px', color: '#737A86', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, display: 'block', marginTop: '2px' }}>Ontario's Premium Insulation Experts</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Accent Line */}
        <div style={{ height: '2px', backgroundColor: '#76C442', width: '100%', marginBottom: '16px' }} />

        {/* Document Metadata (Stacked under divider) */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '11px', color: '#737A86', fontWeight: 600, textAlign: 'left' }} className="pdf-brand-container select-none flex-col sm:flex-row gap-2">
          <div>
            <div style={{ fontSize: '14px', fontWeight: 900, color: '#151A2D' }}>Invoice # {invoice.invoice_number}</div>
          </div>
          <div style={{ textAlign: 'left' }} className="pdf-align-right sm:text-right">
            <div>Created Date: {new Date(invoice.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <div>Payment Terms: Net 15</div>
          </div>
        </div>

        {/* 2. Customer + Billing Summary Cards (Equal Height via items-stretch) */}
        <div style={{ marginBottom: '24px' }} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch select-none">
          {/* Billed To Card */}
          <div style={{ backgroundColor: '#F8F9FA', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            <span style={{ fontSize: '9px', color: '#737A86', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Billed To</span>
            <div style={{ fontSize: '11px', color: '#171A1F', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px' }}>👤</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#151A2D' }}>{cust?.full_name || 'Client'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px' }}>✉</span>
                <span style={{ color: '#737A86' }}>{cust?.email || 'No email registered'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontWeight: 700 }}>
                <span style={{ fontSize: '12px' }}>📍</span>
                <span style={{ textTransform: 'capitalize' }}>{cust?.service_address || 'Address Not Registered'}</span>
              </div>
            </div>
          </div>

          {/* Payment Terms Callout */}
          <div style={{ backgroundColor: '#F8F9FA', border: '1px solid #E2E8F0', borderLeft: '4px solid #76C442', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            <span style={{ fontSize: '9px', color: '#737A86', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Due Date & Status</span>
            <div style={{ fontSize: '14px', fontWeight: 900, color: '#151A2D' }}>
              {new Date(invoice.due_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div style={{ fontSize: '11px', color: '#171A1F', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: 1.4 }}>
              <div>Urgency: <span className="font-bold uppercase" style={{ color: balance === 0 ? '#737A86' : invoice.due_date < '2026-07-31' ? '#EF4444' : '#76C442' }}>
                {balance === 0 ? 'Paid in Full' : invoice.due_date < '2026-07-31' ? 'Past Due / Overdue' : 'Current / Outstanding'}
              </span></div>
              <div className="text-[10px] text-[#737A86] mt-1 italic">Please complete transaction settlement by the designated due date.</div>
            </div>
          </div>
        </div>

        {/* 3. Invoice Items list */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#151A2D', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px', margin: 0, marginBottom: '12px', textAlign: 'left' }} className="select-none">
            Invoice Items
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
            <tbody className="divide-y divide-[#E2E8F0]">
              {invoice.line_items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/40">
                  <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#151A2D' }}>
                    {item.description.includes(':') ? item.description.split(':')[0].trim() : 'Insulation Service'}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#737A86', fontWeight: 550 }}>
                    {item.description.includes(':') ? item.description.split(':').slice(1).join(':').trim() : item.description}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(Number(item.unit_price))}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: '#151A2D' }}>
                    {formatCurrency(Number(item.quantity) * Number(item.unit_price))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Payment Summary Calculations Grid */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <table style={{ width: '310px', borderCollapse: 'collapse', fontSize: '11px' }}>
            <tbody>
              <tr style={{ height: '22px' }} className="select-none">
                <td style={{ color: '#737A86', fontWeight: 600, padding: 0, textAlign: 'left' }}>Subtotal</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', padding: 0, color: '#151A2D' }}>
                  {formatCurrency(Number(invoice.subtotal))}
                </td>
              </tr>
              <tr style={{ height: '22px' }} className="select-none">
                <td style={{ color: '#737A86', fontWeight: 600, padding: 0, textAlign: 'left' }}>HST (13%)</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', padding: 0, color: '#151A2D' }}>
                  {formatCurrency(Number(invoice.tax))}
                </td>
              </tr>
              <tr style={{ height: '22px' }} className="select-none">
                <td style={{ color: '#737A86', fontWeight: 600, padding: 0, textAlign: 'left' }}>Total Invoice Value</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', padding: 0, color: '#151A2D' }}>
                  {formatCurrency(Number(invoice.total))}
                </td>
              </tr>
              <tr style={{ height: '22px' }}>
                <td style={{ color: '#10B981', fontWeight: 600, padding: 0, textAlign: 'left' }}>Paid Amount</td>
                <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'monospace', padding: 0, color: '#10B981' }}>
                  -{formatCurrency(paid)}
                </td>
              </tr>
              <tr style={{ height: '56px' }}>
                <td colSpan={2} style={{ padding: '8px 0 0 0' }}>
                  <div style={{ backgroundColor: balance > 0 ? '#FFFBEB' : '#EAF7EC', border: balance > 0 ? '1px solid #FCD34D' : '1px solid #A5D6A7', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: balance > 0 ? '#92400E' : '#1B5E20', textTransform: 'uppercase', letterSpacing: '0.05em' }}>BALANCE DUE</span>
                    <span style={{ fontSize: '18px', fontWeight: 950, color: balance > 0 ? '#B45309' : '#2E7D32', fontFamily: 'monospace' }}>
                      {formatCurrency(balance)} CAD
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Partial payments list inside statement */}
        {payments.length > 0 && (
          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', marginBottom: '24px' }} className="text-left select-none">
            <h4 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#151A2D', margin: 0, marginBottom: '8px' }}>Payment Audit Log</h4>
            <div className="space-y-1.5 font-mono text-[10px] text-[#737A86]">
              {payments.map((p, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #E2E8F0', paddingBottom: '6px' }}>
                  <span>Stop #{idx + 1} - {p.date} via {p.method} {p.notes ? `(${p.notes})` : ''}</span>
                  <span style={{ fontWeight: 'bold', color: '#10B981' }}>+{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Next Steps / Payment Instructions & Why Space Insulation */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }} className="grid grid-cols-1 md:grid-cols-2 gap-6 select-none">
          {/* Instructions */}
          <div style={{ textAlign: 'left', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ flexGrow: 1 }}>
              <h4 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#151A2D', margin: 0, marginBottom: '6px' }}>
                Settlement Steps
              </h4>
              <div style={{ fontSize: '11px', color: '#171A1F', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>1️⃣ Review this invoice statement</div>
                <div>2️⃣ Submit payment via bank transfer or credit card</div>
                <div>3️⃣ Receive digital payment receipt confirmation</div>
              </div>
            </div>

            {/* QR Code Container */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              {invoice.status !== 'Paid' && invoice.stripe_checkout_url ? (
                <>
                  <QRCodeSVG
                    value={invoice.stripe_checkout_url}
                    size={60}
                    bgColor="#ffffff"
                    fgColor="#151A2D"
                    level="M"
                    style={{ padding: '4px', border: '1px solid #E2E8F0', borderRadius: '6px' }}
                  />
                  <span style={{ fontSize: '7px', color: '#737A86', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scan to Pay</span>
                </>
              ) : invoice.status === 'Paid' ? (
                <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>PAID</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Why space insulation */}
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#151A2D', margin: 0, marginBottom: '6px' }}>
              Why Space Insulation
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }} className="select-none">
              <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 10px', fontSize: '9.5px', fontWeight: 700, color: '#151A2D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#76C442', fontWeight: 'bold' }}>✓</span> Licensed
              </div>
              <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 10px', fontSize: '9.5px', fontWeight: 700, color: '#151A2D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#76C442', fontWeight: 'bold' }}>✓</span> Energy Efficient
              </div>
              <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 10px', fontSize: '9.5px', fontWeight: 700, color: '#151A2D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#76C442', fontWeight: 'bold' }}>✓</span> Warranty Included
              </div>
              <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 10px', fontSize: '9.5px', fontWeight: 700, color: '#151A2D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#76C442', fontWeight: 'bold' }}>✓</span> Pro Installation
              </div>
            </div>
          </div>
        </div>

        {/* Trust Indicators Bar */}
        <div style={{ borderTop: '1px solid #E2E8F0', marginTop: '16px', paddingTop: '10px', display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '9px', color: '#737A86', fontWeight: 700 }} className="select-none flex-wrap">
          <div>✓ WSIB Covered</div>
          <div>|</div>
          <div>✓ Fully Insured</div>
          <div>|</div>
          <div>✓ Ontario Licensed</div>
          <div>|</div>
          <div>✓ Satisfaction Guaranteed</div>
        </div>

        {/* Questions Centered Footer */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '16px', textAlign: 'center', fontSize: '9px', color: '#737A86', display: 'flex', flexDirection: 'column', gap: '2px', fontWeight: 550 }} className="select-none">
          <div style={{ fontWeight: 800, color: '#151A2D', fontSize: '10px' }}>Questions? Call us today.</div>
          <div style={{ fontWeight: 700, color: '#151A2D' }}>Space Insulation Inc.</div>
          <div>Phone: (647) 704-9021 | Email: info@spaceinsulation.ca | Website: spaceinsulation.ca</div>
        </div>

      </div>

      {/* RECORD PAYMENT DIALOG MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs" 
            onClick={() => { if (!isRecording) setShowPaymentModal(false); }}
          />

          <div className="relative bg-white w-full max-w-sm mx-4 rounded-xl shadow-2xl overflow-hidden border border-[#E7E9ED] z-10 flex flex-col p-5 space-y-4 animate-scale-up text-left">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
              <div className="flex items-center gap-1.5">
                <CreditCard className="text-[#76C442] w-5 h-5 stroke-[2.5]" />
                <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">Record Payment</h3>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-[#737A86] hover:text-[#171A1F] border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs border-b border-[#E2E8F0] pb-3 select-none">
              <div>
                <span className="text-[9px] text-[#737A86] uppercase font-bold block">Invoice ID</span>
                <span className="font-bold text-[#151A2D]">{invoice.invoice_number}</span>
              </div>
              <div>
                <span className="text-[9px] text-[#737A86] uppercase font-bold block">Total Amount</span>
                <span className="font-bold text-[#151A2D]">${invoice.total.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[9px] text-[#737A86] uppercase font-bold block">Paid Already</span>
                <span className="font-bold text-emerald-650">${paid.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[9px] text-[#737A86] uppercase font-bold block">Current Balance</span>
                <span className="font-black text-amber-600">${balance.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#737A86] uppercase">Payment Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-[#76C442]"
                />
              </div>

              <div className="space-y-1 select-none">
                <label className="text-[10px] font-bold text-[#737A86] uppercase">Payment Method</label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {['Cash', 'Bank Transfer', 'Card', 'Other'].map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`px-2 py-1.5 border rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                        paymentMethod === method 
                          ? 'bg-[#151A2D] text-white border-[#151A2D]' 
                          : 'bg-white text-[#737A86] border-[#E2E8F0]'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#737A86] uppercase">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#737A86] uppercase">Notes (Optional)</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Reference details..."
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 select-none border-t border-[#E2E8F0]/60">
              <button
                type="button"
                disabled={isRecording}
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#737A86] text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordPaymentSubmit}
                disabled={isRecording}
                className="px-4 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-lg cursor-pointer flex items-center gap-1.5 border-none animate-pulse"
              >
                {isRecording ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Record Payment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL DIALOG */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs"
            onClick={() => { if (!updating) setShowEditModal(false); }}
          />

          <div className="relative bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-[#E7E9ED] z-10 flex flex-col p-5 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
              <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">Edit Invoice Specifications</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-[#737A86] hover:text-[#171A1F] border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#737A86] uppercase">Due Date</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center select-none border-b border-[#E2E8F0] pb-1">
                  <span className="text-[10px] font-bold text-[#737A86] uppercase">Line Items</span>
                  <button
                    type="button"
                    onClick={() => setEditLineItems([...editLineItems, { description: '', quantity: 1, unit_price: 0 }])}
                    className="text-xs font-black text-[#76C442] hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5"
                  >
                    <Plus size={12} />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {editLineItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start border-b border-slate-50 pb-2">
                      <div className="flex-grow space-y-1">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => {
                            const clone = [...editLineItems];
                            clone[index].description = e.target.value;
                            setEditLineItems(clone);
                          }}
                          placeholder="Description..."
                          className="w-full px-2 py-1.5 border border-[#E2E8F0] rounded-md text-xs"
                        />
                      </div>
                      <div className="w-16">
                        <input
                          type="number"
                          value={item.quantity}
                          min="1"
                          onChange={(e) => {
                            const clone = [...editLineItems];
                            clone[index].quantity = Number(e.target.value);
                            setEditLineItems(clone);
                          }}
                          className="w-full px-2 py-1.5 border border-[#E2E8F0] rounded-md text-xs text-center font-mono font-bold"
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          value={item.unit_price}
                          min="0"
                          step="0.01"
                          onChange={(e) => {
                            const clone = [...editLineItems];
                            clone[index].unit_price = Number(e.target.value);
                            setEditLineItems(clone);
                          }}
                          className="w-full px-2 py-1.5 border border-[#E2E8F0] rounded-md text-xs text-right font-mono font-bold"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const clone = [...editLineItems];
                          clone.splice(index, 1);
                          setEditLineItems(clone);
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded border-none bg-transparent cursor-pointer mt-0.5"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 select-none border-t border-[#E2E8F0]/60">
              <button
                type="button"
                disabled={updating}
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#737A86] text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditInvoice}
                disabled={updating}
                className="px-4 py-2 bg-[#151A2D] hover:bg-[#20273D] text-white text-xs font-black rounded-lg cursor-pointer flex items-center gap-1 border-none"
              >
                {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Save Changes</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* EMAIL SEND MODAL DIALOG */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs"
            onClick={() => setShowSendModal(false)}
          />

          <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-[#E7E9ED] z-10 flex flex-col p-5 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 select-none">
              <div className="flex items-center gap-1.5">
                <Send size={16} className="text-[#76C442]" />
                <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">Send Invoice Confirmation</h3>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-[#737A86] hover:text-[#171A1F] border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-[#171A1F]">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#737A86] uppercase">Recipient Email</label>
                <input
                  type="email"
                  value={sendEmailAddress}
                  onChange={(e) => setSendEmailAddress(e.target.value)}
                  placeholder="Enter recipient email..."
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#737A86] uppercase">Short Personal Message (Optional)</label>
                <textarea
                  value={coordinatorMessage}
                  onChange={(e) => setCoordinatorMessage(e.target.value)}
                  placeholder="Hello, please review your billing invoice statement..."
                  className="w-full h-24 p-3 border border-[#E2E8F0] rounded-lg text-xs focus:outline-none focus:border-[#76C442]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 select-none border-t border-[#E2E8F0]/60">
              <button
                type="button"
                disabled={isSending}
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#737A86] text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSendEmail}
                disabled={isSending}
                className="px-4 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-lg cursor-pointer flex items-center gap-1 border-none"
              >
                {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Dispatch Email</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
