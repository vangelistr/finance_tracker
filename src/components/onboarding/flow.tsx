'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/client/api';
import { useAction } from '@/lib/client/use-action';
import { StepRail } from '@/components/auth/step-rail';
import { Categories, type CategoryRow } from '@/components/finance/categories';
import { IncomeSources, type SourceRow } from '@/components/finance/income-sources';
import type { Option } from '@/components/finance/ledger';
import { Button } from '@/components/ui/button';

interface Props {
  sources: SourceRow[];
  categories: CategoryRow[];
  incomeCategories: Option[];
  accounts: Option[];
  currency: string;
  today: string;
  notifications: ReactNode;
}

const SUGGESTED = [
  { type: 'checking', checked: true },
  { type: 'cash', checked: true },
  { type: 'savings', checked: false },
  { type: 'tax_reserve', checked: false },
] as const;

export function OnboardingFlow({ sources, categories, incomeCategories, accounts, currency, today, notifications }: Props) {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const ta = useTranslations('accountType');
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Record<string, boolean>>(Object.fromEntries(SUGGESTED.map((s) => [s.type, s.checked])));
  const { run, busy } = useAction();
  const [finishing, setFinishing] = useState(false);
  const steps = [t('stepIncome'), t('stepCategories'), t('stepAccounts'), t('stepNotifications')];

  async function createAccounts() {
    for (const s of SUGGESTED) {
      if (!picked[s.type]) continue;
      await run('/api/accounts', { body: { name: ta(s.type), type: s.type, openingDate: today } });
    }
    setStep(3);
  }

  async function finish() {
    setFinishing(true);
    const res = await apiFetch('/api/onboarding/complete', { method: 'POST' });
    if (res.ok) {
      router.replace('/');
      router.refresh();
    } else setFinishing(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <StepRail steps={steps} current={step} label={tc('step', { current: step + 1, total: steps.length })} />

      {step === 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t('incomeTitle')}</h2>
          <p className="text-ink-2">{t('incomeBody')}</p>
          <IncomeSources sources={sources} categories={incomeCategories} accounts={accounts} currency={currency} today={today} />
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t('categoriesTitle')}</h2>
          <p className="text-ink-2">{t('categoriesBody')}</p>
          <Categories rows={categories} />
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t('accountsTitle')}</h2>
          <p className="text-ink-2">{t('accountsBody')}</p>
          {accounts.length > 0 && (
            <ul className="divide-y divide-rule border-y border-rule">
              {accounts.map((a) => (
                <li key={a.id} className="py-3 font-medium">
                  {a.name}
                </li>
              ))}
            </ul>
          )}
          {accounts.length === 0 && (
            <fieldset className="flex flex-col">
              <legend className="mb-1 text-sm font-medium">{t('suggested')}</legend>
              {SUGGESTED.map((s) => (
                <label key={s.type} className="flex min-h-12 items-center gap-3 border-b border-rule">
                  <input
                    type="checkbox"
                    checked={!!picked[s.type]}
                    onChange={(e) => setPicked({ ...picked, [s.type]: e.target.checked })}
                    className="size-5 accent-[var(--accent)]"
                  />
                  {ta(s.type)}
                </label>
              ))}
            </fieldset>
          )}
        </section>
      )}

      {step === 3 && <section className="flex flex-col gap-3">{notifications}</section>}

      <div className="flex items-center gap-3">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            {tc('back')}
          </Button>
        )}
        {step < 2 && (
          <Button className="flex-1" onClick={() => setStep(step + 1)}>
            {t('next')}
          </Button>
        )}
        {step === 2 && (
          <Button className="flex-1" loading={busy} onClick={accounts.length === 0 ? createAccounts : () => setStep(3)}>
            {accounts.length === 0 ? t('createSelected') : t('next')}
          </Button>
        )}
        {step === 3 && (
          <Button className="flex-1" size="lg" loading={finishing} onClick={finish}>
            {t('finish')}
          </Button>
        )}
      </div>
    </div>
  );
}
