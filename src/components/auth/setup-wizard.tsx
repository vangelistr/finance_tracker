'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/client/api';
import { LOCALE_COOKIE } from '@/lib/cookie-names';
import { emailSchema, PASSWORD_MIN } from '@/lib/validation/auth';
import { CURRENCIES } from '@/lib/validation/common';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { Switch } from '@/components/ui/switch';
import { StepRail } from './step-rail';
import { authErrorMessage } from './error-message';

const TIMEZONES = ['Europe/Athens', 'Europe/Nicosia', 'Europe/London', 'Europe/Berlin', 'UTC'];

type Locale = 'el' | 'en';

export function SetupWizard() {
  const t = useTranslations('auth');
  const te = useTranslations('auth.errors');
  const tc = useTranslations('common');
  const tl = useTranslations('locale');
  const router = useRouter();
  const locale = useLocale() as Locale;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    locale,
    currency: 'EUR' as (typeof CURRENCIES)[number],
    timezone: 'Europe/Athens',
    investingEnabled: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const steps = [t('setup.stepAccount'), t('setup.stepPreferences'), t('setup.stepInvesting')];
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  function validateAccount(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = te('nameRequired');
    if (!emailSchema.safeParse(form.email).success) next.email = te('emailInvalid');
    if (form.password.length < PASSWORD_MIN) next.password = te('passwordShort', { min: PASSWORD_MIN });
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (step === 0) {
      if (validateAccount()) setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    setBusy(true);
    const res = await apiFetch('/api/auth/setup', { body: form });
    if (res.ok) {
      document.cookie = `${LOCALE_COOKIE}=${form.locale}; path=/; max-age=31536000; samesite=lax`;
      router.replace('/onboarding');
      router.refresh();
      return;
    }
    setBusy(false);
    if (res.code === 'conflict') {
      setFormError(te('setupDone'));
    } else if (res.code === 'validation') {
      setStep(0);
      setErrors({
        ...(res.fields?.email ? { email: te('emailInvalid') } : {}),
        ...(res.fields?.password ? { password: te('passwordShort', { min: PASSWORD_MIN }) } : {}),
        ...(res.fields?.name ? { name: te('nameRequired') } : {}),
      });
    } else {
      setFormError(authErrorMessage(te, res));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <StepRail steps={steps} current={step} label={tc('step', { current: step + 1, total: steps.length })} />

      {step === 0 && (
        <fieldset className="flex flex-col gap-4">
          <legend className="sr-only">{steps[0]}</legend>
          <TextField label={t('name')} autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} required />
          <TextField
            label={t('email')}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            error={errors.email}
            required
          />
          <TextField
            label={t('password')}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            hint={t('passwordHint', { min: PASSWORD_MIN })}
            error={errors.password}
            minLength={PASSWORD_MIN}
            required
          />
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="flex flex-col gap-4">
          <legend className="sr-only">{steps[1]}</legend>
          <SelectField label={tl('label')} value={form.locale} onChange={(e) => set('locale', e.target.value as Locale)}>
            <option value="el">{tl('el')}</option>
            <option value="en">{tl('en')}</option>
          </SelectField>
          <SelectField label={t('setup.currency')} value={form.currency} onChange={(e) => set('currency', e.target.value as (typeof CURRENCIES)[number])}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('setup.timezone')} value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
            {TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </SelectField>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-lg font-semibold">{t('setup.investingTitle')}</legend>
          <p className="text-ink-2">{t('setup.investingBody')}</p>
          <div className="border-y border-rule">
            <Switch checked={form.investingEnabled} onChange={(v) => set('investingEnabled', v)} label={t('setup.investingEnable')} />
          </div>
          <p className="text-sm text-ink-3">{t('setup.investingLater')}</p>
        </fieldset>
      )}

      {formError && <Notice tone="danger">{formError}</Notice>}

      <div className="flex items-center gap-3">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={busy}>
            {tc('back')}
          </Button>
        )}
        <Button type="submit" className="flex-1" loading={busy}>
          {step < 2 ? tc('continue') : t('setup.submit')}
        </Button>
      </div>
    </form>
  );
}
