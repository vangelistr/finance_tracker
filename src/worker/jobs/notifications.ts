import type { Db } from 'mongodb';
import { budgetProgress, type TxRow } from '@/lib/aggregates';
import { addDays, compareLocalDates, monthOf, toLocalDate, zonedInstant, zonedParts } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { nextOccurrence } from '@/lib/recurrence';
import { collectionsOf } from '@/server/db/collections';
import type { UserDoc } from '@/server/db/types';
import { notify } from '@/server/notify';
import type { PushSender } from '@/server/push/send';
import type { Job } from '../scheduler';

// Time-based notifications. Every job is evaluated per user in the user's own time zone, sends at most once per
// idempotency key (insert-before-send log), and catches up after downtime within a bounded window.

const DAILY_WINDOW_MS = 2 * 60 * 60 * 1000; // a missed 21:00 reminder is still useful until 23:00
const MONTHLY_WINDOW_MS = 14 * 60 * 60 * 1000; // the 1st-of-month flow can arrive later that day
const RENEWAL_TIME = '09:00';

const intlLocale = (u: UserDoc) => (u.locale === 'en' ? 'en-IE' : 'el-GR');

/** True when `now` is at or after the local time `time` on the user's current local date, inside `windowMs`. */
function inSlot(now: Date, tz: string, time: string, windowMs: number): boolean {
  const today = toLocalDate(now, tz);
  const slot = zonedInstant(today, time, tz).getTime();
  return now.getTime() >= slot && now.getTime() < slot + windowMs;
}

export function dailyReminderJob(sender: PushSender): Job {
  return {
    name: 'daily-reminder',
    async run({ db, now }: { db: Db; now: Date }) {
      const c = collectionsOf(db);
      for (const user of await c.users.find({ 'settings.notifications.daily.enabled': true }).toArray()) {
        const { time } = user.settings.notifications.daily;
        if (!inSlot(now, user.timezone, time, DAILY_WINDOW_MS)) continue;
        const today = toLocalDate(now, user.timezone);
        await notify(c, sender, { user, key: `daily:${today}`, type: 'daily', titleKey: 'dailyTitle', bodyKey: 'dailyBody', url: '/transactions' }, now);
      }
    },
  };
}

export function monthlyFlowJob(sender: PushSender): Job {
  return {
    name: 'monthly-flow',
    async run({ db, now }: { db: Db; now: Date }) {
      const c = collectionsOf(db);
      for (const user of await c.users.find({ 'settings.notifications.monthly.enabled': true }).toArray()) {
        const parts = zonedParts(now, user.timezone);
        if (parts.day !== 1) continue;
        if (!inSlot(now, user.timezone, user.settings.notifications.monthly.time, MONTHLY_WINDOW_MS)) continue;
        const month = monthOf(toLocalDate(now, user.timezone));
        await notify(
          c,
          sender,
          { user, key: `monthly:${month}`, type: 'monthly', titleKey: 'monthlyTitle', bodyKey: user.settings.investingEnabled ? 'monthlyBodyInvesting' : 'monthlyBody', url: '/monthly' },
          now,
        );
      }
    },
  };
}

