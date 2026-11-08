import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, Field, Input, Page, PageHeader, Sheet, StatusBadge } from '../components/ui';
import { FilterSelect, ListLoading, ListPanel, MobileRow, OverflowMenu, SearchInput, StatStrip, StatusTabs, T } from '../components/ui/list';
import { supabase } from '../supabaseClient';
import { generateInvoicePdfFromData } from '../utils/invoicePdf';
import { todayLocal } from '../utils/dates';
import { FileSpreadsheet, AlertCircle, Plus, CreditCard, Send, Eye, Copy, Ban } from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  email: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  job_id: string | null;
  customer_id: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  stripe_payment_id: string | null;
  created_at: string;
  sent_at?: string | null;
  customers: Customer;
}

interface PaymentRecord {
  amount: number;
  method: string;
  date: string;
  notes?: string;
}

interface FinancialSummary {
  totalInvoiced: number;
  paid: number;
  outstanding: number;
  overdue: number;
  draft: number;
}

const STATUS_FILTERS = ['all', 'Draft', 'Sent', 'Due Soon', 'Paid', 'Overdue'];
const ITEMS_PER_PAGE = 8;

export const InvoicesList: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => {
    const fromUrl = searchParams.get('status');
    return fromUrl && STATUS_FILTERS.includes(fromUrl) ? fromUrl : 'all';
  });
  const [sortOption, setSortOption] = useState<'date_asc' | 'date_desc' | 'total_desc'>('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Financial Stats
  const [summary, setSummary] = useState<FinancialSummary>({
    totalInvoiced: 0,
    paid: 0,
    outstanding: 0,
    overdue: 0,
    draft: 0
  });

  // Action Menu Dropdown state

  // Mobile drawer filter state

  // Record Payment Dialog States
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(() => todayLocal());
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const dbClient = supabase;


  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

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

  // Compute live metrics summary
  const fetchSummary = useCallback(async () => {
    try {
      const { data, error: summaryErr } = await dbClient
        .from('invoices')
        .select('total, status, due_date, stripe_payment_id');

      if (summaryErr) throw summaryErr;

      const todayStr = todayLocal();
      let totalInvoiced = 0;
      let totalPaid = 0;
      let totalOutstanding = 0;
      let totalOverdue = 0;
      let draft = 0;

      (data || []).forEach((inv: any) => {
        const totalVal = Number(inv.total || 0);
        const { paid, balance } = parseInvoicePayments(inv.stripe_payment_id, totalVal, inv.status);

        if (inv.status === 'Draft') {
          draft++;
        }

        totalInvoiced += totalVal;
        totalPaid += paid;
        totalOutstanding += balance;

        const isOverdue = inv.status === 'Sent' && inv.due_date < todayStr && balance > 0;
        if (isOverdue) {
          totalOverdue += balance;
        }
      });

      setSummary({
        totalInvoiced,
        paid: totalPaid,
        outstanding: totalOutstanding,
        overdue: totalOverdue,
        draft
      });
    } catch (err) {
      console.error('Failed to compute summary:', err);
    }
  }, [dbClient]);

  // Fetch invoices list
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromRange = (currentPage - 1) * ITEMS_PER_PAGE;
      const toRange = fromRange + ITEMS_PER_PAGE - 1;

      let query = dbClient
        .from('invoices')
        .select('*, customers(id, full_name, email)', { count: 'exact' });

      // Apply status query
      const todayStr = todayLocal();

      if (statusFilter === 'Overdue') {
        query = query.eq('status', 'Sent').lt('due_date', todayStr);
      } else if (statusFilter === 'Due Soon') {
        // defined as sent & due in next 2 days
        const dueLimit = todayLocal(2);
        query = query.eq('status', 'Sent').gte('due_date', todayStr).lte('due_date', dueLimit);
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply search query (invoice number, customer name, or customer email)
      if (debouncedQuery.trim()) {
        const queryTerm = debouncedQuery.trim();
        
        const { data: matchedCust } = await dbClient
          .from('customers')
          .select('id')
          .or(`full_name.ilike.%${queryTerm}%,email.ilike.%${queryTerm}%`);

        const matchedCustomerIds = (matchedCust || []).map((c: any) => c.id);

        if (matchedCustomerIds.length > 0) {
          const idsList = matchedCustomerIds.join(',');
          query = query.or(`invoice_number.ilike.%${queryTerm}%,customer_id.in.(${idsList})`);
        } else {
          query = query.ilike('invoice_number', `%${queryTerm}%`);
        }
      }

      // Apply sorting
      if (sortOption === 'date_asc') {
        query = query.order('due_date', { ascending: true });
      } else if (sortOption === 'total_desc') {
        query = query.order('total', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      query = query.range(fromRange, toRange);

      const { data, count, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      setInvoices((data as any[]) || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Failed to fetch invoices:', err);
      setError('Could not load invoices directory.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, debouncedQuery, sortOption, dbClient]);

  useEffect(() => {
    fetchInvoices();
    fetchSummary();
  }, [fetchInvoices, fetchSummary]);

  // Expiry / Due Date visualizer
  const getDueDetails = (dueDateStr: string, balance: number, status: string) => {
    const dueDate = new Date(dueDateStr + 'T00:00:00');
    const formatted = dueDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

    if (status.toLowerCase() === 'paid' || balance === 0) {
      return { text: formatted, style: 'text-muted' };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueZero = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const diffTime = dueZero.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      return { text: `${absDays} day${absDays !== 1 ? 's' : ''} overdue`, style: 'text-red-700 font-medium' };
    } else if (diffDays <= 2) {
      return { text: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`, style: 'text-amber-700 font-medium' };
    }
    return { text: formatted, style: 'text-ink-soft' };
  };

  const getStatusLabel = (status: string, balance: number, total: number) => {
    const paid = total - balance;
    if (status === 'Sent' && paid > 0 && balance > 0) {
      return 'Partially Paid';
    }
    return status;
  };

  // Record Payment Dialog Triggers
  const handleOpenPayment = (e: React.MouseEvent, inv: Invoice) => {
    e.stopPropagation();
    setPaymentTarget(inv);

    const { balance } = parseInvoicePayments(inv.stripe_payment_id, inv.total, inv.status);
    setPaymentAmount(balance.toFixed(2));
    setPaymentMethod('Cash');
    setPaymentDate(todayLocal());
    setPaymentNotes('');
  };

  const handleRecordPaymentSubmit = async () => {
    if (!paymentTarget) return;
    const amountVal = Number(paymentAmount);
    
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    const { paid, balance, payments } = parseInvoicePayments(
      paymentTarget.stripe_payment_id, 
      paymentTarget.total, 
      paymentTarget.status
    );

    if (amountVal > balance) {
      alert(`Amount exceeds the remaining balance of $${balance.toFixed(2)}.`);
      return;
    }

    setIsRecording(true);
    try {
      // 1. Build payment array log
      const newPayment: PaymentRecord = {
        amount: amountVal,
        method: paymentMethod,
        date: paymentDate,
        notes: paymentNotes.trim() || undefined
      };

      const updatedPayments = [...payments, newPayment];
      const newPaidTotal = paid + amountVal;
      const isFullyPaid = newPaidTotal >= paymentTarget.total;

      const stripePayload = JSON.stringify({
        payments: updatedPayments
      });

      // 2. Update Invoice in database
      const { error: patchErr } = await dbClient
        .from('invoices')
        .update({
          stripe_payment_id: stripePayload,
          status: isFullyPaid ? 'Paid' : 'Sent',
          paid_at: isFullyPaid ? new Date().toISOString() : null
        })
        .eq('id', paymentTarget.id);

      if (patchErr) throw patchErr;

      alert(`Payment of $${amountVal.toFixed(2)} successfully recorded for ${paymentTarget.invoice_number}!`);
      
      setPaymentTarget(null);
      fetchInvoices();
      fetchSummary();
    } catch (err: any) {
      alert('Failed to record payment: ' + err.message);
    } finally {
      setIsRecording(false);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, targetInv: Invoice) => {
    e.stopPropagation();
    if (!confirm(`Duplicate invoice ${targetInv.invoice_number}?`)) return;

    try {
      const { data: maxInvData } = await dbClient
        .from('invoices')
        .select('invoice_number')
        .order('invoice_number', { ascending: false })
        .limit(1);

      const nextNum = maxInvData && maxInvData.length > 0 
        ? Number(maxInvData[0].invoice_number.replace('INV-', '')) + 1 
        : 1001;

      const { error: dupErr } = await dbClient
        .from('invoices')
        .insert([{
          invoice_number: `INV-${nextNum}`,
          customer_id: targetInv.customer_id,
          job_id: targetInv.job_id,
          line_items: targetInv.line_items,
          subtotal: targetInv.subtotal,
          tax: targetInv.tax,
          total: targetInv.total,
          status: 'Draft',
          due_date: new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Default due 14 days
        }]);

      if (dupErr) throw dupErr;
      alert(`Duplicate INV-${nextNum} created!`);
      fetchInvoices();
      fetchSummary();
    } catch (err: any) {
      alert('Failed to duplicate invoice: ' + err.message);
    }
  };

  const handleSendToCustomer = async (e: React.MouseEvent, targetInv: Invoice) => {
    e.stopPropagation();
    
    const recipientEmail = targetInv.customers?.email?.trim();
    if (!recipientEmail) {
      alert('Please enter a valid customer email address.');
      return;
    }

    if (!confirm(`Send invoice ${targetInv.invoice_number} to ${targetInv.customers.full_name}?`)) return;

    try {
      // Generate client-rendered PDF using shared InvoiceDocument template
      const { pdfBase64 } = await generateInvoicePdfFromData(targetInv as any);
      const sanitizedNum = String(targetInv.invoice_number || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');

      const { data, error: sendErr } = await dbClient.functions.invoke('send-document-email', {
        body: {
          documentId: targetInv.id,
          documentType: 'invoice',
          recipientEmail: recipientEmail,
          pdfBase64,
          requireClientPdf: true,
          pdfFilename: `invoice_${sanitizedNum}.pdf`,
        }
      });

      if (sendErr) {
        let customMsg = sendErr.message;
        try {
          const bodyText = await sendErr.context?.json();
          if (bodyText && bodyText.error) customMsg = bodyText.error;
        } catch (_) {}
        throw new Error(customMsg);
      }

      if (data?.success === false || data?.error) {
        throw new Error(data?.message || data?.error || 'Email sending failed');
      }

      alert('Invoice sent successfully.');
      fetchInvoices();
      fetchSummary();
    } catch (err: any) {
      console.error('Failed to send invoice email:', err);
      alert('Unable to send this invoice: ' + err.message);
    }
  };

  const handleVoidInvoice = async (e: React.MouseEvent, targetInv: Invoice) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to void invoice ${targetInv.invoice_number}?`)) return;

    try {
      const { error: voidErr } = await dbClient
        .from('invoices')
        .update({ status: 'Draft', stripe_payment_id: null }) // Void acts as resetting to Draft
        .eq('id', targetInv.id);

      if (voidErr) throw voidErr;
      alert(`Invoice ${targetInv.invoice_number} has been voided (reset to Draft).`);
      fetchInvoices();
      fetchSummary();
    } catch (err: any) {
      alert('Failed to void invoice: ' + err.message);
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  /** Menu items don't pass a click event, but the handlers expect one. */
  const noEvent = { stopPropagation: () => {} } as unknown as React.MouseEvent;
  const money = (n: number) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const moneyShort = (n: number) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const selectStatus = (s: string) => {
    setStatusFilter(s);
    setCurrentPage(1);
  };

  /** The one obvious next step for each invoice. */
  const primaryAction = (inv: Invoice, balance: number) => {
    if (balance <= 0) return null;
    if (inv.status === 'Draft') {
      return (
        <Button size="sm" variant="dark" icon={Send} onClick={e => handleSendToCustomer(e, inv)}>
          Send
        </Button>
      );
    }
    return (
      <Button size="sm" icon={CreditCard} onClick={e => handleOpenPayment(e, inv)}>
        Record payment
      </Button>
    );
  };

  const moreActions = (inv: Invoice, balance: number) => (
    <div onClick={e => e.stopPropagation()}>
      <OverflowMenu
        label="Invoice actions"
        actions={[
          { label: 'View invoice', icon: Eye, onClick: () => navigate(`/invoices/${inv.id}`) },
          { label: inv.status === 'Draft' ? 'Send to customer' : 'Resend to customer', icon: Send, onClick: () => handleSendToCustomer(noEvent, inv) },
          ...(balance > 0 ? [{ label: 'Record payment', icon: CreditCard, onClick: () => handleOpenPayment(noEvent, inv) }] : []),
          { label: 'Duplicate', icon: Copy, onClick: () => handleDuplicate(noEvent, inv) },
          { label: 'Void', icon: Ban, onClick: () => handleVoidInvoice(noEvent, inv), danger: true },
        ]}
      />
    </div>
  );

  return (
    <Page>
      <PageHeader
        title="Invoices"
        subtitle="Bill customers, record payments and chase what's overdue."
        actions={
          <ButtonLink to="/invoices/new" icon={Plus}>
            New invoice
          </ButtonLink>
        }
      />

      <StatStrip
        items={[
          { label: 'Waiting for payment', value: moneyShort(summary.outstanding), hint: 'Sent and not fully paid', tone: summary.outstanding > 0 ? 'amber' : 'default', active: statusFilter === 'Sent', onClick: () => selectStatus(statusFilter === 'Sent' ? 'all' : 'Sent') },
          { label: 'Overdue', value: moneyShort(summary.overdue), hint: 'Past the due date', tone: summary.overdue > 0 ? 'red' : 'default', active: statusFilter === 'Overdue', onClick: () => selectStatus(statusFilter === 'Overdue' ? 'all' : 'Overdue') },
          { label: 'Paid', value: moneyShort(summary.paid), hint: `of ${moneyShort(summary.totalInvoiced)} invoiced`, tone: 'green', active: statusFilter === 'Paid', onClick: () => selectStatus(statusFilter === 'Paid' ? 'all' : 'Paid') },
          { label: 'Drafts', value: summary.draft, hint: 'Not sent yet', active: statusFilter === 'Draft', onClick: () => selectStatus(statusFilter === 'Draft' ? 'all' : 'Draft') },
        ]}
      />

      <ListPanel
        tabs={<StatusTabs tabs={STATUS_FILTERS.map(s => ({ value: s, label: s === 'all' ? 'All' : s }))} value={statusFilter} onChange={selectStatus} />}
        toolbar={
          <>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by invoice #, customer or address" />
            <FilterSelect value={sortOption} onChange={e => setSortOption(e.target.value as typeof sortOption)} aria-label="Sort invoices">
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Due soonest</option>
              <option value="total_desc">Highest total</option>
            </FilterSelect>
          </>
        }
        footer={
          !loading && !error && totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span>
                Page {currentPage} of {totalPages} · {totalCount} invoices
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {loading ? (
          <ListLoading label="Loading invoices…" />
        ) : error ? (
          <EmptyState icon={AlertCircle} title="Couldn't load invoices" description={error} />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title={debouncedQuery.trim() ? 'No invoices found' : 'No invoices yet'}
            description={debouncedQuery.trim() ? 'Try another name or invoice number.' : 'Create your first invoice to start tracking payments.'}
            action={!debouncedQuery.trim() ? <ButtonLink to="/invoices/new" icon={Plus}>New invoice</ButtonLink> : undefined}
          />
        ) : (
          <>
            <div className={T.wrap}>
              <table className={T.table}>
                <thead className={T.thead}>
                  <tr>
                    <th className={T.th}>Customer</th>
                    <th className={T.th}>Due</th>
                    <th className={T.th}>Status</th>
                    <th className={`${T.th} text-right hidden lg:table-cell`}>Total</th>
                    <th className={`${T.th} text-right`}>Balance</th>
                    <th className={`${T.th} text-right`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const cust = inv.customers || { full_name: 'Client', email: '' };
                    const { balance } = parseInvoicePayments(inv.stripe_payment_id, inv.total, inv.status);
                    const due = getDueDetails(inv.due_date, balance, inv.status);
                    return (
                      <tr key={inv.id} className={T.tr} onClick={() => navigate(`/invoices/${inv.id}`)}>
                        <td className={T.td}>
                          <div className="font-semibold truncate max-w-[240px]">{cust.full_name}</div>
                          <div className="text-xs text-muted">
                            {inv.invoice_number} · {new Date(inv.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </td>
                        <td className={`${T.td} text-xs whitespace-nowrap`}>
                          <span className={due.style}>{due.text}</span>
                        </td>
                        <td className={T.td}>
                          <StatusBadge status={getStatusLabel(inv.status, balance, inv.total)} />
                        </td>
                        <td className={`${T.td} text-right text-muted whitespace-nowrap hidden lg:table-cell`}>{money(inv.total)}</td>
                        <td className={`${T.td} text-right font-semibold whitespace-nowrap`}>{money(balance)}</td>
                        <td className={T.td}>
                          <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                            {primaryAction(inv, balance)}
                            {moreActions(inv, balance)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-line">
              {invoices.map(inv => {
                const cust = inv.customers || { full_name: 'Client', email: '' };
                const { balance } = parseInvoicePayments(inv.stripe_payment_id, inv.total, inv.status);
                const due = getDueDetails(inv.due_date, balance, inv.status);
                return (
                  <div key={`mob-inv-${inv.id}`}>
                    <MobileRow
                      to={`/invoices/${inv.id}`}
                      title={cust.full_name}
                      subtitle={`${inv.invoice_number} · Total ${money(inv.total)}`}
                      right={<StatusBadge status={getStatusLabel(inv.status, balance, inv.total)} />}
                      meta={
                        <>
                          <span className="font-semibold text-navy">Balance {money(balance)}</span>
                          <span className={due.style}>{due.text}</span>
                        </>
                      }
                    />
                    <div className="flex items-center justify-end gap-2 px-4 pb-3 -mt-1">
                      {primaryAction(inv, balance)}
                      {moreActions(inv, balance)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </ListPanel>

      {/* Record payment */}
      {paymentTarget &&
        (() => {
          const { paid, balance } = parseInvoicePayments(paymentTarget.stripe_payment_id, paymentTarget.total, paymentTarget.status);
          return (
            <Sheet
              open
              onClose={() => {
                if (!isRecording) setPaymentTarget(null);
              }}
              size="sm"
              title="Record payment"
              description={`Invoice ${paymentTarget.invoice_number} · ${paymentTarget.customers?.full_name ?? ''}`}
              footer={
                <>
                  <Button variant="secondary" disabled={isRecording} onClick={() => setPaymentTarget(null)}>
                    Cancel
                  </Button>
                  <Button loading={isRecording} onClick={handleRecordPaymentSubmit}>
                    Record payment
                  </Button>
                </>
              }
            >
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-canvas p-3 text-center">
                  <div>
                    <div className="text-2xs text-muted">Total</div>
                    <div className="text-sm font-semibold text-navy">{money(paymentTarget.total)}</div>
                  </div>
                  <div>
                    <div className="text-2xs text-muted">Paid</div>
                    <div className="text-sm font-semibold text-brand-ink">{money(paid)}</div>
                  </div>
                  <div>
                    <div className="text-2xs text-muted">Balance</div>
                    <div className="text-sm font-semibold text-amber-700">{money(balance)}</div>
                  </div>
                </div>

                <Field label="Amount" required>
                  <Input type="number" inputMode="decimal" step="0.01" min="0.01" max={balance} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                </Field>

                <Field label="Payment method">
                  <div className="grid grid-cols-2 gap-2">
                    {['Cash', 'Bank Transfer', 'Card', 'Other'].map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        aria-pressed={paymentMethod === method}
                        className={`h-10 rounded-lg border text-sm font-medium ${
                          paymentMethod === method ? 'bg-navy text-white border-navy' : 'bg-white text-ink-soft border-line hover:bg-mist'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Payment date">
                  <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                </Field>

                <Field label="Notes" hint="Optional — e.g. cheque number or e-transfer reference">
                  <Input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} />
                </Field>
              </div>
            </Sheet>
          );
        })()}
    </Page>
  );
};
