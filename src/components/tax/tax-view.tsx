import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Money } from '@/components/data/money';
import { Section } from '@/components/shell/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { formatDay, formatMonth, intlLocale } from '@/lib/intl';
import type { YearEstimate } from '@/lib/tax/estimate';
import { cn } from '@/lib/cn';
import { MoveButton } from './actions';

// The tax/EFKA estimator (PLAN 6.5). Every figure is an estimate: the disclaimer sits above, every section title and
// money column says "estimate", and [uncertain] rules are listed with the numbers they affect.

export interface TaxViewData {
  taxYear: number;
  throughMonth: number;
  efkaDueThrough: number;
  configYear: number;
  configFallback: boolean;
  hasFreelance: boolean;
  full: YearEstimate;
  ytd: YearEstimate;
  invoiceMeta: Record<string, { source: string }>;
  moved: Record<string, { amountMinor: number; localDate: string }>;
  reserve: { accountId: string | null; name: string | null; balanceMinor: number };
  movedThisYearMinor: number;
  dueNowMinor: number;
}

const invoiceKey = (id: string) => `tax:invoice:${id}`;
const efkaKey = (y: number, m: number) => `tax:efka:${y}-${String(m).padStart(2, '0')}`;

function Row({ label, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 border-b border-rule py-2', strong && 'font-semibold')}>
      <dt className="min-w-0">{label}</dt>
      <dd className="shrink-0 text-right">{children}</dd>
    </div>
  );
}

