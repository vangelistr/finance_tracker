import 'server-only';
import type { ObjectId } from 'mongodb';
import { col } from '@/server/db/collections';
import type { TransactionDoc } from '@/server/db/types';

/** Names and options for one user's categories, accounts, sources and fixed costs (for labels and selects). */
export async function lookups(userId: ObjectId) {
  const c = await col();
  const [categories, accounts, sources, expenses] = await Promise.all([
    c.categories.find({ userId }).sort({ sort: 1 }).toArray(),
    c.accounts.find({ userId }).sort({ sort: 1 }).toArray(),
    c.incomeSources.find({ userId }).toArray(),
    c.recurringExpenses.find({ userId }).toArray(),
  ]);
  const byId = <T extends { _id: ObjectId }>(list: T[]) => new Map(list.map((x) => [x._id.toHexString(), x]));
  const categoryMap = byId(categories);
  const label = (id: string) => {
    const cat = categoryMap.get(id);
    if (!cat) return '';
    const parent = cat.parentId ? categoryMap.get(cat.parentId.toHexString()) : undefined;
    return parent ? `${parent.name} › ${cat.name}` : cat.name;
  };
  const options = (kind: 'expense' | 'income') =>
    categories
      .filter((x) => x.kind === kind && !x.archived)
      .map((x) => ({ id: x._id.toHexString(), name: label(x._id.toHexString()), parentId: x.parentId?.toHexString() ?? null, key: x.seedKey ?? undefined }))
      .sort((a, b) => a.name.localeCompare(b.name, 'el'));
  return {
    categories: categoryMap,
    accounts: byId(accounts),
    sources: byId(sources),
    expenses: byId(expenses),
    categoryLabel: label,
    categoryOptions: { expense: options('expense'), income: options('income') },
    accountOptions: accounts.filter((a) => !a.archived).map((a) => ({ id: a._id.toHexString(), name: a.name })),
  };
}

export type Lookups = Awaited<ReturnType<typeof lookups>>;

/** Display row for the ledger: the most specific name first, then category and account as detail. */
export function ledgerRow(t: TransactionDoc, l: Lookups, transferLabel: (from: string, to: string) => string) {
  const source = t.incomeSourceId ? l.sources.get(t.incomeSourceId.toHexString()) : undefined;
  const expense = t.recurringExpenseId ? l.expenses.get(t.recurringExpenseId.toHexString()) : undefined;
  const category = t.categoryId ? l.categoryLabel(t.categoryId.toHexString()) : '';
  const account = t.accountId ? (l.accounts.get(t.accountId.toHexString())?.name ?? '') : '';
  const toAccount = t.toAccountId ? (l.accounts.get(t.toAccountId.toHexString())?.name ?? '') : '';
  const label = t.kind === 'transfer' ? transferLabel(account, toAccount) : (expense?.name ?? source?.name ?? (t.note || category || '—'));
  const detail = [t.kind === 'transfer' ? t.note : category && label !== category ? category : '', account].filter(Boolean).join(' · ');
  return {
    id: t._id.toHexString(),
    kind: t.kind,
    status: t.status,
    amountMinor: t.amountMinor,
    localDate: t.localDate,
    label,
    detail,
    categoryId: t.categoryId?.toHexString() ?? null,
    accountId: t.accountId?.toHexString() ?? null,
    note: t.note,
    generated: !!t.occurrenceKey,
    renewal: !!expense?.subscription,
  };
}
