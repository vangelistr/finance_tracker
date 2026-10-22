import 'server-only';
import type { ObjectId } from 'mongodb';
import { buildMonth, type CalendarItem } from '@/lib/calendar';
import { addMonths, compareLocalDates, monthBounds, monthOf, toLocalDate, type Month } from '@/lib/dates';
import { occurrences } from '@/lib/recurrence';
import { col } from '@/server/db/collections';
import { generateForUser, generatesExpense, generatesIncome, occurrenceKey } from './generation';

/**
 * Month view: stored transactions (expected and done) plus projected occurrences for months beyond the generation
 * window, so the calendar can look ahead without writing rows. Subscription charges show as renewals.
 */
export async function getCalendar(userId: ObjectId, month: Month, tz: string, now = new Date()) {
  await generateForUser(userId, tz, now);
  const c = await col();
  const today = toLocalDate(now, tz);
  const { first, last } = monthBounds(month);
  const horizonEnd = monthBounds(monthOf(addMonths(today, 1))).last;

  const [txs, expenses, sources] = await Promise.all([
    c.transactions.find({ userId, localDate: { $gte: first, $lte: last }, status: { $ne: 'skipped' } }).toArray(),
    c.recurringExpenses.find({ userId }).toArray(),
    c.incomeSources.find({ userId }).toArray(),
  ]);
  const expenseById = new Map(expenses.map((e) => [e._id.toHexString(), e]));
  const sourceById = new Map(sources.map((s) => [s._id.toHexString(), s]));
  const categories = new Map((await c.categories.find({ userId }).toArray()).map((x) => [x._id.toHexString(), x.name]));

  const items: CalendarItem[] = txs.map((t) => {
    const expense = t.recurringExpenseId ? expenseById.get(t.recurringExpenseId.toHexString()) : undefined;
    const source = t.incomeSourceId ? sourceById.get(t.incomeSourceId.toHexString()) : undefined;
    const label =
      expense?.name ?? source?.name ?? (t.note || (t.categoryId ? categories.get(t.categoryId.toHexString()) : undefined) || '');
    return {
      key: t._id.toHexString(),
      kind: t.kind === 'expense' && expense?.subscription ? 'renewal' : t.kind,
      state: t.status === 'done' ? 'done' : 'expected',
      localDate: t.localDate,
      label,
      amountMinor: t.amountMinor,
      transactionId: t._id.toHexString(),
    };
  });

  // Look-ahead beyond the generated window.
  if (compareLocalDates(last, horizonEnd) > 0) {
    const from = compareLocalDates(first, horizonEnd) > 0 ? first : horizonEnd;
    for (const s of sources.filter(generatesIncome)) {
      for (const date of occurrences(s.schedule!, from, last)) {
        if (date === horizonEnd) continue;
        items.push({ key: occurrenceKey('income', s._id, date), kind: 'income', state: 'projected', localDate: date, label: s.name, amountMinor: s.expectedNetMinor!, transactionId: null });
      }
    }
    for (const e of expenses.filter(generatesExpense)) {
      for (const date of occurrences(e.schedule, from, last)) {
        if (date === horizonEnd) continue;
        items.push({
          key: occurrenceKey('expense', e._id, date),
          kind: e.subscription ? 'renewal' : 'expense',
          state: 'projected',
          localDate: date,
          label: e.name,
          amountMinor: e.amountMinor,
          transactionId: null,
        });
      }
    }
  }

  return { month, today, ...buildMonth(month, today, items) };
}
