import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import cfg2026 from '../../config/tax/2026.json';
import { ReportView } from '@/components/reports/report-view';
import { TaxView, type TaxViewData } from '@/components/tax/tax-view';
import el from '@/i18n/messages/el.json';
import en from '@/i18n/messages/en.json';
import { buildReport } from '@/lib/report';
import type { TaxConfig } from '@/lib/tax/config';
import { DEFAULT_TAX_PROFILE, estimateYear } from '@/lib/tax/estimate';

// The move buttons are client components that refresh the router after a move.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));

// UI contract: every tax figure is labelled an estimate with the disclaimer and [uncertain] items; the report
// snapshot shows every PLAN 6.7 section from stored figures.

function render(node: ReactNode, locale: 'el' | 'en') {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'el' ? el : en} timeZone="Europe/Athens">
      {node}
    </NextIntlClientProvider>,
  );
  return html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/ | /g, ' ').replace(/\s+/g, ' ');
}

const cfg = cfg2026 as unknown as TaxConfig;
const invoices = [3, 9].map((m) => ({ id: `i${m}`, date: `2026-0${m}-15`, netMinor: 600000 }));
const profile = { ...DEFAULT_TAX_PROFILE, employmentIncomeMinor: 1800000, vatRegime: 'smallBusinessExempt' as const };
const data: TaxViewData = {
  taxYear: 2026,
  throughMonth: 10,
  efkaDueThrough: 9,
  configYear: 2026,
  configFallback: false,
  hasFreelance: true,
  full: estimateYear({ taxYear: 2026, profile, config: cfg, invoices }),
  ytd: estimateYear({ taxYear: 2026, profile, config: cfg, invoices, throughMonth: 10 }),
  invoiceMeta: { i3: { source: 'Client A' }, i9: { source: 'Client B' } },
  moved: { 'tax:invoice:i3': { amountMinor: 1000, localDate: '2026-03-16' } },
  reserve: { accountId: 'r', name: 'Tax reserve', balanceMinor: 1000 },
  movedThisYearMinor: 1000,
  dueNowMinor: 5000,
};

describe('tax view', () => {
  it('labels every block an estimate, shows the disclaimer, the formula and the open questions', () => {
    for (const locale of ['en', 'el'] as const) {
      const m = locale === 'en' ? en : el;
      const text = render(<TaxView data={data} currency="EUR" profile={null} rates={null} />, locale);
      expect(text.split(m.disclaimers.tax).length - 1).toBe(2);
      for (const key of ['now', 'ytd', 'fullYear', 'invoices', 'months'] as const) expect(text).toContain(`${m.tax[key]} (${m.tax.estimate})`);
      expect(text).toContain(m.tax.formula);
      for (const q of m.tax.uncertain) expect(text).toContain(q);
      expect(text).toContain(m.tax.uncertainTag);
    }
  });

  it('marks the VAT-crossing invoice and what has been moved', () => {
    const text = render(<TaxView data={data} currency="EUR" profile={null} rates={null} />, 'en');
    expect(data.full.vatCrossedOn).toBe('2026-09-15');
    expect(text).toContain('15 Sept: This invoice crosses the €10,000 small-business limit');
    expect(text).toContain('Moved 16 Mar');
    expect(text).toContain('Move to reserve');
    expect(text).toContain('in progress');
  });

  it('points to the income sources when no freelance income exists', () => {
    const text = render(<TaxView data={{ ...data, hasFreelance: false }} currency="EUR" profile={null} rates={null} />, 'en');
    expect(text).toContain(en.tax.noFreelanceTitle);
    expect(text).not.toContain(en.tax.now);
  });
});

describe('report view', () => {
  const report = buildReport({
    month: '2026-09',
    currency: 'EUR',
    rows: [
      { kind: 'income', status: 'done', amountMinor: 200000, localDate: '2026-09-25', categoryId: null, incomeSourceId: null, accountId: null, toAccountId: null },
      { kind: 'expense', status: 'done', amountMinor: 50000, localDate: '2026-09-02', categoryId: 'rent', incomeSourceId: null, accountId: null, toAccountId: null },
      { kind: 'income', status: 'done', amountMinor: 100000, localDate: '2026-08-25', categoryId: null, incomeSourceId: null, accountId: null, toAccountId: null },
    ],
    categories: [{ id: 'rent', name: 'Rent', parentId: null, color: 1 }],
    budgets: [{ categoryId: null, amountMinor: 40000 }],
    goals: [{ id: 'g', name: 'Holiday', targetMinor: 90000, savedAtEndMinor: 45000, contributedInMonthMinor: 9000, isEmergencyFund: false, deadline: null }],
    renewals: [{ name: 'Netflix', date: '2026-10-25', amountMinor: 1399, subscription: true }],
    tax: { reserveBalanceMinor: 10000, estimatedThroughMonthMinor: 25000, movedInMonthMinor: 5000 },
    labels: { overall: 'Overall', none: 'No category' },
  });

  it('computes the snapshot figures', () => {
    expect(report.savingsRateBps).toBe(7500);
    expect(report.change).toEqual({ incomeBps: 10000, expenseBps: null, netMinor: 50000 });
    expect(report.budgets[0]).toMatchObject({ label: 'Overall', usedBps: 12500, over: true });
    expect(report.tax!.gapMinor).toBe(15000);
    expect(buildReport({ ...{ month: '2026-09', currency: 'EUR', rows: [], categories: [], budgets: [], goals: [], renewals: [], tax: null, labels: { overall: 'x', none: 'y' } } }).savingsRateBps).toBeNull();
  });

  it('renders every section, in both languages', () => {
    const text = render(<ReportView data={report} generatedAt="2026-10-01T06:00:00.000Z" />, 'en');
    expect(text).toContain('Snapshot taken 1 October 2026');
    expect(text).toContain('Savings rate 75 %');
    expect(text).toContain('+100 % vs August 2026');
    expect(text).toContain('Rent');
    expect(text).toContain('over budget');
    expect(text).toContain('Holiday');
    expect(text).toContain('90.00 added this month');
    expect(text).toContain('Netflix');
    expect(text).toContain('Tax reserve (estimate)');
    expect(text).toContain(en.disclaimers.tax);
    const greek = render(<ReportView data={report} generatedAt="2026-10-01T06:00:00.000Z" />, 'el');
    expect(greek).toContain('Ποσοστό αποταμίευσης');
    expect(greek).toContain('Αποθεματικό φόρων (εκτίμηση)');
  });
});
