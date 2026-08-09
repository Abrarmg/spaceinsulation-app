import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Loader2, Search, Save, Plus, Trash2 } from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  service_address: string;
}

interface ExtraLineItem {
  id: string;
  description: string;
  quantity: number | '';
  unitPrice: number | '';
}

const INSULATION_TYPES = [
  'Attic Insulation Installation',
  'Blown In Insulation',
  'Insulation Removal',
  'Attic Mold Removal'
];

export const InvoiceBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Form fields
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [homeSize, setHomeSize] = useState<number | ''>('');
  const [insulationType, setInsulationType] = useState('Attic Insulation Installation');
  const [insulationRate, setInsulationRate] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');

  // Multiple Line Items State
  const [extraItems, setExtraItems] = useState<ExtraLineItem[]>([]);

  // Customer dropdown select search
  const [customerSearch, setCustomerSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Set default due date to Net 15 on mount
  useEffect(() => {
    const today = new Date();
    const net15 = new Date();
    net15.setDate(today.getDate() + 15);
    setDueDate(net15.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    async function loadCustomers() {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, full_name, email, service_address')
          .order('full_name', { ascending: true });

        if (error) throw error;
        setCustomers(data || []);
      } catch (err) {
        console.error('Failed to load customers:', err);
      }
    }
    loadCustomers();
  }, []);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.full_name);
    setCustomerEmail(c.email || '');
    setCustomerSearch(c.full_name);
    setIsDropdownOpen(false);
  };

  const filteredCustomers = customers.filter(c =>
    c.full_name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Multiple Line Items Handlers
  const addExtraItem = () => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    setExtraItems([
      ...extraItems,
      {
        id: newId,
        description: '',
        quantity: 1,
        unitPrice: ''
      }
    ]);
  };

  const removeExtraItem = (id: string) => {
    setExtraItems(extraItems.filter(item => item.id !== id));
  };

  const updateExtraItem = (id: string, field: keyof ExtraLineItem, value: any) => {
    setExtraItems(extraItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Math Calculations
  const calculatedBase = Number(homeSize || 0) * Number(insulationRate || 0);
  
  const extrasSubtotal = extraItems.reduce((sum, item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unitPrice || 0);
    return sum + (qty * price);
  }, 0);

  const subtotal = calculatedBase + extrasSubtotal;
  const tax = Number((subtotal * 0.13).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  const handleSaveInvoice = async () => {
    if (!selectedCustomerId) {
      alert('Invoices must be linked to an existing Customer profile.');
      return;
    }
    if (!homeSize || Number(homeSize) <= 0 || !insulationRate || Number(insulationRate) <= 0) {
      alert('Please enter valid Home Size and Insulation Rate values.');
      return;
    }
    if (!dueDate) {
      alert('Please provide a valid payment due date.');
      return;
    }

    // Line items validation
    for (let i = 0; i < extraItems.length; i++) {
      const item = extraItems[i];
      if (!item.description.trim()) {
        alert(`Line Item #${i + 1} is missing a description.`);
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
      // Build line items array matching invoice structure
      const lineItems = [
        {
          description: `Insulation Services: ${insulationType} Insulation (${homeSize} sq ft at $${Number(insulationRate).toFixed(2)}/sq ft)`,
          quantity: 1,
          unit_price: calculatedBase
        }
      ];

      // Add extra line items
      extraItems.forEach(item => {
        lineItems.push({
          description: item.description.trim(),
          quantity: Number(item.quantity),
          unit_price: Number(item.unitPrice)
        });
      });

      const payload = {
        customer_id: selectedCustomerId,
        line_items: lineItems,
        subtotal: subtotal,
        tax: tax,
        total: total,
        status: 'Draft',
        due_date: dueDate
      };

      const { data, error } = await supabase
        .from('invoices')
        .insert([payload])
        .select()
        .maybeSingle();

      if (error) throw error;

      alert('Invoice generated successfully in Draft mode!');
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
    <div className="flex-grow p-6 md:p-8 space-y-6 overflow-y-auto max-h-screen bg-brand-grey pb-16">
      
      {/* Header bar */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate('/invoices')}
          className="p-2 bg-white border border-brand-grey-medium hover:bg-brand-grey rounded-xl text-brand-charcoal cursor-pointer transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-2xl font-black text-brand-charcoal tracking-tight m-0">Draft New Invoice</h2>
          <p className="text-sm text-brand-grey-dark mt-1">Select customer profile and define insulation service items.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">
          
          {/* Customer Selection Card */}
          <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4 relative">
            <label className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal block border-b border-brand-grey-medium pb-2 m-0">
              Customer Account Link
            </label>

            <div className="relative">
              <input
                type="text"
                placeholder="Search existing customers..."
                value={customerSearch}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full pl-4 pr-10 py-2.5 border border-brand-grey-medium rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20"
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
                        className="w-full text-left px-4 py-2.5 hover:bg-brand-grey-light/75 text-xs font-semibold text-brand-charcoal"
                      >
                        {c.full_name} ({c.service_address})
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedCustomerId && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-brand-grey-dark uppercase block">Client Name</span>
                  <span className="font-bold text-brand-charcoal">{customerName}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-brand-grey-dark uppercase block">Client Email</span>
                  <span className="font-bold text-brand-charcoal">{customerEmail || '--'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Insulation specifications */}
          <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4">
            <label className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal block border-b border-brand-grey-medium pb-2 m-0">
              Audit Specifications (Core Service)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Home Size (sq ft)</label>
                <input
                  type="number"
                  value={homeSize}
                  min="1"
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    if (val === '' || val >= 0) setHomeSize(val);
                  }}
                  placeholder="e.g. 1500"
                  className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-green/20 text-center bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Insulation Type</label>
                <select
                  value={insulationType}
                  onChange={(e) => setInsulationType(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                >
                  {INSULATION_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Rate per sq ft ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={insulationRate}
                  min="0"
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    if (val === '' || val >= 0) setInsulationRate(val);
                  }}
                  placeholder="e.g. 1.25"
                  className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-green/20 text-center bg-white"
                />
              </div>
            </div>
          </div>

          {/* Multiple Additional Line Items Section */}
          <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4">
            <label className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal block border-b border-brand-grey-medium pb-2 m-0">
              Additional Line Items
            </label>

            {extraItems.length === 0 ? (
              <div className="py-4 text-center text-xs text-brand-grey-dark italic">
                No additional line items added yet. Click below to add.
              </div>
            ) : (
              <div className="space-y-3">
                {extraItems.map((item) => {
                  const qty = Number(item.quantity || 0);
                  const price = Number(item.unitPrice || 0);
                  const lineTotal = qty * price;

                  return (
                    <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center border-b border-brand-grey-light/50 pb-3 last:border-b-0">
                      
                      {/* Description */}
                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[9px] font-bold text-brand-grey-dark uppercase block">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateExtraItem(item.id, 'description', e.target.value)}
                          placeholder="e.g. Air Sealing, Permit Fee, Materials..."
                          className="w-full px-3 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[9px] font-bold text-brand-grey-dark uppercase block text-center">Qty</label>
                        <input
                          type="number"
                          value={item.quantity}
                          min="1"
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            if (val === '' || val > 0) updateExtraItem(item.id, 'quantity', val);
                          }}
                          className="w-full px-3 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[9px] font-bold text-brand-grey-dark uppercase block text-center">Unit Price ($)</label>
                        <input
                          type="number"
                          value={item.unitPrice}
                          min="0"
                          step="0.01"
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            if (val === '' || val >= 0) updateExtraItem(item.id, 'unitPrice', val);
                          }}
                          placeholder="0.00"
                          className="w-full px-3 py-1.5 border border-brand-grey-medium rounded-lg text-xs font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                        />
                      </div>

                      {/* Line Total */}
                      <div className="sm:col-span-2 space-y-1 text-center">
                        <label className="text-[9px] font-bold text-brand-grey-dark uppercase block">Total</label>
                        <span className="font-mono text-xs font-black text-brand-charcoal block py-1.5">
                          ${lineTotal.toFixed(2)}
                        </span>
                      </div>

                      {/* Delete Action */}
                      <div className="sm:col-span-1 text-right pt-4 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => removeExtraItem(item.id)}
                          className="p-1.5 text-brand-grey-dark hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={addExtraItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-brand-grey-dark/40 hover:bg-brand-grey text-brand-charcoal font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
            >
              <Plus size={12} className="stroke-[2.5]" />
              <span>Add Line Item</span>
            </button>
          </div>

        </div>

        {/* Right ledger calculations column */}
        <div className="space-y-6">
          
          <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal border-b border-brand-grey-medium pb-2.5 m-0">
              Invoice Ledger
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-brand-grey-dark font-medium">Base Services</span>
                <span className="font-mono font-bold text-brand-charcoal">${calculatedBase.toFixed(2)}</span>
              </div>

              {extraItems.map((item, idx) => {
                const qty = Number(item.quantity || 0);
                const price = Number(item.unitPrice || 0);
                const lineTotal = qty * price;
                if (lineTotal <= 0) return null;

                return (
                  <div key={item.id} className="flex justify-between items-center">
                    <span className="text-brand-grey-dark font-medium truncate max-w-[140px]" title={item.description}>
                      {item.description || `Line Item #${idx + 1}`}
                    </span>
                    <span className="font-mono font-bold text-brand-charcoal">${lineTotal.toFixed(2)}</span>
                  </div>
                );
              })}

              <div className="flex justify-between items-center border-t border-brand-grey-light pt-2">
                <span className="text-brand-grey-dark font-medium">Subtotal</span>
                <span className="font-mono font-bold text-brand-charcoal">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-brand-grey-dark font-medium">HST (13% Ontario Sales Tax)</span>
                <span className="font-mono font-bold text-brand-charcoal">${tax.toFixed(2)}</span>
              </div>
              <div className="border-t border-brand-grey/50 pt-3 flex justify-between items-center">
                <span className="text-xs font-extrabold text-brand-charcoal">Invoice Total Due</span>
                <span className="text-lg font-mono font-black text-brand-green">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-brand-grey-dark uppercase block">Payment Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveInvoice}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4.5 py-3 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal font-black text-xs uppercase tracking-wider rounded-xl shadow cursor-pointer transition-colors"
              >
                {loading ? <Loader2 size={13} className="animate-spin mr-1 inline" /> : <Save size={13} />}
                <span>Generate Draft Invoice</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
