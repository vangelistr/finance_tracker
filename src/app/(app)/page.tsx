import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { MonthLine, type Station } from '@/components/data/month-line';
import { Money } from '@/components/data/money';
import { StatusMark } from '@/components/data/status-mark';
import { PageHeader, Section } from '@/components/shell/page-header';
import { compareLocalDates, monthOf, toLocalDate } from '@/lib/dates';
import { formatDay, formatMonth, intlLocale } from '@/lib/intl';
import { requireUser } from '@/server/auth/current';
import { BudgetBars } from '@/components/charts/budget-bars';
import { IncomeExpenseBars } from '@/components/charts/bars';
import { Donut } from '@/components/charts/donut';
import { NetWorthLine } from '@/components/charts/line';
import { cn } from '@/lib/cn';
import { getCalendar } from '@/server/services/calendar';
import { loadDashboard, RANGES, type Range } from '@/server/services/dashboard';
import { ledgerRow, lookups } from '@/server/services/lookups';
import { listTransactions } from '@/server/services/transactions';

export async function generateMetadata() {
  const t = await getTranslations('dashboard');
  return { title: t('title') };
}

export default async function DashboardPage({ searchParams }: PageProps<'/'>) {
  const { user } = await requireUser();
  const sp = await searchParams;
  const range: Range = RANGES.includes(sp.range as Range) ? (sp.range as Range) : 'month';
  const t = await getTranslations('dashboard');
  const tb = await getTranslations('budgets');
  const tc = await getTranslations('common');
  const ti = await getTranslations('income');
  const tn = await getTranslations('nav');
  const ts = await getTranslations('status');
  const locale = await getLocale();
  const loc = intlLocale(locale);
  const today = toLocalDate(new Date(), user.timezone);
  const month = monthOf(today);

  const [cal, txs, l, dash] = await Promise.all([
    getCalendar(user._id, month, user.timezone),
    listTransactions(user._id, { month, limit: 500 }),
    lookups(user._id),
    loadDashboard(user._id, range, today, user.settings.notifications.overspend.thresholds, { none: '—', other: t('other'), overall: t('overall') }),
  ]);
  const monthLabel = (m: string) =>
    new Intl.DateTimeFormat(loc, { month: 'short', ...(m.slice(0, 4) !== month.slice(0, 4) ? { year: '2-digit' } : {}), timeZone: 'UTC' }).format(new Date(`${m}-01T12:00:00Z`));
  const done = txs.filter((x) => x.status === 'done');
  const inMinor = done.filter((x) => x.kind === 'income').reduce((s, x) => s + x.amountMinor, 0);
  const outMinor = done.filter((x) => x.kind === 'expense').reduce((s, x) => s + x.amountMinor, 0);

  const monthItems = cal.days.filter((d) => d.inMonth).flatMap((d) => d.items);
  const stations: Station[] = monthItems
    .filter((i) => i.kind !== 'transfer' && i.kind !== 'goal')
    .map((i) => ({ date: i.localDate, kind: i.kind === 'renewal' ? 'renewal' : i.kind === 'income' ? 'income' : 'expense', done: i.state === 'done', label: i.label }) as Station);
  const comingUp = monthItems.filter((i) => i.state !== 'done' && compareLocalDates(i.localDate, today) >= 0).slice(0, 6);
  const recent = done.slice(0, 6).map((x) => ledgerRow(x, l, (a, b) => `${a} → ${b}`));
  const empty = txs.length === 0;

  return (
    <>
      <PageHeader title={t('title')} meta={<span className="capitalize">{formatMonth(month, locale)}</span>} />
      <dl className="grid grid-cols-3 gap-4 pb-6">
        {[
          { key: 'monthIn', value: inMinor, tone: 'text-income' },
          { key: 'monthOut', value: outMinor, tone: 'text-spend' },
          { key: 'monthLeft', value: inMinor - outMinor, tone: 'text-ink' },
        ].map((item) => (
          <div key={item.key} className="min-w-0">
            <dt className="text-sm text-ink-2">{t(item.key)}</dt>
            <dd className={`mt-1 text-xl font-semibold tracking-[-0.01em] sm:text-3xl ${item.value === 0 ? 'text-ink' : item.tone}`}>
              <Money minor={item.value} currency={user.currency} locale={loc} />
            </dd>
          </div>
        ))}
      </dl>
      <Section title={t('monthLine')} aside={<Link href="/calendar" className="text-sm text-accent hover:underline">{tn('calendar')}</Link>}>
        <MonthLine month={month} today={today} stations={stations} summary={t('monthLine')} todayLabel={t('today')} />
        {empty && (
          <div className="mt-4 max-w-prose">
            <p className="font-semibold">{t('emptyTitle')}</p>
            <p className="mt-1 text-ink-2">{t('emptyBody')}</p>
          </div>
        )}
      </Section>
      {!empty && (
        <div className="grid gap-x-12 lg:grid-cols-2">
          <Section title={t('comingUp')}>
            {comingUp.length === 0 ? (
              <p className="text-ink-2">{t('nothingComing')}</p>
            ) : (
              <ul className="flex flex-col">
                {comingUp.map((i) => (
                  <li key={i.key} className="flex min-h-12 items-center gap-3">
                    <StatusMark tone={i.kind === 'transfer' ? 'transfer' : i.kind} state={i.state} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{i.label}</span>
                      <span className="block text-sm text-ink-3 capitalize">
                        {formatDay(i.localDate, locale, { weekday: 'short', day: 'numeric', month: 'short' })} · {ts(i.state)}
                      </span>
                    </span>
                    <Money minor={i.kind === 'income' ? i.amountMinor : -i.amountMinor} currency={user.currency} locale={loc} className="text-ink-2" />
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t('recent')} aside={<Link href="/transactions" className="text-sm text-accent hover:underline">{tn('transactions')}</Link>}>
            {recent.length === 0 ? (
              <p className="text-ink-2">{t('nothingRecent')}</p>
            ) : (
              <ul className="flex flex-col">
                {recent.map((r) => (
                  <li key={r.id} className="flex min-h-12 items-center gap-3">
                    <StatusMark tone={r.renewal ? 'renewal' : r.kind} state="done" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{r.label}</span>
                      <span className="block truncate text-sm text-ink-3">{r.detail}</span>
                    </span>
                    <Money
                      minor={r.kind === 'expense' ? -r.amountMinor : r.amountMinor}
                      currency={user.currency}
                      locale={loc}
                      signed={r.kind === 'income'}
                      className={r.kind === 'income' ? 'font-semibold text-income' : 'font-semibold'}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
      <Section title={t('budgets')} aside={<Link href="/budgets" className="text-sm text-accent hover:underline">{t('setBudgets')}</Link>}>
        {dash.budgets.length === 0 ? (
          <p className="text-ink-2">{t('noBudgets')}</p>
        ) : (
          <BudgetBars
            items={dash.budgets}
            currency={user.currency}
            locale={loc}
            labels={{
              of: (spent, budget) => tb('spentOf', { spent, budget }),
              over: (amount) => tb('over', { amount }),
              left: (amount) => tb('left', { amount }),
              warning: tb('warning'),
              overState: tb('overState'),
            }}
          />
        )}
      </Section>
      <nav aria-label={t('rangeLabel')} className="-mx-1 flex gap-1 overflow-x-auto border-t border-rule pt-6 pb-2">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={r === 'month' ? '/' : `/?range=${r}`}
            scroll={false}
            aria-current={range === r ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm',
              range === r ? 'border-accent bg-accent-soft font-semibold text-ink' : 'border-rule-strong text-ink-2 hover:text-ink',
            )}
          >
            {t(`range_${r}`)}
          </Link>
        ))}
      </nav>
      <div className="grid gap-x-12 lg:grid-cols-2">
        <Section title={t('spendingByCategory')}>
          <Donut title={t('spendingByCategory')} slices={dash.expenseSlices} currency={user.currency} locale={loc} totalLabel={t('total')} emptyLabel={t('noSpending')} head={[tc('category'), tc('amount'), t('share')]} />
        </Section>
        <Section title={t('incomeBySource')}>
          <Donut title={t('incomeBySource')} slices={dash.incomeSlices} currency={user.currency} locale={loc} totalLabel={t('total')} emptyLabel={t('noIncome')} head={[ti('source'), tc('amount'), t('share')]} />
        </Section>
      </div>
      <div className="grid gap-x-12 lg:grid-cols-2">
        <Section title={t('inVsOut')}>
          <IncomeExpenseBars title={t('inVsOut')} bars={dash.bars} currency={user.currency} locale={loc} labels={{ in: t('in'), out: t('out'), month: t('month') }} monthLabel={monthLabel} />
        </Section>
        <Section title={t('netWorth')}>
          <NetWorthLine title={t('netWorth')} points={dash.netWorth} currency={user.currency} locale={loc} labels={{ month: t('month'), value: t('value') }} monthLabel={monthLabel} />
        </Section>
      </div>
    </>
  );
}
