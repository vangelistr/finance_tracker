import 'server-only';
import { MongoServerError, ObjectId, type Filter } from 'mongodb';
import { monthBounds, monthOf, type LocalDate } from '@/lib/dates';
import { col } from '@/server/db/collections';
import type { TransactionDoc, TransactionKind, TransactionOrigin, TransactionStatus } from '@/server/db/types';

export interface TransactionInput {
  kind: TransactionKind;
  status: Extract<TransactionStatus, 'expected' | 'done'>;
  amountMinor: number;
  grossMinor: number | null;
  accountId: ObjectId | null;
  toAccountId: ObjectId | null;
  categoryId: ObjectId | null;
  incomeSourceId: ObjectId | null;
  localDate: LocalDate;
  note: string;
  clientId: string | null;
  origin: Extract<TransactionOrigin, 'manual' | 'offline' | 'tax_set_aside'>;
}

export interface TransactionQuery {
  month?: string;
  from?: LocalDate;
  to?: LocalDate;
  kind?: TransactionKind;
  status?: TransactionStatus;
  categoryId?: ObjectId;
  accountId?: ObjectId;
  q?: string;
  limit: number;
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listTransactions(userId: ObjectId, q: TransactionQuery): Promise<TransactionDoc[]> {
  const { transactions } = await col();
  const filter: Filter<TransactionDoc> = { userId };
  if (q.month) {
    const { first, last } = monthBounds(q.month);
    filter.localDate = { $gte: first, $lte: last };
  } else if (q.from || q.to) {
    filter.localDate = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  }
  if (q.kind) filter.kind = q.kind;
  if (q.status) filter.status = q.status;
  else filter.status = { $ne: 'skipped' };
  if (q.categoryId) filter.categoryId = q.categoryId;
  if (q.accountId) filter.$or = [{ accountId: q.accountId }, { toAccountId: q.accountId }];
  if (q.q) filter.note = { $regex: escapeRegex(q.q), $options: 'i' };
  return transactions.find(filter).sort({ localDate: -1, createdAt: -1 }).limit(q.limit).toArray();
}

export async function getTransaction(userId: ObjectId, id: ObjectId) {
  const { transactions } = await col();
  return transactions.findOne({ _id: id, userId });
}

/**
 * Creates a transaction. A repeated clientId (offline replay, double tap) returns the first one instead of a
 * duplicate: `{ created: false }`.
 */
export async function createTransaction(userId: ObjectId, input: TransactionInput, now = new Date()): Promise<{ doc: TransactionDoc; created: boolean }> {
  const { transactions } = await col();
  const doc: TransactionDoc = {
    _id: new ObjectId(),
    userId,
    kind: input.kind,
    status: input.status,
    amountMinor: input.amountMinor,
    grossMinor: input.kind === 'income' ? input.grossMinor : null,
    accountId: input.accountId,
    toAccountId: input.kind === 'transfer' ? input.toAccountId : null,
    categoryId: input.kind === 'transfer' ? null : input.categoryId,
    incomeSourceId: input.kind === 'income' ? input.incomeSourceId : null,
    recurringExpenseId: null,
    localDate: input.localDate,
    month: monthOf(input.localDate),
    note: input.note,
    origin: input.origin,
    occurrenceKey: null,
    clientId: input.clientId,
    doneAt: input.status === 'done' ? now : null,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await transactions.insertOne(doc);
    return { doc, created: true };
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000 && input.clientId) {
      const existing = await transactions.findOne({ userId, clientId: input.clientId });
      if (existing) return { doc: existing, created: false };
    }
    throw err;
  }
}

export async function updateTransaction(
  userId: ObjectId,
  id: ObjectId,
  patch: Partial<Pick<TransactionDoc, 'amountMinor' | 'grossMinor' | 'accountId' | 'categoryId' | 'incomeSourceId' | 'localDate' | 'note'>>,
) {
  const { transactions } = await col();
  const set: Record<string, unknown> = { ...patch, updatedAt: new Date() };
  if (patch.localDate) set.month = monthOf(patch.localDate);
  return transactions.findOneAndUpdate({ _id: id, userId }, { $set: set }, { returnDocument: 'after' });
}

/** Generated occurrences are marked skipped (so they are never generated again); everything else is deleted. */
export async function removeTransaction(userId: ObjectId, id: ObjectId): Promise<'deleted' | 'skipped' | null> {
  const { transactions } = await col();
  const tx = await transactions.findOne({ _id: id, userId });
  if (!tx) return null;
  if (tx.occurrenceKey) {
    await transactions.updateOne({ _id: id, userId }, { $set: { status: 'skipped', updatedAt: new Date() } });
    return 'skipped';
  }
  await transactions.deleteOne({ _id: id, userId });
  return 'deleted';
}

/** Expected → received/paid, optionally with the real amount, date or account. */
export async function confirmTransaction(
  userId: ObjectId,
  id: ObjectId,
  opts: { amountMinor?: number; localDate?: LocalDate; accountId?: ObjectId | null },
  now = new Date(),
) {
  const { transactions } = await col();
  const set: Record<string, unknown> = { status: 'done', doneAt: now, updatedAt: now };
  if (opts.amountMinor !== undefined) set.amountMinor = opts.amountMinor;
  if (opts.localDate) {
    set.localDate = opts.localDate;
    set.month = monthOf(opts.localDate);
  }
  if (opts.accountId !== undefined) set.accountId = opts.accountId;
  return transactions.findOneAndUpdate({ _id: id, userId, status: { $in: ['expected', 'skipped'] } }, { $set: set }, { returnDocument: 'after' });
}

export async function skipTransaction(userId: ObjectId, id: ObjectId, now = new Date()) {
  const { transactions } = await col();
  return transactions.findOneAndUpdate({ _id: id, userId, status: 'expected' }, { $set: { status: 'skipped', updatedAt: now } }, { returnDocument: 'after' });
}
