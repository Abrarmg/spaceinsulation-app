import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { COMPANY_DETAILS } from '../config/constants';
import { 
  ArrowLeft, 
  Loader2, 
  Search, 
  Edit2, 
  Send, 
  Save, 
  Printer, 
  Plus, 
  Trash2, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  Image as ImageIcon,
  Sparkles
} from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  service_address: string;
}

interface StaffProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role?: string;
}

export type QuoteItemType = 'item' | 'section';

export interface QuoteLineItem {
  id: string;
  type: QuoteItemType;
  name: string;
  description: string;
  quantity: number | '';
  unit_price: number | '';
  is_optional: boolean;
  is_recommended: boolean;
  image_url: string;
}

export interface ClientViewSettings {
  show_quantity: boolean;
  show_unit_price: boolean;
  show_line_item_totals: boolean;
  show_total: boolean;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);
};

export const EstimateBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customer');

  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [nextEstimateNumber, setNextEstimateNumber] = useState<string>('EST-Auto');

  const dbClient = supabase;

  // Stage: 'form' or 'preview'
  const [stage, setStage] = useState<'form' | 'preview'>('form');

  // ─── 1. QUOTE DETAILS ───
  const [title, setTitle] = useState('Attic Insulation Upgrade');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');

  // Salesperson / Estimator
  const [expertName, setExpertName] = useState('');
  const [expertRole, setExpertRole] = useState('Insulation Specialist');
  const [expertEmail, setExpertEmail] = useState('');
  const [expertPhone, setExpertPhone] = useState('');
  const [expertAddress, setExpertAddress] = useState('10660 Yonge St, Richmond Hill, ON L4C 3C9');

  // ─── 2. INTRODUCTION ───
  const [introTitle, setIntroTitle] = useState('Estimate / Scope of Work');
  const [introText, setIntroText] = useState('After inspection, we have estimated this project as follows:');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [aiDrafted, setAiDrafted] = useState(false);

  // ─── 3. PRODUCTS & SERVICES ───
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([
    {
      id: 'item-1',
      type: 'item',
      name: 'Blown-In Attic Insulation Upgrade to R60',
      description: 'Blown-in fiberglass/cellulose insulation upgrade to achieve R-60 thermal resistance.',
      quantity: 1,
      unit_price: 2100,
      is_optional: false,
      is_recommended: false,
      image_url: ''
    }
  ]);

  // ─── 4. PRICING ───
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [taxRate, setTaxRate] = useState<number>(0.13); // 13% HST

  // ─── 5. DEPOSIT ───
  const [depositType, setDepositType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [depositValue, setDepositValue] = useState<number | ''>('');

  // ─── 6. CLIENT VIEW SETTINGS ───
  const [clientViewSettings, setClientViewSettings] = useState<ClientViewSettings>({
    show_quantity: true,
    show_unit_price: true,
    show_line_item_totals: true,
    show_total: true
  });

  // ─── 7. CLIENT MESSAGE & TERMS ───
  const [clientMessage, setClientMessage] = useState(
    'Thank you for considering Space Insulation Inc. for your home improvement project. Please review the proposal details below.'
  );
  const [contractDisclaimer, setContractDisclaimer] = useState(
    'This quotation is valid for 30 days. Work will be performed in accordance with Ontario Building Code standards by certified insulation technicians.'
  );
  const [terms, setTerms] = useState(
    'Payment due upon substantial completion of work unless otherwise specified.'
  );

  // Client search states
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

  // ─── LOAD INITIAL DATA ───
  useEffect(() => {
    async function initData() {
      try {
        // 1. Load customers
        const { data: custData } = await dbClient
          .from('customers')
          .select('id, full_name, email, phone, service_address')
          .order('full_name', { ascending: true });
        
        if (custData) {
          setCustomers(custData);
          if (preselectedCustomerId) {
            const match = custData.find(c => c.id === preselectedCustomerId);
            if (match) {
              handleSelectCustomer(match);
            }
          }
        }

        // 2. Load staff profiles for Estimator assignment
        const { data: staffData } = await dbClient
          .from('profiles')
          .select('id, full_name, email, phone, role')
          .order('full_name', { ascending: true });
        
        if (staffData) {
          setStaffProfiles(staffData);
        }

        // 3. Current user profile for default estimator details
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: myProfile } = await dbClient
            .from('profiles')
            .select('full_name, email, phone, role')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (myProfile && !expertName) {
            setExpertName(myProfile.full_name || '');
            setExpertEmail(myProfile.email || authData.user.email || '');
            if (myProfile.phone) setExpertPhone(myProfile.phone);
            if (myProfile.role === 'admin') {
              setExpertRole('Project Consultant');
            }
          }
        }

        // 4. Latest estimate number
        const { data: latestEst } = await dbClient
          .from('estimates')
          .select('estimate_number')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestEst?.estimate_number) {
          const matchNum = latestEst.estimate_number.match(/\d+/);
          if (matchNum) {
            const nextVal = parseInt(matchNum[0], 10) + 1;
            setNextEstimateNumber(`EST-${nextVal}`);
          }
        }
      } catch (err) {
        console.error('Failed to initialize quote builder data:', err);
      }
    }
    initData();
  }, [preselectedCustomerId]);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.full_name || '');
    setCustomerEmail(c.email || '');
    setCustomerPhone(c.phone || '');
    setPropertyAddress(c.service_address || '');
    setCustomerSearch(c.full_name || '');
    setIsDropdownOpen(false);
  };

  const filteredCustomers = customers.filter(c =>
    (c.full_name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.service_address || '').toLowerCase().includes(customerSearch.toLowerCase())
  );

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

      setCustomers(prev => [...prev, newCust].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')));
      handleSelectCustomer(newCust);
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
          if (bodyText && bodyText.error) customMsg = bodyText.error;
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

  // ─── LINE ITEMS HANDLERS ───
  const addLineItem = () => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    setLineItems([
      ...lineItems,
      {
        id: newId,
        type: 'item',
        name: '',
        description: '',
        quantity: 1,
        unit_price: '',
        is_optional: false,
        is_recommended: false,
        image_url: ''
      }
    ]);
  };

  const addTextSection = () => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    setLineItems([
      ...lineItems,
      {
        id: newId,
        type: 'section',
        name: 'Important Information',
        description: '',
        quantity: '',
        unit_price: '',
        is_optional: false,
        is_recommended: false,
        image_url: ''
      }
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof QuoteLineItem, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const moveLineItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === lineItems.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newItems = [...lineItems];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);
    setLineItems(newItems);
  };

  // ─── EXACT PRICING CALCULATIONS ───
  // Optional items must NOT be included in the base total
  const subtotal = lineItems.reduce((sum, item) => {
    if (item.type === 'section' || item.is_optional) return sum;
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    return sum + (qty * price);
  }, 0);

  // Optional items sum (for informational visibility only)
  const optionalItemsTotal = lineItems.reduce((sum, item) => {
    if (item.type === 'item' && item.is_optional) {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + (qty * price);
    }
    return sum;
  }, 0);

  // Calculate discount
  let discountAmount = 0;
  if (discountType === 'percentage') {
    const pct = Math.max(0, Number(discountValue) || 0);
    discountAmount = Number(((subtotal * pct) / 100).toFixed(2));
  } else if (discountType === 'fixed') {
    discountAmount = Math.max(0, Number(discountValue) || 0);
  }
  discountAmount = Math.min(discountAmount, subtotal);

  // Discounted subtotal
  const discountedSubtotal = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));

  // Tax calculation
  const currentTaxRate = Math.max(0, Number(taxRate) || 0);
  const tax = Number((discountedSubtotal * currentTaxRate).toFixed(2));

  // Quote Total
  const total = Number((discountedSubtotal + tax).toFixed(2));

  // Deposit calculation
  let depositAmount = 0;
  if (depositType === 'percentage') {
    const pct = Math.max(0, Math.min(100, Number(depositValue) || 0));
    depositAmount = Number(((total * pct) / 100).toFixed(2));
  } else if (depositType === 'fixed') {
    depositAmount = Math.min(total, Math.max(0, Number(depositValue) || 0));
  }

  // ─── VALIDATION & PREVIEW ───
  const validateQuoteInputs = (): boolean => {
    if (!customerName.trim()) {
      alert('Please provide a Client Name.');
      return false;
    }
    if (customerEmail.trim() && !customerEmail.includes('@')) {
      alert('Please provide a valid Client Email address.');
      return false;
    }
    if (!expertName.trim()) {
      alert('Please specify the Salesperson / Estimator Name.');
      return false;
    }

    const pricedItems = lineItems.filter(item => item.type === 'item');
    if (pricedItems.length === 0) {
      alert('Please add at least one line item to the quote.');
      return false;
    }

    for (let i = 0; i < pricedItems.length; i++) {
      const item = pricedItems[i];
      if (!item.name.trim() && !item.description.trim()) {
        alert(`Line Item #${i + 1} is missing a Name or Description.`);
        return false;
      }
      if (item.quantity === '' || Number(item.quantity) <= 0) {
        alert(`Line Item "${item.name || i + 1}" must have a quantity greater than zero.`);
        return false;
      }
      if (item.unit_price === '' || Number(item.unit_price) < 0) {
        alert(`Line Item "${item.name || i + 1}" must have a valid unit price.`);
        return false;
      }
    }

    return true;
  };

  const handleGeneratePreview = () => {
    if (!validateQuoteInputs()) return;
    setSendEmailAddress(customerEmail);
    setStage('preview');
  };

  // ─── SAVE / SEND RECORD GENERATION ───
  const handleCreateEstimateRecord = async (status: 'Draft' | 'Sent') => {
    // Format line items preserving backward compatibility
    const formattedLineItems = lineItems.map(item => {
      if (item.type === 'section') {
        return {
          type: 'section',
          name: item.name.trim() || 'Information',
          description: item.description.trim(),
          quantity: 0,
          unit_price: 0,
          is_optional: false,
          is_recommended: false,
          image_url: null
        };
      }
      return {
        type: 'item',
        name: item.name.trim() || item.description.trim() || 'Service Item',
        description: item.description.trim(),
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        is_optional: Boolean(item.is_optional),
        is_recommended: Boolean(item.is_recommended),
        image_url: item.image_url ? item.image_url.trim() : null,
        // Legacy fallback field for older template engines
        service: item.name.trim() || item.description.trim() || 'Service Item'
      };
    });

    const payload = {
      customer_id: selectedCustomerId || null,
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim() || null,
      customer_phone: customerPhone.trim() || null,
      property_address: propertyAddress.trim() || null,
      title: title.trim() || 'Insulation Quote',
      intro_title: introTitle.trim() || 'Estimate / Scope of Work',
      intro_text: introText.trim(),
      header_image_url: headerImageUrl.trim() || null,
      home_size: 0,
      insulation_type: 'Line Items',
      insulation_rate: 0,
      expert_name: expertName.trim(),
      expert_role: expertRole.trim(),
      expert_email: expertEmail.trim(),
      expert_phone: expertPhone.trim(),
      expert_address: expertAddress.trim(),
      line_items: formattedLineItems,
      discount_type: discountType,
      discount_value: Number(discountValue) || 0,
      tax_rate: Number(taxRate) || 0.13,
      deposit_type: depositType,
      deposit_value: Number(depositValue) || 0,
      client_view_settings: clientViewSettings,
      client_message: clientMessage.trim() || null,
      contract_disclaimer: contractDisclaimer.trim() || null,
      terms: terms.trim() || null,
      total_amount: total,
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
    if (!validateQuoteInputs()) return;
    setLoading(true);
    try {
      const record = await handleCreateEstimateRecord('Draft');
      alert(`Quote ${record?.estimate_number || ''} saved successfully as Draft!`);
      navigate('/estimates');
    } catch (err: any) {
      alert('Failed to save quote draft: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSendEmail = async () => {
    if (!sendEmailAddress.trim() || !sendEmailAddress.includes('@')) {
      alert('Please provide a valid recipient email address.');
      return;
    }
    setIsSending(true);
    try {
      // 1. Create quote record
      const estRecord = await handleCreateEstimateRecord('Sent');
      if (!estRecord) throw new Error('Quote record creation failed.');

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
          if (bodyText && bodyText.error) customMsg = bodyText.error;
        } catch (_) {}
        throw new Error(customMsg);
      }

      alert(`Quote ${estRecord.estimate_number || ''} sent to ${sendEmailAddress} successfully!`);
      navigate('/estimates');
    } catch (err: any) {
      console.error('Email dispatch failed:', err);
      alert('Failed to dispatch quote: ' + err.message);
    } finally {
      setIsSending(false);
      setShowSendModal(false);
    }
  };

  return (
    <div className="flex-grow p-4 md:p-8 space-y-6 overflow-y-auto max-h-screen bg-[#F8FAFC] pb-24 print:bg-white print:p-0 print:overflow-visible print:max-h-none font-sans text-slate-800">
      
      {/* Print Overrides */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body, html, #root, #root > div, main {
            height: auto !important;
            overflow: visible !important;
            max-height: none !important;
          }
          .print\\:hidden { display: none !important; }
          aside, header, nav, button, textarea, label { display: none !important; }
          .bg-brand-grey { background-color: #ffffff !important; }
        }
      `}} />

      {/* Top Navigation / Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (stage === 'preview') {
                setStage('form');
              } else {
                navigate('/estimates');
              }
            }}
            className="p-2.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-slate-700 cursor-pointer transition-colors shadow-xs"
            title="Back to Estimates"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-[#151A2D] tracking-tight m-0">
                {stage === 'form' ? 'Create Quote' : 'Quote Document Preview'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wide">
                Draft
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {stage === 'form' 
                ? 'Field-service quotation builder with Jobber-style scope, optional items, and custom terms.' 
                : 'Inspect client document letterhead before dispatching.'}
            </p>
          </div>
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center gap-2">
          {stage === 'form' ? (
            <>
              <button
                type="button"
                onClick={handleGeneratePreview}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Eye size={14} className="text-slate-500" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAsDraft}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-[#151A2D] text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {loading ? <Loader2 size={13} className="animate-spin text-slate-600" /> : <Save size={14} />}
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (validateQuoteInputs()) {
                    setSendEmailAddress(customerEmail);
                    setShowSendModal(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Send size={14} />
                <span>Send Quote</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStage('form')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <Edit2 size={13} />
                <span>Edit Quote</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <Printer size={13} />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAsDraft}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-[#151A2D] text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {loading ? <Loader2 size={13} className="animate-spin text-slate-600" /> : <Save size={13} />}
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSendModal(true)}
                className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Send size={13} />
                <span>Send Quote</span>
              </button>
            </>
          )}
        </div>
      </div>

      {stage === 'form' ? (
        /* STAGE 1: FORM BUILDER */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Document Sections (Left 8 cols) */}
          <div className="lg:col-span-8 space-y-6">

            {/* ─────────────────────────────────────────────────────────────
                SECTION 1: QUOTE DETAILS
               ───────────────────────────────────────────────────────────── */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h2 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">
                    Quote Details
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-semibold">Quote #:</span>
                  <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-xs font-mono font-bold text-slate-800">
                    {nextEstimateNumber}
                  </span>
                </div>
              </div>

              {/* Quote Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  Quote Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Attic Insulation Upgrade, R60 Blown-in"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#76C442]/30 focus:border-[#76C442] bg-white transition-all"
                />
              </div>

              {/* Client Selection & Details */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Client Details
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setNewCustomerModalOpen(true)}
                      className="text-xs text-[#5aa32a] hover:underline font-bold cursor-pointer border-none bg-transparent"
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
                          setCustomerPhone('');
                          setPropertyAddress('');
                          setCustomerSearch('');
                        }}
                        className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer border-none bg-transparent"
                      >
                        Clear Selected
                      </button>
                    )}
                  </div>
                </div>

                {/* Customer Search Dropdown */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search existing clients by name, email, or address..."
                    value={customerSearch}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#76C442]/30 focus:border-[#76C442]"
                  />
                  <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />

                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto z-30 divide-y divide-slate-100">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 italic">No clients found matching query</div>
                      ) : (
                        filteredCustomers.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectCustomer(c)}
                            className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer flex flex-col"
                          >
                            <span className="font-bold text-[#151A2D]">{c.full_name}</span>
                            <span className="text-[11px] text-slate-500 font-normal">
                              {c.email || 'No email'} {c.phone ? `· ${c.phone}` : ''} {c.service_address ? `· ${c.service_address}` : ''}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Client Editable Input Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Client Name *</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer full name..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442] bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Client Email</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="client@example.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442] bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Client Phone</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. (647) 555-0199"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442] bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Property / Service Address</label>
                    <input
                      type="text"
                      value={propertyAddress}
                      onChange={(e) => setPropertyAddress(e.target.value)}
                      placeholder="e.g. 123 Maple Street, Richmond Hill, ON"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442] bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Salesperson / Estimator Details */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Salesperson / Estimator
                  </label>
                  {staffProfiles.length > 0 && (
                    <select
                      onChange={(e) => {
                        const s = staffProfiles.find(p => p.id === e.target.value);
                        if (s) {
                          setExpertName(s.full_name || '');
                          setExpertEmail(s.email || '');
                          if (s.phone) setExpertPhone(s.phone);
                          setExpertRole(s.role === 'admin' ? 'Project Consultant' : 'Insulation Specialist');
                        }
                      }}
                      defaultValue=""
                      className="text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1 bg-white cursor-pointer"
                    >
                      <option value="" disabled>Assign from team...</option>
                      {staffProfiles.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name} ({s.role || 'Staff'})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Estimator Name *</label>
                    <input
                      type="text"
                      value={expertName}
                      onChange={(e) => setExpertName(e.target.value)}
                      placeholder="e.g. Space Insulation Expert"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442] bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Role / Title</label>
                    <input
                      type="text"
                      value={expertRole}
                      onChange={(e) => setExpertRole(e.target.value)}
                      placeholder="e.g. Insulation Specialist"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442] bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Estimator Phone</label>
                    <input
                      type="tel"
                      value={expertPhone}
                      onChange={(e) => setExpertPhone(e.target.value)}
                      placeholder="647-704-9021"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442] bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Estimator Address</label>
                    <input
                      type="text"
                      value={expertAddress}
                      onChange={(e) => setExpertAddress(e.target.value)}
                      placeholder="10660 Yonge St, Richmond Hill"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442] bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 2: INTRODUCTION
               ───────────────────────────────────────────────────────────── */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h2 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">
                    Introduction & Scope
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Introduction Title</label>
                  <input
                    type="text"
                    value={introTitle}
                    onChange={(e) => setIntroTitle(e.target.value)}
                    placeholder="Estimate / Scope of Work"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#76C442] bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Header Image URL (Optional)</label>
                  <input
                    type="url"
                    value={headerImageUrl}
                    onChange={(e) => setHeaderImageUrl(e.target.value)}
                    placeholder="https://example.com/banner.jpg"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-[#76C442] bg-white"
                  />
                </div>
              </div>

              {/* Technician Inspection Notes + AI Scope Drafting */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[#5aa32a]" />
                    Technician Inspection Notes
                  </span>
                  <button
                    type="button"
                    onClick={handleDraftScopeOfWork}
                    disabled={isDrafting || !inspectionNotes.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#76C442] hover:bg-[#689F38] disabled:bg-slate-200 disabled:text-slate-400 text-[#151A2D] font-black text-[11px] uppercase tracking-wider rounded-lg shadow-2xs cursor-pointer transition-all border-none"
                  >
                    {isDrafting ? <Loader2 size={12} className="animate-spin" /> : <Edit2 size={12} />}
                    <span>{isDrafting ? 'Drafting...' : 'AI Scope of Work'}</span>
                  </button>
                </div>
                <textarea
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="e.g. Attic access in hallway tight, existing R-12 fiberglass batt, drafty hatches. Recommend adding baffles and blowing in Owens Corning to R-60."
                  className="w-full h-18 p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#76C442] bg-white"
                />
              </div>

              {/* Introduction / Scope Text Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Scope of Work Text</label>
                  {aiDrafted && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      AI-drafted scope
                    </span>
                  )}
                </div>
                <textarea
                  value={introText}
                  onChange={(e) => {
                    setIntroText(e.target.value);
                    if (aiDrafted) setAiDrafted(false);
                  }}
                  rows={4}
                  placeholder="Enter the project scope summary presented to the customer..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-normal leading-relaxed focus:outline-none focus:border-[#76C442] bg-white"
                />
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 3: PRODUCTS & SERVICES
               ───────────────────────────────────────────────────────────── */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h2 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">
                    Products & Services
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {lineItems.length} {lineItems.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              {/* Line Items Container */}
              <div className="space-y-3">
                {lineItems.map((item, index) => {
                  const isItem = item.type === 'item';
                  const qty = Number(item.quantity) || 0;
                  const price = Number(item.unit_price) || 0;
                  const lineTotal = qty * price;

                  if (!isItem) {
                    // TEXT SECTION CARD
                    return (
                      <div 
                        key={item.id} 
                        className="p-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 space-y-3 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white">
                              Text Section
                            </span>
                            <span className="text-[11px] text-slate-400 italic">No price or quantity</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveLineItem(index, 'up')}
                              disabled={index === 0}
                              className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveLineItem(index, 'down')}
                              disabled={index === lineItems.length - 1}
                              className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeLineItem(item.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer ml-1"
                              title="Remove section"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateLineItem(item.id, 'name', e.target.value)}
                            placeholder="Section Title (e.g. Important Information, Warranty & Guarantee)"
                            className="w-full px-3 py-1.5 border border-indigo-200 rounded-lg text-xs font-bold text-[#151A2D] bg-white focus:outline-none focus:border-indigo-500"
                          />
                          <textarea
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            rows={2}
                            placeholder="Detailed text description for this section..."
                            className="w-full p-2.5 border border-indigo-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    );
                  }

                  // PRICED SERVICE LINE ITEM CARD
                  return (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        item.is_optional 
                          ? 'border-amber-200 bg-amber-50/20' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Top Row: Reorder, Name, Qty, Rate, Total, Trash */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Reorder arrows */}
                        <div className="flex items-center gap-1 text-slate-400">
                          <button
                            type="button"
                            onClick={() => moveLineItem(index, 'up')}
                            disabled={index === 0}
                            className="p-1 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLineItem(index, 'down')}
                            disabled={index === lineItems.length - 1}
                            className="p-1 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>

                        {/* Line Item Name */}
                        <div className="flex-grow space-y-0.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block sm:hidden">Item Name</label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateLineItem(item.id, 'name', e.target.value)}
                            placeholder="Item Name (e.g. Blown-in Attic Insulation)"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-[#151A2D] bg-white focus:outline-none focus:border-[#76C442]"
                          />
                        </div>

                        {/* Quantity */}
                        <div className="w-20 space-y-0.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block sm:hidden">Qty</label>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              updateLineItem(item.id, 'quantity', val);
                            }}
                            placeholder="1"
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center bg-white focus:outline-none focus:border-[#76C442]"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="w-28 space-y-0.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block sm:hidden">Unit Price</label>
                          <div className="relative">
                            <span className="absolute left-2 top-1.5 text-xs text-slate-400">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                updateLineItem(item.id, 'unit_price', val);
                              }}
                              placeholder="0.00"
                              className="w-full pl-5 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-right bg-white focus:outline-none focus:border-[#76C442]"
                            />
                          </div>
                        </div>

                        {/* Line Total */}
                        <div className="w-28 text-right flex flex-col justify-center">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block sm:hidden">Total</label>
                          <span className={`text-xs font-mono font-black ${item.is_optional ? 'text-amber-700 line-through decoration-slate-400' : 'text-[#151A2D]'}`}>
                            ${lineTotal.toFixed(2)}
                          </span>
                          {item.is_optional && (
                            <span className="text-[9px] text-amber-700 font-bold uppercase">Optional</span>
                          )}
                        </div>

                        {/* Delete button */}
                        <div>
                          <button
                            type="button"
                            onClick={() => removeLineItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Description input */}
                      <div>
                        <textarea
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          rows={2}
                          placeholder="Line item description or material specifications..."
                          className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-600 bg-white focus:outline-none focus:border-[#76C442]"
                        />
                      </div>

                      {/* Item Options Bar: Optional, Recommended, Image URL */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-4">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 select-none">
                            <input
                              type="checkbox"
                              checked={item.is_optional}
                              onChange={(e) => updateLineItem(item.id, 'is_optional', e.target.checked)}
                              className="rounded border-slate-300 text-[#76C442] focus:ring-[#76C442]"
                            />
                            <span>Optional item</span>
                            <span className="text-[10px] text-slate-400 font-normal">(excluded from base total)</span>
                          </label>

                          <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 select-none">
                            <input
                              type="checkbox"
                              checked={item.is_recommended}
                              onChange={(e) => updateLineItem(item.id, 'is_recommended', e.target.checked)}
                              className="rounded border-slate-300 text-[#76C442] focus:ring-[#76C442]"
                            />
                            <span>Recommended</span>
                          </label>
                        </div>

                        {/* Image URL toggle/input */}
                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                          <ImageIcon size={12} className="text-slate-400" />
                          <input
                            type="url"
                            value={item.image_url || ''}
                            onChange={(e) => updateLineItem(item.id, 'image_url', e.target.value)}
                            placeholder="Line item image URL..."
                            className="px-2 py-1 border border-slate-200 rounded text-[11px] w-full sm:w-48 bg-white focus:outline-none focus:border-[#76C442]"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add buttons */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={addLineItem}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus size={13} className="text-[#5aa32a] stroke-[3]" />
                  <span>Add Line Item</span>
                </button>

                <button
                  type="button"
                  onClick={addTextSection}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <Plus size={13} className="text-indigo-600 stroke-[3]" />
                  <span>Add Text Section</span>
                </button>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 4: PRICING & DISCOUNTS
               ───────────────────────────────────────────────────────────── */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <h2 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">
                    Pricing & Discounts
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Discount configuration */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                    Discount
                  </label>
                  
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['none', 'percentage', 'fixed'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setDiscountType(mode)}
                        className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          discountType === mode
                            ? 'bg-[#151A2D] text-white border-[#151A2D] shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {mode === 'none' && 'No Discount'}
                        {mode === 'percentage' && 'Percentage (%)'}
                        {mode === 'fixed' && 'Fixed ($)'}
                      </button>
                    ))}
                  </div>

                  {discountType !== 'none' && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">
                        {discountType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount ($)'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs text-slate-400">
                          {discountType === 'percentage' ? '%' : '$'}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step={discountType === 'percentage' ? '1' : '0.01'}
                          value={discountValue}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setDiscountValue(val);
                          }}
                          placeholder={discountType === 'percentage' ? '10' : '150.00'}
                          className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white focus:outline-none focus:border-[#76C442]"
                        />
                      </div>
                      {discountAmount > 0 && (
                        <p className="text-[11px] text-emerald-700 font-bold mt-1">
                          Calculated discount: -{formatCurrency(discountAmount)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Tax Rate configuration */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                    Tax Rate
                  </label>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value))}
                        className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white focus:outline-none focus:border-[#76C442]"
                      />
                      <span className="text-xs font-semibold text-slate-600">
                        = {(taxRate * 100).toFixed(1)}% ({taxRate === 0.13 ? 'Ontario 13% HST' : 'Custom Tax'})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 italic">
                      Tax is calculated on the discounted subtotal.
                    </p>
                  </div>
                </div>
              </div>

              {/* Exact Calculation Display Breakdown */}
              <div className="pt-3 border-t border-slate-100 divide-y divide-slate-100 text-xs text-slate-700">
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 font-medium">Line Item Subtotal (non-optional):</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between py-1.5 text-emerald-700">
                    <span className="font-medium">Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Fixed'}):</span>
                    <span className="font-mono font-bold">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 font-medium">Discounted Subtotal:</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(discountedSubtotal)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 font-medium">HST ({(taxRate * 100).toFixed(1)}%):</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between py-2 text-sm">
                  <span className="font-black text-[#151A2D] uppercase">Quote Total:</span>
                  <span className="font-mono font-black text-emerald-600 text-base">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 5: DEPOSIT
               ───────────────────────────────────────────────────────────── */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    5
                  </div>
                  <h2 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">
                    Deposit Requirements
                  </h2>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  Deposit Required
                </label>

                <div className="flex flex-wrap gap-4">
                  {(['none', 'percentage', 'fixed'] as const).map((mode) => (
                    <label key={mode} className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                      <input
                        type="radio"
                        name="deposit_type"
                        checked={depositType === mode}
                        onChange={() => setDepositType(mode)}
                        className="text-[#76C442] focus:ring-[#76C442]"
                      />
                      <span>
                        {mode === 'none' && 'No Deposit'}
                        {mode === 'percentage' && 'Percentage (%)'}
                        {mode === 'fixed' && 'Fixed Amount ($)'}
                      </span>
                    </label>
                  ))}
                </div>

                {depositType !== 'none' && (
                  <div className="flex items-center gap-4 pt-2">
                    <div className="w-40">
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs text-slate-400">
                          {depositType === 'percentage' ? '%' : '$'}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step={depositType === 'percentage' ? '1' : '0.01'}
                          value={depositValue}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setDepositValue(val);
                          }}
                          placeholder={depositType === 'percentage' ? '50' : '500.00'}
                          className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white focus:outline-none focus:border-[#76C442]"
                        />
                      </div>
                    </div>

                    <div className="text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg">
                      Calculated deposit: {formatCurrency(depositAmount)} {depositType === 'percentage' && `(${depositValue}% of total)`}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 6: CLIENT VIEW SETTINGS
               ───────────────────────────────────────────────────────────── */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    6
                  </div>
                  <h2 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">
                    Client View Settings
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  What should the client see on their quotation?
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer select-none bg-slate-50 p-3 rounded-xl border border-slate-200 hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={clientViewSettings.show_quantity}
                    onChange={(e) => setClientViewSettings({ ...clientViewSettings, show_quantity: e.target.checked })}
                    className="rounded border-slate-300 text-[#76C442] focus:ring-[#76C442]"
                  />
                  <span>Quantity</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer select-none bg-slate-50 p-3 rounded-xl border border-slate-200 hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={clientViewSettings.show_unit_price}
                    onChange={(e) => setClientViewSettings({ ...clientViewSettings, show_unit_price: e.target.checked })}
                    className="rounded border-slate-300 text-[#76C442] focus:ring-[#76C442]"
                  />
                  <span>Unit Price</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer select-none bg-slate-50 p-3 rounded-xl border border-slate-200 hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={clientViewSettings.show_line_item_totals}
                    onChange={(e) => setClientViewSettings({ ...clientViewSettings, show_line_item_totals: e.target.checked })}
                    className="rounded border-slate-300 text-[#76C442] focus:ring-[#76C442]"
                  />
                  <span>Line Item Totals</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer select-none bg-slate-50 p-3 rounded-xl border border-slate-200 hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={clientViewSettings.show_total}
                    onChange={(e) => setClientViewSettings({ ...clientViewSettings, show_total: e.target.checked })}
                    className="rounded border-slate-300 text-[#76C442] focus:ring-[#76C442]"
                  />
                  <span>Quote Total</span>
                </label>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 7: CLIENT MESSAGE & TERMS
               ───────────────────────────────────────────────────────────── */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    7
                  </div>
                  <h2 className="text-sm font-black text-[#151A2D] uppercase tracking-wider m-0">
                    Client Message & Terms
                  </h2>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Message to Client</label>
                  <textarea
                    value={clientMessage}
                    onChange={(e) => setClientMessage(e.target.value)}
                    rows={2}
                    placeholder="Personal note displayed at the top or introduction of proposal..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-[#76C442]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Contract / Disclaimer</label>
                  <textarea
                    value={contractDisclaimer}
                    onChange={(e) => setContractDisclaimer(e.target.value)}
                    rows={2}
                    placeholder="Legal disclaimer, building code conformance, validity period..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-[#76C442]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Terms & Conditions</label>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    rows={2}
                    placeholder="Payment milestones, warranties, customer prep requirements..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-[#76C442]"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 8: STICKY SUMMARY PANEL (Right 4 cols)
             ───────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Commercial Proposal
                </span>
                <h3 className="text-base font-black text-[#151A2D] m-0">
                  Quote Summary
                </h3>
              </div>

              {/* Items summary */}
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Line Items Subtotal</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(subtotal)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-emerald-700">
                    <span>Discount</span>
                    <span className="font-mono font-bold">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-slate-600 border-t border-slate-100 pt-1.5">
                    <span>Discounted Subtotal</span>
                    <span className="font-mono font-bold text-slate-800">{formatCurrency(discountedSubtotal)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-600">
                  <span>HST ({(taxRate * 100).toFixed(1)}%)</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(tax)}</span>
                </div>

                <div className="border-t-2 border-slate-200 pt-3 flex justify-between items-baseline">
                  <div>
                    <span className="text-xs font-black text-[#151A2D] uppercase block">Total</span>
                    <span className="text-[10px] text-slate-400">Includes all taxes</span>
                  </div>
                  <span className="text-2xl font-mono font-black text-[#5aa32a]">
                    {formatCurrency(total)}
                  </span>
                </div>

                {depositAmount > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex justify-between items-center font-bold text-indigo-950">
                      <span>Deposit Required</span>
                      <span className="font-mono">{formatCurrency(depositAmount)}</span>
                    </div>
                    <span className="text-[10px] text-indigo-700 block">
                      {depositType === 'percentage' ? `${depositValue}% of total amount` : 'Fixed upfront deposit'}
                    </span>
                  </div>
                )}

                {optionalItemsTotal > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex justify-between items-center font-bold text-amber-950">
                      <span>Optional Upgrades</span>
                      <span className="font-mono">{formatCurrency(optionalItemsTotal)}</span>
                    </div>
                    <span className="text-[10px] text-amber-800 block">
                      Excluded from base quote. Customer can approve individually.
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (validateQuoteInputs()) {
                      setSendEmailAddress(customerEmail);
                      setShowSendModal(true);
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <Send size={14} />
                  <span>Send Quote to Client</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAsDraft}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer bg-white"
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-slate-500 hover:text-slate-800 font-semibold text-xs transition-colors cursor-pointer border-none bg-transparent"
                >
                  <Eye size={13} />
                  <span>Open Full Document Preview</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            STAGE 2: LETTERHEAD DOCUMENT PREVIEW
           ───────────────────────────────────────────────────────────── */
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Options Header panel */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 print:hidden shadow-xs">
            <div className="text-xs text-slate-600 font-semibold text-center md:text-left">
              Reviewing client letterhead layout for <strong>{title}</strong>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setStage('form')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer min-h-[40px]"
              >
                <Edit2 size={13} />
                <span>Edit Inputs</span>
              </button>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer min-h-[40px]"
              >
                <Printer size={13} />
                <span>Print</span>
              </button>

              <button
                onClick={handleSaveAsDraft}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-[#151A2D] hover:bg-slate-100 text-[#151A2D] font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer min-h-[40px]"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Save Draft</span>
              </button>

              <button
                onClick={() => setShowSendModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] font-black text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors cursor-pointer min-h-[40px]"
              >
                <Send size={13} />
                <span>Send Quote</span>
              </button>
            </div>
          </div>

          {/* Letter style white page container */}
          <div className="bg-white border border-slate-200 shadow-xl p-6 md:p-14 space-y-8 min-h-[700px] flex flex-col justify-between rounded-xl">
            
            <div className="space-y-8">
              {/* Optional Header Hero Image */}
              {headerImageUrl && (
                <div className="w-full h-36 rounded-xl overflow-hidden mb-4">
                  <img src={headerImageUrl} alt="Header" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Header Letterhead */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 border-b-2 border-[#151A2D] pb-6">
                <div className="flex items-center gap-3">
                  <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain rounded" />
                  <div>
                    <h1 className="text-xl font-black text-[#151A2D] tracking-tight m-0">SPACE INSULATION</h1>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold block">Ontario's Trusted Insulation Experts</span>
                  </div>
                </div>
                <div className="text-left md:text-right text-xs space-y-0.5 text-slate-600 font-medium">
                  <div>Date Issued: {new Date().toLocaleDateString()}</div>
                  <div className="font-bold text-[#151A2D]">Reference: {nextEstimateNumber}</div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center">
                <h2 className="text-xl font-black text-[#151A2D] tracking-tight uppercase m-0">
                  {title || 'Insulation Estimate'}
                </h2>
                <div className="text-xs font-bold text-slate-500 mt-1">{introTitle}</div>
              </div>

              {/* Client and Expert Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Prepared For</span>
                  <div className="font-bold text-sm text-[#151A2D]">{customerName}</div>
                  {customerPhone && <div className="text-slate-600">📞 {customerPhone}</div>}
                  {customerEmail && <div className="text-slate-600">✉ {customerEmail}</div>}
                  {propertyAddress && <div className="text-slate-800 font-semibold pt-1">📍 {propertyAddress}</div>}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Your Estimator</span>
                  <div className="font-bold text-sm text-[#151A2D]">{expertName} <span className="font-normal text-xs text-slate-500">({expertRole})</span></div>
                  {expertPhone && <div className="text-slate-600">📞 {expertPhone}</div>}
                  {expertEmail && <div className="text-slate-600">✉ {expertEmail}</div>}
                  {expertAddress && <div className="text-slate-600">📍 {expertAddress}</div>}
                </div>
              </div>

              {/* Introduction / Scope Text */}
              {introText && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Scope Description</span>
                  <p className="text-xs leading-relaxed italic text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200 m-0">
                    "{introText}"
                  </p>
                </div>
              )}

              {/* Products & Services Table */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#151A2D] border-b border-slate-200 pb-2 m-0">
                  Products & Services
                </h3>

                <div className="divide-y divide-slate-100">
                  {lineItems.map((item, idx) => {
                    if (item.type === 'section') {
                      return (
                        <div key={item.id} className="py-3 bg-slate-50 px-3 rounded-lg my-2">
                          <h4 className="text-xs font-bold text-[#151A2D] uppercase tracking-wide m-0">{item.name}</h4>
                          {item.description && <p className="text-xs text-slate-600 mt-1 m-0">{item.description}</p>}
                        </div>
                      );
                    }

                    const qty = Number(item.quantity) || 0;
                    const price = Number(item.unit_price) || 0;
                    const lineTotal = qty * price;

                    return (
                      <div key={item.id} className="py-3 flex justify-between items-start text-xs">
                        <div className="space-y-0.5 max-w-lg">
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <span>{item.name || `Line Item #${idx + 1}`}</span>
                            {item.is_recommended && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                Recommended
                              </span>
                            )}
                            {item.is_optional && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                Optional
                              </span>
                            )}
                          </div>
                          {item.description && <p className="text-slate-500 text-[11px] m-0">{item.description}</p>}
                          <div className="text-[10px] text-slate-400 font-normal pt-0.5">
                            {clientViewSettings.show_quantity && `Qty: ${qty}`}
                            {clientViewSettings.show_quantity && clientViewSettings.show_unit_price && ' · '}
                            {clientViewSettings.show_unit_price && `Unit: ${formatCurrency(price)}`}
                          </div>
                        </div>

                        {clientViewSettings.show_line_item_totals && (
                          <span className={`font-mono font-bold ${item.is_optional ? 'text-amber-700' : 'text-slate-900'}`}>
                            {formatCurrency(lineTotal)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total calculations */}
              <div className="border-t-2 border-slate-200 pt-6 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-emerald-700">
                    <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Fixed'})</span>
                    <span className="font-mono font-bold">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-slate-600">
                  <span>HST ({(taxRate * 100).toFixed(1)}%)</span>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(tax)}</span>
                </div>
                {clientViewSettings.show_total && (
                  <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                    <span className="text-sm font-black text-[#151A2D] uppercase tracking-wider">Quote Total</span>
                    <span className="text-xl font-mono font-black text-[#5aa32a]">{formatCurrency(total)}</span>
                  </div>
                )}
                {depositAmount > 0 && (
                  <div className="flex justify-between items-center text-indigo-900 pt-1 font-semibold">
                    <span>Deposit Required Upon Approval</span>
                    <span className="font-mono font-bold">{formatCurrency(depositAmount)}</span>
                  </div>
                )}
              </div>

              {/* Client Message, Disclaimers, Terms */}
              {(clientMessage || contractDisclaimer || terms) && (
                <div className="border-t border-slate-200 pt-6 space-y-4 text-xs">
                  {clientMessage && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Note to Client</span>
                      <p className="text-slate-700 m-0">{clientMessage}</p>
                    </div>
                  )}
                  {contractDisclaimer && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Disclaimer</span>
                      <p className="text-slate-500 text-[11px] leading-relaxed m-0">{contractDisclaimer}</p>
                    </div>
                  )}
                  {terms && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Terms & Conditions</span>
                      <p className="text-slate-500 text-[11px] leading-relaxed m-0">{terms}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 pt-6 text-center text-[10px] text-slate-500 space-y-1 font-medium">
              <div className="font-bold text-[#151A2D]">{COMPANY_DETAILS.name}</div>
              <div>Phone: {COMPANY_DETAILS.phone} | Email: {COMPANY_DETAILS.email}</div>
              <div>Website: {COMPANY_DETAILS.website}</div>
            </div>

          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          EMAIL CONFIRMATION MODAL
         ───────────────────────────────────────────────────────────── */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs"
            onClick={() => setShowSendModal(false)}
          />

          <div className="relative bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-10 flex flex-col">
            <div className="p-4 bg-[#151A2D] text-white flex items-center gap-2">
              <Send size={16} className="text-[#76C442]" />
              <h3 className="text-sm font-bold text-white m-0">Send Quote Confirmation</h3>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Recipient Email *</label>
                <input
                  type="email"
                  value={sendEmailAddress}
                  onChange={(e) => setSendEmailAddress(e.target.value)}
                  placeholder="Enter recipient email..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Personal Message (Optional)</label>
                <textarea
                  value={coordinatorMessage}
                  onChange={(e) => setCoordinatorMessage(e.target.value)}
                  placeholder="Hello, please review your custom attic insulation quote..."
                  rows={3}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#76C442]"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                className="px-3.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmSendEmail}
                disabled={isSending}
                className="px-4 py-1.5 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-lg transition-all shadow-sm cursor-pointer border-none"
              >
                {isSending ? <Loader2 size={12} className="animate-spin mr-1 inline" /> : null}
                <span>Dispatch Email</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          INLINE QUICK CUSTOMER CREATOR MODAL
         ───────────────────────────────────────────────────────────── */}
      {newCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs" 
            onClick={() => { if (!creatingCustomer) setNewCustomerModalOpen(false); }}
          />

          <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-slate-200 z-10 flex flex-col">
            <div className="p-4 bg-[#151A2D] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-[#76C442] stroke-[3]" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider m-0">Create New Customer</h3>
              </div>
              <button
                onClick={() => setNewCustomerModalOpen(false)}
                className="text-slate-400 hover:text-white border-none bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-800">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Customer Name *</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Email Address</label>
                <input
                  type="email"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  placeholder="e.g. johndoe@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Phone Number</label>
                <input
                  type="tel"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="e.g. (647) 555-0000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Service Address *</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="e.g. 100 Main St, Richmond Hill, ON"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#76C442]"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={creatingCustomer}
                onClick={() => setNewCustomerModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
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
