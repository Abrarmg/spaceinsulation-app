export interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  expense_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  
  // New SaaS Features
  vendor_name?: string | null;
  expense_type?: string | null;
  tax_amount?: number;
  currency?: string;
  payment_method?: string | null;
  job_id?: string | null;
  invoice_number?: string | null;
  is_recurring?: boolean;
  receipt_url?: string | null;
  status?: string;

  // Joined relations
  profiles?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

export const EXPENSE_CATEGORIES = [
  'Materials',
  'Fuel',
  'Payroll',
  'Office',
  'Equipment',
  'Maintenance',
  'Travel',
  'Utilities',
  'Marketing',
  'Insurance',
  'Rent',
  'Other'
];

export const CATEGORY_COLORS: Record<string, { bg: string, text: string }> = {
  'Materials': { bg: '#F0FDF4', text: '#15803D' },   // Green
  'Fuel': { bg: '#FFF7ED', text: '#C2410C' },        // Orange
  'Payroll': { bg: '#EFF6FF', text: '#1D4ED8' },     // Blue
  'Office': { bg: '#FAF5FF', text: '#7E22CE' },      // Purple
  'Equipment': { bg: '#FEFCE8', text: '#A16207' },   // Yellow
  'Maintenance': { bg: '#FEF2F2', text: '#B91C1C' }, // Red
  'Travel': { bg: '#ECFEFF', text: '#0E7490' },      // Cyan
  'Utilities': { bg: '#F3F4F6', text: '#374151' },   // Gray
  'Marketing': { bg: '#FDF2F8', text: '#BE185D' },   // Pink
  'Insurance': { bg: '#EEF2FF', text: '#4338CA' },   // Indigo
  'Rent': { bg: '#F8FAFC', text: '#475569' },        // Slate
  'Other': { bg: '#F1F5F9', text: '#475569' },       // Slate
};