export function renewalAlertsJob(sender: PushSender): Job {
  return {
    name: 'renewal-alerts',
    async run({ db, now }: { db: Db; now: Date }) {
      const c = collectionsOf(db);
      const users = await c.users.find({ 'settings.notifications.renewals.enabled': true }).toArray();
      for (const user of users) {
        const today = toLocalDate(now, user.timezone);
        if (now.getTime() < zonedInstant(today, RENEWAL_TIME, user.timezone).getTime()) continue;
        const subs = await c.recurringExpenses.find({ userId: user._id, active: true, 'subscription.status': 'active' }).toArray();
        for (const sub of subs) {
          const days = sub.subscription!.reminderDaysBefore ?? user.settings.notifications.renewals.defaultDaysBefore;
          const renewal = nextOccurrence(sub.schedule, today);
          if (!renewal) continue;
          // From N days before the renewal until the renewal day itself (catch-up), once per renewal date.
          if (compareLocalDates(today, addDays(renewal, -days)) < 0) continue;
          await notify(
            c,
            sender,
            {
              user,
              key: `renewal:${sub._id.toHexString()}:${renewal}`,
              type: 'renewal',
              titleKey: 'renewalTitle',
              bodyKey: 'renewalBody',
              params: { name: sub.name, date: new Intl.DateTimeFormat(intlLocale(user), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${renewal}T12:00:00Z`)), amount: formatMoney(sub.amountMinor, user.currency, intlLocale(user)) },
              url: '/fixed',
            },
            now,
          );
        }
      }
    },
  };
}

/**
 * Overspend: when month-to-date spending crosses a threshold of a budget. Each threshold fires at most once per
 * budget per month; when several are crossed at once only the highest is sent and the lower ones are marked done.
 */
export function overspendAlertsJob(sender: PushSender): Job {
  return {
    name: 'overspend-alerts',
    async run({ db, now }: { db: Db; now: Date }) {
      const c = collectionsOf(db);
      for (const user of await c.users.find({ 'settings.notifications.overspend.enabled': true }).toArray()) {
        const budgets = await c.budgets.find({ userId: user._id }).toArray();
        if (budgets.length === 0) continue;
        const month = monthOf(toLocalDate(now, user.timezone));
        const [txs, categories] = await Promise.all([
          c.transactions.find({ userId: user._id, kind: 'expense', status: 'done', month }).toArray(),
          c.categories.find({ userId: user._id, kind: 'expense' }).toArray(),
        ]);
        const rows: TxRow[] = txs.map((t) => ({
          kind: t.kind,
          status: t.status,
          amountMinor: t.amountMinor,
          localDate: t.localDate,
          categoryId: t.categoryId?.toHexString() ?? null,
          incomeSourceId: null,
          accountId: null,
          toAccountId: null,
        }));
        const thresholds = [...user.settings.notifications.overspend.thresholds].sort((a, b) => a - b);
        const progress = budgetProgress(
          rows,
          budgets.map((b) => ({ categoryId: b.categoryId?.toHexString() ?? null, amountMinor: b.amountMinor })),
          categories.map((x) => ({ id: x._id.toHexString(), name: x.name, parentId: x.parentId?.toHexString() ?? null, color: x.color })),
          month,
          thresholds,
          { overall: user.locale === 'en' ? 'Overall' : 'Συνολικά' },
        );
        for (const p of progress) {
          if (p.reached === null) continue;
          const scope = p.categoryId ?? 'overall';
          const reached = thresholds.filter((t) => t <= p.reached!);
          const highest = reached.at(-1)!;
          const keyFor = (t: number) => `overspend:${scope}:${month}:${t}`;
          const result = await notify(
            c,
            sender,
            {
              user,
              key: keyFor(highest),
              type: 'overspend',
              titleKey: highest >= 100 ? 'overspendTitleOver' : 'overspendTitle',
              bodyKey: 'overspendBody',
              params: {
                category: p.label,
                threshold: highest,
                spent: formatMoney(p.spentMinor, user.currency, intlLocale(user)),
                budget: formatMoney(p.budgetMinor, user.currency, intlLocale(user)),
              },
              url: '/budgets',
            },
            now,
          );
          if (result === 'duplicate') continue;
          // Lower thresholds crossed in the same jump are recorded as covered so they never arrive later.
          for (const t of reached.slice(0, -1)) {
            await c.notificationLog.updateOne(
              { userId: user._id, key: keyFor(t) },
              { $setOnInsert: { userId: user._id, key: keyFor(t), type: 'overspend', status: 'superseded', createdAt: now, updatedAt: now } },
              { upsert: true },
            );
          }
        }
      }
    },
  };
}
