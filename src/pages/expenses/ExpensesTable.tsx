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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-[#FFF7ED] text-[#C2410C] border border-[#fed7aa]">
          <Clock size={10} /> Pending
        </span>
      );
    }
    if (status === 'Draft') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-mist text-ink-soft border border-line">
          <FileText size={10} /> Draft
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-[#F0FDF4] text-[#15803D] border border-[#bbf7d0]">
        <CheckCircle size={10} /> Completed
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden flex-grow flex flex-col">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-left whitespace-nowrap">
          <thead>
            <tr className="bg-canvas border-b border-line">
              <th className="px-6 py-4 text-2xs font-bold uppercase tracking-wider text-muted pl-8">Date</th>
              <th className="px-6 py-4 text-2xs font-bold uppercase tracking-wider text-muted">Expense Info</th>
              <th className="px-6 py-4 text-2xs font-bold uppercase tracking-wider text-muted">Category</th>
              <th className="px-6 py-4 text-2xs font-bold uppercase tracking-wider text-muted">Employee</th>
              <th className="px-6 py-4 text-2xs font-bold uppercase tracking-wider text-muted">Status</th>
              <th className="px-6 py-4 text-2xs font-bold uppercase tracking-wider text-muted text-right">Amount</th>
              <th className="px-6 py-4 text-2xs font-bold uppercase tracking-wider text-muted text-center pr-8">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {expenses.map((exp) => {
              const catColor = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS['Other'];
              
              return (
                <tr 
                  key={exp.id} 
                  className="hover:bg-canvas transition-colors group cursor-pointer"
                  onClick={() => onView(exp)}
                >
                  <td className="px-6 py-4 pl-8 text-xs text-muted font-semibold">
                    {new Date(exp.expense_date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-navy truncate max-w-[200px]">{exp.description}</span>
                      {exp.vendor_name && <span className="text-2xs text-subtle font-bold truncate max-w-[200px]">{exp.vendor_name}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      className="inline-block px-2.5 py-1 rounded-lg text-2xs font-bold border border-black/5"
                      style={{ backgroundColor: catColor.bg, color: catColor.text }}
                    >
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-line flex items-center justify-center text-muted">
                        <User size={12} />
                      </div>
                      <span className="text-xs font-semibold text-ink-soft">
                        {exp.profiles?.full_name || 'System'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(exp.status)}
                  </td>
                  <td className="px-6 py-4 font-bold text-sm text-navy text-right">
                    {formatCurrency(exp.amount)}
                  </td>
                  <td className="px-6 py-4 pr-8 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onDuplicate(exp)}
                        className="p-1.5 text-muted hover:text-[#0284C7] hover:bg-[#E0F2FE] rounded-lg transition-colors" 
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </button>
                      <button 
                        onClick={() => onEdit(exp)}
                        className="p-1.5 text-muted hover:text-brand hover:bg-[#F0FDF4] rounded-lg transition-colors" 
                        title="Edit Expense"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => onDelete(exp.id)}
                        className="p-1.5 text-muted hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors" 
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
      <div className="md:hidden divide-y divide-line">
        {expenses.map((exp) => {
          const catColor = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS['Other'];
          
          return (
            <div 
              key={exp.id} 
              className="p-5 space-y-3 bg-white active:bg-canvas"
              onClick={() => onView(exp)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xs text-subtle font-bold">
                    {new Date(exp.expense_date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </span>
                  {getStatusBadge(exp.status)}
                </div>
                <span 
                  className="inline-block px-2 py-0.5 rounded border border-black/5 text-2xs font-bold"
                  style={{ backgroundColor: catColor.bg, color: catColor.text }}
                >
                  {exp.category}
                </span>
              </div>
              
              <div>
                <h4 className="text-sm font-bold text-navy m-0">{exp.description}</h4>
                {exp.vendor_name && <p className="text-xs font-semibold text-muted mt-0.5">{exp.vendor_name}</p>}
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-mist">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-line flex items-center justify-center text-muted">
                    <User size={10} />
                  </div>
                  <span className="text-2xs font-semibold text-muted">
                    {exp.profiles?.full_name?.split(' ')[0] || 'System'}
                  </span>
                </div>
                <span className="font-bold text-sm text-navy">
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
