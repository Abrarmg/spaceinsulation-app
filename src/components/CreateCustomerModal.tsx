import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Loader2, CheckCircle2, AlertCircle, Check, ChevronDown, ChevronUp, ClipboardCheck, Plus } from 'lucide-react';

export const CUSTOMER_NEEDS_OPTIONS = [
  { id: 'blowing_insulation', label: 'Blowing insulation' },
  { id: 'removing_insulation', label: 'Removing insulation' },
  { id: 'mold_removal', label: 'Mold removal' },
  { id: 'baffles', label: 'Baffles' },
  { id: 'batt_insulation_attic', label: 'Batt Insulation around the Attic' },
  { id: 'replace_bathroom_pipe', label: 'Replace the bathroom pipe' },
  { id: 'spray_foam_bathroom_pipe', label: 'Spray foam around bathroom pipe' },
  { id: 'garage_insulation', label: 'Garage insulation' },
] as const;

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  service_address: string | null;
  billing_address: string | null;
  preferred_contact_method: string | null;
  notes?: string | null;
  inquiry_date?: string | null;
  customer_needs?: string[] | null;
  square_footage?: number | null;
  asked_about_rebate?: boolean | null;
}

interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerToEdit?: Customer | null;
}

export const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  customerToEdit = null
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [preferredContact, setPreferredContact] = useState('email');
  const [notes, setNotes] = useState('');

  // Customer Intake / Project Requirements
  const [inquiryDate, setInquiryDate] = useState('');
  const [customerNeeds, setCustomerNeeds] = useState<string[]>([]);
  const [squareFootage, setSquareFootage] = useState<number | ''>('');
  const [askedAboutRebate, setAskedAboutRebate] = useState<boolean | null>(null);

  // Optional Initial Inspection state (when creating new customer)
  const [includeInspection, setIncludeInspection] = useState(false);
  const [inspCurrentRValue, setInspCurrentRValue] = useState('');
  const [inspTargetRValue, setInspTargetRValue] = useState('R-60');
  const [inspSqft, setInspSqft] = useState<number | ''>('');
  const [inspInsulationType, setInspInsulationType] = useState('Fiberglass');
  const [inspDepth, setInspDepth] = useState('');
  const [inspBaffles, setInspBaffles] = useState('');
  const [inspGeneralCondition, setInspGeneralCondition] = useState('');
  const [inspNotes, setInspNotes] = useState('');
  
  // Validation/UI states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isEditMode = !!customerToEdit;

  useEffect(() => {
    if (isOpen) {
      if (customerToEdit) {
        // Strip [ARCHIVED] tag for the form display
        let displayNotes = customerToEdit.notes || '';
        if (displayNotes.startsWith('[ARCHIVED]')) {
          displayNotes = displayNotes.replace('[ARCHIVED]', '').trim();
        }

        setFullName(customerToEdit.full_name || '');
        setPhone(customerToEdit.phone || '');
        setEmail(customerToEdit.email || '');
        setServiceAddress(customerToEdit.service_address || '');
        setBillingAddress(customerToEdit.billing_address || '');
        setPreferredContact(customerToEdit.preferred_contact_method || 'email');
        setNotes(displayNotes);

        // Populate intake fields on edit
        setInquiryDate(
          customerToEdit.inquiry_date
            ? customerToEdit.inquiry_date.split('T')[0]
            : new Date().toISOString().split('T')[0]
        );
        setCustomerNeeds(customerToEdit.customer_needs || []);
        setSquareFootage(
          customerToEdit.square_footage !== undefined && customerToEdit.square_footage !== null
            ? customerToEdit.square_footage
            : ''
        );
        setAskedAboutRebate(
          customerToEdit.asked_about_rebate !== undefined
            ? customerToEdit.asked_about_rebate
            : null
        );
      } else {
        setFullName('');
        setPhone('');
        setEmail('');
        setServiceAddress('');
        setBillingAddress('');
        setPreferredContact('email');
        setNotes('');

        // Default today on create
        setInquiryDate(new Date().toISOString().split('T')[0]);
        setCustomerNeeds([]);
        setSquareFootage('');
        setAskedAboutRebate(null);

        // Reset optional inspection fields
        setIncludeInspection(false);
        setInspCurrentRValue('');
        setInspTargetRValue('R-60');
        setInspSqft('');
        setInspInsulationType('Fiberglass');
        setInspDepth('');
        setInspBaffles('');
        setInspGeneralCondition('');
        setInspNotes('');
      }
      setErrors({});
      setNotification(null);
    }
  }, [isOpen, customerToEdit]);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full Name is required.';
    }

    if (email.trim() && !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (phone.trim() && !/^\+?[0-9\s\-()]{7,20}$/.test(phone)) {
      newErrors.phone = 'Please enter a valid phone number.';
    }

    if (squareFootage !== '' && (isNaN(Number(squareFootage)) || Number(squareFootage) < 0)) {
      newErrors.squareFootage = 'Square footage must be a non-negative number.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleCustomerNeed = (needId: string) => {
    setCustomerNeeds((prev) =>
      prev.includes(needId) ? prev.filter((id) => id !== needId) : [...prev, needId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    // Keep [ARCHIVED] tag if the edited contact was archived
    let finalNotes = notes.trim();
    if (isEditMode && customerToEdit?.notes?.includes('[ARCHIVED]')) {
      finalNotes = `[ARCHIVED] ${notes.trim()}`.trim();
    }

    const payload: any = {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      service_address: serviceAddress.trim() || null,
      billing_address: billingAddress.trim() || (serviceAddress.trim() || null),
      inquiry_date: inquiryDate || null,
      customer_needs: customerNeeds.length > 0 ? customerNeeds : null,
      square_footage: squareFootage !== '' ? Number(squareFootage) : null,
      asked_about_rebate: askedAboutRebate,
      preferred_contact_method: preferredContact,
      notes: finalNotes || null,
      updated_at: new Date().toISOString()
    };

    if (!isEditMode) {
      payload.source = 'manual';
      payload.created_from = 'manual_ui';
      payload.contact_type = 'prospect';
      payload.is_archived = false;
    }

    try {
      if (isEditMode && customerToEdit) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', customerToEdit.id);

        if (error) throw error;
        setNotification({ type: 'success', message: 'Contact updated successfully!' });
      } else {
        const { data: insertedCustomer, error } = await supabase
          .from('customers')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        // If optional initial inspection was enabled, create the initial inspection report
        if (includeInspection && insertedCustomer?.id) {
          const inspectionPayload = {
            customer_id: insertedCustomer.id,
            inspection_date: inquiryDate || new Date().toISOString().split('T')[0],
            status: 'draft',
            current_r_value: inspCurrentRValue.trim() || null,
            target_r_value: inspTargetRValue.trim() || 'R-60',
            attic_sqft: inspSqft !== '' ? Number(inspSqft) : (squareFootage !== '' ? Number(squareFootage) : null),
            current_insulation_type: inspInsulationType || 'Fiberglass',
            insulation_depth: inspDepth.trim() || null,
            soffits_baffles_condition: inspBaffles.trim() || null,
            general_condition: inspGeneralCondition.trim() || null,
            notes: inspNotes.trim() || null
          };
          const { error: inspErr } = await supabase
            .from('inspection_reports')
            .insert([inspectionPayload]);
          if (inspErr) {
            console.error('Failed to create initial inspection report:', inspErr);
          }
        }

        setNotification({ type: 'success', message: 'Contact created successfully!' });
      }
      
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 800);
    } catch (err: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'inserting'} customer:`, err);
      setNotification({
        type: 'error',
        message: err.message || `An error occurred while ${isEditMode ? 'saving' : 'creating'} the customer.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyServiceAddressToBilling = () => {
    setBillingAddress(serviceAddress);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-2xl mx-4 rounded-xl shadow-2xl overflow-hidden border border-[#E7E9ED] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#E7E9ED] bg-[#151A2D] text-white shrink-0">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white m-0">
            {isEditMode ? 'Edit Contact Details' : 'Create New Contact'}
          </h2>
          <button 
            onClick={onClose}
            className="text-[#737A86] hover:text-white transition-colors cursor-pointer border-none bg-transparent"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-5">
          
          {notification && (
            <div className={`p-3.5 rounded-lg flex items-start gap-3 text-xs font-semibold ${
              notification.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              )}
              <span>{notification.message}</span>
            </div>
          )}

          {/* Section 1: Contact Information */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-1">
              Contact Information
            </h3>
            
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Khder Qassim"
                className={`w-full px-3 py-2 border rounded-lg text-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#76C442]/15 ${
                  errors.fullName ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-[#E6E8EC] focus:border-[#76C442]'
                }`}
              />
              {errors.fullName && (
                <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> {errors.fullName}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 555-123-4567"
                  className={`w-full px-3 py-2 border rounded-lg text-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#76C442]/15 ${
                    errors.phone ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-[#E6E8EC] focus:border-[#76C442]'
                  }`}
                />
                {errors.phone && (
                  <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> {errors.phone}
                  </span>
                )}
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. khder@gmail.com"
                  className={`w-full px-3 py-2 border rounded-lg text-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#76C442]/15 ${
                    errors.email ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-[#E6E8EC] focus:border-[#76C442]'
                  }`}
                />
                {errors.email && (
                  <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> {errors.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Property Details */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-1">
              Property Details
            </h3>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                Service Address
              </label>
              <input
                type="text"
                value={serviceAddress}
                onChange={(e) => setServiceAddress(e.target.value)}
                placeholder="Street Address, City, State, ZIP"
                className="w-full px-3 py-2 border border-[#E6E8EC] rounded-lg text-xs transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/15"
              />
            </div>

            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider">
                  Billing Address
                </label>
                {serviceAddress.trim() && (
                  <button
                    type="button"
                    onClick={copyServiceAddressToBilling}
                    className="text-[10px] font-bold text-[#76C442] hover:underline cursor-pointer border-none bg-transparent"
                  >
                    Copy Service Address
                  </button>
                )}
              </div>
              <input
                type="text"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Leave empty if same as Service Address"
                className="w-full px-3 py-2 border border-[#E6E8EC] rounded-lg text-xs transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/10"
              />
            </div>
          </div>

          {/* Section 3: Project Requirements */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-1">
              Project Requirements
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Inquiry Date
                </label>
                <input
                  type="date"
                  value={inquiryDate}
                  onChange={(e) => setInquiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8EC] rounded-lg text-xs transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/15 bg-white text-[#151A2D]"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Square Footage (SQFT)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={squareFootage}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setSquareFootage('');
                      } else {
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 0) {
                          setSquareFootage(num);
                        }
                      }
                    }}
                    placeholder="e.g. 1,500"
                    className={`w-full px-3 py-2 pr-14 border rounded-lg text-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#76C442]/15 ${
                      errors.squareFootage ? 'border-red-500 bg-red-50' : 'border-[#E6E8EC] focus:border-[#76C442]'
                    }`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#737A86] bg-[#F6F7F9] px-2 py-0.5 rounded border border-[#E7E9ED] select-none pointer-events-none">
                    SQFT
                  </span>
                </div>
                {errors.squareFootage && (
                  <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> {errors.squareFootage}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                Services Requested / Customer Needs
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CUSTOMER_NEEDS_OPTIONS.map((option) => {
                  const isSelected = customerNeeds.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleCustomerNeed(option.id)}
                      className={`px-3 py-2.5 rounded-lg border text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#76C442] bg-[#76C442]/10 text-[#151A2D] font-bold shadow-xs'
                          : 'border-[#E6E8EC] bg-white hover:bg-[#F6F7F9] text-[#737A86]'
                      }`}
                    >
                      <span className="truncate pr-2">{option.label}</span>
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                          isSelected
                            ? 'bg-[#151A2D] border-[#151A2D] text-[#76C442]'
                            : 'border-[#D1D5DB] bg-white'
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 4: Rebate */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-1">
              Rebate
            </h3>

            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider">
                  Asked About Rebates? / Eligible for Rebates?
                </label>
                {askedAboutRebate !== null && (
                  <button
                    type="button"
                    onClick={() => setAskedAboutRebate(null)}
                    className="text-[10px] text-[#737A86] hover:text-[#151A2D] underline cursor-pointer border-none bg-transparent"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5 max-w-xs">
                <button
                  type="button"
                  onClick={() => setAskedAboutRebate(askedAboutRebate === true ? null : true)}
                  className={`py-2 px-4 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[40px] ${
                    askedAboutRebate === true
                      ? 'border-[#76C442] bg-[#76C442]/15 text-[#151A2D] ring-2 ring-[#76C442]/20 font-black'
                      : 'border-[#E6E8EC] bg-white hover:bg-[#F6F7F9] text-[#737A86]'
                  }`}
                >
                  <span>Yes</span>
                  {askedAboutRebate === true && <Check size={12} className="text-[#151A2D]" strokeWidth={3} />}
                </button>

                <button
                  type="button"
                  onClick={() => setAskedAboutRebate(askedAboutRebate === false ? null : false)}
                  className={`py-2 px-4 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[40px] ${
                    askedAboutRebate === false
                      ? 'border-[#151A2D] bg-[#151A2D] text-white ring-2 ring-[#151A2D]/20 font-black'
                      : 'border-[#E6E8EC] bg-white hover:bg-[#F6F7F9] text-[#737A86]'
                  }`}
                >
                  <span>No</span>
                  {askedAboutRebate === false && <Check size={12} className="text-[#76C442]" strokeWidth={3} />}
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Communication Preferences */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-1">
              Communication Preferences
            </h3>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                Preferred Contact Method
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'email', label: '✉ Email' },
                  { id: 'phone', label: '☎ Phone' },
                  { id: 'text', label: '💬 Text' }
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`border rounded-lg p-2.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all min-h-[44px] ${
                      preferredContact === item.id
                        ? 'border-[#76C442] bg-[#76C442]/5 font-black text-[#151A2D]'
                        : 'border-[#E6E8EC] hover:bg-[#F6F7F9] text-[#737A86] font-semibold'
                    }`}
                  >
                    <input
                      type="radio"
                      name="preferredContact"
                      value={item.id}
                      checked={preferredContact === item.id}
                      onChange={() => setPreferredContact(item.id)}
                      className="sr-only"
                    />
                    <span>{item.label}</span>
                    {preferredContact === item.id && <span className="text-[#76C442] text-[9.5px]">✓</span>}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Section 6: Initial Attic Inspection / Current Condition (Optional) */}
          {!isEditMode && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#E7E9ED] pb-1">
                <div className="flex items-center gap-1.5">
                  <ClipboardCheck size={13} className="text-[#76C442]" />
                  <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider">
                    Initial Inspection / Current Condition (Optional)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIncludeInspection(!includeInspection)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer transition-colors border ${
                    includeInspection 
                      ? 'bg-[#151A2D] text-white border-[#151A2D]' 
                      : 'bg-[#F6F7F9] text-[#171A1F] hover:bg-[#E7E9ED] border-[#E7E9ED]'
                  }`}
                >
                  {includeInspection ? '✓ Inspection Enabled' : '+ Add Inspection Draft'}
                </button>
              </div>

              {includeInspection ? (
                <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E7E9ED] space-y-3 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1">
                        Current R-Value
                      </label>
                      <input
                        type="text"
                        value={inspCurrentRValue}
                        onChange={(e) => setInspCurrentRValue(e.target.value)}
                        placeholder="e.g. R-11 or R-19"
                        className="w-full px-3 py-2 border border-[#E6E8EC] focus:border-[#76C442] rounded-lg text-xs"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1">
                        Target R-Value
                      </label>
                      <input
                        type="text"
                        value={inspTargetRValue}
                        onChange={(e) => setInspTargetRValue(e.target.value)}
                        placeholder="e.g. R-60"
                        className="w-full px-3 py-2 border border-[#E6E8EC] focus:border-[#76C442] rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1">
                        Attic Sqft (if known)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={inspSqft}
                        onChange={(e) => setInspSqft(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder={squareFootage !== '' ? String(squareFootage) : 'e.g. 1300'}
                        className="w-full px-3 py-2 border border-[#E6E8EC] focus:border-[#76C442] rounded-lg text-xs"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1">
                        Current Insulation Type
                      </label>
                      <select
                        value={inspInsulationType}
                        onChange={(e) => setInspInsulationType(e.target.value)}
                        className="w-full px-3 py-2 border border-[#E6E8EC] focus:border-[#76C442] rounded-lg text-xs bg-white"
                      >
                        <option value="Fiberglass">Fiberglass (Batt or Blown)</option>
                        <option value="Cellulose">Cellulose (Blown)</option>
                        <option value="Rockwool">Rockwool / Mineral Wool</option>
                        <option value="Spray Foam">Spray Foam</option>
                        <option value="Vermiculite">Vermiculite</option>
                        <option value="None">None / Bare Attic Floor</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1">
                        Insulation Depth
                      </label>
                      <input
                        type="text"
                        value={inspDepth}
                        onChange={(e) => setInspDepth(e.target.value)}
                        placeholder="e.g. 3-4 inches"
                        className="w-full px-3 py-2 border border-[#E6E8EC] focus:border-[#76C442] rounded-lg text-xs"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1">
                        Soffits & Baffles Condition
                      </label>
                      <input
                        type="text"
                        value={inspBaffles}
                        onChange={(e) => setInspBaffles(e.target.value)}
                        placeholder="e.g. Cardboard baffles damaged, vents blocked"
                        className="w-full px-3 py-2 border border-[#E6E8EC] focus:border-[#76C442] rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1">
                      General Condition & Observations
                    </label>
                    <input
                      type="text"
                      value={inspGeneralCondition}
                      onChange={(e) => setInspGeneralCondition(e.target.value)}
                      placeholder="e.g. Dry attic, light mold around north soffit, old wiring"
                      className="w-full px-3 py-2 border border-[#E6E8EC] focus:border-[#76C442] rounded-lg text-xs"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-[#737A86] italic">
                  Optional: Click &quot;+ Add Inspection Draft&quot; to capture initial attic specs now. You can also upload field photos directly from the Contact Profile.
                </p>
              )}
            </div>
          )}

          {/* Section 7: CRM Notes */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-1">
              CRM Notes
            </h3>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                Internal Contact Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Customer prefers appointments after 4 PM. Gate access code is 2026."
                rows={3}
                className="w-full px-3 py-2 border border-[#E6E8EC] focus:border-[#76C442] rounded-lg text-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#76C442]/10"
              />
            </div>
          </div>

        </form>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-10 px-6 py-4 border-t border-[#E7E9ED] bg-[#F6F7F9] flex items-center justify-end gap-3 rounded-b-xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-[#E6E8EC] hover:bg-white text-[#737A86] hover:text-[#171A1F] text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 min-h-[38px]"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-lg shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 min-h-[38px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#151A2D]" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{isEditMode ? 'Save Changes' : 'Create Contact'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const CreateContactModal = CreateCustomerModal;
