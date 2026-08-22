import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { COMPANY_DETAILS } from '../config/constants';
import { ArrowLeft, Loader2, Search, ChevronRight, Edit2, Send, Save, Printer, Plus, Trash2, X } from 'lucide-react';

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



export const EstimateBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const dbClient = supabase;

  // Stage: 'form' or 'preview'
  const [stage, setStage] = useState<'form' | 'preview'>('form');

  // Input states
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');


  // Expert Details
  const [expertName, setExpertName] = useState('');
  const [expertRole, setExpertRole] = useState('');
  const [expertEmail, setExpertEmail] = useState('');
  const [expertPhone, setExpertPhone] = useState('');
  const [expertAddress, setExpertAddress] = useState('');
  const [introText, setIntroText] = useState('After inspection, we have estimated this project as follows:');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [aiDrafted, setAiDrafted] = useState(false);

  const handleDraftScopeOfWork = async () => {
    if (!inspectionNotes.trim()) return;
    setIsDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke('draft-scope-of-work', {
        body: { notes: inspectionNotes.trim() }
      });

      if (error) {
        let customMsg = error.message;
        try {
          const bodyText = await error.context.json();
          if (bodyText && bodyText.error) {
            customMsg = bodyText.error;
          }
        } catch (_) {}
        throw new Error(customMsg);
      }

      if (data && data.draft) {
        setIntroText(data.draft);
        setAiDrafted(true);
      }
    } catch (err: any) {
      console.error('Draft scope-of-work failed:', err);
      alert('AI drafting unavailable. Please write or edit the scope of work manually: ' + err.message);
    } finally {
      setIsDrafting(false);
    }
  };

  // Multiple Line Items State
  const [extraItems, setExtraItems] = useState<ExtraLineItem[]>([]);

  // Client search search states
  const [customerSearch, setCustomerSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Email modal confirmation states
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmailAddress, setSendEmailAddress] = useState('');
  const [coordinatorMessage, setCoordinatorMessage] = useState('');

  // Create New Customer States
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const handleCreateCustomer = async () => {
    if (!newCustName.trim()) {
      alert('Please enter customer full name.');
      return;
    }
    if (!newCustAddress.trim()) {
      alert('Please enter service address.');
      return;
    }

    setCreatingCustomer(true);
    try {
      const { data: newCust, error: err } = await dbClient
        .from('customers')
        .insert([{
          full_name: newCustName.trim(),
          email: newCustEmail.trim() || null,
          phone: newCustPhone.trim() || null,
          service_address: newCustAddress.trim(),
          billing_address: newCustAddress.trim(),
          preferred_contact_method: 'Email'
        }])
        .select()
        .maybeSingle();

      if (err) throw err;
      if (!newCust) throw new Error('Customer creation returned no data');

      setCustomers(prev => [...prev, newCust].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setSelectedCustomerId(newCust.id);
      setCustomerName(newCust.full_name);
      setCustomerEmail(newCust.email || '');
      setCustomerSearch(newCust.full_name);

      alert(`Customer ${newCust.full_name} created and selected!`);
      
      setNewCustName('');
      setNewCustEmail('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustomerModalOpen(false);
    } catch (e: any) {
      alert('Failed to create customer: ' + e.message);
    } finally {
      setCreatingCustomer(false);
    }
  };

  useEffect(() => {
    async function loadCustomers() {
      try {
        const { data, error } = await dbClient
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

  // Calculations
  const subtotal = extraItems.reduce((sum, item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unitPrice || 0);
    return sum + (qty * price);
  }, 0);

  const tax = Number((subtotal * 0.13).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  const handleGeneratePreview = () => {
    if (!customerName.trim() || !customerEmail.trim()) {
      alert('Please fill out the Customer Name and Email address.');
      return;
    }
    if (!expertName.trim()) {
      alert('Please provide the Expert Name.');
      return;
    }
    if (expertEmail.trim() && !expertEmail.includes('@')) {
      alert('Please provide a valid Expert Email.');
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

    setSendEmailAddress(customerEmail);
    setStage('preview');
  };

  const handleCreateEstimateRecord = async (status: 'Draft' | 'Sent') => {
    // Build line items array matching structured JSONB format
    const lineItems = extraItems.map(item => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unit_price: Number(item.unitPrice)
    }));

    const payload = {
      customer_id: selectedCustomerId || null,
      customer_name: customerName,
      customer_email: customerEmail,
      home_size: 0,
      insulation_type: 'Line Items',
      insulation_rate: 0,
      expert_name: expertName.trim(),
      expert_role: expertRole.trim(),
      expert_email: expertEmail.trim(),
      expert_phone: expertPhone.trim(),
      expert_address: expertAddress.trim(),
      line_items: lineItems,
      total_amount: total,
      intro_text: introText,
      status: status
    };

    const { data, error } = await dbClient
      .from('estimates')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  const handleSaveAsDraft = async () => {
    setLoading(true);
    try {
      await handleCreateEstimateRecord('Draft');
      alert('Estimate saved successfully as Draft.');
      navigate('/estimates');
    } catch (err: any) {
      alert('Failed to save estimate: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSendEmail = async () => {
    if (!sendEmailAddress.trim()) {
      alert('Please provide a valid recipient email address.');
      return;
    }
    setIsSending(true);
    try {
      // 1. Create the estimate record first as a Draft
      const estRecord = await handleCreateEstimateRecord('Draft');
      if (!estRecord) throw new Error('Estimate record generation failed.');

      // 2. Invoke Resend transaction email edge function
      const { error: sendError } = await supabase.functions.invoke('send-document-email', {
        body: {
          documentId: estRecord.id,
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

      alert(`Estimate ${estRecord.estimate_number} sent to ${sendEmailAddress} successfully!`);
      navigate('/estimates');
    } catch (err: any) {
      console.error('Email dispatch failed:', err);
      alert('Failed to dispatch estimate: ' + err.message);
    } finally {
      setIsSending(false);
      setShowSendModal(false);
    }
  };

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
          aside, header, nav, button, textarea, label {
            display: none !important;
          }
          .bg-brand-grey {
            background-color: #ffffff !important;
          }
        }
      `}} />

      {/* Header bar */}
      <div className="flex items-center gap-3 print:hidden">
        <button 
          onClick={() => {
            if (stage === 'preview') {
              setStage('form');
            } else {
              navigate('/estimates');
            }
          }}
          className="p-2 bg-white border border-brand-grey-medium hover:bg-brand-grey rounded-xl text-brand-charcoal cursor-pointer transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-2xl font-black text-brand-charcoal tracking-tight m-0">
            {stage === 'form' ? 'Estimate Builder' : 'Estimate Document Preview'}
          </h2>
          <p className="text-sm text-brand-grey-dark mt-1">
            {stage === 'form' 
              ? 'Input property audit details and calculate pricing proposals.' 
              : 'Review standard letterhead invoice document layout.'}
          </p>
        </div>
      </div>

      {stage === 'form' ? (
        /* Stage 1: Form Input */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 space-y-6">
            
            {/* Customer Search & Manual Input Card */}
            <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-brand-grey-medium pb-2 select-none">
                <label className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal">
                  Customer Information
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCustomerModalOpen(true)}
                    className="text-[10px] text-[#76C442] hover:underline font-black cursor-pointer border-none bg-transparent"
                  >
                    + Create New Customer
                  </button>
                  {selectedCustomerId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId('');
                        setCustomerName('');
                        setCustomerEmail('');
                        setCustomerSearch('');
                      }}
                      className="text-[10px] text-red-650 hover:underline font-bold pointer-events-auto cursor-pointer border-none bg-transparent"
                    >
                      | Clear Selected
                    </button>
                  )}
                </div>
              </div>

              {/* Search input field */}
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
                          className="w-full text-left px-4 py-2.5 hover:bg-brand-grey-light/75 text-xs font-semibold text-brand-charcoal cursor-pointer"
                        >
                          {c.full_name} ({c.service_address})
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Manual Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Client Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name..."
                    className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Client Email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="Enter customer email..."
                    className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Inspection Notes & Scope of Work */}
            <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4">
              <label className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal block border-b border-brand-grey-medium pb-2 m-0 text-left">
                AI Scope of Work Writer
              </label>

              <div className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Technician Inspection Notes</label>
                    <span className="text-[9px] text-brand-grey-dark font-medium italic">Informal shorthand allowed</span>
                  </div>
                  <textarea
                    value={inspectionNotes}
                    onChange={(e) => setInspectionNotes(e.target.value)}
                    placeholder="e.g., attic access tight, some knob-and-tube wiring, R-8 existing, needs blown-in to R-50"
                    className="w-full h-24 p-3 border border-brand-grey-medium rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                  />
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleDraftScopeOfWork}
                      disabled={isDrafting || !inspectionNotes.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-green hover:bg-brand-green-hover disabled:bg-brand-grey-medium disabled:opacity-50 disabled:cursor-not-allowed text-brand-charcoal font-black text-xs uppercase tracking-wider rounded-xl shadow cursor-pointer transition-colors"
                    >
                      {isDrafting ? <Loader2 size={12} className="animate-spin text-brand-charcoal" /> : <Edit2 size={12} />}
                      <span>{isDrafting ? 'Drafting...' : 'Draft Scope of Work'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Scope of Work (Estimate Intro Text)</label>
                    {aiDrafted && (
                      <span className="text-[9px] bg-brand-green/10 text-brand-green border border-brand-green/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                        AI-drafted — please review
                      </span>
                    )}
                  </div>
                  <textarea
                    value={introText}
                    onChange={(e) => {
                      setIntroText(e.target.value);
                      if (aiDrafted) setAiDrafted(false);
                    }}
                    placeholder="Polished scope-of-work text will appear here..."
                    className="w-full h-32 p-3 border border-brand-grey-medium rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                  />
                  <span className="text-[10px] text-brand-grey-dark block leading-normal italic">
                    This text is shown on the final proposal document and sent to the client. You can edit this directly at any time.
                  </span>
                </div>
              </div>
            </div>

            {/* Insulation Expert Details */}
            <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4">
              <label className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal block border-b border-brand-grey-medium pb-2 m-0 text-left">
                Insulation Expert Details
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Expert Name *</label>
                  <input
                    type="text"
                    value={expertName}
                    onChange={(e) => setExpertName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Expert Role / Title</label>
                  <input
                    type="text"
                    value={expertRole}
                    onChange={(e) => setExpertRole(e.target.value)}
                    placeholder="e.g. Insulation Specialist"
                    className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Expert Email</label>
                  <input
                    type="email"
                    value={expertEmail}
                    onChange={(e) => setExpertEmail(e.target.value)}
                    placeholder="e.g. john@spaceinsulation.ca"
                    className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Expert Phone</label>
                  <input
                    type="text"
                    value={expertPhone}
                    onChange={(e) => setExpertPhone(e.target.value)}
                    placeholder="e.g. 647-555-1234"
                    className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-brand-grey-dark uppercase">Expert Address</label>
                  <input
                    type="text"
                    value={expertAddress}
                    onChange={(e) => setExpertAddress(e.target.value)}
                    placeholder="e.g. Richmond Hill, Ontario"
                    className="w-full px-3 py-2 border border-brand-grey-medium rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-green/20 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Multiple Additional Line Items Section */}
            <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4">
              <label className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal block border-b border-brand-grey-medium pb-2 m-0">
                Quote Items
              </label>

              {extraItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-brand-grey-dark italic">
                  No quote items added yet. Click below to add.
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
                            placeholder="e.g. Air Sealing, Extra Access Panel, Materials..."
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

          {/* Right Summary Panel */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-brand-grey-medium shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal border-b border-brand-grey-medium pb-2.5 m-0">
                Estimate Summary
              </h3>

              <div className="space-y-3.5 text-xs">
                {extraItems.map((item, idx) => {
                  const qty = Number(item.quantity || 0);
                  const price = Number(item.unitPrice || 0);
                  const lineTotal = qty * price;
                  if (lineTotal <= 0 && !item.description) return null;

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
                  <span className="text-xs font-extrabold text-brand-charcoal">Project Estimate Total</span>
                  <span className="text-lg font-mono font-black text-brand-green">${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4.5 py-3 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal font-black text-xs uppercase tracking-wider rounded-xl shadow cursor-pointer transition-colors"
                >
                  <span>Generate Estimate Document</span>
                  <ChevronRight size={13} className="stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Stage 2: Document Letterhead Preview */
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Options Header panel */}
          <div className="bg-white p-4 rounded-xl border border-brand-grey-medium flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 print:hidden">
            <div className="text-xs text-brand-grey-dark font-semibold text-center md:text-left">
              Intro text is editable. Click below to modify wording.
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setStage('form')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-brand-grey-dark/40 hover:bg-brand-grey text-brand-charcoal font-extrabold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer min-h-[44px]"
              >
                <Edit2 size={13} />
                <span>Edit Inputs</span>
              </button>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-brand-grey-dark/40 hover:bg-brand-grey-light text-brand-charcoal font-extrabold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer min-h-[44px]"
              >
                <Printer size={13} />
                <span>Print Estimate</span>
              </button>

              <button
                onClick={handleSaveAsDraft}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-brand-charcoal hover:bg-brand-grey-light text-brand-charcoal font-extrabold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer min-h-[44px]"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Save Draft</span>
              </button>

              <button
                onClick={() => setShowSendModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal font-black text-xs uppercase tracking-wider rounded-lg shadow transition-colors cursor-pointer min-h-[44px]"
              >
                <Send size={13} />
                <span>Send Estimate</span>
              </button>
            </div>
          </div>

          {/* Letter style white page container */}
          <div className="bg-white border border-brand-grey-medium shadow-2xl p-5 md:p-14 space-y-8 min-h-[700px] flex flex-col justify-between">
            
            <div className="space-y-8">
              {/* Header Letterhead */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 border-b-2 border-brand-charcoal pb-6">
                <div className="flex items-center gap-3">
                  <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain rounded" />
                  <div>
                    <h1 className="text-xl font-black text-brand-charcoal tracking-tight m-0">SPACE INSULATION</h1>
                    <span className="text-[10px] text-brand-grey-dark uppercase tracking-widest font-extrabold block">Ontario's Trusted Insulation Experts</span>
                  </div>
                </div>
                <div className="text-left md:text-right text-xs space-y-0.5 text-brand-grey-dark font-medium">
                  <div>Date Issued: {new Date().toLocaleDateString()}</div>
                  <div>Reference: EST-PENDING</div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center">
                <h2 className="text-xl font-extrabold text-brand-charcoal tracking-tight uppercase m-0">Insulation Estimate</h2>
              </div>

              {/* Editable Intro Text Area */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-brand-grey-dark block print:hidden">Intro Greeting (Editable)</label>
                <textarea
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  className="w-full p-3 border border-brand-grey-medium hover:border-brand-green/30 rounded-xl text-xs leading-relaxed italic bg-brand-grey-light/20 font-semibold focus:outline-none print:hidden"
                  rows={2}
                />
                <p className="hidden print:block text-xs leading-relaxed italic font-semibold text-brand-charcoal mb-4">
                  "{introText}"
                </p>
              </div>

              {/* Specification Table */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal border-b border-brand-grey-medium pb-2 m-0">
                  Project Estimate Specifications
                </h3>

                <div className="space-y-3.5 text-xs text-brand-charcoal font-semibold">
                  <div className="flex justify-between items-center border-b border-brand-grey-light pb-2.5">
                    <span className="text-brand-grey-dark font-medium">Client Name</span>
                    <span>{customerName}</span>
                  </div>
                  {/* Detailed Line Items Breakdown */}
                  <div className="pt-4 space-y-3 border-t border-brand-grey-light">

                    {extraItems.map((item, idx) => {
                      const qty = Number(item.quantity || 0);
                      const price = Number(item.unitPrice || 0);
                      const lineTotal = qty * price;
                      if (lineTotal <= 0) return null;

                      return (
                        <div key={item.id} className="flex justify-between items-start text-brand-charcoal">
                          <div className="space-y-0.5">
                            <span>{item.description || `Line Item #${idx + 1}`}</span>
                            <div className="text-[10px] text-brand-grey-dark font-normal italic">
                              Qty: {qty} × ${price.toFixed(2)}
                            </div>
                          </div>
                          <span className="font-mono font-bold">${lineTotal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Total calculations */}
              <div className="border-t border-brand-grey-medium pt-8 mt-8 space-y-2.5 text-xs text-brand-charcoal font-semibold">
                <div className="flex justify-between items-center">
                  <span className="text-brand-grey-dark font-medium">Subtotal</span>
                  <span className="font-mono font-bold">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-brand-grey-dark font-medium">HST (13% Ontario Sales Tax)</span>
                  <span className="font-mono font-bold">${tax.toFixed(2)}</span>
                </div>
                <div className="border-t border-brand-grey-medium pt-3.5 flex justify-between items-center">
                  <span className="text-sm font-black text-brand-charcoal uppercase tracking-wider">Project Estimate Total</span>
                  <span className="text-xl font-mono font-black text-brand-green">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Constant Footer Letterhead */}
            <div className="border-t border-brand-grey-medium pt-6 text-center text-[10px] text-brand-grey-dark space-y-1 font-medium">
              <div className="font-bold text-brand-charcoal">{COMPANY_DETAILS.name}</div>
              <div>Phone: {COMPANY_DETAILS.phone} | Email: {COMPANY_DETAILS.email}</div>
              <div>Website: {COMPANY_DETAILS.website}</div>
            </div>

          </div>

        </div>
      )}

      {/* Email confirmation modal */}
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
                onClick={handleConfirmSendEmail}
                disabled={isSending}
                className="px-4 py-1.5 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal text-xs font-bold rounded-lg transition-all shadow-sm cursor-pointer"
              >
                {isSending ? <Loader2 size={12} className="animate-spin mr-1 inline" /> : null}
                <span>Dispatch Email</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INLINE QUICK CUSTOMER CREATOR MODAL */}
      {newCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs" 
            onClick={() => { if (!creatingCustomer) setNewCustomerModalOpen(false); }}
          />

          {/* Modal Container */}
          <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-[#E7E9ED] z-10 flex flex-col animate-scale-up">
            
            {/* Header */}
            <div className="p-4 bg-[#151A2D] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-[#76C442] stroke-[3]" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider m-0">Create New Customer</h3>
              </div>
              <button
                onClick={() => setNewCustomerModalOpen(false)}
                className="text-[#737A86] hover:text-white border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Fields */}
            <div className="p-5 space-y-4 text-xs text-[#171A1F]">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#737A86] uppercase">Customer Name *</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#737A86] uppercase">Email Address</label>
                <input
                  type="email"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  placeholder="e.g. johndoe@example.com"
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#737A86] uppercase">Phone Number</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="e.g. (555) 000-0000"
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#737A86] uppercase">Service Address *</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="e.g. 100 Main St, Richmond Hill, ON"
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442]"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={creatingCustomer}
                onClick={() => setNewCustomerModalOpen(false)}
                className="px-3.5 py-1.5 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#737A86] text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCreateCustomer}
                disabled={creatingCustomer}
                className="px-4 py-1.5 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-lg transition-all shadow-xs cursor-pointer border-none"
              >
                {creatingCustomer ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                <span>Create Customer</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

