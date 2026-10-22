import 'server-only';
import { ObjectId } from 'mongodb';
import { toLocalDate } from '@/lib/dates';
import type { Schedule } from '@/lib/recurrence';
import { col } from '@/server/db/collections';
import type { IncomeSourceDoc, IncomeType, RecurringExpenseDoc, SubscriptionStatus } from '@/server/db/types';
import { generateForUser, resetFutureOccurrences } from './generation';

// Income sources and fixed expenses (subscriptions included). Every write regenerates expected occurrences so the
// calendar and dashboard reflect the change at once.

export interface IncomeSourceInput {
  name: string;
  type: IncomeType;
  categoryId: ObjectId | null;
  accountId: ObjectId | null;
  currency: string;
  schedule: Schedule | null;
  expectedNetMinor: number | null;
  expectedGrossMinor: number | null;
  freelance: boolean;
  active: boolean;
}

export async function listIncomeSources(userId: ObjectId, opts: { includeInactive?: boolean } = {}) {
  const { incomeSources } = await col();
  return incomeSources.find({ userId, ...(opts.includeInactive ? {} : { active: true }) }).sort({ createdAt: 1 }).toArray();
}

export async function createIncomeSource(userId: ObjectId, input: IncomeSourceInput, tz: string, now = new Date()) {
  const { incomeSources } = await col();
  const doc: IncomeSourceDoc = { _id: new ObjectId(), userId, ...input, createdAt: now, updatedAt: now };
  await incomeSources.insertOne(doc);
  await generateForUser(userId, tz, now);
  return doc;
}

export async function updateIncomeSource(userId: ObjectId, id: ObjectId, patch: Partial<IncomeSourceInput>, tz: string, now = new Date()) {
  const { incomeSources } = await col();
  const updated = await incomeSources.findOneAndUpdate({ _id: id, userId }, { $set: { ...patch, updatedAt: now } }, { returnDocument: 'after' });
  if (!updated) return null;
  await resetFutureOccurrences(userId, 'incomeSourceId', id, toLocalDate(now, tz));
  await generateForUser(userId, tz, now);
  return updated;
}

/** Sources are never hard-deleted while entries point at them: they are deactivated and stop generating. */
export async function deactivateIncomeSource(userId: ObjectId, id: ObjectId, tz: string, now = new Date()) {
  const { incomeSources } = await col();
  const res = await incomeSources.updateOne({ _id: id, userId }, { $set: { active: false, updatedAt: now } });
  if (res.matchedCount === 0) return false;
  await resetFutureOccurrences(userId, 'incomeSourceId', id, toLocalDate(now, tz));
  return true;
}

export interface RecurringExpenseInput {
  name: string;
  amountMinor: number;
  categoryId: ObjectId | null;
  accountId: ObjectId | null;
  schedule: Schedule;
  subscription: { status: SubscriptionStatus; reminderDaysBefore: number | null } | null;
  note: string;
  active: boolean;
}

export async function listRecurringExpenses(userId: ObjectId, opts: { includeInactive?: boolean } = {}) {
  const { recurringExpenses } = await col();
  return recurringExpenses.find({ userId, ...(opts.includeInactive ? {} : { active: true }) }).sort({ createdAt: 1 }).toArray();
}

export async function createRecurringExpense(userId: ObjectId, input: RecurringExpenseInput, tz: string, now = new Date()) {
  const { recurringExpenses } = await col();
  const doc: RecurringExpenseDoc = { _id: new ObjectId(), userId, ...input, createdAt: now, updatedAt: now };
  await recurringExpenses.insertOne(doc);
  await generateForUser(userId, tz, now);
  return doc;
}

export async function updateRecurringExpense(userId: ObjectId, id: ObjectId, patch: Partial<RecurringExpenseInput>, tz: string, now = new Date()) {
  const { recurringExpenses } = await col();
  const updated = await recurringExpenses.findOneAndUpdate({ _id: id, userId }, { $set: { ...patch, updatedAt: now } }, { returnDocument: 'after' });
  if (!updated) return null;
  await resetFutureOccurrences(userId, 'recurringExpenseId', id, toLocalDate(now, tz));
  await generateForUser(userId, tz, now);
  return updated;
}

export async function deactivateRecurringExpense(userId: ObjectId, id: ObjectId, tz: string, now = new Date()) {
  const { recurringExpenses } = await col();
  const res = await recurringExpenses.updateOne({ _id: id, userId }, { $set: { active: false, updatedAt: now } });
  if (res.matchedCount === 0) return false;
  await resetFutureOccurrences(userId, 'recurringExpenseId', id, toLocalDate(now, tz));
  return true;
}
