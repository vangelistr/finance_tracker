import {
  BarChart3,
  CalendarDays,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  PiggyBank,
  Receipt,
  Repeat,
  Settings,
  Tags,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  key: string; // message key under `nav`
  href: string;
  icon: LucideIcon;
  investingOnly?: boolean;
}

// Destinations in reading order. Items are added here as their screens ship (see docs/PROGRESS.md).
export const NAV: NavItem[] = [
  { key: 'dashboard', href: '/', icon: LayoutDashboard },
  { key: 'transactions', href: '/transactions', icon: ListOrdered },
  { key: 'calendar', href: '/calendar', icon: CalendarDays },
  { key: 'budgets', href: '/budgets', icon: Gauge },
  { key: 'income', href: '/income', icon: Wallet },
  { key: 'fixed', href: '/fixed', icon: Repeat },
  { key: 'accounts', href: '/accounts', icon: Landmark },
  { key: 'categories', href: '/categories', icon: Tags },
  { key: 'settings', href: '/settings', icon: Settings },
];

// Planned destinations, listed so the shell layout is designed for its final size.
export const PLANNED: NavItem[] = [
  { key: 'goals', href: '/goals', icon: PiggyBank },
  { key: 'plan', href: '/plan', icon: BarChart3 },
  { key: 'reports', href: '/reports', icon: FileText },
  { key: 'tax', href: '/tax', icon: Receipt },
  { key: 'investing', href: '/investing', icon: LineChart, investingOnly: true },
];

/** Mobile bottom bar: the first two and the last destination flank the central Add button; the rest go to More. */
export const BOTTOM_BAR_KEYS = ['dashboard', 'transactions', 'calendar'];

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
