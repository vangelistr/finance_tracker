import { beforeAll, describe, expect, it } from 'vitest';
import * as accounts from '@/app/api/accounts/route';
import * as accountById from '@/app/api/accounts/[id]/route';
import * as calendar from '@/app/api/calendar/route';
import * as categories from '@/app/api/categories/route';
import * as categoryById from '@/app/api/categories/[id]/route';
import * as incomeSources from '@/app/api/income-sources/route';
import * as incomeSourceById from '@/app/api/income-sources/[id]/route';
import * as recurring from '@/app/api/recurring-expenses/route';
import * as recurringById from '@/app/api/recurring-expenses/[id]/route';
import * as transactions from '@/app/api/transactions/route';
import * as transactionById from '@/app/api/transactions/[id]/route';
import * as confirm from '@/app/api/transactions/[id]/confirm/route';
import * as transfers from '@/app/api/transfers/route';
import { monthOf, toLocalDate } from '@/lib/dates';
import { getDb } from '@/server/db/client';
import { collectionsOf } from '@/server/db/collections';
import { runMigrations } from '@/server/db/migrations';
import { generateForUser } from '@/server/services/generation';
import { signedInUser } from './users';

type Session = Awaited<ReturnType<typeof signedInUser>>;
let a: Session;
let b: Session;
const today = toLocalDate(new Date(), 'Europe/Athens');

beforeAll(async () => {
  await runMigrations(await getDb());
  a = await signedInUser('el');
  b = await signedInUser('en');
});

describe('categories', () => {
  it('seeds Greek defaults once per user, with essentials marked', async () => {
    const res = await a.client.call(categories.GET, 'GET', '/api/categories');
    const names = res.json.categories.map((c: { name: string }) => c.name);
    expect(names).toEqual(expect.arrayContaining(['Σπίτι', 'Σούπερ μάρκετ', 'Ενοίκιο ή δόση', 'Μισθός', 'Εργόσημο']));
    expect(res.json.categories.find((c: { name: string }) => c.name === 'Σούπερ μάρκετ').essential).toBe(true);
    const again = await a.client.call(categories.GET, 'GET', '/api/categories');
    expect(again.json.categories).toHaveLength(res.json.categories.length);
    const en = await b.client.call(categories.GET, 'GET', '/api/categories');
    expect(en.json.categories.map((c: { name: string }) => c.name)).toContain('Groceries');
  });

  it('creates subcategories, rejects duplicates and foreign parents', async () => {
    const list = (await a.client.call(categories.GET, 'GET', '/api/categories')).json.categories;
    const home = list.find((c: { name: string }) => c.name === 'Σπίτι');
    const sub = await a.client.call(categories.POST, 'POST', '/api/categories', { body: { kind: 'expense', name: 'Θέρμανση', parentId: home.id } });
    expect(sub.status).toBe(200);
    const dup = await a.client.call(categories.POST, 'POST', '/api/categories', { body: { kind: 'expense', name: 'θέρμανση', parentId: home.id } });
    expect(dup.status).toBe(409);
    const foreign = await b.client.call(categories.POST, 'POST', '/api/categories', { body: { kind: 'expense', name: 'X', parentId: home.id } });
    expect(foreign.status).toBe(400);
    expect((await b.client.call(categoryById.PATCH, 'PATCH', `/api/categories/${home.id}`, { params: { id: home.id }, body: { name: 'Hacked' } })).status).toBe(404);
  });
});

