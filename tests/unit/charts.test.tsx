import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IncomeExpenseBars } from '@/components/charts/bars';
import { BudgetBars } from '@/components/charts/budget-bars';
import { Donut } from '@/components/charts/donut';
import { NetWorthLine } from '@/components/charts/line';
import { percentages } from '@/components/charts/shared';

// The charts render their exact numbers into a hidden table; these tests read them back from the markup.
const norm = (html: string) => html.replace(/\u00a0|&nbsp;/g, ' ');
const cells = (html: string) => [...html.matchAll(/<t[hd][^>]*>([^<]*)<\/t[hd]>/g)].map((m) => m[1]!.replace(/&nbsp;| /g, ' '));

describe('chart components render the fixture totals', () => {
  it('donut lists every slice with shares that add up to 100 %', () => {
    const slices = [
      { key: 'home', label: 'Σπίτι', color: 1, valueMinor: 68450 },
      { key: 'food', label: 'Σούπερ μάρκετ', color: 3, valueMinor: 21030 },
      { key: 'none', label: '—', color: 8, valueMinor: 4500 },
    ];
    const html = norm(renderToStaticMarkup(<Donut title="Έξοδα" slices={slices} currency="EUR" locale="el-GR" totalLabel="Σύνολο" emptyLabel="—" head={['Κατηγορία', 'Ποσό', 'Μερίδιο']} />));
    const c = cells(html);
    expect(c).toContain('684,50 €');
    expect(c).toContain('210,30 €');
    expect(html).toContain('939,80 €'); // centre total
    const shares = c.filter((x) => x.endsWith('%')).map((x) => Number.parseFloat(x));
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  });

  it('bars and line list each month', () => {
    const bars = renderToStaticMarkup(
      <IncomeExpenseBars
        title="Ανά μήνα"
        bars={[
          { month: '2026-09', inMinor: 182000, outMinor: 93980 },
          { month: '2026-10', inMinor: 150000, outMinor: 87000 },
        ]}
        currency="EUR"
        locale="el-GR"
        labels={{ in: 'Έσοδα', out: 'Έξοδα', month: 'Μήνας' }}
        monthLabel={(m) => m}
      />,
    );
    expect(cells(bars)).toEqual(['Μήνας', 'Έσοδα', 'Έξοδα', '2026-09', '1.820,00 €', '939,80 €', '2026-10', '1.500,00 €', '870,00 €']);
    const line = renderToStaticMarkup(
      <NetWorthLine title="Περιουσία" points={[{ month: '2026-09', valueMinor: 692520 }, { month: '2026-10', valueMinor: 755520 }]} currency="EUR" locale="el-GR" labels={{ month: 'Μήνας', value: 'Αξία' }} monthLabel={(m) => m} />,
    );
    expect(cells(line)).toEqual(['Μήνας', 'Αξία', '2026-09', '6.925,20 €', '2026-10', '7.555,20 €']);
  });

  it('budget bars expose spent and limit as a meter', () => {
    const html = norm(renderToStaticMarkup(
      <BudgetBars
        items={[{ categoryId: 'home', label: 'Σπίτι', color: 1, budgetMinor: 60000, spentMinor: 66000, usedBps: 11000, reached: 100 }]}
        currency="EUR"
        locale="el-GR"
        labels={{ of: (a, b) => `${a} / ${b}`, over: (a) => `+${a}`, left: (a) => a, warning: 'w', overState: 'over' }}
      />,
    ));
    expect(html).toContain('aria-valuenow="600"');
    expect(html).toContain('aria-valuemax="600"');
    expect(html).toContain('660,00 € / 600,00 €');
    expect(html).toContain('+60,00 €');
  });

  it('percentages always sum to 100.0', () => {
    const p = percentages([1, 1, 1]).map(Number);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
    expect(percentages([0, 0])).toEqual(['0', '0']);
  });
});
