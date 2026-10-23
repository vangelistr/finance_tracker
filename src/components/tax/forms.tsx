'use client';

import { ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Section } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { MoneyInput } from '@/components/ui/money-input';
import { Notice } from '@/components/ui/notice';
import { Switch } from '@/components/ui/switch';
import { useAction } from '@/lib/client/use-action';
import { formatDay, intlLocale } from '@/lib/intl';
import { formatMoney } from '@/lib/money';
import type { TaxConfig } from '@/lib/tax/config';
import { AGE_BANDS, EFKA_CLASS_IDS, EXTRA_CLASS_IDS, type TaxProfile } from '@/lib/tax/estimate';

const pct = (bps: number, loc: string) => `${(bps / 100).toLocaleString(loc, { maximumFractionDigits: 2 })} %`;

export function TaxProfileForm({ profile, currency }: { profile: TaxProfile; currency: string }) {
  const t = useTranslations('tax');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const [p, setP] = useState(profile);
  const [saved, setSaved] = useState(false);
  // Follow the stored profile after a save without remounting (which would drop the saved message).
  const storedKey = JSON.stringify(profile);
  const [seen, setSeen] = useState(storedKey);
  if (seen !== storedKey) {
    setSeen(storedKey);
    setP(profile);
  }
  const set = <K extends keyof TaxProfile>(k: K, v: TaxProfile[K]) => {
    setSaved(false);
    setP((x) => ({ ...x, [k]: v }));
  };
  const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : null);

  return (
    <Section title={t('profile')}>
      <p className="mb-4 max-w-prose text-ink-2">{t('profileHint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput label={t('employment')} hint={t('employmentHint')} valueMinor={p.employmentIncomeMinor} onValueChange={(v) => set('employmentIncomeMinor', v ?? 0)} currency={currency} locale={locale} />
        <div className="grid grid-cols-2 gap-4">
          <TextField label={t('children')} inputMode="numeric" value={String(p.dependentChildren)} onChange={(e) => set('dependentChildren', Math.min(15, int(e.target.value) ?? 0))} />
          <SelectField label={t('ageBand')} value={p.ageBand} onChange={(e) => set('ageBand', e.target.value as TaxProfile['ageBand'])}>
            {AGE_BANDS.map((a) => (
              <option key={a} value={a}>
                {t(`ages.${a}`)}
              </option>
            ))}
          </SelectField>
        </div>
        <SelectField label={t('efkaClass')} value={p.efkaClassId} onChange={(e) => set('efkaClassId', e.target.value as TaxProfile['efkaClassId'])}>
          {EFKA_CLASS_IDS.map((c) => (
            <option key={c} value={c}>
              {t(`classes.${c}`)}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-4">
          <TextField label={t('insuranceStart')} hint={t('insuranceStartHint')} inputMode="numeric" value={p.insuranceStartYear === null ? '' : String(p.insuranceStartYear)} onChange={(e) => set('insuranceStartYear', int(e.target.value))} />
          <TextField label={t('efkaFrom')} inputMode="numeric" value={String(p.efkaFromMonth)} onChange={(e) => set('efkaFromMonth', Math.min(13, Math.max(1, int(e.target.value) ?? 1)))} />
        </div>
        <SelectField label={t('supplementary')} value={p.supplementaryClass ?? ''} onChange={(e) => set('supplementaryClass', (e.target.value || null) as TaxProfile['supplementaryClass'])}>
          <option value="">{t('none')}</option>
          {EXTRA_CLASS_IDS.map((c) => (
            <option key={c} value={c}>
              {t(`classes.${c}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('lumpSum')} value={p.lumpSumClass ?? ''} onChange={(e) => set('lumpSumClass', (e.target.value || null) as TaxProfile['lumpSumClass'])}>
          <option value="">{t('none')}</option>
          {EXTRA_CLASS_IDS.map((c) => (
            <option key={c} value={c}>
              {t(`classes.${c}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('vatRegime')} value={p.vatRegime} onChange={(e) => set('vatRegime', e.target.value as TaxProfile['vatRegime'])}>
          <option value="normal">{t('vatNormal')}</option>
          <option value="smallBusinessExempt">{t('vatExempt')}</option>
        </SelectField>
        <MoneyInput label={t('previousTurnover')} valueMinor={p.previousYearGreekTurnoverMinor} onValueChange={(v) => set('previousYearGreekTurnoverMinor', v ?? 0)} currency={currency} locale={locale} />
      </div>
      <div className="mt-4 border-y border-rule">
        <Switch label={t('parallel')} description={t('parallelHint')} checked={p.hasParallelSalariedEmployment} onChange={(v) => set('hasParallelSalariedEmployment', v)} />
        {p.hasParallelSalariedEmployment && (
          <div className="flex flex-col gap-2 pb-3">
            <MoneyInput label={t('salariedContributions')} valueMinor={p.salariedContributionsMonthlyMinor} onValueChange={(v) => set('salariedContributionsMonthlyMinor', v ?? 0)} currency={currency} locale={locale} />
            <Switch label={t('extrasCovered')} checked={p.extrasCoveredBySalary} onChange={(v) => set('extrasCoveredBySalary', v)} />
          </div>
        )}
        <Switch label={t('healthProfessional')} checked={p.healthProfessional} onChange={(v) => set('healthProfessional', v)} />
        <Switch label={t('firstTime')} checked={p.firstTimeBusinessIncome} onChange={(v) => set('firstTimeBusinessIncome', v)} />
        <Switch label={t('clientsWithhold')} checked={p.clientsWithhold} onChange={(v) => set('clientsWithhold', v)} />
        <Switch label={t('bandCut')} checked={p.applyNewSoleProprietorBandCut} onChange={(v) => set('applyNewSoleProprietorBandCut', v)} />
      </div>
      <div className="mt-4 max-w-md">
        <MoneyInput label={t('minimum')} valueMinor={p.minimumPresumedIncomeMinor} onValueChange={(v) => set('minimumPresumedIncomeMinor', v)} currency={currency} locale={locale} />
      </div>
      {error && <Notice tone="danger" className="mt-3">{tc('saveFailed')}</Notice>}
      <div className="mt-4 flex items-center gap-3">
        <Button loading={busy} onClick={async () => setSaved((await run('/api/tax/profile', { method: 'PUT', body: p })) !== null)}>
          {tc('save')}
        </Button>
        {saved && <span className="text-ink-2">{t('saved')}</span>}
      </div>
    </Section>
  );
}

function SourceLink({ sources, id }: { sources: TaxConfig['sources']; id?: string }) {
  const s = sources.find((x) => x.id === id);
  return s ? (
    <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
      {s.id}
      <ExternalLink aria-hidden className="size-3" strokeWidth={2} />
    </a>
  ) : null;
}

function Tag({ on }: { on?: boolean }) {
  const t = useTranslations('tax');
  return on ? <span className="ml-1 text-sm font-medium text-warning">{t('uncertainTag')}</span> : null;
}

/** The year's rates with sources, review date and [uncertain] tags; a few values are editable per user. */
export function RatesPanel({ config, edited, year, currency }: { config: TaxConfig; edited: boolean; year: number; currency: string }) {
  const t = useTranslations('tax');
  const tc = useTranslations('common');
  const locale = useLocale();
  const loc = intlLocale(locale);
  const { run, busy, error } = useAction();
  const [editing, setEditing] = useState(false);
  const money = (m: number) => formatMoney(m, currency, loc);
  const toBp = (s: string) => {
    const v = Number(s.trim().replace(',', '.'));
    return s.trim() && Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v * 100) : null;
  };
  const [vat, setVat] = useState((config.vat.standardRateBps / 100).toString());
  const [bands, setBands] = useState(config.incomeTax.bands.map((b) => (b.rateBps / 100).toString()));
  const [classes, setClasses] = useState<Record<string, number | null>>(Object.fromEntries(config.efka.classes.map((c) => [c.id, c.monthlyMinor])));
  const valid = toBp(vat) !== null && bands.every((b) => toBp(b) !== null) && Object.values(classes).every((v) => v !== null);

  async function save() {
    if (!valid) return;
    const ok = await run(`/api/tax/config/${year}`, {
      method: 'PUT',
      body: {
        vatStandardRateBps: toBp(vat),
        bands: config.incomeTax.bands.map((b, i) => ({ upToMinor: b.upToMinor, rateBps: toBp(bands[i]!) })),
        efkaClasses: classes,
      },
    });
    if (ok) setEditing(false);
  }

  const froms = config.incomeTax.bands.map((_, i) => (i === 0 ? 0 : config.incomeTax.bands[i - 1]!.upToMinor ?? 0));
  return (
    <Section title={t('rates', { year })} aside={<span className="text-sm text-ink-2">{t('lastReviewed', { date: formatDay(config.lastReviewed, locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}</span>}>
      <p className="mb-4 max-w-prose text-ink-2">{t('ratesHint')}</p>
      {edited && <Notice tone="warning" className="mb-4">{t('edited')}</Notice>}
      <div className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">
            {t('bands')} <SourceLink sources={config.sources} id={config.incomeTax.sourceId} />
            <Tag on={config.incomeTax.uncertain} />
          </h3>
          <table className="w-full text-left text-sm">
            <thead className="text-ink-2">
              <tr className="border-b border-rule">
                <th scope="col" className="py-1.5 font-medium">{t('upTo')}</th>
                <th scope="col" className="py-1.5 text-right font-medium">{t('rate')}</th>
              </tr>
            </thead>
            <tbody>
              {config.incomeTax.bands.map((b, i) => {
                const from = froms[i]!;
                return (
                  <tr key={i} className="border-b border-rule">
                    <th scope="row" className="num py-1.5 font-normal">{b.upToMinor === null ? `${t('above')} ${money(from)}` : `${money(from)} – ${money(b.upToMinor)}`}</th>
                    <td className="num py-1.5 text-right">
                      {editing ? (
                        <input aria-label={`${t('rate')} ${i + 1}`} inputMode="decimal" value={bands[i]} onChange={(e) => setBands((x) => x.map((v, k) => (k === i ? e.target.value : v)))} className="w-20 rounded-md border border-rule-strong bg-surface px-2 py-1 text-right" />
                      ) : (
                        pct(b.rateBps, loc)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="mb-2 font-semibold">
            {t('efkaClasses')} <SourceLink sources={config.sources} id={config.efka.sourceId} />
            <Tag on={config.efka.uncertain} />
          </h3>
          <table className="w-full text-left text-sm">
            <tbody>
              {config.efka.classes.map((c) => (
                <tr key={c.id} className="border-b border-rule">
                  <th scope="row" className="py-1.5 font-normal">{t(`classes.${c.id}` as never)}</th>
                  <td className="num py-1.5 text-right">
                    {editing ? (
                      <MoneyInput label={t(`classes.${c.id}` as never)} valueMinor={classes[c.id] ?? null} onValueChange={(v) => setClasses((x) => ({ ...x, [c.id]: v }))} currency={currency} locale={locale} />
                    ) : (
                      money(c.monthlyMinor)
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-b border-rule">
                <th scope="row" className="py-1.5 font-normal">{t('unemployment')}</th>
                <td className="num py-1.5 text-right">{money(config.efka.extras.unemploymentMonthlyMinor)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <dl className="text-sm">
          <div className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5">
            <dt>
              {t('vatRate')} <SourceLink sources={config.sources} id={config.vat.sourceId} />
              <Tag on={config.vat.uncertain} />
            </dt>
            <dd className="num">
              {editing ? <input aria-label={t('vatRate')} inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} className="w-20 rounded-md border border-rule-strong bg-surface px-2 py-1 text-right" /> : pct(config.vat.standardRateBps, loc)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5">
            <dt>{t('smallBusiness')}</dt>
            <dd className="num">{money(config.vat.smallBusinessThresholdMinor)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5">
            <dt>
              {t('prepaymentRate')} <SourceLink sources={config.sources} id={config.prepayment.sourceId} />
              <Tag on={config.prepayment.uncertain} />
            </dt>
            <dd className="num">{pct(config.prepayment.rateBps, loc)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5">
            <dt>{t('prepaymentReduction')}</dt>
            <dd className="num">{pct(config.prepayment.newProfessionalReductionBps, loc)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5">
            <dt>
              {t('withholdingRate')} <SourceLink sources={config.sources} id={config.withholding.sourceId} />
              <Tag on={config.withholding.uncertain} />
            </dt>
            <dd className="num">{pct(config.withholding.rateBps, loc)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5">
            <dt>{t('withholdingThreshold')}</dt>
            <dd className="num">{money(config.withholding.thresholdMinor)}</dd>
          </div>
        </dl>
        <div>
          <h3 className="mb-2 font-semibold">{t('sources')}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {config.sources.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
                  {s.id}: {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {error && <Notice tone="danger" className="mt-3">{tc('saveFailed')}</Notice>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {editing ? (
          <>
            <Button loading={busy} disabled={!valid} onClick={save}>
              {t('saveRates')}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {tc('cancel')}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {t('editRates')}
          </Button>
        )}
        {edited && (
          <Button variant="ghost" className="ml-auto" onClick={() => run(`/api/tax/config/${year}`, { method: 'PUT', body: { reset: true } })}>
            {t('resetRates')}
          </Button>
        )}
      </div>
    </Section>
  );
}