export function TaxView({ data, currency, profile, rates }: { data: TaxViewData; currency: string; profile: ReactNode; rates: ReactNode }) {
  const t = useTranslations('tax');
  const td = useTranslations('disclaimers');
  const locale = useLocale();
  const loc = intlLocale(locale);
  const mo = (minor: number, className?: string) => <Money minor={minor} currency={currency} locale={loc} className={className} />;
  const est = (label: string) => `${label} (${t('estimate')})`;
  const day = (d: string) => formatDay(d, locale, { day: 'numeric', month: 'short' });
  const monthName = (m: number) => formatMonth(`${data.taxYear}-${String(m).padStart(2, '0')}`, locale).replace(/\s\d{4}$/, '');
  const { full, ytd } = data;
  const crossing = full.invoices.find((l) => l.vatCrossing);

  const totals = (e: YearEstimate) => (
    <dl>
      <Row label={t('vat')}>{mo(e.totals.vatMinor)}</Row>
      <Row label={t('incomeTax')}>{mo(e.months.reduce((s, r) => s + r.incomeTaxFromInvoicesMinor + r.efkaEffectMinor, 0))}</Row>
      <Row label={t('efka')}>{mo(e.totals.efkaMinor)}</Row>
      <Row label={t('total')} strong>
        {mo(e.months.reduce((s, r) => s + r.setAsideMinor, 0))}
      </Row>
    </dl>
  );

  return (
    <div>
      <Notice tone="info" className="mb-6">
        {td('tax')}
      </Notice>
      {data.configFallback && (
        <Notice tone="warning" className="mb-6">
          {t('fallback', { year: data.taxYear, configYear: data.configYear })}
        </Notice>
      )}

      {!data.hasFreelance ? (
        <EmptyState
          title={t('noFreelanceTitle')}
          body={t('noFreelanceBody')}
          action={
            <Link href="/income" prefetch={false} className="font-medium text-accent hover:underline">
              {t('openIncome')}
            </Link>
          }
        />
      ) : (
        <>
          <Section title={est(t('now'))}>
            <p className="num text-3xl font-semibold lg:text-4xl">{mo(data.dueNowMinor)}</p>
            <p className="mt-2 max-w-prose text-ink-2">{t('nowHint')}</p>
            <dl className="mt-4 max-w-xl">
              <Row label={data.reserve.name ?? t('reserve')}>{mo(data.reserve.balanceMinor)}</Row>
              <Row label={t('movedThisYear')}>{mo(data.movedThisYearMinor)}</Row>
            </dl>
            {!data.reserve.accountId && <p className="mt-2 text-sm text-ink-2">{t('noReserve')}</p>}
          </Section>

          <div className="grid gap-x-12 lg:grid-cols-2">
            <Section title={est(t('ytd'))}>{totals(ytd)}</Section>
            <Section title={est(t('fullYear'))}>
              {totals(full)}
              <dl className="mt-4 text-sm text-ink-2">
                <Row label={t('profit')}>{mo(full.totals.businessProfitMinor)}</Row>
                <Row label={t('taxOnEmployment')}>{mo(full.totals.taxOnEmploymentMinor)}</Row>
                {full.totals.withheldMinor > 0 && <Row label={t('withheld')}>{mo(full.totals.withheldMinor)}</Row>}
                <Row label={`${t('prepayment')} ${t('uncertainTag')}`}>{mo(full.totals.prepaymentNextYearMinor)}</Row>
              </dl>
              <p className="mt-2 text-sm text-ink-2">{t('prepaymentHint')}</p>
            </Section>
          </div>

          <Section title={est(t('invoices'))}>
            <p className="mb-4 max-w-prose border-l-2 border-rule-strong pl-3 text-sm text-ink-2">{t('formula')}</p>
            {crossing && (
              <Notice tone="warning" className="mb-4">
                {day(crossing.date)}: {t('crossing')}
              </Notice>
            )}
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left">
                <thead className="text-sm text-ink-2">
                  <tr className="border-b border-rule">
                    <th scope="col" className="py-2 font-medium">{t('date')}</th>
                    <th scope="col" className="py-2 text-right font-medium">{t('net')}</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">{t('vat')}</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">{t('incomeTax')}</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">{t('setAside')}</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">
                      <span className="sr-only">{t('move')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {full.invoices.map((l) => {
                    const moved = data.moved[invoiceKey(l.id)];
                    return (
                      <tr key={l.id} className="border-b border-rule align-baseline">
                        <th scope="row" className="py-2.5 font-normal">
                          <span className="font-medium">{day(l.date)}</span>
                          <span className="block text-sm text-ink-2">{data.invoiceMeta[l.id]?.source}</span>
                          {l.vatCrossing && (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-warning">
                              <AlertTriangle aria-hidden className="size-3.5" strokeWidth={2} />
                              {t('vat')}
                            </span>
                          )}
                        </th>
                        <td className="py-2.5 text-right">{mo(l.netMinor)}</td>
                        <td className="py-2.5 pl-3 text-right text-ink-2">{mo(l.vatMinor)}</td>
                        <td className="py-2.5 pl-3 text-right text-ink-2">{mo(l.incomeTaxMinor)}</td>
                        <td className="py-2.5 pl-3 text-right">{mo(l.setAsideMinor, 'font-semibold')}</td>
                        <td className="py-2.5 pl-3 text-right">
                          {moved ? (
                            <span className="text-sm whitespace-nowrap text-ink-2">{t('moved', { date: day(moved.localDate) })}</span>
                          ) : l.setAsideMinor > 0 ? (
                            <MoveButton path={`/api/tax/set-aside/${l.id}`} label={t('move')} />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={est(t('months'))}>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-ink-2">
                  <tr className="border-b border-rule">
                    <th scope="col" className="py-2 font-medium">{t('month')}</th>
                    <th scope="col" className="py-2 text-right font-medium">{t('net')}</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">{t('vat')}</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">{t('incomeTax')}</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">{t('efkaEffect')}</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">{t('efka')}</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">{t('cumulative')}</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">
                      <span className="sr-only">{t('moveEfka')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {full.months.map((r) => {
                    const moved = data.moved[efkaKey(data.taxYear, r.month)];
                    const open = r.month > data.efkaDueThrough;
                    return (
                      <tr key={r.month} className={cn('border-b border-rule align-baseline', r.month > data.throughMonth && 'text-ink-3')}>
                        <th scope="row" className="py-2 pr-2 font-medium whitespace-nowrap capitalize">{monthName(r.month)}</th>
                        <td className="py-2 text-right">{mo(r.netMinor)}</td>
                        <td className="py-2 pl-3 text-right">{mo(r.vatMinor)}</td>
                        <td className="py-2 pl-3 text-right">{mo(r.incomeTaxFromInvoicesMinor)}</td>
                        <td className="py-2 pl-3 text-right">{mo(r.efkaEffectMinor)}</td>
                        <td className="py-2 pl-3 text-right">{mo(r.efkaMinor)}</td>
                        <td className="py-2 pl-3 text-right">{mo(r.cumulativeIncomeTaxMinor)}</td>
                        <td className="py-2 pl-3 text-right">
                          {r.efkaMinor > 0 &&
                            (moved ? (
                              <span className="whitespace-nowrap text-ink-2">{t('moved', { date: day(moved.localDate) })}</span>
                            ) : open ? (
                              <span className="whitespace-nowrap text-ink-3">{t('monthOpen')}</span>
                            ) : (
                              <MoveButton path={`/api/tax/set-aside-efka/${data.taxYear}-${String(r.month).padStart(2, '0')}`} label={t('moveEfka')} />
                            ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}

      {profile}
      {rates}

      <Section title={t('uncertainTitle')}>
        <ul className="flex max-w-prose list-disc flex-col gap-1.5 pl-5 text-ink-2 marker:text-ink-3">
          {(t.raw('uncertain') as string[]).map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-2">{td('tax')}</p>
      </Section>
    </div>
  );
}
