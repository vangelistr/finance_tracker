'use client';

import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { addDays } from '@/lib/dates';
import { apiFetch, readCsrfToken } from '@/lib/client/api';
import { enqueue, saveMeta } from '@/lib/client/offline-queue';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { MoneyInput } from '@/components/ui/money-input';
import { Notice } from '@/components/ui/notice';
import { Sheet } from '@/components/ui/sheet';

export interface QuickCategory {
  id: string;
  name: string;
  parentId: string | null;
  color: number;
}

export interface QuickAccount {
  id: string;
  name: string;
}

interface QuickAddProps {
  categories: QuickCategory[];
  accounts: QuickAccount[];
  currency: string;
  today: string;
  variant: 'rail' | 'bar';
  /** Offline page: always queue, never call the API. */
  offline?: boolean;
}

const RECENT_KEY = 'ft_recent_categories';

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/**
 * The fastest path in the app: amount, one tap on a category, save. Date defaults to today. When the server cannot be
 * reached the expense is queued on the device (IndexedDB) and replayed later; the client id makes replays idempotent.
 */
export function QuickAdd({ categories, accounts, currency, today, variant, offline = false }: QuickAddProps) {
  const t = useTranslations('quickAdd');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const amountRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [amount, setAmount] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [parentOpen, setParentOpen] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'info' | 'danger'; text: string } | null>(null);
  const [showError, setShowError] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (offline) return;
    // Keep what the offline page needs on the device (names and ids only).
    void saveMeta('bootstrap', { categories, accounts, currency });
  }, [categories, accounts, currency, offline]);

  const parents = useMemo(() => {
    const top = categories.filter((c) => !c.parentId);
    const rank = (id: string) => {
      const i = recent.indexOf(id);
      return i === -1 ? 999 : i;
    };
    return [...top].sort((a, b) => rank(a.id) - rank(b.id));
  }, [categories, recent]);
  const children = (id: string) => categories.filter((c) => c.parentId === id);

  function openSheet() {
    setRecent(readRecent());
    setOpen(true);
  }

  function reset() {
    setAmount(null);
    setCategoryId(null);
    setParentOpen(null);
    setDate(today);
    setNote('');
    setShowError(false);
    setFormKey((k) => k + 1);
  }

  function rememberCategory(id: string) {
    const parent = categories.find((c) => c.id === id)?.parentId ?? id;
    const next = [parent, ...readRecent().filter((x) => x !== parent)].slice(0, 12);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: ordering falls back to the default.
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!amount) {
      setShowError(true);
      amountRef.current?.focus();
      return;
    }
    setBusy(true);
    const body = {
      kind: 'expense',
      status: 'done',
      amountMinor: amount,
      categoryId,
      accountId: accountId || null,
      localDate: date,
      note,
      clientId: crypto.randomUUID(),
      origin: offline ? 'offline' : 'manual',
    };
    const queue = async () => {
      await enqueue({ clientId: body.clientId, path: '/api/transactions', body: { ...body, origin: 'offline' }, csrf: readCsrfToken(), createdAt: new Date().toISOString() });
      setMessage({ tone: 'info', text: t('savedOffline') });
    };
    if (offline) {
      await queue();
    } else {
      const res = await apiFetch('/api/transactions', { body });
      if (res.ok) {
        setMessage({ tone: 'success', text: t('saved') });
        router.refresh();
      } else if (res.code === 'network') {
        await queue();
      } else {
        setMessage({ tone: 'danger', text: tc('saveFailed') });
        setBusy(false);
        return;
      }
    }
    if (categoryId) rememberCategory(categoryId);
    setBusy(false);
    reset();
    setOpen(false);
    window.setTimeout(() => setMessage(null), 3500);
  }

  const trigger =
    variant === 'rail' ? (
      <Button className="w-full justify-start" icon={<Plus aria-hidden className="size-5" strokeWidth={2} />} onClick={openSheet}>
        {t('title')}
      </Button>
    ) : (
      <button
        type="button"
        onClick={openSheet}
        aria-label={t('title')}
        className="-mt-5 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_4px_14px_-2px_oklch(0.2_0.05_262/0.5)] ring-4 ring-rail transition-transform duration-150 active:scale-95"
      >
        <Plus aria-hidden className="size-7" strokeWidth={2.25} />
      </button>
    );

  return (
    <>
      {trigger}
      <p aria-live="polite" className="sr-only">
        {message?.text}
      </p>
      {message && !open && (
        <div className={cn('fixed inset-x-4 z-40 mx-auto max-w-md', variant === 'bar' ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))]' : 'bottom-6 lg:left-auto lg:right-6')}>
          <Notice tone={message.tone} className="shadow-[var(--shadow-overlay)]">
            {message.text}
          </Notice>
        </div>
      )}
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title={t('title')}
        closeLabel={tc('close')}
      >
        <form key={formKey} onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <MoneyInput
            ref={amountRef}
            label={t('amount')}
            size="lg"
            valueMinor={null}
            onValueChange={(v) => {
              setAmount(v);
              if (v) setShowError(false);
            }}
            currency={currency}
            locale={locale}
            error={showError ? t('amountInvalid') : undefined}
            autoFocus
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('pickCategory')}</legend>
            <div className="flex flex-wrap gap-2">
              {parents.map((c) => {
                const selected = categoryId === c.id || categories.find((x) => x.id === categoryId)?.parentId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setCategoryId(c.id);
                      setParentOpen(children(c.id).length > 0 ? c.id : null);
                    }}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors duration-150',
                      selected ? 'border-accent bg-accent-soft font-semibold text-ink' : 'border-rule-strong bg-surface text-ink-2 hover:text-ink',
                    )}
                  >
                    <span aria-hidden className="size-2.5 rounded-full" style={{ background: `var(--chart-${c.color})` }} />
                    {c.name}
                  </button>
                );
              })}
            </div>
            {parentOpen && (
              <div className="mt-3 flex flex-wrap gap-2 border-l border-rule pl-3">
                {children(parentOpen).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={categoryId === c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={cn(
                      'min-h-10 rounded-full border px-3 text-sm',
                      categoryId === c.id ? 'border-accent bg-accent-soft font-semibold' : 'border-rule bg-surface text-ink-2 hover:text-ink',
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{tc('date')}</span>
              <div className="flex gap-1.5">
                {[
                  { label: tc('today'), value: today },
                  { label: tc('yesterday'), value: addDays(today, -1) },
                ].map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={date === d.value}
                    onClick={() => setDate(d.value)}
                    className={cn('min-h-11 flex-1 rounded-md border text-sm', date === d.value ? 'border-accent bg-accent-soft font-semibold' : 'border-rule-strong bg-surface text-ink-2')}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <TextField label={'\u00a0'} aria-label={tc('date')} type="date" value={date} max={addDays(today, 365)} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>

          {accounts.length > 0 && (
            <SelectField label={tc('account')} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              <option value="">{tc('noAccount')}</option>
            </SelectField>
          )}

          <TextField label={tc('note')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} hint={tc('optional')} />

          <Button type="submit" size="lg" loading={busy}>
            {t('save')}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
