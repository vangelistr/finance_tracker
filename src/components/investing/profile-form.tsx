'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Section } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { Switch } from '@/components/ui/switch';
import { useAction } from '@/lib/client/use-action';
import { cn } from '@/lib/cn';
import { METRICS, type Metric } from '@/lib/investing/metrics';
import { DEFAULT_WEIGHTS } from '@/lib/investing/ranking';
import { DEFAULT_INVESTING_SETTINGS, type InvestingSettings } from '@/lib/investing/settings';
import { PROFILE_RULES, profileFromAnswers, QUESTIONS, RISK_PROFILES, type Answers, type RiskProfile } from '@/lib/investing/split';
import { intlLocale } from '@/lib/intl';
import { formatBp } from './format';

type Question = keyof typeof QUESTIONS;

function Choice({ q, value, onChange }: { q: Question; value: string | undefined; onChange: (v: string) => void }) {
  const t = useTranslations('investing.profile');
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">{t(`q.${q}`)}</legend>
      {QUESTIONS[q].map((option) => (
        <label
          key={option}
          className={cn(
            'flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors',
            value === option ? 'border-accent bg-accent-soft font-medium' : 'border-rule-strong hover:bg-surface-hover',
          )}
        >
          <input type="radio" name={q} value={option} checked={value === option} onChange={() => onChange(option)} className="size-4 accent-[var(--accent)]" />
          {t(`a.${q}.${option}` as never)}
        </label>
      ))}
    </fieldset>
  );
}

