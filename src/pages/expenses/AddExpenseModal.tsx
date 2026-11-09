import React, { useState, useEffect, useRef } from 'react';
import { X, Receipt, UploadCloud, AlertCircle, Loader2, Scan } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import type { Expense } from './types';
import { EXPENSE_CATEGORIES } from './types';
import { todayLocal } from '../../utils/dates';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: Partial<Expense>) => Promise<void>;
  expenseToEdit: Expense | null;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  expenseToEdit
}) => {
  const [description, setDescription] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [category, setCategory] = useState('Materials');
  const [amount, setAmount] = useState('');
  const [tax, setTax] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => todayLocal());
  const [paymentMethod, setPaymentMethod] = useState('Card');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (expenseToEdit) {
        setDescription(expenseToEdit.description || '');
        setVendorName(expenseToEdit.vendor_name || '');
        setCategory(expenseToEdit.category || 'Materials');
        setAmount(expenseToEdit.amount?.toString() || '');
        setTax(expenseToEdit.tax_amount?.toString() || '');
        setExpenseDate(expenseToEdit.expense_date || todayLocal());
        setPaymentMethod(expenseToEdit.payment_method || 'Card');
        setInvoiceNumber(expenseToEdit.invoice_number || '');
        setNotes(expenseToEdit.notes || '');
        setIsRecurring(expenseToEdit.is_recurring || false);
        setReceiptUrl(expenseToEdit.receipt_url || '');
      } else {
        // Reset form
        setDescription('');
        setVendorName('');
        setCategory('Materials');
        setAmount('');
        setTax('');
        setExpenseDate(todayLocal());
        setPaymentMethod('Card');
        setInvoiceNumber('');
        setNotes('');
        setIsRecurring(false);
        setReceiptUrl('');
      }
      setFormError(null);
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, expenseToEdit]);

  if (!isOpen && !isClosing) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setFormError(null);

    try {
      // 1. Compress image to save bandwidth and API cost
      const base64Image = await resizeImage(file);

      // 2. Call Edge Function
      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: { image: base64Image }
      });

      if (error) throw new Error(error.message || 'Failed to scan receipt');
      if (data?.error) throw new Error(data.error);

      // 3. Populate form fields
      if (data) {
        if (data.vendor_name) setVendorName(data.vendor_name);
        if (data.amount) setAmount(data.amount.toString());
        if (data.tax_amount) setTax(data.tax_amount.toString());
        if (data.category && EXPENSE_CATEGORIES.includes(data.category)) setCategory(data.category);
        if (data.expense_date) setExpenseDate(data.expense_date);
        if (data.invoice_number) setInvoiceNumber(data.invoice_number);
        if (data.description) setDescription(data.description);
        
        // Note: For a real app, you'd upload the file to Supabase Storage here and set the receiptUrl.
        // setReceiptUrl('path/to/uploaded/receipt.jpg');
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setFormError(err.message || 'Failed to scan receipt.');
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSmartScan = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!description.trim()) return setFormError('Description is required.');
    if (!amount.trim() || isNaN(parseFloat(amount))) return setFormError('Valid amount is required.');
    
    setSaving(true);
    try {
      await onSave({
        description,
        vendor_name: vendorName || null,
        category,
        amount: parseFloat(amount),
        tax_amount: tax ? parseFloat(tax) : 0,
        expense_date: expenseDate,
        payment_method: paymentMethod || null,
        invoice_number: invoiceNumber || null,
        notes: notes || null,
        is_recurring: isRecurring,
        receipt_url: receiptUrl || null,
        status: 'Completed'
      });
      handleClose();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-opacity duration-200 ${isOpen && !isClosing ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={handleClose} />
      
      <div className={`relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] transition-transform duration-200 ${isOpen && !isClosing ? 'scale-100' : 'scale-95'}`}>
        
        {/* Header */}
        <div className="px-6 py-5 bg-white border-b border-line flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F0FDF4] rounded-xl flex items-center justify-center border border-[#bbf7d0]">
              <Receipt size={20} className="text-[#15803D]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy m-0">
                {expenseToEdit ? 'Edit Expense' : 'Log Business Expense'}
              </h2>
              <p className="text-xs font-semibold text-muted m-0 mt-0.5">Track and organize company expenses.</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 text-muted hover:text-navy hover:bg-mist rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6 space-y-8">
            
            {formError && (
              <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex gap-3 items-start animate-fade-in">
                <AlertCircle size={16} className="text-[#DC2626] shrink-0 mt-0.5" />
                <span className="text-xs font-bold text-[#991B1B]">{formError}</span>
              </div>
            )}

            {/* OCR Scanner Concept */}
            {!expenseToEdit && (
              <div className="bg-canvas border border-line rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 justify-between">
                <div>
                  <div className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                    <Scan size={14} className="text-brand" /> 
                    Smart Receipt Scanner
                  </div>
                  <div className="text-xs text-muted mt-1 font-medium">Upload a receipt and let AI extract the details automatically.</div>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <button 
                  type="button" 
                  onClick={handleSmartScan}
                  disabled={isScanning}
                  className="px-4 py-2 bg-white border border-line hover:bg-mist text-navy text-sm font-semibold rounded-lg shadow-sm whitespace-nowrap transition-colors flex items-center gap-2"
                >
                  {isScanning ? <Loader2 size={14} className="animate-spin text-brand" /> : <UploadCloud size={14} className="text-muted" />}
                  {isScanning ? 'Scanning...' : 'Upload & Scan'}
                </button>
              </div>
            )}

            {/* Section 1: Expense Information */}
            <section>
              <h3 className="text-sm font-semibold text-navy mb-4 border-b border-line pb-2">Expense Information</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-ink-soft">Description <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Insulation Batts, Team Lunch"
                      className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-sm focus:outline-none focus:border-brand transition-colors text-navy placeholder:text-subtle focus:ring-3 focus:ring-brand/15"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-ink-soft">Vendor Name</label>
                    <input
                      type="text"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      placeholder="e.g. Home Depot, Shell"
                      className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-sm focus:outline-none focus:border-brand transition-colors text-navy placeholder:text-subtle focus:ring-3 focus:ring-brand/15"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="text-xs font-semibold text-ink-soft">Amount (CAD) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-sm font-bold text-navy font-mono focus:outline-none focus:border-brand transition-colors placeholder:text-subtle focus:ring-3 focus:ring-brand/15"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="text-xs font-semibold text-ink-soft">Tax Included</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tax}
                      onChange={(e) => setTax(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-sm font-bold text-muted font-mono focus:outline-none transition-colors text-navy placeholder:text-subtle focus:border-brand focus:ring-3 focus:ring-brand/15"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="text-xs font-semibold text-ink-soft">Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-sm focus:outline-none focus:border-brand transition-colors text-navy placeholder:text-subtle focus:ring-3 focus:ring-brand/15"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-ink-soft">Category <span className="text-red-500">*</span></label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-sm focus:outline-none focus:border-brand transition-colors cursor-pointer text-navy placeholder:text-subtle focus:ring-3 focus:ring-brand/15"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-ink-soft">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-sm focus:outline-none focus:border-brand transition-colors cursor-pointer text-navy placeholder:text-subtle focus:ring-3 focus:ring-brand/15"
                    >
                      <option value="Card">Card</option>
                      <option value="Cash">Cash</option>
                      <option value="Online Payment">Online Payment</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="checkbox" 
                    id="isRecurring"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 text-brand border-line rounded focus:ring-brand"
                  />
                  <label htmlFor="isRecurring" className="text-xs font-bold text-ink-soft cursor-pointer">
                    This is a recurring monthly expense
                  </label>
                </div>
              </div>
            </section>

            {/* Section 2: Notes */}
            <section>
              <h3 className="text-sm font-semibold text-navy mb-4 border-b border-line pb-2">Additional Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-ink-soft">Invoice / Receipt #</label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-sm focus:outline-none focus:border-brand transition-colors text-navy placeholder:text-subtle focus:ring-3 focus:ring-brand/15"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink-soft">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes for accounting or auditing..."
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-white border border-line rounded-lg text-sm focus:outline-none focus:border-brand transition-colors resize-none text-navy placeholder:text-subtle focus:ring-3 focus:ring-brand/15"
                  />
                </div>
              </div>
            </section>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 bg-canvas border-t border-line flex items-center justify-end gap-3 sticky bottom-0">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 bg-white border border-line hover:bg-mist text-navy text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-navy text-sm font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-70"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}
              <span>{expenseToEdit ? 'Save Changes' : 'Add Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
