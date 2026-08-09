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
        className={`fixed inset-0 bg-[#151A2D]/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen && !isClosing ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Drawer Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-[#F8FAFC] shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${isOpen && !isClosing ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-[#E2E8F0]">
          <h3 className="text-base font-black text-[#151A2D] uppercase tracking-wide">Expense Details</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => expense && onEdit(expense)}
              className="p-2 text-[#64748B] hover:text-[#7CC242] hover:bg-[#F0FDF4] rounded-lg transition-colors"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={() => expense && onDelete(expense.id)}
              className="p-2 text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
            <div className="w-px h-6 bg-[#E2E8F0] mx-1"></div>
            <button 
              onClick={handleClose}
              className="p-2 text-[#64748B] hover:text-[#151A2D] hover:bg-[#F1F5F9] rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto">
          {expense && (
            <div className="p-6 space-y-6">
              
              {/* Top Summary Card */}
              <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm text-center">
                <div className="w-12 h-12 bg-[#F1F5F9] rounded-full flex items-center justify-center mx-auto mb-3 text-[#64748B]">
                  <Receipt size={24} />
                </div>
                <h2 className="text-xl font-black text-[#151A2D] m-0 mb-1">{formatCurrency(expense.amount)}</h2>
                <p className="text-sm font-bold text-[#64748B] m-0">{expense.description}</p>
                {expense.vendor_name && (
                  <p className="text-xs font-semibold text-[#94A3B8] mt-1">{expense.vendor_name}</p>
                )}
                
                <div className="mt-4 flex justify-center">
                  <span 
                    className="inline-block px-3 py-1 rounded-lg text-[10px] font-bold border border-black/5"
                    style={{ backgroundColor: catColor.bg, color: catColor.text }}
                  >
                    {expense.category}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center gap-2 text-[#475569]">
                  <FileText size={14} />
                  <span className="text-[10px] font-black uppercase tracking-wider">Information</span>
                </div>
                <div className="divide-y divide-[#E2E8F0]">
                  <div className="flex px-5 py-3">
                    <div className="w-1/3 flex items-center gap-2 text-[#64748B]">
                      <Calendar size={14} />
                      <span className="text-xs font-semibold">Date</span>
                    </div>
                    <div className="w-2/3 text-sm font-bold text-[#151A2D] text-right">
                      {new Date(expense.expense_date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric'
                      })}
                    </div>
                  </div>
                  
                  <div className="flex px-5 py-3">
                    <div className="w-1/3 flex items-center gap-2 text-[#64748B]">
                      <User size={14} />
                      <span className="text-xs font-semibold">Employee</span>
                    </div>
                    <div className="w-2/3 text-sm font-bold text-[#151A2D] text-right">
                      {expense.profiles?.full_name || 'System User'}
                    </div>
                  </div>

                  <div className="flex px-5 py-3">
                    <div className="w-1/3 flex items-center gap-2 text-[#64748B]">
                      <CreditCard size={14} />
                      <span className="text-xs font-semibold">Payment</span>
                    </div>
                    <div className="w-2/3 text-sm font-bold text-[#151A2D] text-right">
                      {expense.payment_method || 'Corporate Card'}
                    </div>
                  </div>

                  <div className="flex px-5 py-3">
                    <div className="w-1/3 flex items-center gap-2 text-[#64748B]">
                      <Tag size={14} />
                      <span className="text-xs font-semibold">Status</span>
                    </div>
                    <div className="w-2/3 text-sm font-bold text-[#151A2D] text-right">
                      {expense.status || 'Completed'}
                    </div>
                  </div>
                  
                  {expense.invoice_number && (
                    <div className="flex px-5 py-3">
                      <div className="w-1/3 flex items-center gap-2 text-[#64748B]">
                        <Receipt size={14} />
                        <span className="text-xs font-semibold">Invoice #</span>
                      </div>
                      <div className="w-2/3 text-sm font-bold text-[#151A2D] text-right font-mono">
                        {expense.invoice_number}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {expense.notes && (
                <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center gap-2 text-[#475569]">
                    <FileText size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Notes</span>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-medium text-[#475569] leading-relaxed m-0 whitespace-pre-wrap">
                      {expense.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Receipt Placeholder (OCR UI Concept) */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between text-[#475569]">
                  <div className="flex items-center gap-2">
                    <Receipt size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Attached Receipt</span>
                  </div>
                  {expense.receipt_url && (
                    <button className="text-xs font-bold text-[#7CC242] hover:underline flex items-center gap-1">
                      <Download size={12} /> Download
                    </button>
                  )}
                </div>
                <div className="p-5">
                  {expense.receipt_url ? (
                    <div className="w-full h-48 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#E2E8F0] transition-colors group">
                      <Receipt size={32} className="text-[#94A3B8] group-hover:text-[#64748B]" />
                      <span className="text-xs font-bold text-[#64748B]">receipt_scan.pdf</span>
                    </div>
                  ) : (
                    <div className="w-full py-8 bg-[#F8FAFC] border-2 border-dashed border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center gap-2">
                      <span className="text-xs font-semibold text-[#94A3B8]">No receipt attached</span>
                      <button className="px-3 py-1.5 bg-white border border-[#E2E8F0] text-xs font-bold text-[#151A2D] rounded-lg shadow-sm">
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
        <div className="p-5 bg-white border-t border-[#E2E8F0] flex gap-3">
          <button 
            onClick={() => expense && onEdit(expense)}
            className="flex-1 py-3 bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#151A2D] font-black text-xs uppercase tracking-wider rounded-xl transition-colors"
          >
            Edit Expense
          </button>
        </div>
      </div>
    </>
  );
};
