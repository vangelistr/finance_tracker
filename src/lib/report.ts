import { budgetProgress, expensesByCategory, type BudgetRow, type CategoryRef, type TxRow } from './aggregates';
import { addMonthsToMonth, monthBounds, type LocalDate, type Month } from './dates';

// Month-end report (PLAN 6.7): a pure builder from the closed month's data. The result is stored as an immutable
// snapshot of computed figures, so later edits to transactions, budgets or goals never change a past report.

export const REPORT_SCHEMA_VERSION = 1;
const TOP_CATEGORIES = 5;

export interface ReportInput {
  month: Month;
  currency: string;
  /** Done transactions of the month and of the month before. */
  rows: TxRow[];
  categories: CategoryRef[];
  budgets: BudgetRow[];
  goals: Array<{ id: string; name: string; targetMinor: number; savedAtEndMinor: number; contributedInMonthMinor: number; isEmergencyFund: boolean; deadline: LocalDate | null }>;
  /** Subscription renewals and fixed costs expected next month. */
  renewals: Array<{ name: string; date: LocalDate; amountMinor: number; subscription: boolean }>;
  tax: { reserveBalanceMinor: number; estimatedThroughMonthMinor: number; movedInMonthMinor: number } | null;
  labels: { overall: string; none: string };
}

export interface ReportTotals {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

export interface ReportData {
  month: Month;
  currency: string;
  totals: ReportTotals;
  /** (income − expenses) / income in basis points; null without income. */
  savingsRateBps: number | null;
  previous: (ReportTotals & { month: Month }) | null;
  /** Month-over-month change; percentages are null when the previous value is zero. */
  change: { incomeBps: number | null; expenseBps: number | null; netMinor: number } | null;
  topCategories: Array<{ label: string; color: number; amountMinor: number; shareBps: number }>;
  budgets: Array<{ label: string; color: number; budgetMinor: number; spentMinor: number; usedBps: number; over: boolean }>;
  goals: Array<{ name: string; targetMinor: number; savedMinor: number; contributedMinor: number; progressBps: number; isEmergencyFund: boolean; deadline: LocalDate | null }>;
  renewals: Array<{ name: string; date: LocalDate; amountMinor: number; subscription: boolean }>;
  renewalsTotalMinor: number;
  tax: { reserveBalanceMinor: number; estimatedThroughMonthMinor: number; movedInMonthMinor: number; gapMinor: number } | null;
}

function totalsOf(rows: TxRow[], month: Month): ReportTotals {
  const { first, last } = monthBounds(month);
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.status !== 'done' || r.localDate < first || r.localDate > last) continue;
    if (r.kind === 'income') income += r.amountMinor;
    else if (r.kind === 'expense') expense += r.amountMinor;
  }
  return { incomeMinor: income, expenseMinor: expense, netMinor: income - expense };
}

const pctChange = (now: number, before: number) => (before === 0 ? null : Math.round(((now - before) * 10_000) / before));

export function buildReport(i: ReportInput): ReportData {
  const totals = totalsOf(i.rows, i.month);
  const prevMonth = addMonthsToMonth(i.month, -1);
  const prev = totalsOf(i.rows, prevMonth);
  const hasPrev = i.rows.some((r) => r.status === 'done' && r.localDate.startsWith(prevMonth));
  const { first, last } = monthBounds(i.month);

  const slices = expensesByCategory(i.rows, i.categories, first, last, { none: i.labels.none })
    .sort((a, b) => b.valueMinor - a.valueMinor || (a.label < b.label ? -1 : 1))
    .slice(0, TOP_CATEGORIES);

  return {
    month: i.month,
    currency: i.currency,
    totals,
    savingsRateBps: totals.incomeMinor > 0 ? Math.round((totals.netMinor * 10_000) / totals.incomeMinor) : null,
    previous: hasPrev ? { month: prevMonth, ...prev } : null,
    change: hasPrev ? { incomeBps: pctChange(totals.incomeMinor, prev.incomeMinor), expenseBps: pctChange(totals.expenseMinor, prev.expenseMinor), netMinor: totals.netMinor - prev.netMinor } : null,
    topCategories: slices.map((s) => ({ label: s.label, color: s.color, amountMinor: s.valueMinor, shareBps: totals.expenseMinor > 0 ? Math.round((s.valueMinor * 10_000) / totals.expenseMinor) : 0 })),
    budgets: budgetProgress(i.rows, i.budgets, i.categories, i.month, [], { overall: i.labels.overall }).map((b) => ({
      label: b.label,
      color: b.color,
      budgetMinor: b.budgetMinor,
      spentMinor: b.spentMinor,
      usedBps: b.usedBps,
      over: b.spentMinor > b.budgetMinor,
    })),
    goals: i.goals.map((g) => ({
      name: g.name,
      targetMinor: g.targetMinor,
      savedMinor: g.savedAtEndMinor,
      contributedMinor: g.contributedInMonthMinor,
      progressBps: g.targetMinor > 0 ? Math.min(10_000, Math.floor((g.savedAtEndMinor * 10_000) / g.targetMinor)) : 0,
      isEmergencyFund: g.isEmergencyFund,
      deadline: g.deadline,
    })),
    renewals: [...i.renewals].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name < b.name ? -1 : 1)),
    renewalsTotalMinor: i.renewals.reduce((s, r) => s + r.amountMinor, 0),
    tax: i.tax ? { ...i.tax, gapMinor: Math.max(0, i.tax.estimatedThroughMonthMinor - i.tax.reserveBalanceMinor) } : null,
  };
}