describe('accounts, transactions and balances', () => {
  let checking: { id: string };
  let cash: { id: string };

  it('creates accounts and keeps them private', async () => {
    checking = (await a.client.call(accounts.POST, 'POST', '/api/accounts', { body: { name: 'Τρεχούμενος', type: 'checking', openingBalanceMinor: 100000, openingDate: '2026-01-01' } })).json.account;
    cash = (await a.client.call(accounts.POST, 'POST', '/api/accounts', { body: { name: 'Μετρητά', type: 'cash', openingDate: '2026-01-01' } })).json.account;
    const bList = await b.client.call(accounts.GET, 'GET', '/api/accounts');
    expect(bList.json.accounts).toEqual([]);
    expect((await b.client.call(accountById.DELETE, 'DELETE', `/api/accounts/${checking.id}`, { params: { id: checking.id } })).status).toBe(404);
  });

  it('computes balances from opening balance, expenses, income and transfers', async () => {
    const cats = (await a.client.call(categories.GET, 'GET', '/api/categories')).json.categories;
    const groceries = cats.find((c: { name: string }) => c.name === 'Σούπερ μάρκετ');
    await a.client.call(transactions.POST, 'POST', '/api/transactions', { body: { kind: 'expense', amountMinor: 2350, accountId: checking.id, categoryId: groceries.id, localDate: today } });
    await a.client.call(transactions.POST, 'POST', '/api/transactions', { body: { kind: 'income', amountMinor: 50000, accountId: checking.id, localDate: today } });
    await a.client.call(transfers.POST, 'POST', '/api/transfers', { body: { fromAccountId: checking.id, toAccountId: cash.id, amountMinor: 10000, localDate: today } });
    const list = (await a.client.call(accounts.GET, 'GET', '/api/accounts')).json.accounts;
    expect(list.find((x: { id: string }) => x.id === checking.id).balanceMinor).toBe(100000 - 2350 + 50000 - 10000);
    expect(list.find((x: { id: string }) => x.id === cash.id).balanceMinor).toBe(10000);
  });

  it('rejects references to another user’s account or category', async () => {
    const res = await b.client.call(transactions.POST, 'POST', '/api/transactions', { body: { kind: 'expense', amountMinor: 100, accountId: checking.id, localDate: today } });
    expect(res.status).toBe(400);
    expect(res.json.error.fields.accountId).toBe('unknown');
  });

  it('never duplicates a quick-add replayed with the same client id', async () => {
    const body = { kind: 'expense', amountMinor: 450, localDate: today, clientId: '6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b', origin: 'offline' };
    const first = await a.client.call(transactions.POST, 'POST', '/api/transactions', { body });
    const replay = await a.client.call(transactions.POST, 'POST', '/api/transactions', { body });
    expect([first.status, replay.status]).toEqual([201, 200]);
    expect(replay.json.transaction.id).toBe(first.json.transaction.id);
    const same = (await b.client.call(transactions.POST, 'POST', '/api/transactions', { body })).status;
    expect(same).toBe(201); // client ids are unique per user, not globally
  });

  it('isolates transactions between users', async () => {
    const mine = (await a.client.call(transactions.GET, 'GET', `/api/transactions?month=${monthOf(today)}`)).json.transactions;
    const theirs = (await b.client.call(transactions.GET, 'GET', `/api/transactions?month=${monthOf(today)}`)).json.transactions;
    expect(mine.length).toBeGreaterThan(0);
    expect(theirs.some((t: { id: string }) => mine.some((m: { id: string }) => m.id === t.id))).toBe(false);
    const id = mine[0].id;
    expect((await b.client.call(transactionById.GET, 'GET', `/api/transactions/${id}`, { params: { id } })).status).toBe(404);
    expect((await b.client.call(transactionById.PATCH, 'PATCH', `/api/transactions/${id}`, { params: { id }, body: { note: 'x' } })).status).toBe(404);
    expect((await b.client.call(transactionById.DELETE, 'DELETE', `/api/transactions/${id}`, { params: { id } })).status).toBe(404);
    expect((await b.client.call(transactionById.GET, 'GET', '/api/transactions/not-an-id', { params: { id: 'not-an-id' } })).status).toBe(404);
  });
});

