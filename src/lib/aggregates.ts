import { compareLocalDates, monthBounds, type LocalDate, type Month } from './dates';

// Pure aggregations behind the dashboard charts and budgets. Inputs are plain rows (no database), amounts are integer
// cents, only completed ("done") transactions count; expected and skipped items never move a chart.

export interface TxRow {
  kind: 'income' | 'expense' | 'transfer';
  status: 'expected' | 'done' | 'skipped';
  amountMinor: number;
  localDate: LocalDate;
  categoryId: string | null;
  incomeSourceId: string | null;
  accountId: string | null;
  toAccountId: string | null;
}

export interface CategoryRef {
  id: string;
  name: string;
  parentId: string | null;
  color: number;
}

export interface Slice {
  key: string;
  label: string;
  color: number;
  valueMinor: number;
}

const inRange = (d: LocalDate, from: LocalDate, to: LocalDate) => compareLocalDates(d, from) >= 0 && compareLocalDates(d, to) <= 0;

/** Maps a category to its top-level parent, so subcategory spending rolls up. */
export function topCategory(categories: CategoryRef[]): (id: string | null) => CategoryRef | null {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return (id) => {
    let c = id ? byId.get(id) : undefined;
    while (c?.parentId) c = byId.get(c.parentId) ?? undefined;
    return c ?? null;
  };
}

/** Keeps the largest `max - 1` slices and folds the rest into one "other" slice; the total never changes. */
export function foldSlices(slices: Slice[], max: number, otherLabel: string): Slice[] {
  const sorted = [...slices].filter((s) => s.valueMinor > 0).sort((a, b) => b.valueMinor - a.valueMinor || a.label.localeCompare(b.label));
  if (sorted.length <= max) return sorted;
  const head = sorted.slice(0, max - 1);
  const rest = sorted.slice(max - 1).reduce((s, x) => s + x.valueMinor, 0);
  return [...head, { key: 'other', label: otherLabel, color: 8, valueMinor: rest }];
}

export function expensesByCategory(rows: TxRow[], categories: CategoryRef[], from: LocalDate, to: LocalDate, labels: { none: string }): Slice[] {
  const top = topCategory(categories);
  const totals = new Map<string, Slice>();
  for (const r of rows) {
    if (r.kind !== 'expense' || r.status !== 'done' || !inRange(r.localDate, from, to)) continue;
    const c = top(r.categoryId);
    const key = c?.id ?? 'none';
    const slice = totals.get(key) ?? { key, label: c?.name ?? labels.none, color: c?.color ?? 8, valueMinor: 0 };
    slice.valueMinor += r.amountMinor;
    totals.set(key, slice);
  }
  return [...totals.values()];
}

export function incomeBySource(
  rows: TxRow[],
  sources: Array<{ id: string; name: string }>,
  from: LocalDate,
  to: LocalDate,
  labels: { none: string },
): Slice[] {
  const names = new Map(sources.map((s) => [s.id, s.name]));
  const totals = new Map<string, Slice>();
  let colour = 0;
  for (const r of rows) {
    if (r.kind !== 'income' || r.status !== 'done' || !inRange(r.localDate, from, to)) continue;
    const key = r.incomeSourceId ?? 'none';
    let slice = totals.get(key);
    if (!slice) {
      slice = { key, label: (r.incomeSourceId && names.get(r.incomeSourceId)) || labels.none, color: (colour++ % 7) + 1, valueMinor: 0 };
      totals.set(key, slice);
    }
    slice.valueMinor += r.amountMinor;
  }
  return [...totals.values()];
}

export interface MonthBar {
  month: Month;
  inMinor: number;
  outMinor: number;
}

export function incomeVsExpenses(rows: TxRow[], months: Month[]): MonthBar[] {
  const bars = new Map(months.map((m) => [m, { month: m, inMinor: 0, outMinor: 0 }]));
  for (const r of rows) {
    if (r.status !== 'done') continue;
    const bar = bars.get(r.localDate.slice(0, 7));
    if (!bar) continue;
    if (r.kind === 'income') bar.inMinor += r.amountMinor;
    else if (r.kind === 'expense') bar.outMinor += r.amountMinor;
  }
  return months.map((m) => bars.get(m)!);
}

