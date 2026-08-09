import React from 'react';
import { FileText, CheckCircle, Clock, Trash2, Edit2, User, Copy } from 'lucide-react';
import type { Expense } from './types';
import { CATEGORY_COLORS } from './types';

interface ExpensesTableProps {
  expenses: Expense[];
  onView: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onDuplicate: (expense: Expense) => void;
}

export const ExpensesTable: React.FC<ExpensesTableProps> = ({
  expenses,
  onView,
  onEdit,
  onDelete,
  onDuplicate
}) => {
  const formatCurrency = (val: number) => 
    '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getStatusBadge = (status?: string) => {
    if (status === 'Pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-[#fed7aa]">
          <Clock size={10} /> Pending
        </span>
      );
    }
    if (status === 'Draft') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-[#475569] border border-[#e2e8f0]">
          <FileText size={10} /> Draft
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0FDF4] text-[#15803D] border border-[#bbf7d0]">
        <CheckCircle size={10} /> Completed
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden flex-grow flex flex-col">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-left whitespace-nowrap">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#64748B] pl-8">Date</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#64748B]">Expense Info</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#64748B]">Category</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#64748B]">Employee</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#64748B]">Status</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#64748B] text-right">Amount</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#64748B] text-center pr-8">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {expenses.map((exp) => {
              const catColor = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS['Other'];
              
              return (
                <tr 
                  key={exp.id} 
                  className="hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                  onClick={() => onView(exp)}
                >
                  <td className="px-6 py-4 pl-8 text-xs text-[#64748B] font-semibold">
                    {new Date(exp.expense_date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-[#151A2D] truncate max-w-[200px]">{exp.description}</span>
                      {exp.vendor_name && <span className="text-[10px] text-[#94A3B8] font-bold truncate max-w-[200px]">{exp.vendor_name}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border border-black/5"
                      style={{ backgroundColor: catColor.bg, color: catColor.text }}
                    >
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[#64748B]">
                        <User size={12} />
                      </div>
                      <span className="text-xs font-semibold text-[#475569]">
                        {exp.profiles?.full_name || 'System'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(exp.status)}
                  </td>
                  <td className="px-6 py-4 font-black text-sm text-[#151A2D] text-right">
                    {formatCurrency(exp.amount)}
                  </td>
                  <td className="px-6 py-4 pr-8 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onDuplicate(exp)}
                        className="p-1.5 text-[#64748B] hover:text-[#0284C7] hover:bg-[#E0F2FE] rounded-lg transition-colors" 
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </button>
                      <button 
                        onClick={() => onEdit(exp)}
                        className="p-1.5 text-[#64748B] hover:text-[#7CC242] hover:bg-[#F0FDF4] rounded-lg transition-colors" 
                        title="Edit Expense"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => onDelete(exp.id)}
                        className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors" 
                        title="Delete Expense"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile / Tablet List View */}
      <div className="md:hidden divide-y divide-[#E2E8F0]">
        {expenses.map((exp) => {
          const catColor = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS['Other'];
          
          return (
            <div 
              key={exp.id} 
              className="p-5 space-y-3 bg-white active:bg-[#F8FAFC]"
              onClick={() => onView(exp)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#94A3B8] font-bold">
                    {new Date(exp.expense_date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </span>
                  {getStatusBadge(exp.status)}
                </div>
                <span 
                  className="inline-block px-2 py-0.5 rounded border border-black/5 text-[9px] font-bold"
                  style={{ backgroundColor: catColor.bg, color: catColor.text }}
                >
                  {exp.category}
                </span>
              </div>
              
              <div>
                <h4 className="text-sm font-black text-[#151A2D] m-0">{exp.description}</h4>
                {exp.vendor_name && <p className="text-xs font-semibold text-[#64748B] mt-0.5">{exp.vendor_name}</p>}
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9]">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[#64748B]">
                    <User size={10} />
                  </div>
                  <span className="text-[10px] font-semibold text-[#64748B]">
                    {exp.profiles?.full_name?.split(' ')[0] || 'System'}
                  </span>
                </div>
                <span className="font-black text-sm text-[#151A2D]">
                  {formatCurrency(exp.amount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
