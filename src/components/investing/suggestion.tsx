import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Money } from '@/components/data/money';
import { Section } from '@/components/shell/page-header';
import { Notice } from '@/components/ui/notice';
import { displayShares } from '@/lib/plan';
import type { Guardrails, RiskProfile, SplitResult } from '@/lib/investing/split';
import { intlLocale } from '@/lib/intl';
import { formatMoney } from '@/lib/money';
import { formatBp } from './format';

// The monthly suggestion: the Smart Plan's investing share split across the top-ranked instruments within the
// risk profile and the diversification limits (PLAN 6.6). Shows its inputs, rules and every exclusion.

export interface SuggestionData {
  split: SplitResult;
  profile: { profile: RiskProfile; source: 'default' | 'questionnaire' | 'override' };
  guardrails: Guardrails;
  plan: { investingBp: number; investingMinor: number; heldMinor: number; baselineMinor: number };
  names: Record<string, string>;
}

export function SuggestionView({ data, currency }: { data: SuggestionData; currency: string }) {
  const t = useTranslations('investing');
  const tp = useTranslations('investing.profile');
  const ts = useTranslations('investing.suggestion');
  const tc = useTranslations('common');
  const loc = intlLocale(useLocale());
  const { split, plan, guardrails: g } = data;
  const money = (minor: number) => formatMoney(minor, currency, loc);
  const parts = [...split.lines.map((l) => l.amountMinor), split.unallocatedMinor];
  const shares = split.amountMinor > 0 ? displayShares(parts) : parts.map(() => '0');
  const share = (x: string) => `${Number(x).toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

  return (
    <>
      <Section title={ts('amount')}>
        <p className="num text-3xl font-semibold lg:text-4xl">
          <Money minor={plan.investingMinor} currency={currency} locale={loc} />
        </p>
        <p className="mt-2 text-ink-2">
          {ts('fromPlan', { pct: formatBp(plan.investingBp, loc), baseline: money(plan.baselineMinor) })}{' '}
          <Link href="/plan" prefetch={false} className="font-medium text-accent hover:underline">
            {ts('planLink')}
          </Link>
        </p>
        {plan.heldMinor > 0 && <p className="mt-1 text-ink-2">{ts('held', { amount: money(plan.heldMinor) })}</p>}
      </Section>

      <Section title={ts('profile')}>
        <p className="text-lg font-semibold">{tp(`profiles.${data.profile.profile}`)}</p>
        <p className="text-ink-2">{ts(`profileSource.${data.profile.source}`)}</p>
        <p className="mt-3 max-w-prose text-ink-2">
          {ts('rules', {
            n: split.topN,
            core: formatBp(split.coreMinBp, loc),
            inst: formatBp(g.maxPerInstrumentBp, loc),
            region: formatBp(g.maxPerRegionBp, loc),
            currency: formatBp(g.maxPerCurrencyBp, loc),
          })}
        </p>
        <p className="mt-3 max-w-prose border-l-2 border-rule-strong pl-3 text-sm text-ink-2">{ts('formula')}</p>
      </Section>

      <Section title={ts('split')}>
        {plan.investingMinor === 0 ? (
          <p className="text-ink-2">{ts('zero')}</p>
        ) : split.lines.length === 0 ? (
          <Notice tone="warning">{ts('notes.nothing_eligible')}</Notice>
        ) : (
          <>
            <div aria-hidden className="flex h-3 gap-px overflow-hidden rounded-full bg-surface-2">
              {split.lines.map((l, i) => (
                <div key={l.key} className={l.core ? 'bg-chart-3' : 'bg-chart-3 opacity-55'} style={{ width: `${shares[i]}%` }} />
              ))}
            </div>
            <table className="mt-4 w-full text-left">
              <thead className="text-sm text-ink-2">
                <tr className="border-b border-rule">
                  <th scope="col" className="py-2 font-medium">{t('instrument')}</th>
                  <th scope="col" className="py-2 text-right font-medium">{ts('share')}</th>
                  <th scope="col" className="py-2 pl-4 text-right font-medium">{tc('amount')}</th>
                </tr>
              </thead>
              <tbody>
                {split.lines.map((l, i) => (
                  <tr key={l.key} className="border-b border-rule align-baseline">
                    <th scope="row" className="py-2.5 font-normal">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="num text-ink-2">{l.rank}.</span>
                        <span className="font-semibold">{l.symbol}</span>
                        {l.core && (
                          <span className="inline-flex items-center gap-1 text-sm text-ink-2">
                            <span aria-hidden className="size-2 rounded-full bg-chart-3" />
                            {t('core')}
                          </span>
                        )}
                        {l.capped.length > 0 && <span className="text-sm text-ink-2">· {l.capped.map((c) => ts(`cap.${c}`)).join(', ')}</span>}
                      </span>
                      <span className="block text-sm text-ink-2">{data.names[l.key]}</span>
                    </th>
                    <td className="num py-2.5 text-right whitespace-nowrap text-ink-2">{share(shares[i]!)}</td>
                    <td className="py-2.5 pl-4 text-right">
                      <Money minor={l.amountMinor} currency={currency} locale={loc} className="font-semibold" />
                    </td>
                  </tr>
                ))}
                {split.unallocatedMinor > 0 && (
                  <tr className="border-b border-rule align-baseline">
                    <th scope="row" className="py-2.5 font-normal text-ink-2">{ts('unallocated')}</th>
                    <td className="num py-2.5 text-right whitespace-nowrap text-ink-2">{share(shares.at(-1)!)}</td>
                    <td className="py-2.5 pl-4 text-right">
                      <Money minor={split.unallocatedMinor} currency={currency} locale={loc} />
                    </td>
                  </tr>
                )}
                <tr className="font-semibold">
                  <th scope="row" className="py-2.5">{ts('total')}</th>
                  <td className="num py-2.5 text-right whitespace-nowrap text-ink-2">{share('100')}</td>
                  <td className="py-2.5 pl-4 text-right">
                    <Money minor={split.amountMinor} currency={currency} locale={loc} />
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}
        {split.notes.filter((n) => n !== 'nothing_eligible').length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 text-ink-2">
            {split.notes
              .filter((n) => n !== 'nothing_eligible')
              .map((n) => (
                <li key={n}>{ts(`notes.${n}`)}</li>
              ))}
          </ul>
        )}
      </Section>

      {split.excluded.length > 0 && (
        <Section title={ts('excluded')}>
          <ul className="flex flex-col gap-1 text-ink-2">
            {split.excluded.map((e) => (
              <li key={e.key}>
                <span className="font-medium text-ink">{e.symbol}</span>: {ts(`reason.${e.reason}`, { n: split.topN })}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
