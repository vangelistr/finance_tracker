'use client';

import { ArrowLeftRight, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAction } from '@/lib/client/use-action';
import { intlLocale } from '@/lib/intl';
import { Money } from '@/components/data/money';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { MoneyInput } from '@/components/ui/money-input';
import { Notice } from '@/components/ui/notice';
import { Sheet } from '@/components/ui/sheet';

export const ACCOUNT_TYPES = ['checking', 'cash', 'savings', 'investment', 'bills', 'tax_reserve'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  openingBalanceMinor: number;
  openingDate: string;
  archived: boolean;
  balanceMinor: number | null;
}

export function Accounts({ rows, currency, today }: { rows: AccountRow[]; currency: string; today: string }) {
  const t = useTranslations('accounts');
  const ta = useTranslations('accountType');
  const locale = useLocale();
  const [editing, setEditing] = useState<AccountRow | 'new' | null>(null);
  const [transfer, setTransfer] = useState(false);
  const active = rows.filter((r) => !r.archived);
  const total = active.reduce((s, r) => s + (r.balanceMinor ?? 0), 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="text-sm text-ink-2">{t('total')}</p>
          <p className="text-2xl font-semibold">
            <Money minor={total} currency={currency} locale={intlLocale(locale)} />
          </p>
        </div>
        <div className="flex gap-2">
          {active.length >= 2 && (
            <Button variant="secondary" icon={<ArrowLeftRight aria-hidden className="size-4" strokeWidth={2} />} onClick={() => setTransfer(true)}>
              {t('transfer')}
            </Button>
          )}
          <Button icon={<Plus aria-hidden className="size-4" strokeWidth={2} />} onClick={() => setEditing('new')}>
            {t('add')}
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="border-t border-rule py-6">
          <p className="font-semibold">{t('empty')}</p>
          <p className="mt-1 text-ink-2">{t('emptyHint')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setEditing(r)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-surface-hover">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-sm text-ink-3">
                    {ta(r.type)}
                    {r.archived ? ` · ${t('archive')}` : ''}
                  </span>
                </span>
                <Money minor={r.balanceMinor ?? 0} currency={currency} locale={intlLocale(locale)} className="font-semibold" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && <AccountForm key={editing === 'new' ? 'new' : editing.id} row={editing === 'new' ? null : editing} currency={currency} today={today} onClose={() => setEditing(null)} />}
      {transfer && <TransferForm accounts={active} currency={currency} today={today} onClose={() => setTransfer(false)} />}
    </>
  );
}

function AccountForm({ row, currency, today, onClose }: { row: AccountRow | null; currency: string; today: string; onClose: () => void }) {
  const t = useTranslations('accounts');
  const ta = useTranslations('accountType');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const [name, setName] = useState(row?.name ?? '');
  const [type, setType] = useState<AccountType>(row?.type ?? 'checking');
  const [opening, setOpening] = useState<number | null>(row?.openingBalanceMinor ?? 0);
  const [openingDate, setOpeningDate] = useState(row?.openingDate ?? today);

  async function save() {
    if (!name.trim()) return;
    const body = { name: name.trim(), type, openingBalanceMinor: opening ?? 0, openingDate };
    const ok = row ? await run(`/api/accounts/${row.id}`, { method: 'PATCH', body }) : await run('/api/accounts', { body });
    if (ok) onClose();
  }

  return (
    <Sheet open onClose={onClose} title={row ? t('edit') : t('add')} closeLabel={tc('close')}>
      <div className="flex flex-col gap-4">
        <TextField label={tc('name')} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
        <SelectField label={t('type')} value={type} onChange={(e) => setType(e.target.value as AccountType)} hint={type === 'tax_reserve' ? t('taxReserveHint') : undefined}>
          {ACCOUNT_TYPES.map((v) => (
            <option key={v} value={v}>
              {ta(v)}
            </option>
          ))}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput label={t('openingBalance')} valueMinor={opening} onValueChange={(v) => setOpening(v ?? 0)} currency={currency} locale={locale} />
          <TextField label={t('openingDate')} type="date" value={openingDate} onChange={(e) => e.target.value && setOpeningDate(e.target.value)} />
        </div>
        {error && <Notice tone="danger">{tc('saveFailed')}</Notice>}
        <div className="flex items-center gap-3">
          <Button onClick={save} loading={busy} disabled={!name.trim()}>
            {tc('save')}
          </Button>
          {row && !row.archived && (
            <Button variant="danger" className="ml-auto" onClick={async () => (await run(`/api/accounts/${row.id}`, { method: 'DELETE' })) && onClose()}>
              {t('archive')}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function TransferForm({ accounts, currency, today, onClose }: { accounts: AccountRow[]; currency: string; today: string; onClose: () => void }) {
  const t = useTranslations('accounts');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const [from, setFrom] = useState(accounts[0]?.id ?? '');
  const [to, setTo] = useState(accounts[1]?.id ?? '');
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');

  return (
    <Sheet open onClose={onClose} title={t('transfer')} closeLabel={tc('close')}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={t('transferFrom')} value={from} onChange={(e) => setFrom(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('transferTo')} value={to} onChange={(e) => setTo(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>
        </div>
        <MoneyInput label={tc('amount')} valueMinor={null} onValueChange={setAmount} currency={currency} locale={locale} size="lg" />
        <TextField label={tc('date')} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <TextField label={tc('note')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} hint={tc('optional')} />
        {error && <Notice tone="danger">{tc('saveFailed')}</Notice>}
        <Button
          size="lg"
          loading={busy}
          disabled={!amount || from === to}
          onClick={async () => (await run('/api/transfers', { body: { fromAccountId: from, toAccountId: to, amountMinor: amount, localDate: date, note } })) && onClose()}
        >
          {t('transfer')}
        </Button>
      </div>
    </Sheet>
  );
}
