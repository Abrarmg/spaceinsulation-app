import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button, Card, Page, StatusBadge } from '../components/ui';
import { OverflowMenu } from '../components/ui/list';
import { DetailGrid, DetailHeader, DetailLoading, DetailNotFound, InfoList, InfoRow, MobileActionBar } from '../components/ui/detail';
import { supabase } from '../supabaseClient';
import { todayLocal } from '../utils/dates';
import { 
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
import { InvoiceDocument } from '../components/invoice/InvoiceDocument';
import { generateInvoiceJsPdf, generateInvoicePdfBase64 } from '../utils/invoicePdf';

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
  issue_date?: string;
  payment_terms?: string;
  discount_type?: string;
  discount_value?: number;
  tax_rate?: number;
  notes?: string;
  payment_instructions?: string;
  customer_message?: string;
  line_items: Array<{
    name?: string;
    service?: string;
    title?: string;
    description: string;
    quantity: number;
    unit_price: number;
    total?: number;
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
  const [paymentDate, setPaymentDate] = useState(() => todayLocal());
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
        const todayStr = todayLocal();
        
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
  const [editTaxAmount, setEditTaxAmount] = useState<number | ''>('');

  const handleOpenEdit = () => {
    if (!invoice) return;
    setEditDueDate(invoice.due_date);
    setEditLineItems(invoice.line_items.map(item => ({ ...item })));
    setEditTaxAmount(invoice.tax ?? 0);
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
      const taxVal = Number(editTaxAmount === '' ? 0 : editTaxAmount);
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
      const element = document.getElementById('invoice-document');
      if (!element) {
        throw new Error('Invoice preview element (#invoice-document) not found for PDF generation.');
      }

      const { pdfBase64 } = await generateInvoicePdfBase64(element);
      if (!pdfBase64) {
        throw new Error('Failed to generate client PDF attachment.');
      }

      const sanitizedNum = String(invoice.invoice_number || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
      const { data, error: sendError } = await dbClient.functions.invoke('send-document-email', {
        body: {
          documentId: invoice.id,
          documentType: 'invoice',
          recipientEmail: recipientEmail,
          pdfBase64,
          requireClientPdf: true,
          pdfFilename: `invoice_${sanitizedNum}.pdf`,
        }
      });

      if (sendError) {
        let customMsg = sendError.message;
        try {
          const bodyText = await sendError.context?.json();
          if (bodyText && bodyText.error) {
            customMsg = bodyText.error;
          }
        } catch (_) {}
        throw new Error(customMsg);
      }

      if (data?.success === false || data?.error) {
        throw new Error(data?.message || data?.error || 'Email sending failed');
      }

      setShowSendModal(false);
      loadInvoice();
      setStatusMessage({ type: 'success', text: 'Invoice sent successfully.' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to send invoice email:', err);
      alert('Unable to send this invoice: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    setIsDownloading(true);
    try {
      const element = document.getElementById('invoice-document');
      if (!element) throw new Error('Invoice preview element (#invoice-document) not found.');

      const pdf = await generateInvoiceJsPdf(element);
      const sanitizedNum = String(invoice.invoice_number || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`invoice_${sanitizedNum}.pdf`);
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
    setPaymentDate(todayLocal());
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

  if (loading) return <DetailLoading label="Loading invoice…" />;

  if (!invoice) {
    return <DetailNotFound title="Invoice not found" back={{ to: '/invoices', label: 'Back to invoices' }} />;
  }

  const cust = invoice.customers;
  const { paid, balance, payments } = parseInvoicePayments(invoice.stripe_payment_id, invoice.total, invoice.status);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const statusLabel = invoice.status === 'Sent' && paid > 0 && balance > 0 ? 'Partially Paid' : invoice.status;
  const dueDate = invoice.due_date ? new Date(`${invoice.due_date.slice(0, 10)}T12:00:00`) : null;
  const isOverdue = balance > 0 && invoice.status !== 'Draft' && !!invoice.due_date && invoice.due_date.slice(0, 10) < todayLocal();

  /** The one obvious next step: send a draft, otherwise collect the money. */
  const nextStep =
    balance <= 0 ? null : invoice.status === 'Draft' ? (
      <Button icon={Send} onClick={() => setShowSendModal(true)}>
        Send invoice
      </Button>
    ) : (
      <Button icon={CreditCard} onClick={handleOpenPaymentModal}>
        Record payment
      </Button>
    );

  const moreActions = [
    { label: isDownloading ? 'Preparing PDF…' : 'Download PDF', icon: Download, onClick: handleDownloadPDF },
    ...(invoice.status !== 'Paid' && invoice.status !== 'Draft' ? [{ label: 'Resend to customer', icon: Send, onClick: () => setShowSendModal(true) }] : []),
    ...(invoice.status === 'Draft' && balance > 0 ? [{ label: 'Record payment', icon: CreditCard, onClick: handleOpenPaymentModal }] : []),
    { label: 'Delete invoice', icon: Trash2, onClick: handleDeleteInvoice, danger: true },
  ];

  return (
    <Page className="pb-28 md:pb-7">
      <DetailHeader
        back={{ to: '/invoices', label: 'Invoices' }}
        title={cust?.full_name || invoice.invoice_number}
        badges={
          <>
            <StatusBadge status={isOverdue ? 'Overdue' : statusLabel} />
            {updating && <Loader2 size={16} className="animate-spin text-brand" />}
          </>
        }
        meta={
          <>
            <span>{invoice.invoice_number}</span>
            {dueDate && (
              <>
                <span aria-hidden>·</span>
                <span className={isOverdue ? 'text-red-700 font-medium' : ''}>
                  Due {dueDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </>
            )}
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
          <div className="bg-white border border-line rounded-xl shadow-card p-3 md:p-6 overflow-x-auto">
            <InvoiceDocument invoice={invoice} containerId="invoice-document" />
          </div>
        }
        side={
          <>
            <Card title="Balance">
              <div className={`text-3xl font-bold tracking-tight ${balance > 0 ? (isOverdue ? 'text-red-700' : 'text-navy') : 'text-brand-ink'}`}>
                {formatCurrency(balance)}
              </div>
              <div className="text-xs text-muted mt-0.5">{balance > 0 ? 'Still to collect' : 'Paid in full'}</div>
              <div className="mt-3 h-2 rounded-full bg-mist overflow-hidden">
                <div className="h-full bg-brand rounded-full" style={{ width: `${invoice.total > 0 ? Math.min(100, (paid / invoice.total) * 100) : 0}%` }} />
              </div>
              <InfoList className="mt-4">
                <InfoRow label="Invoice total">{formatCurrency(invoice.total)}</InfoRow>
                <InfoRow label="Paid so far">{formatCurrency(paid)}</InfoRow>
              </InfoList>
              {balance > 0 && invoice.status !== 'Draft' && (
                <Button block className="mt-4" icon={CreditCard} onClick={handleOpenPaymentModal}>
                  Record payment
                </Button>
              )}
            </Card>

            {cust && (
              <Card title="Customer">
                <InfoList>
                  <InfoRow label="Name">
                    {invoice.customer_id ? (
                      <Link to={`/contacts/${invoice.customer_id}`} className="font-semibold text-navy no-underline hover:underline">
                        {cust.full_name}
                      </Link>
                    ) : (
                      cust.full_name
                    )}
                  </InfoRow>
                  {cust.email && (
                    <InfoRow label="Email">
                      <a href={`mailto:${cust.email}`} className="text-brand-ink no-underline hover:underline break-all">
                        {cust.email}
                      </a>
                    </InfoRow>
                  )}
                </InfoList>
              </Card>
            )}

            <Card title="Payments" description={payments.length ? `${payments.length} recorded` : undefined}>
              {payments.length === 0 ? (
                <p className="m-0 text-sm text-muted">No payments recorded yet.</p>
              ) : (
                <ul className="m-0 p-0 list-none divide-y divide-line">
                  {payments.map((p, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-navy">{p.method}</div>
                        <div className="text-xs text-muted">
                          {p.date}
                          {p.notes ? ` · ${p.notes}` : ''}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-brand-ink whitespace-nowrap">+{formatCurrency(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
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

      {/* RECORD PAYMENT DIALOG MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
          <div 
            className="absolute inset-0 bg-navy/60 backdrop-blur-xs" 
            onClick={() => { if (!isRecording) setShowPaymentModal(false); }}
          />

          <div className="relative bg-white w-full max-w-sm mx-4 rounded-xl shadow-2xl overflow-hidden border border-line z-10 flex flex-col p-5 space-y-4 animate-scale-up text-left">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex items-center gap-1.5">
                <CreditCard className="text-brand w-5 h-5 stroke-[2.5]" />
                <h3 className="text-sm font-bold text-navy uppercase tracking-wider m-0">Record Payment</h3>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-muted hover:text-navy border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs border-b border-line pb-3 select-none">
              <div>
                <span className="text-2xs text-muted uppercase font-bold block">Invoice ID</span>
                <span className="font-bold text-navy">{invoice.invoice_number}</span>
              </div>
              <div>
                <span className="text-2xs text-muted uppercase font-bold block">Total Amount</span>
                <span className="font-bold text-navy">${invoice.total.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-2xs text-muted uppercase font-bold block">Paid Already</span>
                <span className="font-bold text-emerald-650">${paid.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-2xs text-muted uppercase font-bold block">Current Balance</span>
                <span className="font-bold text-amber-600">${balance.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-2xs font-bold text-muted uppercase">Payment Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-brand"
                />
              </div>

              <div className="space-y-1 select-none">
                <label className="text-2xs font-bold text-muted uppercase">Payment Method</label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {['Cash', 'Bank Transfer', 'Card', 'Other'].map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`px-2 py-1.5 border rounded-lg text-2xs font-bold uppercase tracking-wider cursor-pointer ${
                        paymentMethod === method 
                          ? 'bg-navy text-white border-navy' 
                          : 'bg-white text-muted border-line'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold text-muted uppercase">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-lg text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold text-muted uppercase">Notes (Optional)</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Reference details..."
                  className="w-full px-3 py-2 border border-line rounded-lg text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 select-none border-t border-line/60">
              <button
                type="button"
                disabled={isRecording}
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border border-line bg-white hover:bg-slate-50 text-muted text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordPaymentSubmit}
                disabled={isRecording}
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-navy text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 border-none animate-pulse"
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
            className="absolute inset-0 bg-navy/60 backdrop-blur-xs"
            onClick={() => { if (!updating) setShowEditModal(false); }}
          />

          <div className="relative bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-line z-10 flex flex-col p-5 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h3 className="text-sm font-bold text-navy uppercase tracking-wider m-0">Edit Invoice Specifications</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-muted hover:text-navy border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-2xs font-bold text-muted uppercase">Due Date</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-lg text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center select-none border-b border-line pb-1">
                  <span className="text-2xs font-bold text-muted uppercase">Line Items</span>
                  <button
                    type="button"
                    onClick={() => setEditLineItems([...editLineItems, { description: '', quantity: 1, unit_price: 0 }])}
                    className="text-xs font-bold text-brand hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5"
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
                          className="w-full px-2 py-1.5 border border-line rounded-md text-xs"
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
                          className="w-full px-2 py-1.5 border border-line rounded-md text-xs text-center font-mono font-bold"
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
                          className="w-full px-2 py-1.5 border border-line rounded-md text-xs text-right font-mono font-bold"
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

              <div className="space-y-1 border-t border-line pt-2">
                <label className="text-2xs font-bold text-muted uppercase">HST Amount ($)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-xs">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editTaxAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setEditTaxAmount('');
                      } else {
                        setEditTaxAmount(Math.max(0, Number(val)));
                      }
                    }}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 border border-line rounded-md text-xs font-mono font-bold text-gray-900 focus:outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 select-none border-t border-line/60">
              <button
                type="button"
                disabled={updating}
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-line bg-white hover:bg-slate-50 text-muted text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditInvoice}
                disabled={updating}
                className="px-4 py-2 bg-navy hover:bg-[#20273D] text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 border-none"
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
            className="absolute inset-0 bg-navy/60 backdrop-blur-xs"
            onClick={() => setShowSendModal(false)}
          />

          <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-line z-10 flex flex-col p-5 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-line pb-2 select-none">
              <div className="flex items-center gap-1.5">
                <Send size={16} className="text-brand" />
                <h3 className="text-sm font-bold text-navy uppercase tracking-wider m-0">Send Invoice Confirmation</h3>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-muted hover:text-navy border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-navy">
              <div className="space-y-1">
                <label className="text-2xs font-bold text-muted uppercase">Recipient Email</label>
                <input
                  type="email"
                  value={sendEmailAddress}
                  onChange={(e) => setSendEmailAddress(e.target.value)}
                  placeholder="Enter recipient email..."
                  className="w-full px-3 py-2 border border-line rounded-lg text-xs font-semibold focus:outline-none focus:border-brand"
                />
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold text-muted uppercase">Short Personal Message (Optional)</label>
                <textarea
                  value={coordinatorMessage}
                  onChange={(e) => setCoordinatorMessage(e.target.value)}
                  placeholder="Hello, please review your billing invoice statement..."
                  className="w-full h-24 p-3 border border-line rounded-lg text-xs focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 select-none border-t border-line/60">
              <button
                type="button"
                disabled={isSending}
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 border border-line bg-white hover:bg-slate-50 text-muted text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSendEmail}
                disabled={isSending}
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-navy text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 border-none"
              >
                {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Dispatch Email</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </Page>
  );
};
