import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
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

export const InvoiceBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customer_id');

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // 1. INVOICE DETAILS STATE
  const [previewInvoiceNumber, setPreviewInvoiceNumber] = useState('INV-1001');
  const [issueDate, setIssueDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermsOption>('Net 15');
  const [dueDate, setDueDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 15);
    return today.toISOString().split('T')[0];
  });
  const invoiceStatus = 'Draft';

  // 2. CUSTOMER STATE
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
  const [customerMessage, setCustomerMessage] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [termsAndNotes, setTermsAndNotes] = useState('');

  // 5. PRICING & DISCOUNTS STATE
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [taxRate, setTaxRate] = useState<number | ''>(13.0);

  // Helper to calculate Due Date from Issue Date + Terms
  const calculateDueDateFromTerms = (baseDateStr: string, terms: PaymentTermsOption): string => {
    if (!baseDateStr) return '';
    const base = new Date(`${baseDateStr}T00:00:00`);
    if (isNaN(base.getTime())) return '';

    if (terms === 'Due on Receipt') {
      return baseDateStr;
    } else if (terms === 'Net 7') {
      base.setDate(base.getDate() + 7);
      return base.toISOString().split('T')[0];
    } else if (terms === 'Net 15') {
      base.setDate(base.getDate() + 15);
      return base.toISOString().split('T')[0];
    } else if (terms === 'Net 30') {
      base.setDate(base.getDate() + 30);
      return base.toISOString().split('T')[0];
    }
    return dueDate;
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
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Math Calculations
  const subtotal = lineItems.reduce((sum, item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unitPrice || 0);
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
      alert('Invoices must be linked to an existing Customer profile.');
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
      if (item.unitPrice === '' || Number(item.unitPrice) < 0) {
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
        unit_price: Number(item.unitPrice),
        total: Number((Number(item.quantity) * Number(item.unitPrice)).toFixed(2))
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
    <div className="flex-grow p-6 md:p-8 space-y-6 overflow-y-auto max-h-screen bg-brand-grey pb-16 font-sans">
      
      {/* Header Bar */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate('/invoices')}
          className="p-2 bg-white border border-brand-grey-medium hover:bg-brand-grey rounded-xl text-brand-charcoal cursor-pointer transition-colors"
          title="Back to Invoices"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-2xl font-black text-brand-charcoal tracking-tight m-0">Draft New Invoice</h2>
          <p className="text-sm text-brand-grey-dark mt-0.5">
            Configure invoice details, link customer, and specify contractor services.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* ================================================== */}
          {/* 1. INVOICE DETAILS SECTION                         */}
          {/* ================================================== */}
          <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-brand-grey-medium pb-2.5">
              <span className="w-5 h-5 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-[11px] font-black">
                1
              </span>
              <h3 className="text-xs font-black uppercase tracking-wider text-brand-charcoal m-0">
                INVOICE DETAILS
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {/* Invoice Number (Read-only preview) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-grey-dark uppercase block tracking-wider">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={previewInvoiceNumber}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold text-brand-charcoal bg-slate-100 cursor-not-allowed"
                />
                <span className="text-[9px] text-brand-grey-dark block">Auto-assigned on save</span>
              </div>

              {/* Issue Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-grey-dark uppercase block tracking-wider">
                  Issue Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => handleIssueDateChange(e.target.value)}
                    className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                  />
                </div>
              </div>

              {/* Payment Terms */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-grey-dark uppercase block tracking-wider">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => handlePaymentTermsChange(e.target.value as PaymentTermsOption)}
                  className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white cursor-pointer"
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
                <label className="text-[10px] font-bold text-brand-grey-dark uppercase block tracking-wider">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  disabled={paymentTerms !== 'Custom'}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={`w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 ${
                    paymentTerms === 'Custom' ? 'bg-white' : 'bg-slate-50 cursor-not-allowed'
                  }`}
                />
                {paymentTerms !== 'Custom' && (
                  <span className="text-[9px] text-brand-grey-dark block">Calculated from {paymentTerms}</span>
                )}
              </div>
            </div>

            {/* Status Indicator */}
            <div className="pt-2 border-t border-brand-grey-light flex items-center justify-between text-xs">
              <span className="text-[10px] font-bold text-brand-grey-dark uppercase tracking-wider">Initial Invoice Status</span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider rounded-md border border-slate-200">
                {invoiceStatus}
              </span>
            </div>
          </div>

          {/* ================================================== */}
          {/* 2. CUSTOMER ACCOUNT LINK                           */}
          {/* ================================================== */}
          <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4 relative">
            <div className="flex items-center gap-2 border-b border-brand-grey-medium pb-2.5">
              <span className="w-5 h-5 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-[11px] font-black">
                2
              </span>
              <h3 className="text-xs font-black uppercase tracking-wider text-brand-charcoal m-0">
                CUSTOMER ACCOUNT LINK
              </h3>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search existing customers by name or service address..."
                value={customerSearch}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full pl-4 pr-10 py-2.5 border border-brand-grey-medium rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
              />
              <Search className="absolute right-3 top-3 text-brand-grey-dark w-4 h-4" />

              {isDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-brand-grey-medium rounded-xl shadow-lg max-h-48 overflow-y-auto z-20 divide-y divide-brand-grey/50">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-3.5 text-xs text-brand-grey-dark italic">No clients match search query</div>
                  ) : (
                    filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-brand-grey-light/75 text-xs font-semibold text-brand-charcoal transition-colors"
                      >
                        <div className="font-bold text-brand-charcoal">{c.full_name}</div>
                        <div className="text-[11px] text-brand-grey-dark">{c.service_address || 'No service address registered'} &bull; {c.email || 'No email'}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedCustomerId && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-brand-grey-dark uppercase block">Client Name</span>
                  <span className="font-bold text-brand-charcoal">{customerName}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-brand-grey-dark uppercase block">Client Email</span>
                  <span className="font-bold text-brand-charcoal">{customerEmail || '--'}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-brand-grey-dark uppercase block">Service Address</span>
                  <span className="font-bold text-brand-charcoal truncate block" title={customerAddress}>{customerAddress || '--'}</span>
                </div>
              </div>
            )}
          </div>

          {/* ================================================== */}
          {/* 3. PRODUCTS & SERVICES                             */}
          {/* ================================================== */}
          <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-brand-grey-medium pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-[11px] font-black">
                  3
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-brand-charcoal m-0">
                  PRODUCTS & SERVICES
                </h3>
              </div>
              <span className="text-[10px] font-bold text-brand-grey-dark uppercase tracking-wider">
                {lineItems.length} line item{lineItems.length > 1 ? 's' : ''}
              </span>
            </div>

            {lineItems.length === 0 ? (
              <div className="py-4 text-center text-xs text-brand-grey-dark italic">
                No line items added yet. Click below to add.
              </div>
            ) : (
              <div className="space-y-4">
                {lineItems.map((item, idx) => {
                  const qty = Number(item.quantity || 0);
                  const price = Number(item.unitPrice || 0);
                  const lineTotal = qty * price;

                  return (
                    <div 
                      key={item.id} 
                      className="p-4 rounded-xl border border-brand-grey-medium/75 bg-slate-50/50 space-y-3"
                    >
                      {/* Row Header & Primary Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                        {/* Product / Service Title */}
                        <div className="sm:col-span-6 space-y-1">
                          <label className="text-[9.5px] font-bold text-brand-charcoal uppercase block tracking-wider">
                            Product / Service <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={item.service}
                            onChange={(e) => updateLineItem(item.id, 'service', e.target.value)}
                            placeholder="e.g. Attic Insulation Upgrade, Air Sealing, Baffles..."
                            className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-bold text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                          />
                        </div>

                        {/* Qty */}
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[9.5px] font-bold text-brand-charcoal uppercase block text-center tracking-wider">
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
                            className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[9.5px] font-bold text-brand-charcoal uppercase block text-right tracking-wider">
                            Unit Price ($) <span className="text-red-500">*</span>
                          </label>
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
                            className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold text-right focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                          />
                        </div>

                        {/* Total */}
                        <div className="sm:col-span-2 space-y-1 text-right flex flex-col items-end">
                          <div className="flex items-center justify-between w-full">
                            <label className="text-[9.5px] font-bold text-brand-charcoal uppercase block tracking-wider">Total</label>
                            {lineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLineItem(item.id)}
                                className="text-brand-grey-dark hover:text-red-600 p-0.5 rounded transition-colors cursor-pointer"
                                title="Delete line item"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <span className="font-mono text-xs font-black text-brand-charcoal block py-2">
                            ${lineTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Description Multi-line Textarea */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-brand-grey-dark uppercase block tracking-wider">
                          Description <span className="text-[9px] text-brand-grey-dark font-normal lowercase">(optional work details)</span>
                        </label>
                        <textarea
                          rows={2}
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          placeholder="e.g. Supply and install blown fiberglass insulation to achieve R-60 thermal resistance..."
                          className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs text-[#334155] focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white leading-relaxed resize-y"
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
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-grey-dark/30 hover:bg-slate-50 text-brand-charcoal font-black text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
            >
              <Plus size={13} className="stroke-[3] text-brand-green" />
              <span>Add Line Item</span>
            </button>
          </div>

          {/* ================================================== */}
          {/* 4. NOTES & PAYMENT INSTRUCTIONS                    */}
          {/* ================================================== */}
          <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-brand-grey-medium pb-2.5">
              <span className="w-5 h-5 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-[11px] font-black">
                4
              </span>
              <h3 className="text-xs font-black uppercase tracking-wider text-brand-charcoal m-0">
                NOTES & PAYMENT INSTRUCTIONS
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              {/* Message to Customer */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-charcoal uppercase block tracking-wider">
                  Message to Customer
                </label>
                <textarea
                  rows={2}
                  value={customerMessage}
                  onChange={(e) => setCustomerMessage(e.target.value)}
                  placeholder="Thank you for choosing Space Insulation Inc."
                  className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                />
              </div>

              {/* Payment Instructions */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-charcoal uppercase block tracking-wider">
                  Payment Instructions
                </label>
                <textarea
                  rows={2}
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  placeholder="Enter payment instructions, e-transfer details, cheque instructions, or other payment information."
                  className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                />
              </div>

              {/* Terms / Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-charcoal uppercase block tracking-wider">
                  Terms / Notes
                </label>
                <textarea
                  rows={2}
                  value={termsAndNotes}
                  onChange={(e) => setTermsAndNotes(e.target.value)}
                  placeholder="Enter invoice terms, warranty notes, payment conditions, or additional information."
                  className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                />
              </div>
            </div>
          </div>

        </div>

        {/* ================================================== */}
        {/* RIGHT COLUMN: STICKY INVOICE LEDGER                */}
        {/* ================================================== */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4 sticky top-6">
            <div className="flex items-center justify-between border-b border-brand-grey-medium pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-brand-charcoal m-0">
                INVOICE LEDGER
              </h3>
              <span className="text-[10px] font-extrabold text-brand-grey-dark uppercase tracking-wider">
                CAD
              </span>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-3.5 text-xs">
              
              {/* Line items preview */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {lineItems.map((item, idx) => {
                  const qty = Number(item.quantity || 0);
                  const price = Number(item.unitPrice || 0);
                  const lineTotal = qty * price;
                  if (lineTotal <= 0 && !item.service) return null;

                  return (
                    <div key={item.id} className="flex justify-between items-center text-[11px]">
                      <span className="text-brand-grey-dark font-medium truncate max-w-[150px]" title={item.service}>
                        {item.service || `Line Item #${idx + 1}`}
                      </span>
                      <span className="font-mono font-bold text-brand-charcoal">
                        ${lineTotal.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Subtotal */}
              <div className="flex justify-between items-center border-t border-brand-grey-light pt-2.5">
                <span className="text-brand-grey-dark font-medium">Subtotal</span>
                <span className="font-mono font-bold text-brand-charcoal">
                  ${subtotal.toFixed(2)}
                </span>
              </div>

              {/* ================================================== */}
              {/* DISCOUNT CONTROLS                                  */}
              {/* ================================================== */}
              <div className="space-y-2 pt-2 border-t border-brand-grey-light/70">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-brand-charcoal uppercase tracking-wider">
                    Discount
                  </label>
                  <div className="inline-flex rounded-lg border border-brand-grey-medium p-0.5 bg-slate-50 text-[10px]">
                    <button
                      type="button"
                      onClick={() => { setDiscountType('none'); setDiscountValue(''); }}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        discountType === 'none' ? 'bg-white text-brand-charcoal shadow-xs' : 'text-brand-grey-dark hover:text-brand-charcoal'
                      }`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        discountType === 'percentage' ? 'bg-white text-brand-charcoal shadow-xs' : 'text-brand-grey-dark hover:text-brand-charcoal'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        discountType === 'fixed' ? 'bg-white text-brand-charcoal shadow-xs' : 'text-brand-grey-dark hover:text-brand-charcoal'
                      }`}
                    >
                      $
                    </button>
                  </div>
                </div>

                {discountType === 'percentage' && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-brand-grey-dark text-[11px]">Discount %</span>
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
                        className="w-full px-2 py-1 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold text-right text-brand-charcoal focus:outline-none focus:border-brand-green bg-white pr-6"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">%</span>
                    </div>
                  </div>
                )}

                {discountType === 'fixed' && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-brand-grey-dark text-[11px]">Discount Amount</span>
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
                        className="w-full pl-5 pr-2 py-1 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold text-right text-brand-charcoal focus:outline-none focus:border-brand-green bg-white"
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
                  <span className="text-brand-charcoal font-semibold">Discounted Subtotal</span>
                  <span className="font-mono font-bold text-brand-charcoal">
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
                    <label className="text-[10px] font-bold text-brand-charcoal uppercase tracking-wider block">
                      Tax Rate
                    </label>
                    <span className="text-[10px] text-brand-grey-dark">Ontario HST</span>
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
                      className="w-full px-2 py-1 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold text-right text-brand-charcoal focus:outline-none focus:border-brand-green bg-white pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">%</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-brand-grey-dark font-medium">
                    HST ({effectiveTaxRate.toFixed(1)}%)
                  </span>
                  <span className="font-mono font-bold text-brand-charcoal">
                    ${calculatedTax.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="border-t-2 border-[#151A2D] pt-3 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-brand-charcoal">
                  INVOICE TOTAL
                </span>
                <span className="text-xl font-mono font-black text-brand-charcoal">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Due Date & Submit */}
            <div className="space-y-3 pt-3 border-t border-brand-grey-light">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-brand-grey-dark uppercase tracking-wider">
                  Payment Due Date
                </span>
                <span className="font-mono font-bold text-brand-charcoal">
                  {dueDate || '--'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSaveInvoice}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal font-black text-xs uppercase tracking-wider rounded-xl shadow cursor-pointer transition-colors"
              >
                {loading ? <Loader2 size={14} className="animate-spin mr-1 inline" /> : <Save size={14} className="stroke-[2.5]" />}
                <span>Generate Draft Invoice</span>
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
