import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  service_address: string;
  billing_address: string | null;
  preferred_contact_method: string | null;
  notes?: string | null;
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
      } else {
        setFullName('');
        setPhone('');
        setEmail('');
        setServiceAddress('');
        setBillingAddress('');
        setPreferredContact('email');
        setNotes('');
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

    if (!serviceAddress.trim()) {
      newErrors.serviceAddress = 'Service Address is required.';
    }

    if (email.trim() && !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (phone.trim() && !/^\+?[0-9\s\-()]{7,20}$/.test(phone)) {
      newErrors.phone = 'Please enter a valid phone number.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    // Keep [ARCHIVED] tag if the edited customer was archived
    let finalNotes = notes.trim();
    if (isEditMode && customerToEdit?.notes?.includes('[ARCHIVED]')) {
      finalNotes = `[ARCHIVED] ${notes.trim()}`.trim();
    }

    const payload = {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      service_address: serviceAddress.trim(),
      billing_address: billingAddress.trim() || serviceAddress.trim(),
      preferred_contact_method: preferredContact,
      notes: finalNotes || null
    };

    try {
      if (isEditMode && customerToEdit) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', customerToEdit.id);

        if (error) throw error;
        setNotification({ type: 'success', message: 'Customer updated successfully!' });
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([payload]);

        if (error) throw error;
        setNotification({ type: 'success', message: 'Customer created successfully!' });
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
      <div className="relative bg-white w-full max-w-xl mx-4 rounded-xl shadow-2xl overflow-hidden border border-[#E7E9ED] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E9ED] bg-[#151A2D] text-white">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white m-0">
            {isEditMode ? 'Edit Customer CRM Details' : 'Create New Customer Record'}
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

          {/* Section 1: Customer Information */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-1">
              Customer Information
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
                Service Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={serviceAddress}
                onChange={(e) => setServiceAddress(e.target.value)}
                placeholder="Street Address, City, State, ZIP"
                className={`w-full px-3 py-2 border rounded-lg text-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#76C442]/15 ${
                  errors.serviceAddress ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-[#E6E8EC] focus:border-[#76C442]'
                }`}
              />
              {errors.serviceAddress && (
                <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> {errors.serviceAddress}
                </span>
              )}
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

          {/* Section 3: Communication Preferences */}
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

          {/* Section 4: CRM Notes */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-1">
              CRM Notes
            </h3>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                Internal Customer Notes
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
        <div className="px-6 py-4 border-t border-[#E7E9ED] bg-[#F6F7F9] flex items-center justify-end gap-3 rounded-b-xl">
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
              <span>{isEditMode ? 'Save CRM Record' : 'Create Client'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
