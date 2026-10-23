import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Money } from '@/components/data/money';
import { Section } from '@/components/shell/page-header';
import { cn } from '@/lib/cn';
import { formatDay, formatMonth, intlLocale } from '@/lib/intl';
import { formatMoney } from '@/lib/money';
import type { ReportData } from '@/lib/report';

// A stored month-end snapshot (PLAN 6.7). Server-rendered from the snapshot alone; prints on A4 in light colours.

const pctText = (bps: number, loc: string, signed = false) =>
  `${new Intl.NumberFormat(loc, { maximumFractionDigits: 1, signDisplay: signed ? 'exceptZero' : 'auto' }).format(bps / 100).replace('-', '−')} %`;

function Row({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 border-b border-rule py-2', className)}>
      <dt className="min-w-0">{label}</dt>
      <dd className="shrink-0 text-right">{children}</dd>
    </div>
  );
}

export function ReportView({ data, generatedAt }: { data: ReportData; generatedAt: string }) {
  const t = useTranslations('reports');
  const tt = useTranslations('tax');
  const td = useTranslations('disclaimers');
  const locale = useLocale();
  const loc = intlLocale(locale);
  const cur = data.currency;
  const mo = (minor: number, className?: string, signed = false) => <Money minor={minor} currency={cur} locale={loc} className={className} signed={signed} />;
  const prevName = data.previous ? formatMonth(data.previous.month, locale) : '';

  return (
    <div>
      <p className="mb-6 text-sm text-ink-2">
        {t('generated', { date: formatDay(generatedAt.slice(0, 10), locale, { day: 'numeric', month: 'long', year: 'numeric' }) })} · {t('snapshotNote')}
      </p>

      <Section>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {[
            { label: t('income'), value: mo(data.totals.incomeMinor), change: data.change?.incomeBps },
            { label: t('expenses'), value: mo(data.totals.expenseMinor), change: data.change?.expenseBps },
            { label: t('net'), value: mo(data.totals.netMinor, undefined, true), change: null },
            { label: t('savingsRate'), value: <span className="num">{data.savingsRateBps === null ? t('noIncome') : pctText(data.savingsRateBps, loc)}</span>, change: null },
          ].map((x) => (
            <div key={x.label}>
              <dt className="text-sm text-ink-2">{x.label}</dt>
              <dd className="text-xl font-semibold lg:text-2xl">{x.value}</dd>
              {x.change !== null && x.change !== undefined && <dd className="num text-sm text-ink-2">{t('change', { pct: pctText(x.change, loc, true), month: prevName })}</dd>}
            </div>
          ))}
        </dl>
        {data.change ? (
          <p className="mt-4 text-sm text-ink-2">
            {t('vsPrevious', { month: prevName })}: {t('net')} {mo(data.change.netMinor, undefined, true)}
          </p>
        ) : (
          <p className="mt-4 text-sm text-ink-2">{t('noPrevious')}</p>
        )}
      </Section>

      <div className="grid gap-x-12 lg:grid-cols-2 print:grid-cols-2">
        <Section title={t('topCategories')}>
          {data.topCategories.length === 0 ? (
            <p className="text-ink-2">{t('noSpending')}</p>
          ) : (
            <dl>
              {data.topCategories.map((c) => (
                <Row
                  key={c.label}
                  label={
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: `var(--chart-${c.color})` }} />
                      {c.label}
                    </span>
                  }
                >
                  {mo(c.amountMinor)} <span className="num ml-2 text-sm text-ink-2">{pctText(c.shareBps, loc)}</span>
                </Row>
              ))}
            </dl>
          )}
        </Section>

        <Section title={t('budgets')}>
          {data.budgets.length === 0 ? (
            <p className="text-ink-2">{t('noBudgets')}</p>
          ) : (
            <dl>
              {data.budgets.map((b) => (
                <Row key={b.label} label={<span>{b.label}<span className={cn('block text-sm', b.over ? 'font-medium text-danger' : 'text-ink-2')}>{b.over ? t('over') : t('within')} · <span className="num">{pctText(b.usedBps, loc)}</span></span></span>}>
                  {mo(b.spentMinor)} <span className="text-sm text-ink-2">/ {mo(b.budgetMinor)}</span>
                </Row>
              ))}
            </dl>
          )}
        </Section>

        <Section title={t('goals')}>
          {data.goals.length === 0 ? (
            <p className="text-ink-2">{t('noGoals')}</p>
          ) : (
            <dl>
              {data.goals.map((g) => (
                <Row key={g.name} label={<span>{g.name}{g.contributedMinor > 0 && <span className="block text-sm text-ink-2">{t('contributed', { amount: formatMoney(g.contributedMinor, cur, loc) })}</span>}</span>}>
                  {mo(g.savedMinor)} <span className="text-sm text-ink-2">/ {mo(g.targetMinor)} · <span className="num">{pctText(g.progressBps, loc)}</span></span>
                </Row>
              ))}
            </dl>
          )}
        </Section>

        <Section title={t('renewals')}>
          {data.renewals.length === 0 ? (
            <p className="text-ink-2">{t('noRenewals')}</p>
          ) : (
            <dl>
              {data.renewals.map((r) => (
                <Row key={`${r.name}-${r.date}`} label={<span>{r.name}<span className="block text-sm text-ink-2">{formatDay(r.date, locale, { day: 'numeric', month: 'short' })}{r.subscription ? ` · ${t('subscription')}` : ''}</span></span>}>
                  {mo(r.amountMinor)}
                </Row>
              ))}
              <Row label={t('renewalsTotal')} className="font-semibold">
                {mo(data.renewalsTotalMinor)}
              </Row>
            </dl>
          )}
        </Section>
      </div>

      {data.tax && (
        <Section title={`${t('tax')} (${tt('estimate')})`}>
          <dl className="max-w-xl">
            <Row label={t('taxEstimated')}>{mo(data.tax.estimatedThroughMonthMinor)}</Row>
            <Row label={t('taxBalance')}>{mo(data.tax.reserveBalanceMinor)}</Row>
            <Row label={t('taxMoved')}>{mo(data.tax.movedInMonthMinor)}</Row>
            <Row label={t('taxGap')} className="font-semibold">
              {mo(data.tax.gapMinor)}
            </Row>
          </dl>
          <p className="mt-3 text-sm text-ink-2">{td('tax')}</p>
        </Section>
      )}
    </div>
  );
}