describe('recurring generation', () => {
  it('generates each expected occurrence exactly once (idempotent)', async () => {
    const salary = (
      await a.client.call(incomeSources.POST, 'POST', '/api/income-sources', {
        body: { name: 'Wheelsys', type: 'recurring_fixed', expectedNetMinor: 150000, schedule: { frequency: 'monthly', startDate: '2026-01-25' } },
      })
    ).json.incomeSource;
    const phone = (
      await a.client.call(recurring.POST, 'POST', '/api/recurring-expenses', {
        body: { name: 'Κινητό', amountMinor: 2500, schedule: { frequency: 'monthly', startDate: '2026-01-10' } },
      })
    ).json.recurringExpense;
    const { transactions: txs } = collectionsOf(await getDb());
    const count = () => txs.countDocuments({ userId: a.user._id, origin: 'generated' });
    const first = await count();
    expect(first).toBe(4); // current and next month, one salary and one phone bill each
    for (let i = 0; i < 3; i++) await generateForUser(a.user._id, 'Europe/Athens');
    await Promise.all([generateForUser(a.user._id, 'Europe/Athens'), generateForUser(a.user._id, 'Europe/Athens')]);
    expect(await count()).toBe(first);
    expect(await txs.countDocuments({ incomeSourceId: { $ne: null }, userId: b.user._id })).toBe(0);
    expect(salary.type).toBe('recurring_fixed');
    expect(phone.nextDate).toMatch(/^\d{4}-\d{2}-10$/);
  });

  it('keeps a skipped occurrence skipped and stops paused subscriptions', async () => {
    const { transactions: txs, recurringExpenses } = collectionsOf(await getDb());
    const sub = (
      await a.client.call(recurring.POST, 'POST', '/api/recurring-expenses', {
        body: { name: 'Netflix', amountMinor: 1399, schedule: { frequency: 'monthly', startDate: '2026-01-15' }, subscription: { status: 'active', reminderDaysBefore: 3 } },
      })
    ).json.recurringExpense;
    const rows = await txs.find({ userId: a.user._id, recurringExpenseId: (await recurringExpenses.findOne({ name: 'Netflix' }))!._id }).sort({ localDate: 1 }).toArray();
    expect(rows).toHaveLength(2);
    const target = rows.at(-1)!;
    await a.client.call(transactionById.DELETE, 'DELETE', `/api/transactions/${target._id}`, { params: { id: target._id.toHexString() } });
    await generateForUser(a.user._id, 'Europe/Athens');
    expect((await txs.findOne({ _id: target._id }))!.status).toBe('skipped');
    expect(await txs.countDocuments({ occurrenceKey: target.occurrenceKey })).toBe(1);

    await a.client.call(recurringById.PATCH, 'PATCH', `/api/recurring-expenses/${sub.id}`, { params: { id: sub.id }, body: { subscription: { status: 'paused', reminderDaysBefore: 3 } } });
    const future = await txs.countDocuments({ userId: a.user._id, recurringExpenseId: target.recurringExpenseId, status: 'expected', localDate: { $gte: today } });
    expect(future).toBe(0);
  });

  it('confirms an expected salary with the real amount', async () => {
    const { transactions: txs } = collectionsOf(await getDb());
    const expected = (await txs.findOne({ userId: a.user._id, kind: 'income', status: 'expected' }, { sort: { localDate: 1 } }))!;
    const id = expected._id.toHexString();
    const res = await a.client.call(confirm.POST, 'POST', `/api/transactions/${id}/confirm`, { params: { id }, body: { amountMinor: 149850 } });
    expect(res.json.transaction).toMatchObject({ status: 'done', amountMinor: 149850 });
    expect((await b.client.call(confirm.POST, 'POST', `/api/transactions/${id}/confirm`, { params: { id }, body: {} })).status).toBe(404);
  });

  it('requires a schedule and amount for a fixed income', async () => {
    const res = await a.client.call(incomeSources.POST, 'POST', '/api/income-sources', { body: { name: 'Χωρίς πρόγραμμα', type: 'recurring_fixed' } });
    expect(res.status).toBe(400);
    const variable = await a.client.call(incomeSources.POST, 'POST', '/api/income-sources', { body: { name: 'Intercruises', type: 'recurring_variable' } });
    expect(variable.status).toBe(200);
    const id = variable.json.incomeSource.id;
    expect((await b.client.call(incomeSourceById.DELETE, 'DELETE', `/api/income-sources/${id}`, { params: { id } })).status).toBe(404);
  });
});

describe('calendar', () => {
  it('shows stored and projected items and never another user’s', async () => {
    const month = monthOf(today);
    const res = await a.client.call(calendar.GET, 'GET', `/api/calendar?month=${month}`);
    const items = res.json.days.flatMap((d: { items: unknown[] }) => d.items);
    expect(items.length).toBeGreaterThan(0);
    const farMonth = `${Number(month.slice(0, 4)) + 1}${month.slice(4)}`;
    const ahead = await a.client.call(calendar.GET, 'GET', `/api/calendar?month=${farMonth}`);
    const projected = ahead.json.days.flatMap((d: { items: Array<{ state: string }> }) => d.items).filter((i: { state: string }) => i.state === 'projected');
    expect(projected.length).toBeGreaterThan(0);
    const other = await b.client.call(calendar.GET, 'GET', `/api/calendar?month=${month}`);
    const mineIds = new Set(items.map((i: { key: string }) => i.key));
    const theirs = other.json.days.flatMap((d: { items: Array<{ key: string }> }) => d.items);
    expect(theirs.some((i: { key: string }) => mineIds.has(i.key))).toBe(false);
    expect(theirs.every((i: { label: string }) => i.label !== 'Wheelsys')).toBe(true);
  });
});
