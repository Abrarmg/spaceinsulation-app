import React from 'react';
import { Receipt, Plus } from 'lucide-react';
import { Button, EmptyState } from '../../components/ui';

interface EmptyExpenseStateProps {
  onAddExpense: () => void;
  /** True when filters are hiding results, rather than there being no expenses at all. */
  filtered?: boolean;
}

export const EmptyExpenseState: React.FC<EmptyExpenseStateProps> = ({ onAddExpense, filtered }) =>
  filtered ? (
    <EmptyState icon={Receipt} title="No expenses match" description="Try another month, category or search." />
  ) : (
    <EmptyState
      icon={Receipt}
      title="No expenses yet"
      description="Log fuel, materials, equipment and other costs to see where the money goes."
      action={
        <Button icon={Plus} onClick={onAddExpense}>
          Add expense
        </Button>
      }
    />
  );
