import React, { useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { EXPENSE_CATEGORIES } from './types';
import { Field, Input, Select } from '../../components/ui';
import { FilterSelect, SearchInput } from '../../components/ui/list';
import { todayDate } from '../../utils/dates';

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
  employees: { id: string; name: string }[];
}

const monthOptions = () => {
  const options: { value: string; label: string }[] = [];
  const d = todayDate();
  d.setDate(1);
  for (let i = 0; i < 24; i++) {
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString(undefined, { month: 'short', year: 'numeric' }),
    });
    d.setMonth(d.getMonth() - 1);
  }
  return options;
};

/**
 * Toolbar for the expenses list: search, month and category always visible;
 * the rarer filters fold out under "More filters".
 */
export const ExpensesFilters: React.FC<ExpensesFiltersProps> = ({ filters, onFilterChange, employees }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const months = monthOptions();

  const set = (field: keyof FilterState, value: string) => onFilterChange({ ...filters, [field]: value });

  const handleReset = () => {
    onFilterChange({
      search: '',
      month: months[0].value,
      category: 'all',
      employeeId: 'all',
      expenseType: 'all',
      status: 'all',
      minAmount: '',
      maxAmount: '',
      sortBy: 'date_desc',
    });
  };

  const extraCount = [filters.employeeId, filters.status, filters.expenseType].filter(v => v !== 'all').length +
    (filters.minAmount ? 1 : 0) +
    (filters.maxAmount ? 1 : 0) +
    (filters.sortBy !== 'date_desc' ? 1 : 0);

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <SearchInput value={filters.search} onChange={v => set('search', v)} placeholder="Search description, vendor or notes" />
        <div className="grid grid-cols-[1fr_1fr_auto] sm:flex gap-2">
          <FilterSelect value={filters.month} onChange={e => set('month', e.target.value)} aria-label="Month">
            <option value="all">All time</option>
            {months.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect value={filters.category} onChange={e => set('category', e.target.value)} aria-label="Category">
            <option value="all">All categories</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </FilterSelect>
          <button
            type="button"
            onClick={() => setIsExpanded(x => !x)}
            aria-expanded={isExpanded}
            className={`h-10 px-3 inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium whitespace-nowrap ${
              isExpanded || extraCount > 0 ? 'bg-brand-soft border-brand/40 text-brand-ink' : 'bg-white border-line text-ink-soft hover:bg-mist'
            }`}
          >
            <SlidersHorizontal size={15} />
            <span className="hidden sm:inline">More filters</span>
            {extraCount > 0 && <span className="text-xs font-semibold">({extraCount})</span>}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-line animate-fade-in">
          <Field label="Employee">
            <Select value={filters.employeeId} onChange={e => set('employeeId', e.target.value)}>
              <option value="all">Anyone</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={filters.status} onChange={e => set('status', e.target.value)}>
              <option value="all">Any status</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
              <option value="Draft">Draft</option>
            </Select>
          </Field>
          <Field label="Paid with">
            <Select value={filters.expenseType} onChange={e => set('expenseType', e.target.value)}>
              <option value="all">Any</option>
              <option value="Card">Company card</option>
              <option value="Cash">Cash</option>
              <option value="Reimbursement">Reimbursement</option>
            </Select>
          </Field>
          <Field label="Amount">
            <div className="flex items-center gap-2">
              <Input type="number" inputMode="decimal" placeholder="Min $" value={filters.minAmount} onChange={e => set('minAmount', e.target.value)} />
              <span className="text-subtle">–</span>
              <Input type="number" inputMode="decimal" placeholder="Max $" value={filters.maxAmount} onChange={e => set('maxAmount', e.target.value)} />
            </div>
          </Field>
          <Field label="Sort by">
            <Select value={filters.sortBy} onChange={e => set('sortBy', e.target.value)}>
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="amount_desc">Highest amount</option>
              <option value="amount_asc">Lowest amount</option>
            </Select>
          </Field>
          <div className="col-span-full flex justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-muted hover:text-navy hover:bg-mist border-0 bg-transparent"
            >
              <RotateCcw size={14} /> Reset filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