export interface AccountRef {
  id: string;
  openingBalanceMinor: number;
  openingDate: LocalDate;
}

export interface Point {
  month: Month;
  valueMinor: number;
}

/**
 * Net worth at each month end: opening balances of accounts opened by then, plus completed income minus completed
 * spending booked to an account. Transfers move money between accounts and leave the total unchanged.
 */
export function netWorthSeries(rows: TxRow[], accounts: AccountRef[], months: Month[]): Point[] {
  const known = new Set(accounts.map((a) => a.id));
  return months.map((month) => {
    const { last } = monthBounds(month);
    let value = accounts.filter((a) => compareLocalDates(a.openingDate, last) <= 0).reduce((s, a) => s + a.openingBalanceMinor, 0);
    for (const r of rows) {
      if (r.status !== 'done' || compareLocalDates(r.localDate, last) > 0) continue;
      if (r.kind === 'income' && r.accountId && known.has(r.accountId)) value += r.amountMinor;
      else if (r.kind === 'expense' && r.accountId && known.has(r.accountId)) value -= r.amountMinor;
      else if (r.kind === 'transfer') {
        const from = !!r.accountId && known.has(r.accountId);
        const to = !!r.toAccountId && known.has(r.toAccountId);
        if (from && !to) value -= r.amountMinor;
        if (to && !from) value += r.amountMinor;
      }
    }
    return { month, valueMinor: value };
  });
}

export interface BudgetRow {
  categoryId: string | null; // null = overall
  amountMinor: number;
}

export interface BudgetProgress {
  categoryId: string | null;
  label: string;
  color: number;
  budgetMinor: number;
  spentMinor: number;
  /** Spent as a share of the budget in basis points (10000 = 100 %). */
  usedBps: number;
  /** Highest threshold reached (e.g. 80 or 100), or null. */
  reached: number | null;
}

/** Month-to-date spending against each budget; subcategory spending counts toward its top-level category. */
export function budgetProgress(
  rows: TxRow[],
  budgets: BudgetRow[],
  categories: CategoryRef[],
  month: Month,
  thresholds: number[],
  labels: { overall: string },
): BudgetProgress[] {
  const { first, last } = monthBounds(month);
  const top = topCategory(categories);
  const spentByTop = new Map<string, number>();
  let overall = 0;
  for (const r of rows) {
    if (r.kind !== 'expense' || r.status !== 'done' || !inRange(r.localDate, first, last)) continue;
    overall += r.amountMinor;
    const c = top(r.categoryId);
    if (c) spentByTop.set(c.id, (spentByTop.get(c.id) ?? 0) + r.amountMinor);
  }
  const sortedThresholds = [...thresholds].sort((a, b) => a - b);
  const byId = new Map(categories.map((c) => [c.id, c]));
  return budgets
    .filter((b) => b.amountMinor > 0)
    .map((b) => {
      const spent = b.categoryId === null ? overall : (spentByTop.get(b.categoryId) ?? 0);
      const usedBps = Math.floor((spent * 10_000) / b.amountMinor);
      const reached = [...sortedThresholds].reverse().find((t) => usedBps >= t * 100) ?? null;
      const c = b.categoryId ? byId.get(b.categoryId) : undefined;
      return {
        categoryId: b.categoryId,
        label: c?.name ?? labels.overall,
        color: c?.color ?? 8,
        budgetMinor: b.amountMinor,
        spentMinor: spent,
        usedBps,
        reached,
      };
    })
    .sort((a, b) => (a.categoryId === null ? -1 : b.categoryId === null ? 1 : b.usedBps - a.usedBps));
}

/** The months from `from` to `to` inclusive (YYYY-MM). */
export function monthsBetweenInclusive(from: Month, to: Month): Month[] {
  const out: Month[] = [];
  let [y, m] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m === 13) {
      m = 1;
      y++;
    }
  }
  return out;
}
