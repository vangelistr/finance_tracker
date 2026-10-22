import 'server-only';
import { ObjectId } from 'mongodb';
import type { AccountCreate } from '@/lib/validation/finance';
import { col } from '@/server/db/collections';
import type { AccountDoc } from '@/server/db/types';

export async function listAccounts(userId: ObjectId, opts: { includeArchived?: boolean } = {}): Promise<AccountDoc[]> {
  const { accounts } = await col();
  return accounts.find({ userId, ...(opts.includeArchived ? {} : { archived: false }) }).sort({ sort: 1, createdAt: 1 }).toArray();
}

export async function createAccount(userId: ObjectId, input: AccountCreate, now = new Date()): Promise<AccountDoc> {
  const { accounts } = await col();
  const count = await accounts.countDocuments({ userId });
  const doc: AccountDoc = {
    _id: new ObjectId(),
    userId,
    name: input.name,
    type: input.type,
    currency: input.currency,
    openingBalanceMinor: input.openingBalanceMinor,
    openingDate: input.openingDate,
    archived: false,
    sort: count,
    createdAt: now,
    updatedAt: now,
  };
  await accounts.insertOne(doc);
  return doc;
}

export async function updateAccount(userId: ObjectId, id: ObjectId, patch: Partial<AccountDoc>): Promise<AccountDoc | null> {
  const { accounts } = await col();
  const { _id, userId: _u, createdAt: _c, ...set } = patch;
  return accounts.findOneAndUpdate({ _id: id, userId }, { $set: { ...set, updatedAt: new Date() } }, { returnDocument: 'after' });
}

/** Deletes an unused account; an account with history is archived instead. */
export async function removeAccount(userId: ObjectId, id: ObjectId): Promise<'deleted' | 'archived' | null> {
  const c = await col();
  const account = await c.accounts.findOne({ _id: id, userId });
  if (!account) return null;
  const used =
    (await c.transactions.countDocuments({ userId, $or: [{ accountId: id }, { toAccountId: id }] }, { limit: 1 })) +
    (await c.incomeSources.countDocuments({ userId, accountId: id }, { limit: 1 })) +
    (await c.recurringExpenses.countDocuments({ userId, accountId: id }, { limit: 1 }));
  if (used > 0) {
    await c.accounts.updateOne({ _id: id, userId }, { $set: { archived: true, updatedAt: new Date() } });
    return 'archived';
  }
  await c.accounts.deleteOne({ _id: id, userId });
  return 'deleted';
}

/** Current balance per account: opening balance plus every completed movement up to `asOf` (inclusive). */
export async function accountBalances(userId: ObjectId, asOf?: string): Promise<Map<string, number>> {
  const c = await col();
  const accounts = await c.accounts.find({ userId }).toArray();
  const balances = new Map(accounts.map((a) => [a._id.toHexString(), a.openingBalanceMinor]));
  const match = { userId, status: 'done' as const, ...(asOf ? { localDate: { $lte: asOf } } : {}) };
  const outflows = await c.transactions
    .aggregate<{ _id: ObjectId; total: number }>([
      { $match: { ...match, accountId: { $ne: null } } },
      {
        $group: {
          _id: '$accountId',
          total: { $sum: { $cond: [{ $eq: ['$kind', 'income'] }, '$amountMinor', { $multiply: ['$amountMinor', -1] }] } },
        },
      },
    ])
    .toArray();
  const inflows = await c.transactions
    .aggregate<{ _id: ObjectId; total: number }>([
      { $match: { ...match, kind: 'transfer', toAccountId: { $ne: null } } },
      { $group: { _id: '$toAccountId', total: { $sum: '$amountMinor' } } },
    ])
    .toArray();
  for (const row of [...outflows, ...inflows]) {
    const key = row._id.toHexString();
    balances.set(key, (balances.get(key) ?? 0) + row.total);
  }
  return balances;
}
