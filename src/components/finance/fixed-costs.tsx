'use client';

import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAction } from '@/lib/client/use-action';
import { formatDay, intlLocale } from '@/lib/intl';
import { monthlyEquivalent, type Schedule } from '@/lib/recurrence';
import { Money } from '@/components/data/money';
import { StatusMark } from '@/components/data/status-mark';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { MoneyInput } from '@/components/ui/money-input';
import { Notice } from '@/components/ui/notice';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { ScheduleFields, scheduleSummary } from './schedule-fields';
import type { Option } from './ledger';

type SubStatus = 'active' | 'paused' | 'cancelled';

export interface FixedRow {
  id: string;
  name: string;
  amountMinor: number;
  categoryId: string | null;
  accountId: string | null;
  schedule: Schedule;
  subscription: { status: SubStatus; reminderDaysBefore: number | null } | null;
  note: string;
  active: boolean;
  nextDate: string | null;
}

interface Props {
  rows: FixedRow[];
  categories: Option[];
  accounts: Option[];
  currency: string;
  today: string;
  defaultReminder: number;
}

export function FixedCosts({ rows, categories, accounts, currency, today, defaultReminder }: Props) {
  const t = useTranslations('fixed');
  const tf = useTranslations('frequency');
  const locale = useLocale();
  const [editing, setEditing] = useState<FixedRow | 'new' | null>(null);
  const active = rows.filter((r) => r.active);
  const subs = active.filter((r) => r.subscription);
  const bills = active.filter((r) => !r.subscription);
  const monthly = active
    .filter((r) => !r.subscription || r.subscription.status === 'active')
    .reduce((s, r) => s + monthlyEquivalent(r.amountMinor, r.schedule.frequency), 0);
  const statusLabel = (s: SubStatus) => t(s === 'active' ? 'statusActive' : s === 'paused' ? 'statusPaused' : 'statusCancelled');

  const list = (items: FixedRow[]) => (
    <ul className="divide-y divide-rule border-y border-rule">
      {items.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => setEditing(r)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-surface-hover">
            <StatusMark tone={r.subscription ? 'renewal' : 'expense'} state={r.subscription && r.subscription.status !== 'active' ? 'skipped' : 'expected'} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.name}</span>
              <span className="block truncate text-sm text-ink-3">
                {scheduleSummary(r.schedule, tf)}
                {r.subscription ? ` · ${statusLabel(r.subscription.status)}` : ''}
                {r.nextDate && (!r.subscription || r.subscription.status === 'active') ? ` · ${t('next', { date: formatDay(r.nextDate, locale, { day: 'numeric', month: 'short' }) })}` : ''}
              </span>
            </span>
            <Money minor={r.amountMinor} currency={currency} locale={intlLocale(locale)} className="font-semibold" />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="text-sm text-ink-2">{t('monthlyTotal')}</p>
          <p className="text-2xl font-semibold">
            <Money minor={monthly} currency={currency} locale={intlLocale(locale)} />
          </p>
        </div>
        <Button icon={<Plus aria-hidden className="size-4" strokeWidth={2} />} onClick={() => setEditing('new')}>
          {t('add')}
        </Button>
      </div>
      {active.length === 0 ? (
        <div className="border-t border-rule py-6">
          <p className="font-semibold">{t('empty')}</p>
          <p className="mt-1 text-ink-2">{t('emptyHint')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {bills.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">{t('bills')}</h2>
              {list(bills)}
            </section>
          )}
          {subs.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">{t('subscriptions')}</h2>
              {list(subs)}
            </section>
          )}
        </div>
      )}
      {editing && (
        <FixedForm
          key={editing === 'new' ? 'new' : editing.id}
          row={editing === 'new' ? null : editing}
          categories={categories}
          accounts={accounts}
          currency={currency}
          today={today}
          defaultReminder={defaultReminder}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function FixedForm({ row, categories, accounts, currency, today, defaultReminder, onClose }: { row: FixedRow | null } & Omit<Props, 'rows'> & { onClose: () => void }) {
  const t = useTranslations('fixed');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const [name, setName] = useState(row?.name ?? '');
  const [amount, setAmount] = useState<number | null>(row?.amountMinor ?? null);
  const [categoryId, setCategoryId] = useState(row?.categoryId ?? '');
  const [accountId, setAccountId] = useState(row?.accountId ?? accounts[0]?.id ?? '');
  const [schedule, setSchedule] = useState<Schedule>(row?.schedule ?? { frequency: 'monthly', startDate: today, dayOfMonth: null, endDate: null });
  const [isSub, setIsSub] = useState(!!row?.subscription);
  const [status, setStatus] = useState<SubStatus>(row?.subscription?.status ?? 'active');
  const [reminder, setReminder] = useState(row?.subscription?.reminderDaysBefore ?? defaultReminder);

  async function save() {
    if (!name.trim() || !amount) return;
    const body = {
      name: name.trim(),
      amountMinor: amount,
      categoryId: categoryId || null,
      accountId: accountId || null,
      schedule,
      subscription: isSub ? { status, reminderDaysBefore: reminder } : null,
    };
    const ok = row ? await run(`/api/recurring-expenses/${row.id}`, { method: 'PATCH', body }) : await run('/api/recurring-expenses', { body });
    if (ok) onClose();
  }

  return (
    <Sheet open onClose={onClose} title={row ? t('edit') : t('add')} closeLabel={tc('close')}>
      <div className="flex flex-col gap-4">
        <TextField label={tc('name')} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
        <MoneyInput label={tc('amount')} valueMinor={amount} onValueChange={setAmount} currency={currency} locale={locale} />
        <ScheduleFields value={schedule} onChange={setSchedule} />
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
          <Switch label={t('subscription')} description={t('subscriptionHint')} checked={isSub} onChange={setIsSub} />
        </div>
        {isSub && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t('status')}</span>
              <Segmented
                label={t('status')}
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'active', label: t('statusActive') },
                  { value: 'paused', label: t('statusPaused') },
                  { value: 'cancelled', label: t('statusCancelled') },
                ]}
              />
            </div>
            <TextField label={t('reminder')} type="number" inputMode="numeric" min={0} max={60} value={reminder} onChange={(e) => setReminder(Math.min(60, Math.max(0, Number(e.target.value) || 0)))} />
          </div>
        )}
        {error && <Notice tone="danger">{tc('saveFailed')}</Notice>}
        <div className="flex items-center gap-3">
          <Button onClick={save} loading={busy} disabled={!name.trim() || !amount}>
            {tc('save')}
          </Button>
          {row?.active && (
            <Button variant="danger" className="ml-auto" onClick={async () => (await run(`/api/recurring-expenses/${row.id}`, { method: 'DELETE' })) && onClose()}>
              {t('deactivate')}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
