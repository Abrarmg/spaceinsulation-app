import React, { useEffect, useState } from 'react';
import { X, Edit2, Trash2, Download, Receipt, FileText, User, Calendar, CreditCard, Tag } from 'lucide-react';
import type { Expense } from './types';
import { CATEGORY_COLORS } from './types';

interface ExpenseDrawerProps {
  expense: Expense | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export const ExpenseDrawer: React.FC<ExpenseDrawerProps> = ({
  expense,
  isOpen,
  onClose,
  onEdit,
  onDelete
}) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!expense && !isOpen && !isClosing) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300); // match animation duration
  };

  const formatCurrency = (val: number) => 
    '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const catColor = expense ? (CATEGORY_COLORS[expense.category] || CATEGORY_COLORS['Other']) : CATEGORY_COLORS['Other'];

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-navy/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen && !isClosing ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Drawer Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-canvas shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${isOpen && !isClosing ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-line">
          <h3 className="text-base font-semibold text-navy">Expense Details</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => expense && onEdit(expense)}
              className="p-2 text-muted hover:text-brand hover:bg-[#F0FDF4] rounded-lg transition-colors"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={() => expense && onDelete(expense.id)}
              className="p-2 text-muted hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
            <div className="w-px h-6 bg-line mx-1"></div>
            <button 
              onClick={handleClose}
              className="p-2 text-muted hover:text-navy hover:bg-mist rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Scrollable Area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {expense && (
            <div className="p-6 space-y-6">
              
              {/* Top Summary Card */}
              <div className="bg-white p-5 rounded-2xl border border-line shadow-sm text-center">
                <div className="w-12 h-12 bg-mist rounded-full flex items-center justify-center mx-auto mb-3 text-muted">
                  <Receipt size={24} />
                </div>
                <h2 className="text-xl font-bold text-navy m-0 mb-1">{formatCurrency(expense.amount)}</h2>
                <p className="text-sm font-bold text-muted m-0">{expense.description}</p>
                {expense.vendor_name && (
                  <p className="text-xs font-semibold text-subtle mt-1">{expense.vendor_name}</p>
                )}
                
                <div className="mt-4 flex justify-center">
                  <span 
                    className="inline-block px-3 py-1 rounded-lg text-2xs font-bold border border-black/5"
                    style={{ backgroundColor: catColor.bg, color: catColor.text }}
                  >
                    {expense.category}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-canvas border-b border-line flex items-center gap-2 text-ink-soft">
                  <FileText size={14} />
                  <span className="text-2xs font-bold uppercase tracking-wider">Information</span>
                </div>
                <div className="divide-y divide-line">
                  <div className="flex px-5 py-3">
                    <div className="w-1/3 flex items-center gap-2 text-muted">
                      <Calendar size={14} />
                      <span className="text-xs font-semibold">Date</span>
                    </div>
                    <div className="w-2/3 text-sm font-bold text-navy text-right">
                      {new Date(expense.expense_date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric'
                      })}
                    </div>
                  </div>
                  
                  <div className="flex px-5 py-3">
                    <div className="w-1/3 flex items-center gap-2 text-muted">
                      <User size={14} />
                      <span className="text-xs font-semibold">Employee</span>
                    </div>
                    <div className="w-2/3 text-sm font-bold text-navy text-right">
                      {expense.profiles?.full_name || 'System User'}
                    </div>
                  </div>

                  <div className="flex px-5 py-3">
                    <div className="w-1/3 flex items-center gap-2 text-muted">
                      <CreditCard size={14} />
                      <span className="text-xs font-semibold">Payment</span>
                    </div>
                    <div className="w-2/3 text-sm font-bold text-navy text-right">
                      {expense.payment_method || 'Corporate Card'}
                    </div>
                  </div>

                  <div className="flex px-5 py-3">
                    <div className="w-1/3 flex items-center gap-2 text-muted">
                      <Tag size={14} />
                      <span className="text-xs font-semibold">Status</span>
                    </div>
                    <div className="w-2/3 text-sm font-bold text-navy text-right">
                      {expense.status || 'Completed'}
                    </div>
                  </div>
                  
                  {expense.invoice_number && (
                    <div className="flex px-5 py-3">
                      <div className="w-1/3 flex items-center gap-2 text-muted">
                        <Receipt size={14} />
                        <span className="text-xs font-semibold">Invoice #</span>
                      </div>
                      <div className="w-2/3 text-sm font-bold text-navy text-right font-mono">
                        {expense.invoice_number}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {expense.notes && (
                <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-canvas border-b border-line flex items-center gap-2 text-ink-soft">
                    <FileText size={14} />
                    <span className="text-2xs font-bold uppercase tracking-wider">Notes</span>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-medium text-ink-soft leading-relaxed m-0 whitespace-pre-wrap">
                      {expense.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Receipt Placeholder (OCR UI Concept) */}
              <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-canvas border-b border-line flex items-center justify-between text-ink-soft">
                  <div className="flex items-center gap-2">
                    <Receipt size={14} />
                    <span className="text-2xs font-bold uppercase tracking-wider">Attached Receipt</span>
                  </div>
                  {expense.receipt_url && (
                    <button className="text-xs font-bold text-brand hover:underline flex items-center gap-1">
                      <Download size={12} /> Download
                    </button>
                  )}
                </div>
                <div className="p-5">
                  {expense.receipt_url ? (
                    <div className="w-full h-48 bg-mist rounded-xl border border-line flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-line transition-colors group">
                      <Receipt size={32} className="text-subtle group-hover:text-muted" />
                      <span className="text-xs font-bold text-muted">receipt_scan.pdf</span>
                    </div>
                  ) : (
                    <div className="w-full py-8 bg-canvas border-2 border-dashed border-line rounded-xl flex flex-col items-center justify-center gap-2">
                      <span className="text-xs font-semibold text-subtle">No receipt attached</span>
                      <button className="px-3 py-1.5 bg-white border border-line text-xs font-bold text-navy rounded-lg shadow-sm">
                        Upload Receipt
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
        
        {/* Footer actions */}
        <div className="p-5 bg-white border-t border-line flex gap-3">
          <button 
            onClick={() => expense && onEdit(expense)}
            className="flex-1 py-3 bg-canvas border border-line hover:bg-mist text-navy font-semibold text-sm rounded-lg transition-colors"
          >
            Edit Expense
          </button>
        </div>
      </div>
    </>
  );
};
