import React from 'react';
import { Plus, Download, BarChart2 } from 'lucide-react';
import { Button, PageHeader } from '../../components/ui';
import { OverflowMenu, StatStrip } from '../../components/ui/list';
import { todayLocal } from '../../utils/dates';
import type { Expense } from './types';

interface ExpensesHeaderProps {
  expenses: Expense[];
  onAddExpense: () => void;
  onExportCSV: () => void;
  onViewReports: () => void;
  loading?: boolean;
}

const formatCurrency = (val: number) => '$' + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const ExpensesHeader: React.FC<ExpensesHeaderProps> = ({ expenses, onAddExpense, onExportCSV, onViewReports, loading }) => {
  const today = todayLocal();
  const thisMonth = today.substring(0, 7);

  let todayTotal = 0;
  let monthTotal = 0;
  const categoryTotals: Record<string, number> = {};

  expenses.forEach(exp => {
    const amount = Number(exp.amount) || 0;
    if (exp.expense_date === today) todayTotal += amount;
    if (exp.expense_date.startsWith(thisMonth)) {
      monthTotal += amount;
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amount;
    }
  });

  const [largestCategory, largestCategoryAmount] = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0] ?? ['—', 0];
  const avgDailySpend = monthTotal / new Date().getDate();

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Track what the business spends, by category and employee."
        actions={
          <>
            <OverflowMenu
              actions={[
                { label: 'View reports', icon: BarChart2, onClick: onViewReports },
                { label: 'Export to CSV', icon: Download, onClick: onExportCSV },
              ]}
            />
            <Button icon={Plus} onClick={onAddExpense}>
              Add expense
            </Button>
          </>
        }
      />

      <StatStrip
        loading={loading}
        items={[
          { label: 'Today', value: formatCurrency(todayTotal), hint: 'Spent today' },
          { label: 'This month', value: formatCurrency(monthTotal), hint: new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) },
          { label: 'Top category', value: largestCategory, hint: largestCategoryAmount ? `${formatCurrency(largestCategoryAmount)} this month` : 'No spending yet' },
          { label: 'Daily average', value: formatCurrency(avgDailySpend), hint: 'This month' },
        ]}
      />
    </>
  );
};
