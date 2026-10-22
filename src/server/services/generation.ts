import 'server-only';
import type { AnyBulkWriteOperation, ObjectId } from 'mongodb';
import { addMonths, compareLocalDates, monthBounds, monthOf, toLocalDate, type LocalDate } from '@/lib/dates';
import { occurrences } from '@/lib/recurrence';
import { col } from '@/server/db/collections';
import type { IncomeSourceDoc, RecurringExpenseDoc, TransactionDoc } from '@/server/db/types';

// Recurring fixed income and fixed expenses (including subscriptions) become "expected" transactions for the
// current and next month. Each occurrence has a unique key, and inserts use $setOnInsert, so running the generator
// any number of times creates each occurrence exactly once. A skipped occurrence keeps its row, so it never returns.

export function occurrenceKey(kind: 'income' | 'expense', sourceId: ObjectId, date: LocalDate): string {
  return `${kind}:${sourceId.toHexString()}:${date}`;
}

/** Generation window: from the month the source was created (never older) to the end of next month. */
function windowFor(createdAt: Date, today: LocalDate, tz: string): { from: LocalDate; to: LocalDate } {
  const createdMonth = monthOf(toLocalDate(createdAt, tz));
  return { from: `${createdMonth}-01`, to: monthBounds(monthOf(addMonths(today, 1))).last };
}

export function generatesIncome(s: IncomeSourceDoc): boolean {
  return s.active && s.type === 'recurring_fixed' && !!s.schedule && !!s.expectedNetMinor;
}

export function generatesExpense(e: RecurringExpenseDoc): boolean {
  return e.active && (!e.subscription || e.subscription.status === 'active');
}

function expectedRow(
  userId: ObjectId,
  base: Pick<TransactionDoc, 'kind' | 'amountMinor' | 'grossMinor' | 'accountId' | 'categoryId' | 'incomeSourceId' | 'recurringExpenseId'>,
  key: string,
  date: LocalDate,
  now: Date,
): Omit<TransactionDoc, '_id'> {
  return {
    ...base,
    userId,
    status: 'expected',
    toAccountId: null,
    localDate: date,
    month: monthOf(date),
    note: '',
    origin: 'generated',
    occurrenceKey: key,
    clientId: null,
    doneAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Generates missing expected occurrences for one user. Returns how many were inserted. */
export async function generateForUser(userId: ObjectId, tz: string, now = new Date()): Promise<number> {
  const c = await col();
  const today = toLocalDate(now, tz);
  const ops: AnyBulkWriteOperation<TransactionDoc>[] = [];

  for (const s of await c.incomeSources.find({ userId, active: true, type: 'recurring_fixed' }).toArray()) {
    if (!generatesIncome(s)) continue;
    const { from, to } = windowFor(s.createdAt, today, tz);
    for (const date of occurrences(s.schedule!, from, to)) {
      const key = occurrenceKey('income', s._id, date);
      const row = expectedRow(
        userId,
        { kind: 'income', amountMinor: s.expectedNetMinor!, grossMinor: s.expectedGrossMinor, accountId: s.accountId, categoryId: s.categoryId, incomeSourceId: s._id, recurringExpenseId: null },
        key, date, now,
      );
      ops.push({ updateOne: { filter: { userId, occurrenceKey: key }, update: { $setOnInsert: row }, upsert: true } });
    }
  }

  for (const e of await c.recurringExpenses.find({ userId, active: true }).toArray()) {
    if (!generatesExpense(e)) continue;
    const { from, to } = windowFor(e.createdAt, today, tz);
    for (const date of occurrences(e.schedule, from, to)) {
      const key = occurrenceKey('expense', e._id, date);
      const row = expectedRow(
        userId,
        { kind: 'expense', amountMinor: e.amountMinor, grossMinor: null, accountId: e.accountId, categoryId: e.categoryId, incomeSourceId: null, recurringExpenseId: e._id },
        key, date, now,
      );
      ops.push({ updateOne: { filter: { userId, occurrenceKey: key }, update: { $setOnInsert: row }, upsert: true } });
    }
  }

  if (ops.length === 0) return 0;
  const res = await c.transactions.bulkWrite(ops, { ordered: false });
  return res.upsertedCount;
}

/**
 * After a source changes (amount, schedule, account, pause or cancel), future expected occurrences that were not
 * confirmed or skipped are removed so the next generation run recreates them from the new definition.
 */
export async function resetFutureOccurrences(
  userId: ObjectId,
  field: 'incomeSourceId' | 'recurringExpenseId',
  sourceId: ObjectId,
  today: LocalDate,
): Promise<number> {
  const c = await col();
  const res = await c.transactions.deleteMany({ userId, [field]: sourceId, status: 'expected', origin: 'generated', localDate: { $gte: today } });
  return res.deletedCount;
}

export function isFuture(date: LocalDate, today: LocalDate) {
  return compareLocalDates(date, today) >= 0;
}
