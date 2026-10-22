import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Money } from '@/components/data/money';
import { Section } from '@/components/shell/page-header';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/cn';
import type { LocalDate, Month } from '@/lib/dates';
import { formatDay, formatMonth, intlLocale } from '@/lib/intl';
import { formatMoney } from '@/lib/money';
import { DEFAULT_PLAN_SETTINGS, type Plan, type PlanSettings } from '@/lib/plan';

// The Smart Plan with its working (docs/allocation-methodology.md section 6). Renders on the server; the apply
// button and the override form are client slots.

export interface PlanViewData {
  plan: Plan;
  settings: PlanSettings;
  month: Month;
  inputs: {
    fixedSources: Array<{ name: string; monthlyMinor: number }>;
    variableMonths: Array<{ month: Month; totalMinor: number }>;
    fixedEssential: Array<{ name: string; monthlyMinor: number }>;
    emergencyGoalId: string | null;
    goals: Record<string, { name: string; priority: number; deadline: LocalDate | null; requiredMonthlyMinor: number | null }>;
  };
}

/** Sources from section 7 that back the rules shown on this page. */
const SOURCES = [
  { title: 'CFPB, An essential guide to building an emergency fund', url: 'https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/' },
  { title: 'MoneyHelper, Emergency savings: how much is enough?', url: 'https://www.moneyhelper.org.uk/en/savings/types-of-savings/emergency-savings-how-much-is-enough' },
  { title: 'MoneyHelper, How to budget for an irregular income', url: 'https://www.moneyhelper.org.uk/en/everyday-money/budgeting/how-to-budget-for-an-irregular-income' },
  { title: 'FINRA, Start an emergency fund', url: 'https://www.finra.org/investors/insights/start-emergency-fund' },
  { title: 'FINRA, Manage your debt', url: 'https://www.finra.org/investors/personal-finance/manage-your-debt' },
  { title: 'Vanguard, What’s the right emergency savings amount?', url: 'https://ownyourfuture.vanguard.com/content/en/learn/financial-planning/whats-the-right-emergency-savings-amount.html' },
  { title: 'Vanguard, Income volatility and emergency savings', url: 'https://investor.vanguard.com/investor-resources-education/article/understanding-income-volatility-and-emergency-saving' },
  { title: 'JPMorgan Chase Institute, Weathering Volatility 2.0 (2019)', url: 'https://www.jpmorganchase.com/institute/all-topics/financial-health-wealth-creation/report-weathering-volatility-2-a-monthly-stress-test-to-guide-saving' },
  { title: 'Investor Resilience, World Investor Week 2022 (CFTC copy)', url: 'https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/keytopicsforworldinvestorweek2022' },
  { title: 'Get Rich Slowly, review of All Your Worth (50/30/20) [uncertain]', url: 'https://www.getrichslowly.org/book-review-all-your-worth/' },
] as const;

const PART_COLOURS = { essentials: 'bg-spend', discretionary: 'bg-chart-8', savings: 'bg-goal-fill', investing: 'bg-chart-3' } as const;

