import React from 'react';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui';
import { MobileList, MobileRow, OverflowMenu, T } from '../../components/ui/list';
import type { Expense } from './types';
import { CATEGORY_COLORS } from './types';

interface ExpensesTableProps {
  expenses: Expense[];
  onView: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onDuplicate: (expense: Expense) => void;
}

const formatCurrency = (val: number) => '$' + Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const StatusBadge: React.FC<{ status?: string }> = ({ status }) =>
  status === 'Pending' ? <Badge tone="amber">Pending</Badge> : status === 'Draft' ? <Badge tone="neutral">Draft</Badge> : <Badge tone="green">Completed</Badge>;

const CategoryChip: React.FC<{ category: string }> = ({ category }) => {
  const c = CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold whitespace-nowrap" style={{ backgroundColor: c.bg, color: c.text }}>
      {category}
    </span>
  );
};

export const ExpensesTable: React.FC<ExpensesTableProps> = ({ expenses, onView, onEdit, onDelete, onDuplicate }) => {
  const actions = (exp: Expense) => (
    <div onClick={e => e.stopPropagation()}>
      <OverflowMenu
        label="Expense actions"
        actions={[
          { label: 'Edit', icon: Pencil, onClick: () => onEdit(exp) },
          { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate(exp) },
          { label: 'Delete', icon: Trash2, onClick: () => onDelete(exp.id), danger: true },
        ]}
      />
    </div>
  );

  return (
    <>
      <div className={T.wrap}>
        <table className={T.table}>
          <thead className={T.thead}>
            <tr>
              <th className={T.th}>Expense</th>
              <th className={T.th}>Date</th>
              <th className={T.th}>Category</th>
              <th className={`${T.th} hidden lg:table-cell`}>Employee</th>
              <th className={`${T.th} hidden lg:table-cell`}>Status</th>
              <th className={`${T.th} text-right`}>Amount</th>
              <th className={`${T.th} w-14`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(exp => (
              <tr key={exp.id} className={T.tr} onClick={() => onView(exp)}>
                <td className={T.td}>
                  <div className="font-semibold truncate max-w-[260px]">{exp.description}</div>
                  {exp.vendor_name && <div className="text-xs text-muted truncate max-w-[260px]">{exp.vendor_name}</div>}
                </td>
                <td className={`${T.td} whitespace-nowrap text-ink-soft`}>{formatDate(exp.expense_date)}</td>
                <td className={T.td}>
                  <CategoryChip category={exp.category} />
                </td>
                <td className={`${T.td} hidden lg:table-cell text-ink-soft`}>{exp.profiles?.full_name || 'System'}</td>
                <td className={`${T.td} hidden lg:table-cell`}>
                  <StatusBadge status={exp.status} />
                </td>
                <td className={`${T.td} text-right font-semibold whitespace-nowrap`}>{formatCurrency(exp.amount)}</td>
                <td className={`${T.td} text-right`}>{actions(exp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MobileList>
        {expenses.map(exp => (
          <MobileRow
            key={exp.id}
            onClick={() => onView(exp)}
            title={exp.description}
            subtitle={[exp.vendor_name, formatDate(exp.expense_date)].filter(Boolean).join(' · ')}
            right={<span className="text-sm font-semibold text-navy">{formatCurrency(exp.amount)}</span>}
            meta={
              <>
                <CategoryChip category={exp.category} />
                {exp.status && exp.status !== 'Completed' && <StatusBadge status={exp.status} />}
                <span>{exp.profiles?.full_name?.split(' ')[0] || 'System'}</span>
              </>
            }
          />
        ))}
      </MobileList>
    </>
  );
};
