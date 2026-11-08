import {
  Home,
  Calendar,
  Inbox,
  Users,
  FileText,
  ClipboardList,
  FileSpreadsheet,
  Receipt,
  HardHat,
  StickyNote,
  Settings,
  User,
  UserPlus,
  FilePlus2,
  CalendarPlus,
  ReceiptText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  name: string;
  /** Short label for the phone tab bar. */
  short?: string;
  path: string;
  icon: LucideIcon;
  /** Extra path prefixes that should also highlight this item. */
  alsoActive?: string[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/**
 * Office menu, ordered the way work flows through the business:
 * lead → contact → estimate → job → invoice.
 */
export const OFFICE_NAV: NavGroup[] = [
  {
    items: [
      { name: 'Dashboard', short: 'Home', path: '/', icon: Home },
      { name: 'Scheduling', short: 'Schedule', path: '/scheduling', icon: Calendar },
    ],
  },
  {
    label: 'Workflow',
    items: [
      { name: 'Leads', path: '/leads', icon: Inbox },
      { name: 'Contacts', path: '/contacts', icon: Users, alsoActive: ['/customers'] },
      { name: 'Estimates', path: '/estimates', icon: FileText },
      { name: 'Jobs', path: '/jobs', icon: ClipboardList },
      { name: 'Invoices', path: '/invoices', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'Business',
    items: [
      { name: 'Expenses', path: '/expenses', icon: Receipt, alsoActive: ['/net-profit-breakdown'] },
      { name: 'Employees', path: '/employees', icon: HardHat },
      { name: 'Internal Notes', short: 'Notes', path: '/notes', icon: StickyNote },
    ],
  },
];

export const OFFICE_FOOTER_NAV: NavItem[] = [{ name: 'Settings', path: '/settings', icon: Settings }];

export const WORKER_NAV: NavGroup[] = [
  {
    items: [
      { name: 'Dashboard', short: 'Home', path: '/worker-dashboard', icon: Home },
      { name: 'My Jobs', short: 'Jobs', path: '/jobs', icon: ClipboardList, alsoActive: ['/worker-jobs'] },
      { name: 'Estimates', path: '/estimates', icon: FileText },
      { name: 'My Profile', short: 'Profile', path: '/profile', icon: User },
    ],
  },
];

/** Phone tab bar for office staff. "Create" and "More" are added by the tab bar itself. */
export const OFFICE_TABS: NavItem[] = [
  OFFICE_NAV[0].items[0],
  OFFICE_NAV[0].items[1],
  OFFICE_NAV[1].items[3], // Jobs
];

export interface CreateItem {
  name: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

/** Everything the "+ Create" button can start, in workflow order. */
export const CREATE_ITEMS: CreateItem[] = [
  { name: 'Contact', description: 'Add a new customer', path: '/contacts?new=1', icon: UserPlus },
  { name: 'Estimate', description: 'Price out a job', path: '/estimates/new', icon: FilePlus2 },
  { name: 'Job', description: 'Book work on the schedule', path: '/scheduling?new=1', icon: CalendarPlus },
  { name: 'Invoice', description: 'Bill a customer', path: '/invoices/new', icon: ReceiptText },
  { name: 'Expense', description: 'Log a business cost', path: '/expenses?new=1', icon: Receipt },
];

export const isNavItemActive = (item: NavItem, pathname: string) => {
  const prefixes = [item.path, ...(item.alsoActive ?? [])];
  return prefixes.some(p => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)));
};

/**
 * The phone tab bar shows only on top-level screens; detail pages and
 * builders keep the full height for their own action bars.
 */
export const shouldShowTabBar = (pathname: string) => pathname.split('/').filter(Boolean).length <= 1;
