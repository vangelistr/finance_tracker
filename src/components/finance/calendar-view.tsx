'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { CalendarDay, CalendarItem } from '@/lib/calendar';
import { useAction } from '@/lib/client/use-action';
import { cn } from '@/lib/cn';
import { compareLocalDates } from '@/lib/dates';
import { formatDay, intlLocale } from '@/lib/intl';
import { Money } from '@/components/data/money';
import { StatusMark } from '@/components/data/status-mark';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';
import { MoneyInput } from '@/components/ui/money-input';
import { Notice } from '@/components/ui/notice';
import { Sheet } from '@/components/ui/sheet';
import type { Option } from './ledger';

interface Props {
  weeks: CalendarDay[][];
  days: CalendarDay[];
  today: string;
  currency: string;
  categories: Option[];
}

const MAX_IN_CELL = 3;

function weekdayNames(locale: string) {
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i))),
  );
}

export function CalendarView({ weeks, days, today, currency, categories }: Props) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const [selected, setSelected] = useState<CalendarDay | null>(null);
  const agendaDays = days.filter((d) => d.inMonth && d.items.length > 0);
  const loc = intlLocale(locale);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-4 text-sm text-ink-2">
        <span className="inline-flex items-center gap-2">
          <StatusMark tone="income" state="expected" /> {t('legendExpected')}
        </span>
        <span className="inline-flex items-center gap-2">
          <StatusMark tone="income" state="done" /> {t('legendDone')}
        </span>
      </div>

      {/* Desktop: month grid */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-7 border-b border-rule pb-2 text-sm text-ink-3">
          {weekdayNames(locale).map((w) => (
            <div key={w} className="px-2 capitalize">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((d) => (
            <button
              key={d.date}
              type="button"
              onClick={() => setSelected(d)}
              className={cn(
                'flex min-h-32 flex-col gap-1 border-r border-b border-rule p-2 text-left transition-colors duration-150 hover:bg-surface-hover [&:nth-child(7n)]:border-r-0',
                !d.inMonth && 'text-ink-3',
              )}
            >
              <span
                className={cn(
                  'num grid size-7 place-items-center rounded-full text-sm',
                  d.isToday && 'bg-ink font-semibold text-surface',
                )}
              >
                {Number(d.date.slice(8, 10))}
              </span>
              {d.items.slice(0, MAX_IN_CELL).map((i) => (
                <span key={i.key} className="flex items-center gap-1.5 text-xs">
                  <StatusMark tone={i.kind === 'transfer' ? 'transfer' : i.kind} state={i.state} className="size-2.5" />
                  <span className="min-w-0 flex-1 truncate">{i.label}</span>
                </span>
              ))}
              {d.items.length > MAX_IN_CELL && <span className="text-xs text-ink-3">{t('more', { count: d.items.length - MAX_IN_CELL })}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Phone: agenda drawn as a vertical line, travelled part solid */}
      <div className="lg:hidden">
        {agendaDays.length === 0 ? (
          <div className="py-6">
            <p className="font-semibold">{t('nothing')}</p>
            <p className="mt-1 text-ink-2">{t('nothingHint')}</p>
          </div>
        ) : (
          <ol className="relative">
            {agendaDays.map((d, idx) => {
              const past = compareLocalDates(d.date, today) < 0;
              return (
                <li key={d.date} className="relative flex gap-4 pb-5">
                  {idx < agendaDays.length - 1 && (
                    <span aria-hidden className={cn('absolute top-4 bottom-0 left-[7px] w-1 rounded-full', past ? 'bg-ink' : 'bg-rule-strong')} />
                  )}
                  <span
                    aria-hidden
                    className={cn('relative z-10 mt-1 size-[18px] shrink-0 rounded-full border-4', past || d.isToday ? 'border-ink bg-ink' : 'border-rule-strong bg-surface')}
                  />
                  <button type="button" onClick={() => setSelected(d)} className="min-w-0 flex-1 text-left">
                    <span className={cn('block font-semibold capitalize', d.isToday && 'text-accent')}>{formatDay(d.date, locale)}</span>
                    <ul className="mt-1 flex flex-col gap-1.5">
                      {d.items.map((i) => (
                        <li key={i.key} className="flex items-center gap-2.5">
                          <StatusMark tone={i.kind === 'transfer' ? 'transfer' : i.kind} state={i.state} />
                          <span className="min-w-0 flex-1 truncate">{i.label}</span>
                          <Money minor={i.kind === 'income' || i.kind === 'goal' ? i.amountMinor : -i.amountMinor} currency={currency} locale={loc} className={cn('text-sm', i.state === 'done' ? 'font-semibold' : 'text-ink-3')} />
                        </li>
                      ))}
                    </ul>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {selected && <DaySheet day={selected} currency={currency} categories={categories} onClose={() => setSelected(null)} />}
    </>
  );
}

function DaySheet({ day, currency, categories, onClose }: { day: CalendarDay; currency: string; categories: Option[]; onClose: () => void }) {
  const t = useTranslations('calendar');
  const ts = useTranslations('status');
  const tk = useTranslations('kind');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const [amount, setAmount] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [formKey, setFormKey] = useState(0);

  const confirm = (i: CalendarItem) => run(`/api/transactions/${i.transactionId}/confirm`, { method: 'POST' });

  return (
    <Sheet open onClose={onClose} title={formatDay(day.date, locale)} closeLabel={tc('close')}>
      <div className="flex flex-col gap-5">
        {day.items.length > 0 && (
          <ul className="divide-y divide-rule border-y border-rule">
            {day.items.map((i) => (
              <li key={i.key} className="flex min-h-14 items-center gap-3 py-2">
                <StatusMark tone={i.kind === 'transfer' ? 'transfer' : i.kind} state={i.state} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{i.label}</span>
                  <span className="block text-sm text-ink-3">
                    {tk(i.kind)} · {ts(i.state)}
                  </span>
                </span>
                <Money minor={i.amountMinor} currency={currency} locale={intlLocale(locale)} className="font-semibold" />
                {i.state === 'expected' && i.transactionId && (
                  <Button size="sm" variant="secondary" loading={busy} onClick={() => confirm(i).then((ok) => ok && onClose())}>
                    {i.kind === 'income' ? ts('markReceived') : ts('markPaid')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form
          key={formKey}
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!amount) return;
            const ok = await run('/api/transactions', {
              body: { kind: 'expense', amountMinor: amount, categoryId: categoryId || null, localDate: day.date, clientId: crypto.randomUUID() },
            });
            if (ok) {
              setAmount(null);
              setFormKey((k) => k + 1);
            }
          }}
        >
          <p className="font-semibold">{t('addOnDay')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput label={tc('amount')} valueMinor={null} onValueChange={setAmount} currency={currency} locale={locale} />
            <SelectField label={tc('category')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{tc('noCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          </div>
          {error && <Notice tone="danger">{tc('saveFailed')}</Notice>}
          <Button type="submit" loading={busy} disabled={!amount} className="self-start">
            {tc('add')}
          </Button>
        </form>
      </div>
    </Sheet>
  );
}
