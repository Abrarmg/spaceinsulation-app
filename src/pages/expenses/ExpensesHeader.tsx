import React from 'react';
import { Plus, Download, BarChart2, TrendingUp, Calendar, PieChart, Activity } from 'lucide-react';
import type { Expense } from './types';

interface ExpensesHeaderProps {
  expenses: Expense[];
  onAddExpense: () => void;
  onExportCSV: () => void;
  onViewReports: () => void;
}

export const ExpensesHeader: React.FC<ExpensesHeaderProps> = ({ 
  expenses, 
  onAddExpense, 
  onExportCSV, 
  onViewReports 
}) => {
  // Calculate summary metrics
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7); // YYYY-MM
  
  let todayTotal = 0;
  let monthTotal = 0;
  let categoryTotals: Record<string, number> = {};

  expenses.forEach(exp => {
    if (exp.expense_date === today) todayTotal += Number(exp.amount) || 0;
    if (exp.expense_date.startsWith(thisMonth)) monthTotal += Number(exp.amount) || 0;
    
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + (Number(exp.amount) || 0);
  });

  // Find largest category
  let largestCategory = 'N/A';
  let largestCategoryAmount = 0;
  Object.entries(categoryTotals).forEach(([cat, amt]) => {
    if (amt > largestCategoryAmount) {
      largestCategoryAmount = amt;
      largestCategory = cat;
    }
  });

  // Calculate average daily spend for the month
  const d = new Date();
  const currentDay = d.getDate();
  const avgDailySpend = currentDay > 0 ? (monthTotal / currentDay) : 0;

  const formatCurrency = (val: number) => 
    '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      {/* Title & Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#151A2D] tracking-tight m-0">Business Expenses</h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">Track, categorize, and analyze all operational expenses.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onViewReports}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#151A2D] font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm cursor-pointer transition-colors"
          >
            <BarChart2 size={16} className="text-[#64748B]" />
            <span>Reports</span>
          </button>
          
          <button
            onClick={onExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#151A2D] font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm cursor-pointer transition-colors"
          >
            <Download size={16} className="text-[#64748B]" />
            <span>Export CSV</span>
          </button>
          
          <button
            onClick={onAddExpense}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#7CC242] hover:bg-[#6ab331] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-all hover:-translate-y-0.5"
          >
            <Plus size={16} className="stroke-[3]" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Today's Expenses</span>
            <div className="p-2 bg-[#F0FDF4] text-[#15803D] rounded-lg group-hover:scale-110 transition-transform">
              <TrendingUp size={16} strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-2xl font-black text-[#151A2D]">{formatCurrency(todayTotal)}</div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-[#15803D]">
            <TrendingUp size={12} />
            <span>Tracking daily spend</span>
          </div>
        </div>

        {/* Card 2: This Month */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">This Month</span>
            <div className="p-2 bg-[#EFF6FF] text-[#1D4ED8] rounded-lg group-hover:scale-110 transition-transform">
              <Calendar size={16} strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-2xl font-black text-[#151A2D]">{formatCurrency(monthTotal)}</div>
          <div className="mt-3 w-full bg-[#F1F5F9] rounded-full h-1.5">
            <div className="bg-[#1D4ED8] h-1.5 rounded-full" style={{ width: '45%' }}></div>
          </div>
          <div className="mt-1.5 text-[10px] font-bold text-[#64748B]">Compared to monthly budget</div>
        </div>

        {/* Card 3: Largest Category */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Top Category</span>
            <div className="p-2 bg-[#FAF5FF] text-[#7E22CE] rounded-lg group-hover:scale-110 transition-transform">
              <PieChart size={16} strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-2xl font-black text-[#151A2D]">{largestCategory}</div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-[#64748B]">
            <span className="px-1.5 py-0.5 bg-[#F1F5F9] rounded">{formatCurrency(largestCategoryAmount)}</span>
            <span>Total spend</span>
          </div>
        </div>

        {/* Card 4: Avg Daily */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Avg Daily Spend</span>
            <div className="p-2 bg-[#FFF7ED] text-[#C2410C] rounded-lg group-hover:scale-110 transition-transform">
              <Activity size={16} strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-2xl font-black text-[#151A2D]">{formatCurrency(avgDailySpend)}<span className="text-sm text-[#64748B] font-semibold">/day</span></div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-[#64748B]">
            Based on current month
          </div>
        </div>
      </div>
    </div>
  );
};
