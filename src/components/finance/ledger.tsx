'use client';

import { ArrowLeftRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAction } from '@/lib/client/use-action';
import { cn } from '@/lib/cn';
import { formatDay, intlLocale } from '@/lib/intl';
import { Money } from '@/components/data/money';
import { StatusMark } from '@/components/data/status-mark';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { MoneyInput } from '@/components/ui/money-input';
import { Notice } from '@/components/ui/notice';
import { Sheet } from '@/components/ui/sheet';

export interface LedgerRow {
  id: string;
  kind: 'income' | 'expense' | 'transfer';
  status: 'expected' | 'done' | 'skipped';
  amountMinor: number;
  localDate: string;
  label: string;
  detail: string;
  categoryId: string | null;
  accountId: string | null;
  note: string;
  generated: boolean;
  renewal: boolean;
}

export interface Option {
  id: string;
  name: string;
  /** Seed key of a default category (e.g. `income:salary`), when it is one. */
  key?: string;
}

interface LedgerProps {
  rows: LedgerRow[];
  categories: { expense: Option[]; income: Option[] };
  accounts: Option[];
  currency: string;
  emptyTitle: string;
  emptyBody?: string;
}

/** Transactions grouped by day, newest first, with the day's net; expected items can be confirmed in place. */
export function Ledger({ rows, categories, accounts, currency, emptyTitle, emptyBody }: LedgerProps) {
  const locale = useLocale();
  const t = useTranslations('status');
  const [editing, setEditing] = useState<LedgerRow | null>(null);
  const { run, busy } = useAction();
  const [confirming, setConfirming] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="py-6">
        <p className="font-semibold">{emptyTitle}</p>
        {emptyBody && <p className="mt-1 text-ink-2">{emptyBody}</p>}
      </div>
    );
  }

  const days = new Map<string, LedgerRow[]>();
  for (const r of rows) days.set(r.localDate, [...(days.get(r.localDate) ?? []), r]);

  return (
    <>
      <div className="flex flex-col">
        {[...days.entries()].map(([date, items]) => {
          const net = items.reduce((sum, r) => (r.status !== 'done' ? sum : r.kind === 'income' ? sum + r.amountMinor : r.kind === 'expense' ? sum - r.amountMinor : sum), 0);
          return (
            <section key={date} className="border-t border-rule">
              <header className="flex items-baseline justify-between py-2.5 text-sm">
                <h3 className="font-semibold capitalize">{formatDay(date, locale)}</h3>
                {net !== 0 && <Money minor={net} currency={currency} locale={intlLocale(locale)} signed className="text-ink-2" />}
              </header>
              <ul className="-mx-2 flex flex-col pb-2">
                {items.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-md px-2 hover:bg-surface-hover">
                    <button type="button" onClick={() => setEditing(r)} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left">
                      {r.kind === 'transfer' ? (
                        <ArrowLeftRight aria-hidden className="size-3.5 shrink-0 text-ink-3" strokeWidth={2} />
                      ) : (
                        <StatusMark tone={r.renewal ? 'renewal' : r.kind} state={r.status} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{r.label}</span>
                        <span className="block truncate text-sm text-ink-3">
                          {r.status === 'expected' ? `${t('expected')} · ` : ''}
                          {r.detail}
                        </span>
                      </span>
                      <Money
                        minor={r.kind === 'expense' ? -r.amountMinor : r.amountMinor}
                        currency={currency}
                        locale={intlLocale(locale)}
                        signed={r.kind === 'income'}
                        className={cn(
                          'shrink-0 font-semibold',
                          r.status !== 'done' && 'text-ink-3',
                          r.status === 'done' && r.kind === 'income' && 'text-income',
                        )}
                      />
                    </button>
                    {r.status === 'expected' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy && confirming === r.id}
                        onClick={async () => {
                          setConfirming(r.id);
                          await run(`/api/transactions/${r.id}/confirm`, { method: 'POST' });
                          setConfirming(null);
                        }}
                      >
                        {r.kind === 'income' ? t('markReceived') : t('markPaid')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {editing && (
        <EditTransaction row={editing} categories={categories} accounts={accounts} currency={currency} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function EditTransaction({ row, categories, accounts, currency, onClose }: { row: LedgerRow; categories: LedgerProps['categories']; accounts: Option[]; currency: string; onClose: () => void }) {
  const t = useTranslations('transactions');
  const tc = useTranslations('common');
  const ts = useTranslations('status');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const [amount, setAmount] = useState<number | null>(row.amountMinor);
  const [categoryId, setCategoryId] = useState(row.categoryId ?? '');
  const [accountId, setAccountId] = useState(row.accountId ?? '');
  const [date, setDate] = useState(row.localDate);
  const [note, setNote] = useState(row.note);
  const options = row.kind === 'income' ? categories.income : categories.expense;

  async function save() {
    if (!amount) return;
    const ok = await run(`/api/transactions/${row.id}`, {
      method: 'PATCH',
      body: { amountMinor: amount, categoryId: row.kind === 'transfer' ? undefined : categoryId || null, accountId: accountId || null, localDate: date, note },
    });
    if (ok) onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t('edit')} closeLabel={tc('close')}>
      <div className="flex flex-col gap-4">
        <MoneyInput label={tc('amount')} valueMinor={row.amountMinor} onValueChange={setAmount} currency={currency} locale={locale} />
        {row.kind !== 'transfer' && (
          <SelectField label={tc('category')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{tc('noCategory')}</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField label={tc('account')} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">{tc('noAccount')}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
        <TextField label={tc('date')} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <TextField label={tc('note')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        {row.generated && <p className="text-sm text-ink-3">{t('generatedNote')}</p>}
        {error && <Notice tone="danger">{tc('saveFailed')}</Notice>}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} loading={busy} disabled={!amount}>
            {tc('save')}
          </Button>
          {row.status === 'expected' && (
            <Button variant="secondary" onClick={async () => (await run(`/api/transactions/${row.id}/skip`, { method: 'POST' })) && onClose()}>
              {ts('skip')}
            </Button>
          )}
          {/* Destructive action kept apart from the others */}
          <Button variant="danger" className="ml-auto" onClick={async () => (await run(`/api/transactions/${row.id}`, { method: 'DELETE' })) && onClose()}>
            {tc('delete')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
