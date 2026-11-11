import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { recall, remember } from '../utils/formMemory';
import { addDaysToDate, todayLocal } from '../utils/dates';
import { isFreeService } from '../config/serviceDescriptions';
import { 
  ArrowLeft, 
  Loader2, 
  Search, 
  Save, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  Percent, 
  DollarSign, 
  FileText, 
  CreditCard,
  Tag
} from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  service_address: string;
}

interface InvoiceLineItemRow {
  id: string;
  service: string;
  description: string;
  quantity: number | '';
  unitPrice: number | '';
}

export type PaymentTermsOption = 'Due on Receipt' | 'Net 7' | 'Net 15' | 'Net 30' | 'Custom';
export type DiscountType = 'none' | 'percentage' | 'fixed';

const TERM_DAYS: Partial<Record<PaymentTermsOption, number>> = { 'Due on Receipt': 0, 'Net 7': 7, 'Net 15': 15, 'Net 30': 30 };

interface InvoiceFormMemory {
  paymentTerms?: PaymentTermsOption;
  taxRate?: number;
  customerMessage?: string;
  paymentInstructions?: string;
  termsAndNotes?: string;
}

export const InvoiceBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customer_id');

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // 1. INVOICE DETAILS STATE
  const [previewInvoiceNumber, setPreviewInvoiceNumber] = useState('INV-1001');
  // Settings from the last invoice this person created.
  const [memory] = useState(() => recall<InvoiceFormMemory>('invoice'));
  const [issueDate, setIssueDate] = useState(() => todayLocal());
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermsOption>(
    memory.paymentTerms && memory.paymentTerms !== 'Custom' ? memory.paymentTerms : 'Net 15',
  );
  const [dueDate, setDueDate] = useState(() => todayLocal(TERM_DAYS[paymentTerms] ?? 15));
  const invoiceStatus = 'Draft';

  // 2. CUSTOMER STATE
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  // Quick "new customer" form, so an invoice can be made for someone not saved yet.
  const [newCust, setNewCust] = useState<{ name: string; phone: string; email: string; address: string } | null>(null);
  const [creatingCust, setCreatingCust] = useState(false);
  const [newCustError, setNewCustError] = useState<string | null>(null);

  // 3. PRODUCTS & SERVICES STATE
  const [lineItems, setLineItems] = useState<InvoiceLineItemRow[]>([
    {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      service: 'Attic Insulation Installation',
      description: 'Supply and blow attic insulation to code requirements.',
      quantity: 1,
      unitPrice: ''
    }
  ]);

  // 4. NOTES & PAYMENT INSTRUCTIONS STATE
  const [customerMessage, setCustomerMessage] = useState(memory.customerMessage || '');
  const [paymentInstructions, setPaymentInstructions] = useState(memory.paymentInstructions || '');
  const [termsAndNotes, setTermsAndNotes] = useState(memory.termsAndNotes || '');

  // 5. PRICING & DISCOUNTS STATE
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [taxRate, setTaxRate] = useState<number | ''>(typeof memory.taxRate === 'number' ? memory.taxRate : 13.0);

  // Helper to calculate Due Date from Issue Date + Terms
  const calculateDueDateFromTerms = (baseDateStr: string, terms: PaymentTermsOption): string => {
    if (!baseDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) return '';
    const days = TERM_DAYS[terms];
    return days === undefined ? dueDate : addDaysToDate(baseDateStr, days);
  };

  // When payment terms change: update due date if not custom
  const handlePaymentTermsChange = (newTerms: PaymentTermsOption) => {
    setPaymentTerms(newTerms);
    if (newTerms !== 'Custom') {
      setDueDate(calculateDueDateFromTerms(issueDate, newTerms));
    }
  };

  // When issue date changes: update due date if not custom
  const handleIssueDateChange = (newDateStr: string) => {
    setIssueDate(newDateStr);
    if (paymentTerms !== 'Custom') {
      setDueDate(calculateDueDateFromTerms(newDateStr, paymentTerms));
    }
  };

  // Load preview sequence on mount
  useEffect(() => {
    async function fetchNextInvoiceNumber() {
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('invoice_number')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.invoice_number) {
          const match = data.invoice_number.match(/\d+/);
          if (match) {
            const nextNum = parseInt(match[0], 10) + 1;
            setPreviewInvoiceNumber(`INV-${nextNum}`);
          }
        }
      } catch (err) {
        console.warn('Could not preview next invoice number:', err);
      }
    }
    fetchNextInvoiceNumber();
  }, []);

  // Load customers
  useEffect(() => {
    async function loadCustomers() {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, full_name, email, phone, service_address')
          .order('full_name', { ascending: true });

        if (error) throw error;
        setCustomers(data || []);

        if (preselectedCustomerId && data) {
          const match = data.find(c => c.id === preselectedCustomerId);
          if (match) {
            handleSelectCustomer(match);
          }
        }
      } catch (err) {
        console.error('Failed to load customers:', err);
      }
    }
    loadCustomers();
  }, [preselectedCustomerId]);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.full_name);
    setCustomerEmail(c.email || '');
    setCustomerPhone(c.phone || '');
    setCustomerAddress(c.service_address || '');
    setCustomerSearch(c.full_name);
    setIsDropdownOpen(false);
  };

  const handleCreateCustomer = async () => {
    if (!newCust) return;
    if (!newCust.name.trim()) {
      setNewCustError('Enter the customer’s name.');
      return;
    }
    if (newCust.email.trim() && !/\S+@\S+\.\S+/.test(newCust.email.trim())) {
      setNewCustError('That email address doesn’t look right.');
      return;
    }
    setCreatingCust(true);
    setNewCustError(null);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([
          {
            full_name: newCust.name.trim(),
            phone: newCust.phone.trim() || null,
            email: newCust.email.trim() || null,
            service_address: newCust.address.trim() || null,
            billing_address: newCust.address.trim() || null,
          },
        ])
        .select('id, full_name, email, phone, service_address')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('The customer was not saved.');
      setCustomers(prev => [...prev, data as Customer].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      handleSelectCustomer(data as Customer);
      setNewCust(null);
    } catch (err: any) {
      setNewCustError(err.message || 'Could not save the customer.');
    } finally {
      setCreatingCust(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.service_address && c.service_address.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  // Line item handlers
  const addLineItem = () => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    setLineItems([
      ...lineItems,
      {
        id: newId,
        service: '',
        description: '',
        quantity: 1,
        unitPrice: ''
      }
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      alert('An invoice must have at least one line item.');
      return;
    }
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof InvoiceLineItemRow, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        // Naming a free service (baffles, attic door, weather stripping) sets its price to $0.
        if (field === 'service' && isFreeService(value)) return { ...item, service: value, unitPrice: 0 };
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Math Calculations
  const subtotal = lineItems.reduce((sum, item) => {
    const qty = Number(item.quantity || 0);
    const price = isFreeService(item.service) ? 0 : Number(item.unitPrice || 0);
    return sum + (qty * price);
  }, 0);

  // Discount calculation
  let discountAmount = 0;
  let discountLabel = 'Discount';
  if (discountType === 'percentage') {
    const pct = discountValue === '' ? 0 : Math.max(0, Math.min(100, Number(discountValue)));
    discountAmount = Math.min(subtotal, Number(((subtotal * pct) / 100).toFixed(2)));
    discountLabel = `Discount (${pct}%)`;
  } else if (discountType === 'fixed') {
    const fixedVal = discountValue === '' ? 0 : Math.max(0, Number(discountValue));
    discountAmount = Math.min(subtotal, fixedVal);
    discountLabel = 'Discount';
  }

  const discountedSubtotal = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));

  // Tax calculation
  const effectiveTaxRate = taxRate === '' ? 0 : Math.max(0, Number(taxRate));
  const calculatedTax = Number(((discountedSubtotal * effectiveTaxRate) / 100).toFixed(2));
  const total = Number((discountedSubtotal + calculatedTax).toFixed(2));

  // Save invoice
  const handleSaveInvoice = async () => {
    if (!selectedCustomerId) {
      alert('Pick a customer, or add a new one from the customer search.');
      return;
    }
    if (!issueDate) {
      alert('Please provide a valid invoice issue date.');
      return;
    }
    if (!dueDate) {
      alert('Please provide a valid payment due date.');
      return;
    }
    if (lineItems.length === 0) {
      alert('Please add at least one line item to the invoice.');
      return;
    }

    // Line items validation
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (!item.service.trim()) {
        alert(`Line Item #${i + 1} is missing a Product / Service title.`);
        return;
      }
      if (item.quantity === '' || Number(item.quantity) <= 0) {
        alert(`Line Item #${i + 1} must have a quantity greater than zero.`);
        return;
      }
      if (!isFreeService(item.service) && (item.unitPrice === '' || Number(item.unitPrice) < 0)) {
        alert(`Line Item #${i + 1} must have a non-negative unit price.`);
        return;
      }
    }

    setLoading(true);
    try {
      const lineItemsPayload = lineItems.map(item => ({
        service: item.service.trim(),
        name: item.service.trim(),
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unit_price: isFreeService(item.service) ? 0 : Number(item.unitPrice),
        total: isFreeService(item.service) ? 0 : Number((Number(item.quantity) * Number(item.unitPrice)).toFixed(2))
      }));

      const payload = {
        customer_id: selectedCustomerId,
        issue_date: issueDate,
        due_date: dueDate,
        payment_terms: paymentTerms,
        line_items: lineItemsPayload,
        subtotal: Number(subtotal.toFixed(2)),
        discount_type: discountType,
        discount_value: discountType === 'none' ? 0 : Number(discountValue || 0),
        tax_rate: effectiveTaxRate,
        tax: calculatedTax,
        total: total,
        status: 'Draft',
        notes: termsAndNotes.trim() || null,
        payment_instructions: paymentInstructions.trim() || null,
        customer_message: customerMessage.trim() || null,
      };

      const { data, error } = await supabase
        .from('invoices')
        .insert([payload])
        .select()
        .maybeSingle();

      if (error) throw error;

      remember<InvoiceFormMemory>('invoice', {
        paymentTerms,
        taxRate: taxRate === '' ? undefined : Number(taxRate),
        customerMessage,
        paymentInstructions,
        termsAndNotes,
      });
      alert(`Invoice ${data?.invoice_number || ''} generated successfully in Draft mode!`);
      if (data) {
        navigate(`/invoices/${data.id}`);
      }
    } catch (err: any) {
      console.error('Invoice creation failed:', err);
      alert('Failed to generate invoice: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow w-full max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-5 md:py-7 space-y-5 md:space-y-6 pb-28 md:pb-10">
      
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate('/invoices')}
          className="w-10 h-10 flex items-center justify-center bg-white border border-line hover:bg-mist rounded-lg text-navy cursor-pointer transition-colors shrink-0"
          title="Back to invoices"
          aria-label="Back to invoices"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="m-0 text-2xl md:text-[1.75rem] font-bold text-navy tracking-tight leading-tight">New invoice</h1>
          <p className="m-0 mt-1 text-sm text-muted">Pick the customer, add what you did, and save it as a draft to review and send.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 items-start">
        
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* ================================================== */}
          {/* 1. INVOICE DETAILS SECTION                         */}
          {/* ================================================== */}
          <div className="bg-white p-4 md:p-6 rounded-xl border border-line shadow-card space-y-4">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <span className="w-5 h-5 rounded-full bg-navy text-white flex items-center justify-center text-2xs font-bold">
                1
              </span>
              <h3 className="text-sm font-semibold text-navy m-0">
                Invoice details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {/* Invoice Number (Read-only preview) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-soft block">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={previewInvoiceNumber}
                  readOnly
                  disabled
                  className="w-full px-3 py-2.5 border border-line rounded-lg text-sm font-mono font-bold text-navy bg-mist cursor-not-allowed text-navy placeholder:text-subtle focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                />
                <span className="text-2xs text-muted block">Auto-assigned on save</span>
              </div>

              {/* Issue Date */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-soft block">
                  Issue Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => handleIssueDateChange(e.target.value)}
                    className="w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none bg-white text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                  />
                </div>
              </div>

              {/* Payment Terms */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-soft block">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => handlePaymentTermsChange(e.target.value as PaymentTermsOption)}
                  className="w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none bg-white cursor-pointer text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                >
                  <option value="Due on Receipt">Due on Receipt</option>
                  <option value="Net 7">Net 7</option>
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              {/* Due Date */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-soft block">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  disabled={paymentTerms !== 'Custom'}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={`w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none text-navy placeholder:text-subtle focus:ring-3 focus:ring-brand/15 ${
                    paymentTerms === 'Custom' ? 'bg-white' : 'bg-canvas cursor-not-allowed'
                  }`}
                />
                {paymentTerms !== 'Custom' && (
                  <span className="text-2xs text-muted block">Calculated from {paymentTerms}</span>
                )}
              </div>
            </div>

            {/* Status Indicator */}
            <div className="pt-2 border-t border-brand-grey-light flex items-center justify-between text-xs">
              <span className="text-2xs font-bold text-muted uppercase tracking-wider">Initial Invoice Status</span>
              <span className="px-2.5 py-1 bg-mist text-ink-soft font-bold text-2xs uppercase tracking-wider rounded-md border border-line">
                {invoiceStatus}
              </span>
            </div>
          </div>

          {/* ================================================== */}
          {/* 2. CUSTOMER ACCOUNT LINK                           */}
          {/* ================================================== */}
          <div className="bg-white p-4 md:p-6 rounded-xl border border-line shadow-card space-y-4 relative">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <span className="w-5 h-5 rounded-full bg-navy text-white flex items-center justify-center text-2xs font-bold">
                2
              </span>
              <h3 className="text-sm font-semibold text-navy m-0">
                Customer account link
              </h3>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search customers, or type a new name"
                value={customerSearch}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full pl-4 pr-10 py-2.5 border border-line rounded-lg text-sm focus:outline-none bg-white text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
              />
              <Search className="absolute right-3 top-3 text-muted w-4 h-4" />

              {isDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-line rounded-xl shadow-lg max-h-48 overflow-y-auto z-20 divide-y divide-brand-grey/50">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCust({ name: customerSearch.trim(), phone: '', email: '', address: '' });
                      setNewCustError(null);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-brand-soft text-sm font-semibold text-brand-ink flex items-center gap-2 bg-white border-0"
                  >
                    <Plus size={16} />
                    {customerSearch.trim() ? `Add “${customerSearch.trim()}” as a new customer` : 'Add a new customer'}
                  </button>
                  {filteredCustomers.length === 0 ? (
                    <div className="p-3.5 text-xs text-muted">No saved customers match.</div>
                  ) : (
                    filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-canvas/75 text-xs font-semibold text-navy transition-colors"
                      >
                        <div className="font-bold text-navy">{c.full_name}</div>
                        <div className="text-2xs text-muted">{c.service_address || 'No service address registered'} &bull; {c.email || 'No email'}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {newCust && (
              <div className="rounded-xl border border-brand/40 bg-brand-soft/30 p-4 space-y-3">
                <div className="text-sm font-semibold text-navy">New customer</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-ink-soft">Name *</span>
                    <input
                      autoFocus
                      type="text"
                      value={newCust.name}
                      onChange={e => setNewCust({ ...newCust, name: e.target.value })}
                      className="w-full h-11 px-3 border border-line rounded-lg text-sm bg-white text-navy focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-ink-soft">Phone</span>
                    <input
                      
                      type="tel"
                      value={newCust.phone}
                      onChange={e => setNewCust({ ...newCust, phone: e.target.value })}
                      className="w-full h-11 px-3 border border-line rounded-lg text-sm bg-white text-navy focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-ink-soft">Email</span>
                    <input
                      
                      type="email"
                      value={newCust.email}
                      onChange={e => setNewCust({ ...newCust, email: e.target.value })}
                      className="w-full h-11 px-3 border border-line rounded-lg text-sm bg-white text-navy focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-ink-soft">Service address</span>
                    <input
                      
                      type="text"
                      value={newCust.address}
                      onChange={e => setNewCust({ ...newCust, address: e.target.value })}
                      className="w-full h-11 px-3 border border-line rounded-lg text-sm bg-white text-navy focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                    />
                  </label>
                </div>
                {newCustError && <p className="m-0 text-sm text-red-700">{newCustError}</p>}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCust(null)}
                    className="h-10 px-4 rounded-lg border border-line bg-white text-sm font-medium text-navy hover:bg-mist"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCustomer}
                    disabled={creatingCust}
                    className="h-10 px-4 rounded-lg border-0 bg-brand hover:bg-brand-hover text-sm font-semibold text-navy inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {creatingCust && <Loader2 size={16} className="animate-spin" />}
                    Save and use this customer
                  </button>
                </div>
              </div>
            )}

            {selectedCustomerId && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs bg-canvas p-3.5 rounded-xl border border-mist">
                <div className="space-y-0.5">
                  <span className="text-2xs font-bold text-muted uppercase block">Client Name</span>
                  <span className="font-bold text-navy">{customerName}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-2xs font-bold text-muted uppercase block">Client Email</span>
                  <span className="font-bold text-navy">{customerEmail || '--'}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-2xs font-bold text-muted uppercase block">Service Address</span>
                  <span className="font-bold text-navy truncate block" title={customerAddress}>{customerAddress || '--'}</span>
                </div>
              </div>
            )}
          </div>

          {/* ================================================== */}
          {/* 3. PRODUCTS & SERVICES                             */}
          {/* ================================================== */}
          <div className="bg-white p-4 md:p-6 rounded-xl border border-line shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-navy text-white flex items-center justify-center text-2xs font-bold">
                  3
                </span>
                <h3 className="text-sm font-semibold text-navy m-0">
                  Products & services
                </h3>
              </div>
              <span className="text-2xs font-bold text-muted uppercase tracking-wider">
                {lineItems.length} line item{lineItems.length > 1 ? 's' : ''}
              </span>
            </div>

            {lineItems.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted italic">
                No line items added yet. Click below to add.
              </div>
            ) : (
              <div className="space-y-4">
                {lineItems.map((item, idx) => {
                  const qty = Number(item.quantity || 0);
                  const free = isFreeService(item.service);
                  const price = free ? 0 : Number(item.unitPrice || 0);
                  const lineTotal = qty * price;

                  return (
                    <div 
                      key={item.id} 
                      className="p-4 rounded-xl border border-line/75 bg-canvas/50 space-y-3"
                    >
                      {/* Row Header & Primary Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                        {/* Product / Service Title */}
                        <div className="sm:col-span-6 space-y-1">
                          <label className="text-[9.5px] font-bold text-navy uppercase block tracking-wider">
                            Product / Service <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={item.service}
                            onChange={(e) => updateLineItem(item.id, 'service', e.target.value)}
                            placeholder="e.g. Attic Insulation Upgrade, Air Sealing, Baffles..."
                            className="w-full px-3 py-2.5 border border-line rounded-lg text-sm text-navy focus:outline-none bg-white text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                          />
                        </div>

                        {/* Qty */}
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[9.5px] font-bold text-navy uppercase block text-center tracking-wider">
                            Qty <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={item.quantity}
                            min="1"
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              if (val === '' || val > 0) updateLineItem(item.id, 'quantity', val);
                            }}
                            className="w-full px-3 py-2.5 border border-line rounded-lg text-sm font-mono font-bold text-center focus:outline-none bg-white text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[9.5px] font-bold text-navy uppercase block text-right tracking-wider">
                            Unit Price ($) {!free && <span className="text-red-500">*</span>}
                          </label>
                          {free ? (
                            <span className="inline-flex items-center justify-center w-full h-[42px] rounded-lg bg-brand-soft text-brand-ink text-sm font-bold" title="We don't charge for this">
                              Free
                            </span>
                          ) : (
                          <input
                            type="number"
                            value={item.unitPrice}
                            min="0"
                            step="0.01"
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              if (val === '' || val >= 0) updateLineItem(item.id, 'unitPrice', val);
                            }}
                            placeholder="0.00"
                            className="w-full px-3 py-2.5 border border-line rounded-lg text-sm font-mono font-bold text-right focus:outline-none bg-white text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                          />
                          )}
                        </div>

                        {/* Total */}
                        <div className="sm:col-span-2 space-y-1 text-right flex flex-col items-end">
                          <div className="flex items-center justify-between w-full">
                            <label className="text-[9.5px] font-bold text-navy uppercase block tracking-wider">Total</label>
                            {lineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLineItem(item.id)}
                                className="text-muted hover:text-red-600 p-0.5 rounded transition-colors cursor-pointer"
                                title="Delete line item"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <span className={`text-xs font-bold block py-2 ${free ? 'text-brand-ink' : 'font-mono text-navy'}`}>
                            {free ? 'Free' : `$${lineTotal.toFixed(2)}`}
                          </span>
                        </div>
                      </div>

                      {/* Description Multi-line Textarea */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-ink-soft block">
                          Description <span className="text-2xs text-muted font-normal lowercase">(optional work details)</span>
                        </label>
                        <textarea
                          rows={2}
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          placeholder="e.g. Supply and install blown fiberglass insulation to achieve R-60 thermal resistance..."
                          className="w-full px-3 py-2.5 border border-line rounded-lg text-sm text-[#334155] focus:outline-none bg-white leading-relaxed resize-y text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                        />
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={addLineItem}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-grey-dark/30 hover:bg-canvas text-navy font-semibold text-sm rounded-lg transition-colors cursor-pointer"
            >
              <Plus size={13} className="stroke-[3] text-brand-green" />
              <span>Add Line Item</span>
            </button>
          </div>

          {/* ================================================== */}
          {/* 4. NOTES & PAYMENT INSTRUCTIONS                    */}
          {/* ================================================== */}
          <div className="bg-white p-4 md:p-6 rounded-xl border border-line shadow-card space-y-4">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <span className="w-5 h-5 rounded-full bg-navy text-white flex items-center justify-center text-2xs font-bold">
                4
              </span>
              <h3 className="text-sm font-semibold text-navy m-0">
                Notes & payment instructions
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              {/* Message to Customer */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-soft block">
                  Message to Customer
                </label>
                <textarea
                  rows={2}
                  value={customerMessage}
                  onChange={(e) => setCustomerMessage(e.target.value)}
                  placeholder="Thank you for choosing Space Insulation Inc."
                  className="w-full px-3 py-2.5 border border-line rounded-lg text-sm text-navy focus:outline-none bg-white text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                />
              </div>

              {/* Payment Instructions */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-soft block">
                  Payment Instructions
                </label>
                <textarea
                  rows={2}
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  placeholder="Enter payment instructions, e-transfer details, cheque instructions, or other payment information."
                  className="w-full px-3 py-2.5 border border-line rounded-lg text-sm text-navy focus:outline-none bg-white text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                />
              </div>

              {/* Terms / Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-soft block">
                  Terms / Notes
                </label>
                <textarea
                  rows={2}
                  value={termsAndNotes}
                  onChange={(e) => setTermsAndNotes(e.target.value)}
                  placeholder="Enter invoice terms, warranty notes, payment conditions, or additional information."
                  className="w-full px-3 py-2.5 border border-line rounded-lg text-sm text-navy focus:outline-none bg-white text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                />
              </div>
            </div>
          </div>

        </div>

        {/* ================================================== */}
        {/* RIGHT COLUMN: STICKY INVOICE LEDGER                */}
        {/* ================================================== */}
        <div className="space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-xl border border-line shadow-card space-y-4 sticky top-6">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-sm font-semibold text-navy m-0">
                Invoice ledger
              </h3>
              <span className="text-2xs font-bold text-muted uppercase tracking-wider">
                CAD
              </span>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-3.5 text-xs">
              
              {/* Line items preview */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {lineItems.map((item, idx) => {
                  const qty = Number(item.quantity || 0);
                  const price = isFreeService(item.service) ? 0 : Number(item.unitPrice || 0);
                  const lineTotal = qty * price;
                  if (lineTotal <= 0 && !item.service) return null;

                  return (
                    <div key={item.id} className="flex justify-between items-center text-2xs">
                      <span className="text-muted font-medium truncate max-w-[150px]" title={item.service}>
                        {item.service || `Line Item #${idx + 1}`}
                      </span>
                      <span className="font-mono font-bold text-navy">
                        {isFreeService(item.service) ? 'Free' : `$${lineTotal.toFixed(2)}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Subtotal */}
              <div className="flex justify-between items-center border-t border-brand-grey-light pt-2.5">
                <span className="text-muted font-medium">Subtotal</span>
                <span className="font-mono font-bold text-navy">
                  ${subtotal.toFixed(2)}
                </span>
              </div>

              {/* ================================================== */}
              {/* DISCOUNT CONTROLS                                  */}
              {/* ================================================== */}
              <div className="space-y-2 pt-2 border-t border-brand-grey-light/70">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-ink-soft">
                    Discount
                  </label>
                  <div className="inline-flex rounded-lg border border-line p-0.5 bg-canvas text-2xs">
                    <button
                      type="button"
                      onClick={() => { setDiscountType('none'); setDiscountValue(''); }}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        discountType === 'none' ? 'bg-white text-navy shadow-xs' : 'text-muted hover:text-navy'
                      }`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        discountType === 'percentage' ? 'bg-white text-navy shadow-xs' : 'text-muted hover:text-navy'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        discountType === 'fixed' ? 'bg-white text-navy shadow-xs' : 'text-muted hover:text-navy'
                      }`}
                    >
                      $
                    </button>
                  </div>
                </div>

                {discountType === 'percentage' && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted text-2xs">Discount %</span>
                    <div className="relative w-28">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={discountValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setDiscountValue('');
                          } else {
                            const num = Math.min(100, Math.max(0, Number(val)));
                            setDiscountValue(num);
                          }
                        }}
                        placeholder="10"
                        className="w-full px-2 py-1 border border-line rounded-lg text-sm font-mono font-bold text-right text-navy focus:outline-none focus:border-brand bg-white pr-6 text-navy placeholder:text-subtle focus:ring-3 focus:ring-brand/15"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">%</span>
                    </div>
                  </div>
                )}

                {discountType === 'fixed' && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted text-2xs">Discount Amount</span>
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={discountValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setDiscountValue('');
                          } else {
                            const num = Math.max(0, Number(val));
                            setDiscountValue(num);
                          }
                        }}
                        placeholder="100.00"
                        className="w-full pl-5 pr-2 py-1 border border-line rounded-lg text-sm font-mono font-bold text-right text-navy focus:outline-none focus:border-brand bg-white text-navy placeholder:text-subtle focus:ring-3 focus:ring-brand/15"
                      />
                    </div>
                  </div>
                )}

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-red-600 font-semibold pt-1">
                    <span>{discountLabel}</span>
                    <span className="font-mono">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Discounted Subtotal (if discount configured) */}
              {discountAmount > 0 && (
                <div className="flex justify-between items-center border-t border-brand-grey-light/70 pt-2">
                  <span className="text-navy font-semibold">Discounted Subtotal</span>
                  <span className="font-mono font-bold text-navy">
                    ${discountedSubtotal.toFixed(2)}
                  </span>
                </div>
              )}

              {/* ================================================== */}
              {/* TAX RATE (13% ONTARIO HST)                         */}
              {/* ================================================== */}
              <div className="space-y-1.5 pt-2 border-t border-brand-grey-light/70">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold text-ink-soft block">
                      Tax Rate
                    </label>
                    <span className="text-2xs text-muted">Ontario HST</span>
                  </div>
                  <div className="relative w-24">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={taxRate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTaxRate(val === '' ? '' : Math.max(0, Number(val)));
                      }}
                      className="w-full px-2 py-1 border border-line rounded-lg text-sm font-mono font-bold text-right text-navy focus:outline-none focus:border-brand bg-white pr-6 text-navy placeholder:text-subtle focus:ring-3 focus:ring-brand/15"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">%</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-muted font-medium">
                    HST ({effectiveTaxRate.toFixed(1)}%)
                  </span>
                  <span className="font-mono font-bold text-navy">
                    ${calculatedTax.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="border-t-2 border-navy pt-3 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-navy">
                  INVOICE TOTAL
                </span>
                <span className="text-xl font-mono font-bold text-navy">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Due Date & Submit */}
            <div className="space-y-3 pt-3 border-t border-brand-grey-light">
              <div className="flex items-center justify-between text-xs">
                <span className="text-2xs font-bold text-muted uppercase tracking-wider">
                  Payment Due Date
                </span>
                <span className="font-mono font-bold text-navy">
                  {dueDate || '--'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSaveInvoice}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-brand hover:bg-brand-hover text-navy font-semibold text-sm rounded-lg shadow cursor-pointer transition-colors"
              >
                {loading ? <Loader2 size={14} className="animate-spin mr-1 inline" /> : <Save size={14} className="stroke-[2.5]" />}
                <span>Save draft invoice</span>
              </button>
            </div>
          </div>
        </div>

      </div>


      {/* Phone: total and save always within reach */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3">
        <div className="min-w-0">
          <div className="text-2xs text-muted">Total</div>
          <div className="text-lg font-bold text-navy leading-tight">${total.toFixed(2)}</div>
        </div>
        <button type="button" onClick={handleSaveInvoice} disabled={loading} className="inline-flex items-center justify-center gap-1.5 h-10 px-4 bg-brand hover:bg-brand-hover text-navy text-sm font-semibold rounded-lg transition-colors cursor-pointer border-0 disabled:opacity-50 flex-1 h-11">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save draft
        </button>
      </div>
    </div>
  );
};