function Row({ label, children, strong, className }: { label: ReactNode; children: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 border-b border-rule py-2', strong && 'font-semibold', className)}>
      <dt className="min-w-0">{label}</dt>
      <dd className="shrink-0 text-right">{children}</dd>
    </div>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return <p className="mb-3 border-l-2 border-rule-strong pl-3 text-sm text-ink-2">{children}</p>;
}

export function PlanView({ data, currency, apply, overrides }: { data: PlanViewData; currency: string; apply?: ReactNode; overrides?: ReactNode }) {
  const t = useTranslations('plan');
  const tc = useTranslations('common');
  const locale = useLocale();
  const loc = intlLocale(locale);
  const { plan, settings: s, inputs } = data;
  const { baseline: b, essentials: e, emergencyFund: ef, split, routing, surplus, profile } = plan;
  const money = (minor: number) => formatMoney(minor, currency, loc);
  const mo = (minor: number, className?: string) => <Money minor={minor} currency={currency} locale={loc} className={className} />;
  const pct = (bp: number) => (bp / 100).toLocaleString(loc, { maximumFractionDigits: 2 });
  const share = (x: string) => `${Number(x).toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  const withDefault = (key: 'discretionaryBp' | 'investingBp', text: string) =>
    s[key] === DEFAULT_PLAN_SETTINGS[key] ? text : `${text} · ${t('default', { value: `${pct(DEFAULT_PLAN_SETTINGS[key])} %` })}`;

  const parts = [
    { key: 'essentials', minor: split.essentialsMinor, share: plan.shares.essentials, rule: s.essentialsBpOverride === null ? t('ruleEssentials') : t('rulePct', { value: pct(s.essentialsBpOverride) }) },
    { key: 'discretionary', minor: split.discretionaryMinor, share: plan.shares.discretionary, rule: withDefault('discretionaryBp', t('rulePct', { value: pct(s.discretionaryBp) })) },
    { key: 'savings', minor: split.savingsMinor, share: plan.shares.savings, rule: t('ruleBalance', { value: pct(s.minSavingsBp) }) },
    {
      key: 'investing',
      minor: split.investingMinor,
      share: plan.shares.investing,
      rule: [withDefault('investingBp', t('rulePct', { value: pct(s.investingBp) })), split.investingHeldMinor > 0 ? t('ruleHeld', { amount: money(split.investingHeldMinor) }) : null].filter(Boolean).join(' · '),
    },
  ] as const;

  const zeroMonths = b.method === 'min' ? inputs.variableMonths.filter((m) => m.totalMinor <= 0) : [];
  const warnings = [
    b.confidence === 'provisional' ? t('warnProvisional') : null,
    ...zeroMonths.map((m) => t('warnZeroMonth', { month: formatMonth(m.month, locale) })),
    !inputs.emergencyGoalId ? t('efMissing') : null,
    t('debtHint'),
  ].filter((w): w is string => !!w);
  const surplusGoals = surplus.goals.reduce((sum, g) => sum + g.allocMinor, 0);

  return (
    <div>
      <Notice tone="info" className="mb-6">
        {t('disclaimer')}
      </Notice>
      {b.baselineMinor <= 0 && (
        <Notice tone="warning" className="mb-6">
          {t('noIncome')}
        </Notice>
      )}

      <Section title={t('split')}>
        <div aria-hidden className="flex h-3 overflow-hidden rounded-full bg-surface-2">
          {parts.map((p) => (
            <div key={p.key} className={PART_COLOURS[p.key]} style={{ width: `${p.share}%` }} />
          ))}
        </div>
        <table className="mt-4 w-full text-left">
          <thead className="text-sm text-ink-2">
            <tr className="border-b border-rule">
              <th scope="col" className="py-2 font-medium">{t('part')}</th>
              <th scope="col" className="py-2 text-right font-medium">{tc('amount')}</th>
              <th scope="col" className="whitespace-nowrap py-2 pl-4 text-right font-medium">{t('share')}</th>
              <th scope="col" className="hidden py-2 pl-6 font-medium sm:table-cell">{t('rule')}</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p) => (
              <tr key={p.key} className="border-b border-rule align-baseline">
                <th scope="row" className="py-2.5 font-medium">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className={cn('size-2.5 shrink-0 rounded-sm', PART_COLOURS[p.key])} />
                    {t(p.key)}
                  </span>
                  <span className="mt-0.5 block text-sm font-normal text-ink-2 sm:hidden">{p.rule}</span>
                </th>
                <td className="py-2.5 text-right">
                  {mo(p.minor, 'font-semibold')}
                </td>
                <td className="num whitespace-nowrap py-2.5 pl-4 text-right text-ink-2">{share(p.share)}</td>
                <td className="hidden py-2.5 pl-6 text-sm text-ink-2 sm:table-cell">{p.rule}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <th scope="row" className="py-2.5">{t('total')}</th>
              <td className="py-2.5 text-right">
                {mo(b.baselineMinor)}
              </td>
              <td className="num whitespace-nowrap py-2.5 pl-4 text-right text-ink-2">{share('100')}</td>
              <td className="hidden sm:table-cell" />
            </tr>
          </tbody>
        </table>
        <div className="mt-4 flex flex-col gap-3">
          {split.mode === 'deficit' ? (
            <Notice tone="danger">{t('modeDeficit', { essentials: money(e.totalMinor), shortfall: money(split.shortfallMinor), baseline: money(b.baselineMinor) })}</Notice>
          ) : split.mode === 'squeeze' ? (
            <Notice tone="warning">{t('modeSqueeze')}</Notice>
          ) : (
            <p className="text-ink-2">{t('modeNormal')}</p>
          )}
          {!split.gateOpen && s.investingBp > 0 && split.investingHeldMinor > 0 && (
            <p className="text-ink-2">{t('gateClosed', { months: s.efGateMonths, amount: money(split.investingHeldMinor) })}</p>
          )}
          <div className="text-sm">
            <p className="font-semibold">{t('orderTitle')}</p>
            <p className="mt-1 text-ink-2">
              {t('order', {
                baseline: money(b.baselineMinor),
                essentials: money(split.essentialsMinor),
                remainder: money(b.baselineMinor - split.essentialsMinor),
                discretionary: money(split.discretionaryMinor),
                investing: money(split.investingMinor),
                savings: money(split.savingsMinor),
              })}
            </p>
          </div>
          {apply}
        </div>
      </Section>

      {warnings.length > 0 && (
        <Section title={t('warnings')}>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-ink-2 marker:text-ink-3">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Section>
      )}

      <div className="grid gap-x-12 lg:grid-cols-2">
        <Section title={t('baseline')}>
          <Formula>{t('baselineFormula')}</Formula>
          <dl>
            <Row label={t('fixedIncome')}>
              {mo(b.fixedMinor)}
            </Row>
            {inputs.fixedSources.map((f) => (
              <Row key={f.name} label={<span className="pl-4 text-ink-2">{f.name}</span>} className="text-sm">
                {mo(f.monthlyMinor, 'text-ink-2')}
              </Row>
            ))}
            <Row label={b.method === 'manual' ? t('variableManual') : b.method === 'min' ? t('variableBaseline', { count: b.monthsUsed }) : t('variableNone')}>
              {mo(b.variableMinor)}
            </Row>
            {b.method === 'min' &&
              inputs.variableMonths.map((m) => (
                <Row key={m.month} label={<span className="pl-4 text-ink-2">{formatMonth(m.month, locale)}{m.month === b.lowestMonth ? ` · ${t('lowest')}` : ''}</span>} className={cn('text-sm', m.month === b.lowestMonth && 'font-semibold')}>
                  {mo(m.totalMinor, m.month === b.lowestMonth ? undefined : 'text-ink-2')}
                </Row>
              ))}
            <Row label={t('baseline')} strong>
              {mo(b.baselineMinor)}
            </Row>
          </dl>
          <p className="mt-3 text-sm text-ink-2">
            <span className="mr-2 inline-flex rounded-sm border border-rule-strong px-1.5 text-xs font-semibold uppercase tracking-wide text-ink">
              {t(`confidence_${b.confidence}`, { count: b.monthsUsed })}
            </span>
            {b.medianMinor !== null && b.meanMinor !== null && t('median', { amount: money(b.medianMinor), mean: money(b.meanMinor) })}
          </p>
          <p className="mt-2 text-sm text-ink-2">{t('oneTimeNote')}</p>
        </Section>

        <Section title={t('essentialsBlock')}>
          <Formula>{t('essentialsFormula')}</Formula>
          <dl>
            <Row label={t('fixedEssentials')}>
              {mo(e.fixedMinor)}
            </Row>
            {inputs.fixedEssential.map((f, i) => (
              <Row key={`${f.name}-${i}`} label={<span className="pl-4 text-ink-2">{f.name}</span>} className="text-sm">
                {mo(f.monthlyMinor, 'text-ink-2')}
              </Row>
            ))}
          </dl>
          {e.rows.length > 0 && (
            <table className="mt-2 w-full text-sm">
              <thead className="text-ink-2">
                <tr className="border-b border-rule">
                  <th scope="col" className="py-2 text-left font-medium">{tc('category')}</th>
                  <th scope="col" className="hidden py-2 pl-3 text-right font-medium sm:table-cell">{t('average')}</th>
                  <th scope="col" className="hidden py-2 pl-3 text-right font-medium sm:table-cell">{t('budget')}</th>
                  <th scope="col" className="whitespace-nowrap py-2 pl-3 text-right font-medium">{t('used')}</th>
                </tr>
              </thead>
              <tbody>
                {e.rows.map((r) => (
                  <tr key={r.categoryId} className="border-b border-rule">
                    <th scope="row" className="py-2 text-left font-normal">
                      {r.name}
                      <span className="block text-ink-2 sm:hidden">
                        {t('average')} {money(r.averageMinor)} · {t('budget')} {r.budgetMinor === null ? '—' : money(r.budgetMinor)}
                      </span>
                    </th>
                    <td className="hidden py-2 pl-3 text-right text-ink-2 sm:table-cell">{mo(r.averageMinor)}</td>
                    <td className="hidden py-2 pl-3 text-right text-ink-2 sm:table-cell">{r.budgetMinor === null ? '—' : mo(r.budgetMinor)}</td>
                    <td className="py-2 pl-3 text-right align-top font-semibold">{mo(r.usedMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <dl>
            <Row label={t('essentials')} strong>
              {mo(e.totalMinor)}
            </Row>
          </dl>
        </Section>

        <Section title={t('ef')}>
          <p className="mb-3">
            {profile.profile === 'irregular'
              ? t('efProfileIrregular', { share: profile.irregularShareBp === null ? '—' : pct(profile.irregularShareBp), months: ef.months })
              : t('efProfileFixed', { months: ef.months })}
          </p>
          <Formula>
            {t('efFormula', { months: ef.months, essentials: money(e.totalMinor) })}
            {ef.targetMinor !== ef.formulaMinor && <> · {t('efGoalTarget')}</>}
          </Formula>
          <dl>
            <Row label={t('efTarget')}>
              {mo(ef.targetMinor)}
            </Row>
            <Row label={t('efSaved')}>
              {mo(ef.savedMinor)}
            </Row>
            <Row label={t('efNeed')} strong>
              {mo(ef.needMinor)}
            </Row>
          </dl>
          <p className="mt-3">
            {t('efThisMonth', { amount: money(routing.efMinor) })}.{' '}
            {plan.monthsToFundEf === 0 ? t('efDone') : plan.monthsToFundEf === null ? t('efNotGrowing') : t('efMonths', { count: plan.monthsToFundEf })}
          </p>
          <p className="mt-2 text-sm text-ink-2">{t('efRule')}</p>
          {!inputs.emergencyGoalId && (
            <p className="mt-3 text-sm">
              <a href="/goals" className="font-semibold text-accent underline underline-offset-2">
                {t('efCreate')}
              </a>
            </p>
          )}
        </Section>

        <Section title={t('goalsBlock')}>
          {routing.goals.length === 0 ? (
            <p className="text-ink-2">{t('noGoals')}</p>
          ) : (
            <ul>
              {routing.goals.map((g) => {
                const meta = inputs.goals[g.goalId];
                return (
                  <li key={g.goalId} className="border-b border-rule py-3 first:pt-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-semibold">{g.name}</span>
                      <span>{t('alloc', { amount: money(g.allocMinor) })}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-2">
                      {[
                        meta ? t('priorityN', { n: meta.priority }) : null,
                        meta?.deadline ? formatDay(meta.deadline, locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null,
                        g.remainingMinor > 0 ? t('remaining', { amount: money(g.remainingMinor) }) : null,
                        g.claimMinor > 0 ? t('claim', { amount: money(g.claimMinor) }) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {g.flags.map((f) => (
                      <p key={f} className={cn('mt-1 text-sm', f === 'funded' ? 'text-income' : 'text-warning')}>
                        <span className="font-semibold">{t(`flag_${f}`)}</span>
                        {f === 'deadline_at_risk' && <> · {t('fixAtRisk')}</>}
                        {f === 'deadline_passed' && <> · {t('fixPassed')}</>}
                      </p>
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
          {routing.uncommittedMinor > 0 && <p className="mt-3 text-ink-2">{t('uncommitted', { amount: money(routing.uncommittedMinor) })}</p>}
        </Section>
      </div>

      <Section title={t('surplus')}>
        <div className="grid gap-x-12 lg:grid-cols-2">
          <div>
            <Formula>{t('surplusFormula')}</Formula>
            <dl>
              <Row label={t('received')}>
                {mo(surplus.surplusMinor + b.baselineMinor - surplus.shortfallMinor)}
              </Row>
              <Row label={t('baseline')}>
                {mo(b.baselineMinor)}
              </Row>
              {surplus.shortfallMinor > 0 ? (
                <Row label={t('shortfallLine')} strong>
                  {mo(surplus.shortfallMinor)}
                </Row>
              ) : (
                <Row label={t('surplusLine')} strong>
                  {mo(surplus.surplusMinor)}
                </Row>
              )}
            </dl>
          </div>
          {surplus.surplusMinor > 0 && (
            <div className="mt-6 lg:mt-0">
              <p className="mb-3 text-sm text-ink-2">{t('surplusOrder')}</p>
              <dl>
                <Row label={t('taxReserve')}>
                  {mo(surplus.taxReserveMinor)}
                </Row>
                <Row label={t('freeSpending', { value: pct(s.surplusDiscretionaryBp) })}>
                  {mo(surplus.discretionaryMinor)}
                </Row>
                <Row label={t('surplusEf')}>
                  {mo(surplus.efMinor)}
                </Row>
                <Row label={t('surplusGoals')}>
                  {mo(surplusGoals)}
                </Row>
                <Row label={t('surplusInvesting')}>
                  {mo(surplus.investingMinor)}
                </Row>
                <Row label={t('surplusUncommitted')}>
                  {mo(surplus.uncommittedMinor)}
                </Row>
              </dl>
              {surplus.taxReserveMinor === 0 && <p className="mt-2 text-sm text-ink-2">{t('noTax')}</p>}
            </div>
          )}
        </div>
      </Section>

      {overrides}

      <Section>
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-lg font-semibold [&::-webkit-details-marker]:hidden">
            {t('why')}
            <ChevronDown aria-hidden className="size-5 text-ink-2 transition-transform duration-150 group-open:rotate-180" strokeWidth={2} />
          </summary>
          <h3 className="mt-3 font-semibold">{t('sources')}</h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {SOURCES.map((src) => (
              <li key={src.url}>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                  {src.title}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-2">{t('decisions')}</p>
        </details>
      </Section>
    </div>
  );
}
