import 'server-only';
import type { ObjectId } from 'mongodb';
import {
  budgetProgress,
  expensesByCategory,
  foldSlices,
  incomeBySource,
  incomeVsExpenses,
  monthsBetweenInclusive,
  netWorthSeries,
  type TxRow,
} from '@/lib/aggregates';
import { addMonthsToMonth, monthBounds, monthOf, type LocalDate } from '@/lib/dates';
import { col } from '@/server/db/collections';
import type { TransactionDoc } from '@/server/db/types';

export const RANGES = ['month', '3m', '6m', '12m', 'ytd'] as const;
export type Range = (typeof RANGES)[number];

/** Date span of a range ending in the current month; time series show at least six months. */
export function rangeBounds(range: Range, today: LocalDate) {
  const current = monthOf(today);
  const startMonth =
    range === 'month' ? current : range === 'ytd' ? `${current.slice(0, 4)}-01` : addMonthsToMonth(current, -(Number(range.replace('m', '')) - 1));
  const seriesStart = monthsBetweenInclusive(startMonth, current).length < 6 ? addMonthsToMonth(current, -5) : startMonth;
  return {
    from: `${startMonth}-01`,
    to: monthBounds(current).last,
    months: monthsBetweenInclusive(seriesStart, current),
    current,
  };
}

function trimBefore(months: string[], first: string | undefined): string[] {
  if (!first) return months.slice(-1);
  const kept = months.filter((m) => m >= first);
  return kept.length > 0 ? kept : months.slice(-1);
}

const row = (t: TransactionDoc): TxRow => ({
  kind: t.kind,
  status: t.status,
  amountMinor: t.amountMinor,
  localDate: t.localDate,
  categoryId: t.categoryId?.toHexString() ?? null,
  incomeSourceId: t.incomeSourceId?.toHexString() ?? null,
  accountId: t.accountId?.toHexString() ?? null,
  toAccountId: t.toAccountId?.toHexString() ?? null,
});

export async function loadDashboard(
  userId: ObjectId,
  range: Range,
  today: LocalDate,
  thresholds: number[],
  labels: { none: string; other: string; overall: string },
) {
  const c = await col();
  const b = rangeBounds(range, today);
  const [txs, categories, sources, accounts, budgets] = await Promise.all([
    c.transactions.find({ userId, status: 'done', localDate: { $lte: b.to } }).toArray(),
    c.categories.find({ userId, kind: 'expense' }).toArray(),
    c.incomeSources.find({ userId }).toArray(),
    c.accounts.find({ userId }).toArray(),
    c.budgets.find({ userId }).toArray(),
  ]);
  const rows = txs.map(row);
  const cats = categories.map((x) => ({ id: x._id.toHexString(), name: x.name, parentId: x.parentId?.toHexString() ?? null, color: x.color }));
  return {
    range,
    ...b,
    expenseSlices: foldSlices(expensesByCategory(rows, cats, b.from, b.to, labels), 7, labels.other),
    incomeSlices: foldSlices(
      incomeBySource(rows, sources.map((s) => ({ id: s._id.toHexString(), name: s.name })), b.from, b.to, labels),
      7,
      labels.other,
    ),
    bars: incomeVsExpenses(rows, b.months),
    netWorth: netWorthSeries(
      rows,
      accounts.map((a) => ({ id: a._id.toHexString(), openingBalanceMinor: a.openingBalanceMinor, openingDate: a.openingDate })),
      // Start at the first account's month: before that there is nothing to measure.
      trimBefore(b.months, accounts.map((a) => a.openingDate.slice(0, 7)).sort()[0]),
    ),
    budgets: budgetProgress(
      rows,
      budgets.map((x) => ({ categoryId: x.categoryId?.toHexString() ?? null, amountMinor: x.amountMinor })),
      cats,
      b.current,
      thresholds,
      labels,
    ),
  };
}
