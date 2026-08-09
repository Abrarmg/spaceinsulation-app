import React, { useState } from 'react';
import { Filter, Search, RotateCcw, ChevronDown, DollarSign } from 'lucide-react';
import { EXPENSE_CATEGORIES } from './types';

export interface FilterState {
  search: string;
  month: string;
  category: string;
  employeeId: string;
  expenseType: string;
  status: string;
  minAmount: string;
  maxAmount: string;
  sortBy: string;
}

interface ExpensesFiltersProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  employees: { id: string, name: string }[];
}

export const ExpensesFilters: React.FC<ExpensesFiltersProps> = ({
  filters,
  onFilterChange,
  employees
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getMonthOptions = () => {
    const options = [];
    const d = new Date();
    for (let i = 0; i < 24; i++) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      options.push({ value: `${year}-${month}`, label });
      d.setMonth(d.getMonth() - 1);
    }
    return options;
  };
  const monthOptions = getMonthOptions();

  const handleChange = (field: keyof FilterState, value: string) => {
    onFilterChange({ ...filters, [field]: value });
  };

  const handleReset = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    
    onFilterChange({
      search: '',
      month: `${year}-${month}`,
      category: 'all',
      employeeId: 'all',
      expenseType: 'all',
      status: 'all',
      minAmount: '',
      maxAmount: '',
      sortBy: 'date_desc'
    });
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'month' || key === 'sortBy') return false; // Default filters
    if (val === 'all' || val === '') return false;
    return true;
  }).length;

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 transition-all">
      {/* Top Row: Search & Primary Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-grow relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-[#94A3B8]" />
          </div>
          <input
            type="text"
            placeholder="Search expenses, vendors, or notes..."
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 focus:border-[#7CC242]/50 transition-all placeholder:text-[#94A3B8]"
          />
        </div>

        {/* Primary Filters */}
        <div className="flex gap-3">
          <select
            value={filters.month}
            onChange={(e) => handleChange('month', e.target.value)}
            className="px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 cursor-pointer min-w-[120px]"
          >
            <option value="all">All Time</option>
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filters.category}
            onChange={(e) => handleChange('category', e.target.value)}
            className="px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 cursor-pointer min-w-[130px]"
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors border ${
              isExpanded || activeFiltersCount > 0
                ? 'bg-[#F0FDF4] border-[#86efac] text-[#15803D]' 
                : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
            }`}
          >
            <Filter size={14} />
            <span>Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}</span>
            <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in">
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Employee</label>
            <select
              value={filters.employeeId}
              onChange={(e) => handleChange('employeeId', e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20"
            >
              <option value="all">Any Employee</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20"
            >
              <option value="all">Any Status</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Expense Type</label>
            <select
              value={filters.expenseType}
              onChange={(e) => handleChange('expenseType', e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20"
            >
              <option value="all">Any Type</option>
              <option value="Card">Corporate Card</option>
              <option value="Cash">Cash</option>
              <option value="Reimbursement">Reimbursement</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Amount Range</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <DollarSign size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minAmount}
                  onChange={(e) => handleChange('minAmount', e.target.value)}
                  className="w-full pl-6 pr-2 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none"
                />
              </div>
              <span className="text-[#94A3B8]">-</span>
              <div className="relative flex-1">
                <DollarSign size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxAmount}
                  onChange={(e) => handleChange('maxAmount', e.target.value)}
                  className="w-full pl-6 pr-2 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleChange('sortBy', e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="amount_desc">Highest Amount</option>
              <option value="amount_asc">Lowest Amount</option>
            </select>
          </div>

          {/* Reset Button */}
          <div className="col-span-full flex justify-end mt-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#64748B] hover:text-[#151A2D] hover:bg-[#F1F5F9] rounded-lg transition-colors"
            >
              <RotateCcw size={12} />
              <span>Reset Filters</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
