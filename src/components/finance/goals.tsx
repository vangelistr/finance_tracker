'use client';

import { Plus, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAction } from '@/lib/client/use-action';
import { cn } from '@/lib/cn';
import { formatDay, formatMonth, intlLocale } from '@/lib/intl';
import { formatMoney } from '@/lib/money';
import type { GoalStatus } from '@/lib/goals';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { MoneyInput } from '@/components/ui/money-input';
import { Notice } from '@/components/ui/notice';
import { Sheet } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import type { Option } from './ledger';

export interface GoalRow {
  id: string;
  name: string;
  targetMinor: number;
  deadline: string | null;
  accountId: string | null;
  priority: number;
  isEmergencyFund: boolean;
  savedMinor: number;
  status: GoalStatus;
  contributions: Array<{ id: string; amountMinor: number; localDate: string; source: 'manual' | 'plan' }>;
}

export function Goals({ rows, accounts, currency, today }: { rows: GoalRow[]; accounts: Option[]; currency: string; today: string }) {
  const t = useTranslations('goals');
  const locale = useLocale();
  const loc = intlLocale(locale);
  const [editing, setEditing] = useState<GoalRow | 'new' | 'new-ef' | null>(null);
  const [contributing, setContributing] = useState<GoalRow | null>(null);
  const hasEf = rows.some((r) => r.isEmergencyFund);

  return (
    <>
      <div className="flex flex-wrap gap-2 pb-6">
        <Button icon={<Plus aria-hidden className="size-4" strokeWidth={2} />} onClick={() => setEditing('new')}>
          {t('add')}
        </Button>
        {!hasEf && (
          <Button variant="secondary" icon={<ShieldCheck aria-hidden className="size-4" strokeWidth={2} />} onClick={() => setEditing('new-ef')}>
            {t('createEmergency')}
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="border-t border-rule py-6">
          <p className="font-semibold">{t('empty')}</p>
          <p className="mt-1 text-ink-2">{t('emptyHint')}</p>
        </div>
      ) : (
        <ul className="border-t border-rule">
          {rows.map((g) => {
            const pct = g.status.progressBps / 100;
            return (
              <li key={g.id} className="border-b border-rule py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <button type="button" onClick={() => setEditing(g)} className="flex min-h-11 items-center gap-2 text-left text-lg font-semibold hover:underline">
                    {g.isEmergencyFund && <ShieldCheck aria-hidden className="size-4 text-goal" strokeWidth={2} />}
                    {g.name}
                  </button>
                  <span className="num text-ink-2">{t('saved', { saved: formatMoney(g.savedMinor, currency, loc), target: formatMoney(g.targetMinor, currency, loc) })}</span>
                </div>
                <div role="meter" aria-label={g.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-goal-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p className={cn('text-ink-2', g.status.deadlinePassed && 'text-danger')}>
                    {g.status.reached
                      ? t('reached')
                      : [
                          g.status.requiredMonthlyMinor !== null ? t('required', { amount: formatMoney(g.status.requiredMonthlyMinor, currency, loc) }) : null,
                          g.deadline ? formatDay(g.deadline, locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null,
                          g.status.deadlinePassed ? t('deadlinePassed') : null,
                          g.status.projectedMonth ? t('projected', { month: formatMonth(g.status.projectedMonth, locale) }) : t('noPace'),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                  </p>
                  {!g.status.reached && (
                    <Button size="sm" variant="secondary" onClick={() => setContributing(g)}>
                      {t('contribute')}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && (
        <GoalForm
          key={typeof editing === 'string' ? editing : editing.id}
          goal={typeof editing === 'string' ? null : editing}
          emergency={editing === 'new-ef'}
          accounts={accounts}
          currency={currency}
          onClose={() => setEditing(null)}
        />
      )}
      {contributing && <ContributionForm goal={contributing} currency={currency} today={today} onClose={() => setContributing(null)} />}
    </>
  );
}

function GoalForm({ goal, emergency, accounts, currency, onClose }: { goal: GoalRow | null; emergency: boolean; accounts: Option[]; currency: string; onClose: () => void }) {
  const t = useTranslations('goals');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const [name, setName] = useState(goal?.name ?? (emergency ? t('emergencyName') : ''));
  const [target, setTarget] = useState<number | null>(goal?.targetMinor ?? null);
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [priority, setPriority] = useState(goal?.priority ?? (emergency ? 1 : 3));
  const [accountId, setAccountId] = useState(goal?.accountId ?? '');
  const [isEf, setIsEf] = useState(goal?.isEmergencyFund ?? emergency);

  async function save() {
    if (!name.trim() || !target) return;
    const body = { name: name.trim(), targetMinor: target, deadline: deadline || null, priority, accountId: accountId || null, isEmergencyFund: isEf };
    const ok = goal ? await run(`/api/goals/${goal.id}`, { method: 'PATCH', body }) : await run('/api/goals', { body });
    if (ok) onClose();
  }

  return (
    <Sheet open onClose={onClose} title={goal ? t('edit') : t('add')} closeLabel={tc('close')}>
      <div className="flex flex-col gap-4">
        <TextField label={tc('name')} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
        <MoneyInput label={t('target')} valueMinor={target} onValueChange={setTarget} currency={currency} locale={locale} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('deadline')} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <TextField label={t('priority')} hint={t('priorityHint')} type="number" inputMode="numeric" min={1} max={9} value={priority} onChange={(e) => setPriority(Math.min(9, Math.max(1, Number(e.target.value) || 1)))} />
        </div>
        <SelectField label={t('account')} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">{tc('noAccount')}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
        <div className="border-y border-rule">
          <Switch label={t('emergency')} description={t('emergencyHint')} checked={isEf} onChange={setIsEf} />
        </div>
        {error && <Notice tone="danger">{tc('saveFailed')}</Notice>}
        <div className="flex items-center gap-3">
          <Button onClick={save} loading={busy} disabled={!name.trim() || !target}>
            {tc('save')}
          </Button>
          {goal && (
            <Button variant="danger" className="ml-auto" onClick={async () => (await run(`/api/goals/${goal.id}`, { method: 'DELETE' })) && onClose()}>
              {t('archive')}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function ContributionForm({ goal, currency, today, onClose }: { goal: GoalRow; currency: string; today: string; onClose: () => void }) {
  const t = useTranslations('goals');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { run, busy, error } = useAction();
  const [amount, setAmount] = useState<number | null>(goal.status.requiredMonthlyMinor);
  const [date, setDate] = useState(today);
  return (
    <Sheet open onClose={onClose} title={`${t('contribution')}: ${goal.name}`} closeLabel={tc('close')}>
      <div className="flex flex-col gap-4">
        <MoneyInput label={tc('amount')} valueMinor={amount} onValueChange={setAmount} currency={currency} locale={locale} size="lg" />
        <TextField label={tc('date')} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        {error && <Notice tone="danger">{tc('saveFailed')}</Notice>}
        <Button size="lg" loading={busy} disabled={!amount} onClick={async () => (await run(`/api/goals/${goal.id}/contributions`, { body: { amountMinor: amount, localDate: date } })) && onClose()}>
          {t('contribute')}
        </Button>
      </div>
    </Sheet>
  );
}
