'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAction } from '@/lib/client/use-action';
import { intlLocale } from '@/lib/intl';
import { formatMoney } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { Notice } from '@/components/ui/notice';

export interface BudgetLine {
  categoryId: string | null;
  label: string;
  color: number;
  amountMinor: number;
  spentMinor: number;
}

/** Overall budget first, then one row per top-level expense category with this month's spending beside it. */
export function BudgetsForm({ lines, currency }: { lines: BudgetLine[]; currency: string }) {
  const t = useTranslations('budgets');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const [values, setValues] = useState<Record<string, number | null>>(Object.fromEntries(lines.map((l) => [l.categoryId ?? 'overall', l.amountMinor || null])));
  const [saved, setSaved] = useState(false);
  const loc = intlLocale(locale);

  async function save() {
    const budgets = lines.map((l) => ({ categoryId: l.categoryId, amountMinor: values[l.categoryId ?? 'overall'] ?? 0 }));
    const ok = await run('/api/budgets', { method: 'PUT', body: { budgets } });
    setSaved(!!ok);
  }

  const [overall, ...categories] = lines;
  const row = (l: BudgetLine, big = false) => (
    <div key={l.categoryId ?? 'overall'} className="grid grid-cols-[1fr_9rem] items-center gap-4 border-b border-rule py-3 sm:grid-cols-[1fr_12rem]">
      <div className="min-w-0">
        <p className={big ? 'font-semibold break-words' : 'flex items-center gap-2 font-medium'}>
          {!big && <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--chart-${l.color})` }} />}
          <span className="min-w-0 break-words">{l.label}</span>
        </p>
        <p className="num text-sm text-ink-3">{t('spentThisMonth', { amount: formatMoney(l.spentMinor, currency, loc) })}</p>
      </div>
      <MoneyInput
        label={l.label}
        className="[&>label]:sr-only"
        valueMinor={l.amountMinor || null}
        onValueChange={(v) => {
          setSaved(false);
          setValues((prev) => ({ ...prev, [l.categoryId ?? 'overall']: v }));
        }}
        placeholder={t('noBudget')}
        currency={currency}
        locale={locale}
      />
    </div>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {overall && <div className="border-t border-rule">{row(overall, true)}</div>}
      <section>
        <h2 className="mb-1 text-lg font-semibold">{t('perCategory')}</h2>
        <div className="border-t border-rule">{categories.map((l) => row(l))}</div>
      </section>
      {error && <Notice tone="danger">{tc('saveFailed')}</Notice>}
      {saved && <Notice tone="success">{t('saved')}</Notice>}
      <Button onClick={save} loading={busy} className="self-start" size="lg">
        {t('save')}
      </Button>
    </div>
  );
}
