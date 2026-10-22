import { beforeAll, describe, expect, it } from 'vitest';
import * as budgets from '@/app/api/budgets/route';
import * as categories from '@/app/api/categories/route';
import * as dashboard from '@/app/api/dashboard/route';
import * as transactions from '@/app/api/transactions/route';
import { toLocalDate } from '@/lib/dates';
import { getDb } from '@/server/db/client';
import { runMigrations } from '@/server/db/migrations';
import { signedInUser } from './users';

type Session = Awaited<ReturnType<typeof signedInUser>>;
let a: Session;
let b: Session;
let food: { id: string };
let rent: { id: string };

beforeAll(async () => {
  await runMigrations(await getDb());
  a = await signedInUser('el');
  b = await signedInUser('el');
  const list = (await a.client.call(categories.GET, 'GET', '/api/categories')).json.categories;
  food = list.find((c: { name: string }) => c.name === 'Σούπερ μάρκετ');
  rent = list.find((c: { name: string }) => c.name === 'Ενοίκιο ή δόση');
});

describe('budgets', () => {
  it('saves overall and top-level budgets, rejects subcategories and other users’ categories', async () => {
    const ok = await a.client.call(budgets.PUT, 'PUT', '/api/budgets', { body: { budgets: [{ categoryId: null, amountMinor: 100000 }, { categoryId: food.id, amountMinor: 30000 }] } });
    expect(ok.status).toBe(200);
    expect(ok.json.budgets).toHaveLength(2);
    expect((await a.client.call(budgets.PUT, 'PUT', '/api/budgets', { body: { budgets: [{ categoryId: rent.id, amountMinor: 1 }] } })).status).toBe(400);
    expect((await b.client.call(budgets.PUT, 'PUT', '/api/budgets', { body: { budgets: [{ categoryId: food.id, amountMinor: 1 }] } })).status).toBe(400);
    expect((await b.client.call(budgets.GET, 'GET', '/api/budgets')).json.budgets).toEqual([]);
  });

  it('feeds the dashboard progress, and a zero amount removes a budget', async () => {
    const today = toLocalDate(new Date(), 'Europe/Athens');
    await a.client.call(transactions.POST, 'POST', '/api/transactions', { body: { kind: 'expense', amountMinor: 24000, categoryId: food.id, localDate: today } });
    const dash = await a.client.call(dashboard.GET, 'GET', '/api/dashboard?range=month');
    const foodBudget = dash.json.budgets.find((x: { categoryId: string }) => x.categoryId === food.id);
    expect(foodBudget).toMatchObject({ spentMinor: 24000, budgetMinor: 30000, usedBps: 8000, reached: 80 });
    expect(dash.json.expenseSlices.reduce((s: number, x: { valueMinor: number }) => s + x.valueMinor, 0)).toBe(24000);
    const cleared = await a.client.call(budgets.PUT, 'PUT', '/api/budgets', { body: { budgets: [{ categoryId: null, amountMinor: 100000 }, { categoryId: food.id, amountMinor: 0 }] } });
    expect(cleared.json.budgets).toEqual([{ categoryId: null, amountMinor: 100000 }]);
    const other = await b.client.call(dashboard.GET, 'GET', '/api/dashboard?range=month');
    expect(other.json.expenseSlices).toEqual([]);
  });
});
