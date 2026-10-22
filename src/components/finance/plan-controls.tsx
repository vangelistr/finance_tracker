'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAction } from '@/lib/client/use-action';
import { DEFAULT_PLAN_SETTINGS, type PlanSettings, type Profile } from '@/lib/plan';
import { Section } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { MoneyInput } from '@/components/ui/money-input';
import { Notice } from '@/components/ui/notice';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';

export function ApplyPlan() {
  const t = useTranslations('plan');
  const tc = useTranslations('common');
  const { run, busy, error } = useAction();
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col gap-2 border-t border-rule pt-4">
      <div>
        <Button loading={busy} onClick={async () => setDone((await run('/api/plan/apply', { method: 'POST' })) !== null)}>
          {t('apply')}
        </Button>
      </div>
      <p className="text-sm text-ink-2">{t('applyHint')}</p>
      {done && <Notice tone="success">{t('applied')}</Notice>}
      {error && <Notice tone="danger">{error.fields?.emergencyFund ? t('efMissing') : tc('saveFailed')}</Notice>}
    </div>
  );
}

const toText = (bp: number | null) => (bp === null ? '' : String(bp / 100));
/** "12,5" or "12.5" percent to basis points; '' means "use the default". */
function toBp(text: string): number | null | 'invalid' {
  if (!text.trim()) return null;
  const v = Number(text.replace(',', '.'));
  return Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v * 100) : 'invalid';
}

export function PlanOverrides({ settings, currency }: { settings: PlanSettings; currency: string }) {
  const t = useTranslations('plan');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const d = DEFAULT_PLAN_SETTINGS;
  const [essentials, setEssentials] = useState(toText(settings.essentialsBpOverride));
  const [discretionary, setDiscretionary] = useState(toText(settings.discretionaryBp));
  const [investing, setInvesting] = useState(toText(settings.investingBp));
  const [efMonths, setEfMonths] = useState(settings.efMonthsOverride === null ? '' : String(settings.efMonthsOverride));
  const [gate, setGate] = useState(settings.investWhileEfUnfunded);
  const [profile, setProfile] = useState<Profile | 'auto'>(settings.profileOverride ?? 'auto');
  const [manual, setManual] = useState<number | null>(settings.manualVariableBaselineMinor);

  const bps = { essentials: toBp(essentials), discretionary: toBp(discretionary), investing: toBp(investing) };
  const months = efMonths.trim() ? Number(efMonths) : null;
  const monthsInvalid = months !== null && !(Number.isInteger(months) && months >= 1 && months <= 12);
  const invalid = Object.values(bps).includes('invalid') || monthsInvalid;

  async function save() {
    if (invalid) return;
    await run('/api/plan/settings', {
      method: 'PUT',
      body: {
        essentialsBpOverride: bps.essentials,
        discretionaryBp: bps.discretionary,
        investingBp: bps.investing,
        efMonthsOverride: months,
        investWhileEfUnfunded: gate === d.investWhileEfUnfunded ? null : gate,
        profileOverride: profile === 'auto' ? null : profile,
        manualVariableBaselineMinor: manual,
      },
    });
  }

  const pctHint = (bp: number) => t('default', { value: `${bp / 100} %` });
  return (
    <Section title={t('overrides')}>
      <p className="mb-4 text-ink-2">{t('overrideHint')}</p>
      <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
        <TextField label={t('essentialsOverride')} hint={t('default', { value: t('auto') })} inputMode="decimal" value={essentials} placeholder={t('auto')} onChange={(e) => setEssentials(e.target.value)} error={bps.essentials === 'invalid' ? '0–100' : undefined} />
        <TextField label={t('discretionaryPct')} hint={pctHint(d.discretionaryBp)} inputMode="decimal" value={discretionary} onChange={(e) => setDiscretionary(e.target.value)} error={bps.discretionary === 'invalid' ? '0–100' : undefined} />
        <TextField label={t('investingPct')} hint={pctHint(d.investingBp)} inputMode="decimal" value={investing} onChange={(e) => setInvesting(e.target.value)} error={bps.investing === 'invalid' ? '0–100' : undefined} />
        <TextField label={t('efMonthsOverride')} hint={t('default', { value: t('auto') })} inputMode="numeric" value={efMonths} placeholder={t('auto')} onChange={(e) => setEfMonths(e.target.value)} error={monthsInvalid ? '1–12' : undefined} />
        <div className="sm:col-span-2">
          <MoneyInput label={t('manualBaseline')} hint={t('default', { value: t('auto') })} valueMinor={manual} onValueChange={setManual} currency={currency} locale={locale} placeholder={t('auto')} />
        </div>
      </div>
      <div className="mt-4 flex max-w-3xl flex-col gap-2">
        <span className="text-sm font-medium">{t('profile')}</span>
        <Segmented
          label={t('profile')}
          value={profile}
          onChange={setProfile}
          className="self-start"
          options={[
            { value: 'auto', label: t('profileAuto') },
            { value: 'fixed', label: t('profileFixed') },
            { value: 'irregular', label: t('profileIrregular') },
          ]}
        />
      </div>
      <div className="mt-4 max-w-3xl border-y border-rule">
        <Switch label={t('gate')} checked={gate} onChange={setGate} />
      </div>
      {error && <Notice tone="danger" className="mt-4">{tc('saveFailed')}</Notice>}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={save} loading={busy} disabled={invalid}>
          {tc('save')}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => run('/api/plan/settings', { method: 'PUT', body: { reset: true } })}>
          {t('reset')}
        </Button>
      </div>
    </Section>
  );
}
