'use client';

import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAction } from '@/lib/client/use-action';
import { intlLocale } from '@/lib/intl';
import type { Schedule } from '@/lib/recurrence';
import { Money } from '@/components/data/money';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { MoneyInput } from '@/components/ui/money-input';
import { Notice } from '@/components/ui/notice';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { ScheduleFields, scheduleSummary } from './schedule-fields';
import type { Option } from './ledger';

type IncomeType = 'recurring_fixed' | 'recurring_variable' | 'one_time';

export interface SourceRow {
  id: string;
  name: string;
  type: IncomeType;
  categoryId: string | null;
  accountId: string | null;
  schedule: Schedule | null;
  expectedNetMinor: number | null;
  expectedGrossMinor: number | null;
  freelance: boolean;
  active: boolean;
}

interface Props {
  sources: SourceRow[];
  categories: Option[];
  accounts: Option[];
  currency: string;
  today: string;
}

export function IncomeSources({ sources, categories, accounts, currency, today }: Props) {
  const t = useTranslations('income');
  const tt = useTranslations('incomeType');
  const tf = useTranslations('frequency');
  const locale = useLocale();
  const [editing, setEditing] = useState<SourceRow | 'new' | null>(null);
  const active = sources.filter((s) => s.active);
  const inactive = sources.filter((s) => !s.active);

  return (
    <>
      {active.length === 0 ? (
        <div className="py-2">
          <p className="font-semibold">{t('noSources')}</p>
          <p className="mt-1 text-ink-2">{t('noSourcesHint')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {[...active, ...inactive].map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setEditing(s)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-surface-hover">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block truncate text-sm text-ink-3">
                    {tt(s.type)}
                    {s.schedule && s.type === 'recurring_fixed' ? ` · ${scheduleSummary(s.schedule, tf)}` : ''}
                    {s.freelance ? ` · ${t('freelance')}` : ''}
                    {!s.active ? ` · ${t('inactive')}` : ''}
                  </span>
                </span>
                {s.expectedNetMinor ? <Money minor={s.expectedNetMinor} currency={currency} locale={intlLocale(locale)} className="font-semibold" /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" className="mt-4" icon={<Plus aria-hidden className="size-4" strokeWidth={2} />} onClick={() => setEditing('new')}>
        {t('addSource')}
      </Button>
      {editing && (
        <SourceForm
          key={editing === 'new' ? 'new' : editing.id}
          source={editing === 'new' ? null : editing}
          categories={categories}
          accounts={accounts}
          currency={currency}
          today={today}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function SourceForm({ source, categories, accounts, currency, today, onClose }: { source: SourceRow | null } & Omit<Props, 'sources'> & { onClose: () => void }) {
  const t = useTranslations('income');
  const tt = useTranslations('incomeType');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const [name, setName] = useState(source?.name ?? '');
  const [type, setType] = useState<IncomeType>(source?.type ?? 'recurring_fixed');
  const defaultCategory = (ty: IncomeType) =>
    categories.find((c) => c.key === { recurring_fixed: 'income:salary', recurring_variable: 'income:ergosimo', one_time: 'income:freelance' }[ty])?.id ?? '';
  const [categoryId, setCategoryId] = useState(source?.categoryId ?? defaultCategory('recurring_fixed'));
  const [accountId, setAccountId] = useState(source?.accountId ?? accounts[0]?.id ?? '');
  const [schedule, setSchedule] = useState<Schedule>(source?.schedule ?? { frequency: 'monthly', startDate: today, dayOfMonth: null, endDate: null });
  const [net, setNet] = useState<number | null>(source?.expectedNetMinor ?? null);
  const [gross, setGross] = useState<number | null>(source?.expectedGrossMinor ?? null);
  const [freelance, setFreelance] = useState(source?.freelance ?? false);
  const [invalid, setInvalid] = useState(false);

  async function save() {
    const fixed = type === 'recurring_fixed';
    if (!name.trim() || (fixed && !net)) {
      setInvalid(true);
      return;
    }
    const body = {
      name: name.trim(),
      type,
      categoryId: categoryId || null,
      accountId: accountId || null,
      schedule: fixed ? schedule : null,
      expectedNetMinor: net,
      expectedGrossMinor: gross,
      freelance,
    };
    const ok = source ? await run(`/api/income-sources/${source.id}`, { method: 'PATCH', body }) : await run('/api/income-sources', { body });
    if (ok) onClose();
  }

  return (
    <Sheet open onClose={onClose} title={source ? t('editSource') : t('addSource')} closeLabel={tc('close')}>
      <div className="flex flex-col gap-4">
        <TextField label={tc('name')} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} error={invalid && !name.trim() ? tc('saveFailed') : undefined} autoFocus />
        <div className="flex flex-col gap-2">
          <Segmented
            label={tc('type')}
            value={type}
            onChange={(v) => {
              setType(v);
              if (!source) setCategoryId(defaultCategory(v));
            }}
            options={(['recurring_fixed', 'recurring_variable', 'one_time'] as const).map((v) => ({ value: v, label: tt(v) }))}
          />
          <p className="text-sm text-ink-3">{tt(`${type}Hint`)}</p>
        </div>
        {type === 'recurring_fixed' && <ScheduleFields value={schedule} onChange={setSchedule} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput label={t('expectedNet')} valueMinor={net} onValueChange={setNet} currency={currency} locale={locale} error={invalid && type === 'recurring_fixed' && !net ? t('scheduleNeeded') : undefined} />
          <MoneyInput label={t('expectedGross')} valueMinor={gross} onValueChange={setGross} currency={currency} locale={locale} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={tc('category')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{tc('noCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <SelectField label={tc('account')} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">{tc('noAccount')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="border-y border-rule">
          <Switch label={t('freelance')} description={t('freelanceHint')} checked={freelance} onChange={setFreelance} />
        </div>
        {error && <Notice tone="danger">{error.code === 'validation' ? t('scheduleNeeded') : tc('saveFailed')}</Notice>}
        <div className="flex items-center gap-3">
          <Button onClick={save} loading={busy}>
            {tc('save')}
          </Button>
          {source?.active && (
            <Button variant="danger" className="ml-auto" onClick={async () => (await run(`/api/income-sources/${source.id}`, { method: 'DELETE' })) && onClose()}>
              {t('deactivate')}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** Record money that arrived (irregular pay, an invoice, or a fixed salary paid on another day). */
export function RecordIncome({ sources, accounts, currency, today }: { sources: SourceRow[]; accounts: Option[]; currency: string; today: string }) {
  const t = useTranslations('income');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const [open, setOpen] = useState(false);
  const active = sources.filter((s) => s.active);
  const [sourceId, setSourceId] = useState(active[0]?.id ?? '');
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [note, setNote] = useState('');

  async function save() {
    if (!amount) return;
    const source = active.find((s) => s.id === sourceId);
    const ok = await run('/api/transactions', {
      body: {
        kind: 'income',
        amountMinor: amount,
        incomeSourceId: source?.id ?? null,
        categoryId: source?.categoryId ?? null,
        accountId: accountId || null,
        localDate: date,
        note,
        clientId: crypto.randomUUID(),
      },
    });
    if (ok) {
      setOpen(false);
      setAmount(null);
      setNote('');
    }
  }

  return (
    <>
      <Button icon={<Plus aria-hidden className="size-4" strokeWidth={2} />} onClick={() => setOpen(true)}>
        {t('addReceived')}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('addReceived')} closeLabel={tc('close')}>
        <div className="flex flex-col gap-4">
          <SelectField label={t('source')} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="">{tc('none')}</option>
          </SelectField>
          <MoneyInput label={tc('amount')} valueMinor={null} onValueChange={setAmount} currency={currency} locale={locale} size="lg" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={tc('date')} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <SelectField label={tc('account')} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">{tc('noAccount')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </SelectField>
          </div>
          <TextField label={tc('note')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} hint={tc('optional')} />
          {error && <Notice tone="danger">{tc('saveFailed')}</Notice>}
          <Button onClick={save} loading={busy} disabled={!amount} size="lg">
            {tc('save')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
