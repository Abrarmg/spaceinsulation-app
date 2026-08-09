import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import type { Expense } from './expenses/types';
import { ExpensesHeader } from './expenses/ExpensesHeader';
import { ExpensesFilters } from './expenses/ExpensesFilters';
import type { FilterState } from './expenses/ExpensesFilters';
import { ExpensesTable } from './expenses/ExpensesTable';
import { EmptyExpenseState } from './expenses/EmptyExpenseState';
import { AddExpenseModal } from './expenses/AddExpenseModal';
import { ExpenseDrawer } from './expenses/ExpenseDrawer';
import { ExpensesAnalytics } from './expenses/ExpensesAnalytics';
import { Loader2, AlertCircle } from 'lucide-react';

export const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default Filter State
  const defaultMonth = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    month: defaultMonth(),
    category: 'all',
    employeeId: 'all',
    expenseType: 'all',
    status: 'all',
    minAmount: '',
    maxAmount: '',
    sortBy: 'date_desc'
  });

  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Initial Data Fetch
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Expenses (all time, we'll filter client-side for faster SaaS feel)
      const { data: expData, error: expErr } = await supabase
        .from('expenses')
        .select(`
          *,
          profiles:created_by ( id, full_name, role )
        `)
        .order('expense_date', { ascending: false });

      if (expErr) throw expErr;
      setExpenses(expData || []);

      // 2. Extract unique employees from expenses (or fetch from profiles)
      // We'll fetch active office staff & installers from profiles
      const { data: empData, error: empErr } = await supabase
        .from('profiles')
        .select('id, full_name');
        
      if (!empErr && empData) {
        setEmployees(empData.map(e => ({ id: e.id, name: e.full_name || 'Unknown' })));
      }

    } catch (err: any) {
      console.error('Error fetching expenses:', err);
      setError('Failed to fetch expenses. Please reload the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Derived State: Filtered & Sorted Expenses
  const filteredExpenses = useMemo(() => {
    let result = [...expenses];

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(e => 
        e.description.toLowerCase().includes(q) || 
        (e.vendor_name && e.vendor_name.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      );
    }

    // Month
    if (filters.month !== 'all') {
      result = result.filter(e => e.expense_date.startsWith(filters.month));
    }

    // Category
    if (filters.category !== 'all') {
      result = result.filter(e => e.category === filters.category);
    }

    // Employee
    if (filters.employeeId !== 'all') {
      result = result.filter(e => e.created_by === filters.employeeId);
    }

    // Status
    if (filters.status !== 'all') {
      result = result.filter(e => e.status === filters.status);
    }

    // Amount Range
    if (filters.minAmount) {
      result = result.filter(e => e.amount >= parseFloat(filters.minAmount));
    }
    if (filters.maxAmount) {
      result = result.filter(e => e.amount <= parseFloat(filters.maxAmount));
    }

    // Sort
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'date_desc': return new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime();
        case 'date_asc': return new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime();
        case 'amount_desc': return b.amount - a.amount;
        case 'amount_asc': return a.amount - b.amount;
        default: return 0;
      }
    });

    return result;
  }, [expenses, filters]);

  // Actions
  const handleOpenAdd = () => {
    setExpenseToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (expense: Expense) => {
    setExpenseToEdit(expense);
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this expense?')) return;
    
    try {
      const { error: deleteErr } = await supabase.from('expenses').delete().eq('id', id);
      if (deleteErr) throw deleteErr;
      
      setExpenses(prev => prev.filter(e => e.id !== id));
      if (selectedExpense?.id === id) setIsDrawerOpen(false);
    } catch (err: any) {
      alert('Failed to delete expense: ' + err.message);
    }
  };

  const handleDuplicate = (expense: Expense) => {
    // Open modal with pre-filled details but no ID
    setExpenseToEdit({ ...expense, id: '' });
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (payload: Partial<Expense>) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || null;

    const fullPayload = {
      ...payload,
      created_by: expenseToEdit?.id ? expenseToEdit.created_by : userId
    };

    if (expenseToEdit?.id) {
      // Update
      const { data, error } = await supabase
        .from('expenses')
        .update(fullPayload)
        .eq('id', expenseToEdit.id)
        .select(`*, profiles:created_by ( id, full_name, role )`)
        .single();

      if (error) throw error;
      
      setExpenses(prev => prev.map(e => e.id === expenseToEdit.id ? data as Expense : e));
      if (selectedExpense?.id === expenseToEdit.id) setSelectedExpense(data as Expense);
      
    } else {
      // Insert
      const { data, error } = await supabase
        .from('expenses')
        .insert([fullPayload])
        .select(`*, profiles:created_by ( id, full_name, role )`)
        .single();

      if (error) throw error;
      setExpenses(prev => [data as Expense, ...prev]);
    }
  };

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) return alert('No data to export.');
    
    const headers = ['Date', 'Description', 'Vendor', 'Category', 'Amount', 'Tax', 'Employee', 'Status', 'Notes'];
    const rows = filteredExpenses.map(e => [
      e.expense_date,
      `"${e.description.replace(/"/g, '""')}"`,
      `"${(e.vendor_name || '').replace(/"/g, '""')}"`,
      e.category,
      e.amount.toFixed(2),
      (e.tax_amount || 0).toFixed(2),
      `"${(e.profiles?.full_name || 'System').replace(/"/g, '""')}"`,
      e.status || 'Completed',
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `expenses_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-grow p-4 sm:p-6 md:p-8 space-y-6 overflow-y-auto max-h-screen bg-[#F8FAFC] pb-24">
      
      <ExpensesHeader 
        expenses={expenses}
        onAddExpense={handleOpenAdd}
        onExportCSV={handleExportCSV}
        onViewReports={() => document.getElementById('analytics-section')?.scrollIntoView({ behavior: 'smooth' })}
      />

      <ExpensesFilters 
        filters={filters}
        onFilterChange={setFilters}
        employees={employees}
      />

      {loading ? (
        <div className="flex items-center justify-center py-32 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-[#7CC242]" />
        </div>
      ) : error ? (
        <div className="py-20 text-center text-red-600 bg-white rounded-2xl border border-red-200 shadow-sm flex flex-col items-center gap-2">
          <AlertCircle size={32} />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <EmptyExpenseState onAddExpense={handleOpenAdd} />
      ) : (
        <ExpensesTable 
          expenses={filteredExpenses}
          onView={(exp) => { setSelectedExpense(exp); setIsDrawerOpen(true); }}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      )}

      {/* Analytics Section */}
      {!loading && !error && expenses.length > 0 && (
        <div id="analytics-section">
          <ExpensesAnalytics expenses={expenses} />
        </div>
      )}

      {/* Modals & Drawers */}
      <AddExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveExpense}
        expenseToEdit={expenseToEdit}
      />

      <ExpenseDrawer 
        expense={selectedExpense}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};
