import React from 'react';
import { Receipt, Plus } from 'lucide-react';

interface EmptyExpenseStateProps {
  onAddExpense: () => void;
}

export const EmptyExpenseState: React.FC<EmptyExpenseStateProps> = ({ onAddExpense }) => {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm animate-fade-in flex-grow">
      <div className="w-24 h-24 bg-[#F0FDF4] rounded-full flex items-center justify-center mb-6 shadow-inner border border-[#bbf7d0]">
        <Receipt size={40} className="text-[#15803D] stroke-[1.5]" />
      </div>
      
      <h3 className="text-xl font-black text-[#151A2D] m-0 mb-2">No Expenses Yet</h3>
      
      <p className="text-sm text-[#64748B] max-w-sm mx-auto mb-8 leading-relaxed font-medium">
        Start tracking your business spending by adding your first operational expense. Keep your finances organized and gain better insights.
      </p>
      
      <div className="flex items-center gap-4">
        <button
          onClick={onAddExpense}
          className="inline-flex items-center gap-1.5 px-6 py-3 bg-[#7CC242] hover:bg-[#6ab331] text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-[#7CC242]/30 cursor-pointer transition-all hover:-translate-y-0.5"
        >
          <Plus size={16} className="stroke-[3]" />
          <span>Add First Expense</span>
        </button>
        
        <button
          className="inline-flex items-center px-6 py-3 bg-transparent text-[#64748B] hover:text-[#151A2D] font-bold text-sm hover:underline transition-colors"
        >
          Learn More
        </button>
      </div>
    </div>
  );
};