export function QuestionnaireForm({ answers: stored }: { answers: Answers | null }) {
  const t = useTranslations('investing.profile');
  const tc = useTranslations('common');
  const { run, busy, error } = useAction();
  const [answers, setAnswers] = useState<Partial<Answers>>(stored ?? {});
  // Follow the stored answers when they change on the server (after a save or a reset), without remounting.
  const storedKey = JSON.stringify(stored);
  const [seen, setSeen] = useState(storedKey);
  if (seen !== storedKey) {
    setSeen(storedKey);
    setAnswers(stored ?? {});
  }
  const questions = Object.keys(QUESTIONS) as Question[];
  const complete = questions.every((q) => answers[q]);
  const isStored = !!stored && questions.every((q) => answers[q] === stored[q]);
  const result = complete ? profileFromAnswers(answers as Answers) : null;

  return (
    <Section title={t('questionnaire')}>
      <p className="mb-5 max-w-prose text-ink-2">{t('intro')}</p>
      <div className="grid gap-6 lg:grid-cols-3">
        {(Object.keys(QUESTIONS) as Question[]).map((q) => (
          <Choice
            key={q}
            q={q}
            value={answers[q]}
            onChange={(v) => setAnswers((a) => ({ ...a, [q]: v }))}
          />
        ))}
      </div>
      {result && (
        <p className="mt-5 font-medium">
          {t('result', { profile: t(`profiles.${result.profile}`), points: result.points })}
          {answers.horizon === 'short' && <span className="block font-normal text-ink-2">{t('shortRule')}</span>}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button loading={busy} disabled={!complete || isStored} onClick={() => run('/api/investing/profile', { method: 'PUT', body: { answers } })}>
          {t('saveAnswers')}
        </Button>
        {isStored && <span className="text-ink-2">{t('saved')}</span>}
      </div>
      {error && <Notice tone="danger" className="mt-3">{tc('saveFailed')}</Notice>}
    </Section>
  );
}

/** Percent text to basis points within 5–100 %, or 'invalid'. */
function pctToBp(text: string): number | 'invalid' {
  const v = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(v) && v >= 5 && v <= 100 ? Math.round(v * 100) : 'invalid';
}

export function LimitsForm({ settings }: { settings: InvestingSettings }) {
  const t = useTranslations('investing.profile');
  const tm = useTranslations('investing.metric');
  const tc = useTranslations('common');
  const loc = intlLocale(useLocale());
  const { run, busy, error } = useAction();
  const initial = (x: InvestingSettings) => ({
    override: (x.profileOverride ?? '') as RiskProfile | '',
    limits: { inst: formatBp(x.guardrails.maxPerInstrumentBp, loc), region: formatBp(x.guardrails.maxPerRegionBp, loc), currency: formatBp(x.guardrails.maxPerCurrencyBp, loc) },
    weights: Object.fromEntries(METRICS.map((m) => [m, String(x.weights[m])])) as Record<Metric, string>,
  });
  const [override, setOverride] = useState(initial(settings).override);
  const [limits, setLimits] = useState(initial(settings).limits);
  const [allowLeveraged, setAllowLeveraged] = useState(settings.guardrails.allowLeveraged);
  const [allowCrypto, setAllowCrypto] = useState(settings.guardrails.allowCrypto);
  const [weights, setWeights] = useState(initial(settings).weights);
  const [saved, setSaved] = useState(false);
  // Follow the stored settings after a save or a reset without remounting (which would drop the saved message).
  const settingsKey = JSON.stringify(settings);
  const [seen, setSeen] = useState(settingsKey);
  if (seen !== settingsKey) {
    const next = initial(settings);
    setSeen(settingsKey);
    setOverride(next.override);
    setLimits(next.limits);
    setAllowLeveraged(settings.guardrails.allowLeveraged);
    setAllowCrypto(settings.guardrails.allowCrypto);
    setWeights(next.weights);
  }

  const bps = { inst: pctToBp(limits.inst), region: pctToBp(limits.region), currency: pctToBp(limits.currency) };
  const w = Object.fromEntries(METRICS.map((m) => [m, /^\d{1,3}$/.test(weights[m].trim()) && Number(weights[m]) <= 100 ? Number(weights[m]) : NaN])) as Record<Metric, number>;
  const weightsValid = METRICS.every((m) => !Number.isNaN(w[m])) && METRICS.some((m) => w[m] > 0);
  const valid = Object.values(bps).every((v) => v !== 'invalid') && weightsValid;

  async function save() {
    if (!valid) return;
    const ok = await run('/api/investing/profile', {
      method: 'PUT',
      body: {
        profileOverride: override || null,
        guardrails: { maxPerInstrumentBp: bps.inst, maxPerRegionBp: bps.region, maxPerCurrencyBp: bps.currency, allowLeveraged, allowCrypto },
        weights: w,
      },
    });
    setSaved(ok !== null);
  }

  const limitField = (key: keyof typeof limits, label: string, def: number) => (
    <TextField
      label={label}
      hint={`${t('limitHint')} · ${t('defaultValue', { value: formatBp(def, loc) })}`}
      inputMode="decimal"
      value={limits[key]}
      onChange={(e) => {
        setSaved(false);
        setLimits((l) => ({ ...l, [key]: e.target.value }));
      }}
      error={bps[key] === 'invalid' ? tc('invalid') : undefined}
    />
  );
  const d = DEFAULT_INVESTING_SETTINGS.guardrails;

  return (
    <>
      <Section title={t('title')}>
        <SelectField label={t('override')} value={override} onChange={(e) => setOverride(e.target.value as RiskProfile | '')} className="max-w-md">
          <option value="">{t('overrideNone')}</option>
          {RISK_PROFILES.map((p) => (
            <option key={p} value={p}>
              {t(`profiles.${p}`)}: {t('profileRule', { n: PROFILE_RULES[p].topN, core: formatBp(PROFILE_RULES[p].coreMinBp, loc) })}
            </option>
          ))}
        </SelectField>
      </Section>
      <Section title={t('limits')}>
        <div className="grid gap-4 sm:grid-cols-3">
          {limitField('inst', t('maxInstrument'), d.maxPerInstrumentBp)}
          {limitField('region', t('maxRegion'), d.maxPerRegionBp)}
          {limitField('currency', t('maxCurrency'), d.maxPerCurrencyBp)}
        </div>
        <div className="mt-4 border-y border-rule">
          <Switch label={t('allowLeveraged')} checked={allowLeveraged} onChange={setAllowLeveraged} />
          <Switch label={t('allowCrypto')} checked={allowCrypto} onChange={setAllowCrypto} />
        </div>
      </Section>
      <Section title={t('weights')}>
        <p className="mb-4 max-w-prose text-ink-2">{t('weightsHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {METRICS.map((m) => (
            <TextField
              key={m}
              label={tm(m)}
              hint={t('defaultValue', { value: DEFAULT_WEIGHTS[m] })}
              inputMode="numeric"
              value={weights[m]}
              onChange={(e) => {
                setSaved(false);
                setWeights((x) => ({ ...x, [m]: e.target.value }));
              }}
              error={Number.isNaN(w[m]) ? '0–100' : undefined}
            />
          ))}
        </div>
        {!weightsValid && METRICS.every((m) => !Number.isNaN(w[m])) && <p className="mt-3 text-danger">{tc('invalid')}</p>}
      </Section>
      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-6">
        <Button loading={busy} disabled={!valid} onClick={save}>
          {t('save')}
        </Button>
        {saved && <span className="text-ink-2">{t('saved')}</span>}
        <Button variant="ghost" className="ml-auto" onClick={async () => await run('/api/investing/profile', { method: 'PUT', body: { reset: true } })}>
          {t('reset')}
        </Button>
      </div>
      {error && <Notice tone="danger" className="mt-3">{tc('saveFailed')}</Notice>}
    </>
  );
}
