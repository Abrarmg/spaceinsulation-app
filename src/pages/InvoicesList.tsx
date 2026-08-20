import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase, supabaseAdmin } from '../supabaseClient';
import { 
  FileSpreadsheet, 
  Search, 
  Loader2, 
  AlertCircle, 
  Plus,
  MoreVertical,
  Layers,
  Check,
  DollarSign,
  X,
  Filter,
  CreditCard,
  AlertTriangle
} from 'lucide-react';

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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Mobile drawer filter state
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [selectedMobileStatus, setSelectedMobileStatus] = useState('all');

  // Record Payment Dialog States
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState('2026-07-31'); // default to mock system today date
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const dbClient = supabaseAdmin || supabase;

  // Global click listener to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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

      const todayStr = '2026-07-31';
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
      const todayStr = '2026-07-31';

      if (statusFilter === 'Overdue') {
        query = query.eq('status', 'Sent').lt('due_date', todayStr);
      } else if (statusFilter === 'Due Soon') {
        // defined as sent & due in next 2 days
        const dueLimit = '2026-08-02';
        query = query.eq('status', 'Sent').gte('due_date', todayStr).lte('due_date', dueLimit);
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply search query (invoice number, customer name, or customer email)
      if (debouncedQuery.trim()) {
        const queryTerm = debouncedQuery.trim();
        query = query.or(`invoice_number.ilike.%${queryTerm}%,customers.full_name.ilike.%${queryTerm}%`);
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
      return { text: formatted, style: 'text-[#737A86]' };
    }

    const today = new Date('2026-07-31T00:00:00');
    const dueZero = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const diffTime = dueZero.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      return { text: `${absDays} day${absDays !== 1 ? 's' : ''} overdue`, style: 'text-red-650 font-black' };
    } else if (diffDays <= 2) {
      return { text: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`, style: 'text-amber-600 font-extrabold animate-pulse' };
    }
    return { text: formatted, style: 'text-[#171A1F] font-semibold' };
  };

  // Status Badge Styling Helper
  const getStatusStyle = (status: string, balance: number, total: number) => {
    const paid = total - balance;
    
    // Check if partially paid dynamically
    if (status === 'Sent' && paid > 0 && balance > 0) {
      return 'text-purple-700 bg-purple-50 border-purple-200 font-black';
    }

    switch (status.toLowerCase()) {
      case 'draft':
        return 'text-slate-600 bg-slate-50 border-slate-200';
      case 'sent':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'paid':
        return 'text-green-700 bg-green-50 border-green-200 font-black';
      case 'overdue':
        return 'text-red-700 bg-red-50 border-red-200 font-black';
      default:
        return 'text-slate-650 bg-slate-50 border-slate-200';
    }
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
    setActiveMenuId(null);
    setPaymentTarget(inv);

    const { balance } = parseInvoicePayments(inv.stripe_payment_id, inv.total, inv.status);
    setPaymentAmount(balance.toFixed(2));
    setPaymentMethod('Cash');
    setPaymentDate('2026-07-31');
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
    setActiveMenuId(null);
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
    setActiveMenuId(null);
    
    const recipientEmail = targetInv.customers?.email?.trim();
    if (!recipientEmail) {
      alert('Please enter a valid customer email address.');
      return;
    }

    if (!confirm(`Send invoice ${targetInv.invoice_number} to ${targetInv.customers.full_name}?`)) return;

    try {
      const { data, error: sendErr } = await dbClient.functions.invoke('send-document-email', {
        body: {
          documentId: targetInv.id,
          documentType: 'invoice',
          recipientEmail: recipientEmail,
        }
      });

      if (sendErr) throw sendErr;
      if (data?.success === false || data?.error) {
        throw new Error(data?.message || data?.error || 'Email sending failed');
      }

      alert('Invoice sent successfully.');
      fetchInvoices();
      fetchSummary();
    } catch (err: any) {
      console.error('Failed to send invoice email:', err);
      alert('Unable to send this invoice. Please try again.');
    }
  };

  const handleVoidInvoice = async (e: React.MouseEvent, targetInv: Invoice) => {
    e.stopPropagation();
    setActiveMenuId(null);
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

  const handleApplyMobileFilter = () => {
    setStatusFilter(selectedMobileStatus);
    setCurrentPage(1);
    setMobileFilterOpen(false);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="flex-grow p-4 md:p-6 space-y-6 overflow-y-auto max-h-screen bg-[#F6F7F9] font-sans pb-16">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E9ED] pb-3.5 select-none">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-[#151A2D] tracking-tight m-0">Invoices & Receivables</h2>
          <p className="text-xs md:text-sm text-[#737A86] mt-0.5 font-semibold">
            Track payments, issue invoices, and manage client collections.
          </p>
        </div>
        
        <Link 
          to="/invoices/new" 
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] font-black text-xs uppercase tracking-wider rounded-xl shadow-xs cursor-pointer transition-colors border-none"
        >
          <Plus size={15} className="stroke-[3]" />
          <span>New Invoice</span>
        </Link>
      </div>

      {/* FEATURE 2 — COMPACT FINANCIAL SUMMARY */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 select-none">
        {/* Total Invoiced */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 text-[#737A86] rounded-lg shrink-0">
            <FileSpreadsheet size={16} />
          </div>
          <div>
            <div className="text-[10px] text-[#737A86] uppercase font-bold">Total Invoiced</div>
            <div className="text-sm font-black text-[#151A2D]">
              ${Number(summary.totalInvoiced).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Paid */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <Check size={16} />
          </div>
          <div>
            <div className="text-[10px] text-[#737A86] uppercase font-bold">Paid</div>
            <div className="text-sm font-black text-[#151A2D]">
              ${Number(summary.paid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Outstanding */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs flex items-center gap-3">
          <div className={`p-2.5 rounded-lg shrink-0 ${summary.outstanding > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-[#737A86]'}`}>
            <DollarSign size={16} />
          </div>
          <div>
            <div className="text-[10px] text-[#737A86] uppercase font-bold">Outstanding</div>
            <div className={`text-sm font-black ${summary.outstanding > 0 ? 'text-amber-600' : 'text-[#151A2D]'}`}>
              ${Number(summary.outstanding).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs flex items-center gap-3">
          <div className={`p-2.5 rounded-lg shrink-0 ${summary.overdue > 0 ? 'bg-red-50 text-red-650' : 'bg-slate-50 text-[#737A86]'}`}>
            <AlertTriangle size={16} />
          </div>
          <div>
            <div className="text-[10px] text-[#737A86] uppercase font-bold">Overdue</div>
            <div className={`text-sm font-black ${summary.overdue > 0 ? 'text-red-650 animate-pulse' : 'text-[#151A2D]'}`}>
              ${Number(summary.overdue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Draft */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs flex items-center gap-3 col-span-2 lg:col-span-1">
          <div className="p-2.5 bg-slate-50 text-[#737A86] rounded-lg shrink-0">
            <Layers size={16} />
          </div>
          <div>
            <div className="text-[10px] text-[#737A86] uppercase font-bold">Draft</div>
            <div className="text-sm font-black text-[#151A2D]">{summary.draft}</div>
          </div>
        </div>
      </div>

      {/* FEATURE 3 — SEARCH & COMPACT FILTERS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white border border-[#E2E8F0] p-3 rounded-xl gap-3 shadow-3xs select-none">
        {/* Search Input */}
        <div className="relative flex-grow max-w-lg">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737A86]" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice number, customer, or address..."
            className="w-full pl-9 pr-4 py-2 border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442] bg-[#F7F8FA]"
          />
        </div>

        {/* Sort & Desktop Filter options */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort dropdown selector */}
          <select
            value={sortOption}
            onChange={(e: any) => setSortOption(e.target.value)}
            className="px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-[10px] font-black uppercase bg-white text-[#171A1F] cursor-pointer min-h-[30px] focus:outline-none"
          >
            <option value="date_desc">Latest Created</option>
            <option value="date_asc">Earliest Due</option>
            <option value="total_desc">Highest Total</option>
          </select>

          {/* Desktop Filters */}
          <div className="hidden sm:flex items-center gap-1.5">
            {STATUS_FILTERS.map(filter => (
              <button
                key={filter}
                onClick={() => {
                  setStatusFilter(filter);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg border text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer ${
                  statusFilter === filter 
                    ? 'bg-[#151A2D] text-white border-[#151A2D] shadow-xs' 
                    : 'bg-white text-[#737A86] border-[#E2E8F0] hover:bg-slate-50'
                }`}
              >
                {filter === 'all' ? 'All status' : filter}
              </button>
            ))}
          </div>

          {/* Mobile Filter toggle trigger */}
          <button
            onClick={() => {
              setSelectedMobileStatus(statusFilter);
              setMobileFilterOpen(true);
            }}
            className="sm:hidden flex items-center justify-center gap-1.5 px-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-black text-[#171A1F] cursor-pointer"
          >
            <Filter size={13} className="text-[#737A86]" />
            <span>Filter ▾</span>
          </button>
        </div>
      </div>

      {/* MAIN DATA BLOCK */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-3xs overflow-hidden min-h-[340px] flex flex-col justify-between">
        
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2 text-[#737A86] select-none">
            <Loader2 className="w-8 h-8 animate-spin text-[#76C442]" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading invoices directory...</span>
          </div>
        ) : error ? (
          <div className="py-24 text-center text-red-600 flex flex-col items-center justify-center gap-2">
            <AlertCircle size={28} />
            <span className="text-xs font-bold uppercase tracking-wider">{error}</span>
          </div>
        ) : invoices.length === 0 ? (
          /* EMPTY SEARCH AND TABLE STATES */
          <div className="flex flex-col items-center justify-center py-24 text-center px-4 select-none">
            <FileSpreadsheet className="w-12 h-12 text-[#E2E8F0] mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">
              {debouncedQuery.trim() ? 'No invoices found' : 'No invoices yet'}
            </h3>
            <p className="text-xs text-[#737A86] max-w-xs mt-1 font-semibold">
              {debouncedQuery.trim() 
                ? 'Try another name or invoice number.' 
                : 'Create your first invoice to start tracking payments.'
              }
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP / TABLET VIEWPORTS TABLE */}
            <div className="hidden md:block overflow-x-auto relative">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#151A2D] text-white border-b border-[#111624] text-[10px] font-black uppercase tracking-wider select-none">
                    <th className="px-5 py-3.5 pl-6">Invoice</th>
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5">Issue Date</th>
                    <th className="px-5 py-3.5">Due Date</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Total</th>
                    <th className="px-5 py-3.5">Balance</th>
                    <th className="px-5 py-3.5 text-right pr-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {invoices.map((inv) => {
                    const cust = inv.customers || { full_name: 'Client', email: 'No email' };
                    const { balance } = parseInvoicePayments(inv.stripe_payment_id, inv.total, inv.status);
                    const dueDetails = getDueDetails(inv.due_date, balance, inv.status);
                    const displayStatus = getStatusLabel(inv.status, balance, inv.total);
                    const statusClass = getStatusStyle(inv.status, balance, inv.total);

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* 5. INVOICE ID */}
                        <td className="px-5 py-3.5 pl-6">
                          <Link 
                            to={`/invoices/${inv.id}`}
                            className="text-xs font-black text-[#151A2D] hover:text-[#76C442] hover:underline"
                          >
                            {inv.invoice_number}
                          </Link>
                          <div className="text-[9px] text-[#737A86] font-semibold mt-0.5">
                            Created {new Date(inv.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          </div>
                        </td>

                        {/* 6. CUSTOMER */}
                        <td className="px-5 py-3.5">
                          <div className="text-xs font-bold text-[#151A2D]">{cust.full_name}</div>
                          <div className="text-[9.5px] text-[#737A86] font-semibold mt-0.5">{cust.email}</div>
                        </td>

                        {/* ISSUE DATE */}
                        <td className="px-5 py-3.5 text-xs text-[#737A86] font-medium">
                          {new Date(inv.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>

                        {/* 8. DUE DATE VISUALIZATION */}
                        <td className="px-5 py-3.5 text-xs">
                          <span className={dueDetails.style}>{dueDetails.text}</span>
                        </td>

                        {/* 7. STATUS badge */}
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-0.5 border rounded-lg text-[9px] font-black uppercase tracking-wider ${statusClass}`}>
                            {displayStatus}
                          </span>
                        </td>

                        {/* 9. TOTAL */}
                        <td className="px-5 py-3.5 font-bold text-xs text-[#737A86]">
                          ${Number(inv.total).toFixed(2)}
                        </td>

                        {/* 9. BALANCE */}
                        <td className="px-5 py-3.5 font-black text-xs text-[#151A2D]">
                          ${balance.toFixed(2)}
                        </td>

                        {/* 10. ACTIONS ROW */}
                        <td className="px-5 py-3.5 pr-6 text-right relative">
                          <div className="flex items-center justify-end gap-3 select-none">
                            <Link 
                              to={`/invoices/${inv.id}`}
                              className="px-3 py-1 border border-[#E6E8EC] bg-white hover:bg-slate-50 text-[#171A1F] text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                            >
                              View →
                            </Link>

                            {/* Dropdown Menu clicker */}
                            <div className="relative inline-block text-left" ref={menuRef}>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === inv.id ? null : inv.id);
                                }}
                                className="p-1 border border-transparent rounded-lg text-[#737A86] hover:bg-slate-100 hover:text-[#171A1F] cursor-pointer"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {activeMenuId === inv.id && (
                                <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white border border-[#E2E8F0] shadow-xl z-20 overflow-hidden text-left py-1">
                                  <Link 
                                    to={`/invoices/${inv.id}`}
                                    className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-bold text-[#1E293B] block select-none border-none bg-transparent"
                                  >
                                    View Invoice
                                  </Link>
                                  <button 
                                    onClick={(e) => handleSendToCustomer(e, inv)}
                                    className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-bold text-[#1E293B] text-left block select-none border-none bg-transparent cursor-pointer"
                                  >
                                    Send to Customer
                                  </button>
                                  {balance > 0 && (
                                    <button 
                                      onClick={(e) => handleOpenPayment(e, inv)}
                                      className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-black text-[#76C442] text-left block select-none border-none bg-transparent cursor-pointer"
                                    >
                                      Record Payment
                                    </button>
                                  )}
                                  <button 
                                    onClick={(e) => handleDuplicate(e, inv)}
                                    className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-bold text-[#1E293B] text-left block select-none border-none bg-transparent cursor-pointer"
                                  >
                                    Duplicate
                                  </button>
                                  <div className="border-t border-[#E2E8F0] my-0.5" />
                                  <button 
                                    onClick={(e) => handleVoidInvoice(e, inv)}
                                    className="w-full px-4 py-2 hover:bg-red-50 text-xs font-bold text-red-650 text-left block select-none border-none bg-transparent cursor-pointer"
                                  >
                                    Void
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* FEATURE 14 — MOBILE VIEWPORTS RESPONSIVE CARDS */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {invoices.map((inv) => {
                const cust = inv.customers || { full_name: 'Client', email: 'No email' };
                const { balance } = parseInvoicePayments(inv.stripe_payment_id, inv.total, inv.status);
                const dueDetails = getDueDetails(inv.due_date, balance, inv.status);
                const displayStatus = getStatusLabel(inv.status, balance, inv.total);
                const statusClass = getStatusStyle(inv.status, balance, inv.total);
                
                return (
                  <div key={`mob-inv-${inv.id}`} className="p-4 space-y-3 hover:bg-slate-50 transition-all select-none">
                    <div className="flex items-center justify-between">
                      <Link 
                        to={`/invoices/${inv.id}`}
                        className="text-xs font-black text-[#151A2D] hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                      
                      <span className={`px-2.5 py-0.5 border rounded-lg text-[9px] font-black uppercase tracking-wider ${statusClass}`}>
                        {displayStatus}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#737A86] font-semibold">Customer:</span>
                        <span className="font-bold text-[#151A2D]">{cust.full_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#737A86] font-semibold">Total:</span>
                        <span className="font-bold text-[#737A86]">${Number(inv.total).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#737A86] font-semibold">Balance:</span>
                        <span className="font-black text-[#151A2D]">${balance.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10.5px]">
                        <span className="text-[#737A86] font-semibold">Due:</span>
                        <span className={dueDetails.style}>{dueDetails.text}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]/60">
                      <Link 
                        to={`/invoices/${inv.id}`}
                        className="px-4 py-1.5 border border-[#E6E8EC] bg-white text-[#171A1F] text-[10px] font-black rounded-lg text-center"
                      >
                        View Invoice →
                      </Link>

                      {/* Mobile Actions Menu dropdown */}
                      <div className="relative inline-block text-left" ref={menuRef}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === inv.id ? null : inv.id);
                          }}
                          className="p-1.5 border border-[#E2E8F0] rounded-lg text-[#737A86] bg-white cursor-pointer"
                        >
                          <MoreVertical size={14} />
                        </button>
                        
                        {activeMenuId === inv.id && (
                          <div className="absolute right-0 mt-1 w-40 rounded-xl bg-white border border-[#E2E8F0] shadow-xl z-20 overflow-hidden text-left py-1">
                            {balance > 0 && (
                              <button 
                                onClick={(e) => handleOpenPayment(e, inv)}
                                className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-black text-[#76C442] text-left block select-none border-none bg-transparent cursor-pointer"
                              >
                                Record Payment
                              </button>
                            )}
                            <button 
                              onClick={(e) => handleSendToCustomer(e, inv)}
                              className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-bold text-[#1E293B] text-left block select-none border-none bg-transparent cursor-pointer"
                            >
                              Send to Customer
                            </button>
                            <button 
                              onClick={(e) => handleDuplicate(e, inv)}
                              className="w-full px-4 py-2 hover:bg-slate-50 text-xs font-bold text-[#1E293B] text-left block select-none border-none bg-transparent cursor-pointer"
                            >
                              Duplicate
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* PAGINATION PANEL */}
        {!loading && !error && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between bg-slate-50/20 select-none">
            <span className="text-[10.5px] text-[#737A86] font-bold uppercase tracking-wider">
              Page {currentPage} of {totalPages} ({totalCount} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="px-3.5 py-1.5 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="px-3.5 py-1.5 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FEATURE 11 — RECORD PAYMENT MODAL DIALOG */}
      {paymentTarget && (() => {
        const { paid, balance } = parseInvoicePayments(paymentTarget.stripe_payment_id, paymentTarget.total, paymentTarget.status);
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs" 
              onClick={() => { if (!isRecording) setPaymentTarget(null); }}
            />

            {/* Modal Container */}
            <div className="relative bg-white w-full max-w-sm mx-4 rounded-xl shadow-2xl overflow-hidden border border-[#E7E9ED] z-10 flex flex-col p-5 space-y-4 animate-scale-up">
              
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="text-[#76C442] w-5 h-5 stroke-[2.5]" />
                  <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">Record Payment</h3>
                </div>
                <button
                  onClick={() => setPaymentTarget(null)}
                  className="text-[#737A86] hover:text-[#171A1F] border-none bg-transparent cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Data values */}
              <div className="grid grid-cols-2 gap-3 text-xs border-b border-[#E2E8F0] pb-3 select-none">
                <div>
                  <span className="text-[9px] text-[#737A86] uppercase font-bold block">Invoice ID</span>
                  <span className="font-bold text-[#151A2D]">{paymentTarget.invoice_number}</span>
                </div>
                <div>
                  <span className="text-[9px] text-[#737A86] uppercase font-bold block">Total Amount</span>
                  <span className="font-bold text-[#151A2D]">${paymentTarget.total.toFixed(2)}</span>
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

              {/* Inputs */}
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
                    placeholder="Check number, cash memo reference..."
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 select-none border-t border-[#E2E8F0]/60">
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => setPaymentTarget(null)}
                  className="px-4 py-2 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#737A86] text-xs font-semibold rounded-lg cursor-pointer min-h-[36px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRecordPaymentSubmit}
                  disabled={isRecording}
                  className="px-4 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-lg cursor-pointer min-h-[36px] flex items-center gap-1.5 border-none"
                >
                  {isRecording ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Record Payment</span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* FEATURE 15 — MOBILE FILTER BOTTOM SHEET */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center font-sans">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs" 
            onClick={() => setMobileFilterOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative bg-white w-full rounded-t-2xl shadow-2xl p-5 space-y-4 z-10 text-left border-t border-[#E7E9ED] animate-slide-up">
            
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
              <h3 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">Filter Invoices</h3>
              <button 
                onClick={() => setMobileFilterOpen(false)}
                className="text-[#737A86] hover:text-[#171A1F] border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5 select-none">
              <label className="text-[10px] font-bold text-[#737A86] uppercase">Filter by Status</label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {STATUS_FILTERS.map(status => (
                  <button
                    key={`mob-filter-${status}`}
                    onClick={() => setSelectedMobileStatus(status)}
                    className={`px-2 py-2 border rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                      selectedMobileStatus === status
                        ? 'bg-[#151A2D] text-white border-[#151A2D]'
                        : 'bg-white text-[#737A86] border-[#E2E8F0]'
                    }`}
                  >
                    {status === 'all' ? 'All' : status}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-[#E2E8F0] select-none">
              <button
                onClick={() => {
                  setSelectedMobileStatus('all');
                }}
                className="flex-grow py-2.5 border border-[#E2E8F0] hover:bg-slate-50 text-[#737A86] text-xs font-bold rounded-lg cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={handleApplyMobileFilter}
                className="flex-grow py-2.5 bg-[#151A2D] text-white text-xs font-black rounded-lg border-none cursor-pointer"
              >
                Apply Filters
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
