import { describe, expect, it } from 'vitest';
import {
  budgetProgress,
  expensesByCategory,
  foldSlices,
  incomeBySource,
  incomeVsExpenses,
  monthsBetweenInclusive,
  netWorthSeries,
  type CategoryRef,
  type TxRow,
} from '@/lib/aggregates';

// Fixture: two months of a small household. Totals below are computed by hand.
const categories: CategoryRef[] = [
  { id: 'home', name: 'Σπίτι', parentId: null, color: 1 },
  { id: 'rent', name: 'Ενοίκιο', parentId: 'home', color: 1 },
  { id: 'power', name: 'Ρεύμα', parentId: 'home', color: 1 },
  { id: 'food', name: 'Σούπερ μάρκετ', parentId: null, color: 3 },
  { id: 'fun', name: 'Διασκέδαση', parentId: null, color: 4 },
];

const tx = (over: Partial<TxRow>): TxRow => ({
  kind: 'expense',
  status: 'done',
  amountMinor: 0,
  localDate: '2026-09-01',
  categoryId: null,
  incomeSourceId: null,
  accountId: 'chk',
  toAccountId: null,
  ...over,
});

const rows: TxRow[] = [
  tx({ kind: 'income', amountMinor: 150000, localDate: '2026-09-25', incomeSourceId: 'salary' }),
  tx({ kind: 'income', amountMinor: 32000, localDate: '2026-09-12', incomeSourceId: 'ergo' }),
  tx({ amountMinor: 60000, localDate: '2026-09-01', categoryId: 'rent' }),
  tx({ amountMinor: 8450, localDate: '2026-09-15', categoryId: 'power' }),
  tx({ amountMinor: 21030, localDate: '2026-09-20', categoryId: 'food' }),
  tx({ amountMinor: 4500, localDate: '2026-09-21', categoryId: null, accountId: null }),
  tx({ kind: 'transfer', amountMinor: 20000, localDate: '2026-09-26', toAccountId: 'sav' }),
  tx({ kind: 'income', amountMinor: 150000, localDate: '2026-10-25', incomeSourceId: 'salary' }),
  tx({ amountMinor: 60000, localDate: '2026-10-01', categoryId: 'rent' }),
  tx({ amountMinor: 18000, localDate: '2026-10-10', categoryId: 'food' }),
  tx({ amountMinor: 9000, localDate: '2026-10-11', categoryId: 'fun' }),
  // Never counted: expected and skipped items
  tx({ status: 'expected', amountMinor: 99999, localDate: '2026-10-30', categoryId: 'food' }),
  tx({ status: 'skipped', kind: 'income', amountMinor: 88888, localDate: '2026-10-28', incomeSourceId: 'salary' }),
];

describe('dashboard aggregates match the fixture totals', () => {
  it('donut: expenses by top-level category', () => {
    const slices = expensesByCategory(rows, categories, '2026-09-01', '2026-09-30', { none: '—' });
    const byKey = Object.fromEntries(slices.map((s) => [s.key, s.valueMinor]));
    expect(byKey).toEqual({ home: 68450, food: 21030, none: 4500 });
    expect(slices.reduce((s, x) => s + x.valueMinor, 0)).toBe(93980);
  });

  it('donut: income by source', () => {
    const slices = incomeBySource(rows, [{ id: 'salary', name: 'Wheelsys' }, { id: 'ergo', name: 'Intercruises' }], '2026-09-01', '2026-10-31', { none: '—' });
    expect(Object.fromEntries(slices.map((s) => [s.label, s.valueMinor]))).toEqual({ Wheelsys: 300000, Intercruises: 32000 });
  });

  it('bars: income vs expenses per month', () => {
    expect(incomeVsExpenses(rows, ['2026-08', '2026-09', '2026-10'])).toEqual([
      { month: '2026-08', inMinor: 0, outMinor: 0 },
      { month: '2026-09', inMinor: 182000, outMinor: 93980 },
      { month: '2026-10', inMinor: 150000, outMinor: 87000 },
    ]);
  });

  it('line: net worth at each month end, transfers between known accounts neutral', () => {
    const accounts = [
      { id: 'chk', openingBalanceMinor: 100000, openingDate: '2026-08-31' },
      { id: 'sav', openingBalanceMinor: 500000, openingDate: '2026-09-15' },
    ];
    const series = netWorthSeries(rows, accounts, ['2026-08', '2026-09', '2026-10']);
    // Aug: 100000. Sep: +500000 opening, +182000 in, −89480 out on accounts (4500 had no account) = 692520.
    // Oct: +150000 − 87000 = 755520.
    expect(series).toEqual([
      { month: '2026-08', valueMinor: 100000 },
      { month: '2026-09', valueMinor: 692520 },
      { month: '2026-10', valueMinor: 755520 },
    ]);
  });

  it('budget bars: month-to-date spend vs budget with thresholds', () => {
    const progress = budgetProgress(
      rows,
      [
        { categoryId: null, amountMinor: 100000 },
        { categoryId: 'home', amountMinor: 60000 },
        { categoryId: 'food', amountMinor: 22500 },
        { categoryId: 'fun', amountMinor: 20000 },
      ],
      categories,
      '2026-10',
      [80, 100],
      { overall: 'Συνολικά' },
    );
    expect(progress.map((p) => [p.categoryId, p.spentMinor, p.usedBps, p.reached])).toEqual([
      [null, 87000, 8700, 80],
      ['home', 60000, 10000, 100],
      ['food', 18000, 8000, 80],
      ['fun', 9000, 4500, null],
    ]);
  });

  it('folds small slices without changing the total', () => {
    const slices = Array.from({ length: 10 }, (_, i) => ({ key: `c${i}`, label: `c${i}`, color: 1, valueMinor: (i + 1) * 100 }));
    const folded = foldSlices(slices, 6, 'Άλλα');
    expect(folded).toHaveLength(6);
    expect(folded.at(-1)).toMatchObject({ key: 'other', valueMinor: 100 + 200 + 300 + 400 + 500 });
    expect(folded.reduce((s, x) => s + x.valueMinor, 0)).toBe(5500);
  });

  it('lists the months of a range', () => {
    expect(monthsBetweenInclusive('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});
