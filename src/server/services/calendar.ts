import 'server-only';
import type { ObjectId } from 'mongodb';
import { buildMonth, type CalendarItem } from '@/lib/calendar';
import { addMonths, compareLocalDates, monthBounds, monthOf, toLocalDate, type Month } from '@/lib/dates';
import { occurrences } from '@/lib/recurrence';
import { col } from '@/server/db/collections';
import { generateForUser, generatesExpense, generatesIncome, occurrenceKey } from './generation';
import { listGoals } from './goals';

/**
 * Month view: stored transactions (expected and done) plus projected occurrences for months beyond the generation
 * window, so the calendar can look ahead without writing rows. Subscription charges show as renewals. Goal
 * contributions show on their dates; a goal with a deadline also shows its required monthly amount at the end of each
 * month until the deadline (on the deadline day in its own month).
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

  const current = monthOf(today);
  for (const { goal, contributions, status } of await listGoals(userId, tz, now)) {
    for (const x of contributions) {
      if (compareLocalDates(x.localDate, first) < 0 || compareLocalDates(x.localDate, last) > 0) continue;
      items.push({ key: `goal:${x._id.toHexString()}`, kind: 'goal', state: 'done', localDate: x.localDate, label: goal.name, amountMinor: x.amountMinor, transactionId: null });
    }
    // The required amount spreads what is left over the months after this one up to the deadline month, so it is
    // due in those months; in the deadline month itself when that is the current month.
    if (!goal.deadline || status.reached || status.requiredMonthlyMinor === null) continue;
    const deadlineMonth = monthOf(goal.deadline);
    if (month > deadlineMonth || month < current || (month === current && deadlineMonth !== current)) continue;
    const paid = month === current ? contributions.filter((x) => x.month === month).reduce((sum, x) => sum + x.amountMinor, 0) : 0;
    const due = status.requiredMonthlyMinor - paid;
    if (due <= 0) continue;
    const date = compareLocalDates(goal.deadline, last) < 0 ? goal.deadline : last;
    items.push({ key: `goal-due:${goal._id.toHexString()}:${month}`, kind: 'goal', state: month === current ? 'expected' : 'projected', localDate: date, label: goal.name, amountMinor: due, transactionId: null });
  }

  return { month, today, ...buildMonth(month, today, items) };
}
