import type { ObjectId } from 'mongodb';
import type { AccountDoc, CategoryDoc, GoalDoc, IncomeSourceDoc, RecurringExpenseDoc, TransactionDoc } from '@/server/db/types';

// Plain JSON shapes for the client: ids as hex strings, never userId.

const id = (v: ObjectId | null | undefined) => (v ? v.toHexString() : null);

export const accountDto = (a: AccountDoc, balanceMinor?: number) => ({
  id: a._id.toHexString(),
  name: a.name,
  type: a.type,
  currency: a.currency,
  openingBalanceMinor: a.openingBalanceMinor,
  openingDate: a.openingDate,
  archived: a.archived,
  balanceMinor: balanceMinor ?? null,
});

export const categoryDto = (c: CategoryDoc) => ({
  id: c._id.toHexString(),
  kind: c.kind,
  name: c.name,
  parentId: id(c.parentId),
  color: c.color,
  icon: c.icon,
  essential: c.essential,
  archived: c.archived,
});

export const incomeSourceDto = (s: IncomeSourceDoc) => ({
  id: s._id.toHexString(),
  name: s.name,
  type: s.type,
  categoryId: id(s.categoryId),
  accountId: id(s.accountId),
  currency: s.currency,
  schedule: s.schedule,
  expectedNetMinor: s.expectedNetMinor,
  expectedGrossMinor: s.expectedGrossMinor,
  freelance: s.freelance,
  active: s.active,
});

export const recurringExpenseDto = (e: RecurringExpenseDoc, nextDate?: string | null) => ({
  id: e._id.toHexString(),
  name: e.name,
  amountMinor: e.amountMinor,
  categoryId: id(e.categoryId),
  accountId: id(e.accountId),
  schedule: e.schedule,
  subscription: e.subscription,
  note: e.note,
  active: e.active,
  nextDate: nextDate ?? null,
});

export const transactionDto = (t: TransactionDoc) => ({
  id: t._id.toHexString(),
  kind: t.kind,
  status: t.status,
  amountMinor: t.amountMinor,
  grossMinor: t.grossMinor,
  accountId: id(t.accountId),
  toAccountId: id(t.toAccountId),
  categoryId: id(t.categoryId),
  incomeSourceId: id(t.incomeSourceId),
  recurringExpenseId: id(t.recurringExpenseId),
  localDate: t.localDate,
  note: t.note,
  origin: t.origin,
  generated: !!t.occurrenceKey,
});

export const goalDto = (g: GoalDoc) => ({
  id: g._id.toHexString(),
  name: g.name,
  targetMinor: g.targetMinor,
  deadline: g.deadline,
  accountId: g.accountId?.toHexString() ?? null,
  priority: g.priority,
  isEmergencyFund: g.isEmergencyFund,
});

export type AccountDto = ReturnType<typeof accountDto>;
export type CategoryDto = ReturnType<typeof categoryDto>;
export type IncomeSourceDto = ReturnType<typeof incomeSourceDto>;
export type RecurringExpenseDto = ReturnType<typeof recurringExpenseDto>;
export type TransactionDto = ReturnType<typeof transactionDto>;
