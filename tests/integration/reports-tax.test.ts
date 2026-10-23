import { ObjectId } from 'mongodb';
import { beforeAll, describe, expect, it } from 'vitest';
import * as reportByMonth from '@/app/api/reports/[month]/route';
import * as reportsRoute from '@/app/api/reports/route';
import * as taxConfig from '@/app/api/tax/config/[year]/route';
import * as taxEstimate from '@/app/api/tax/estimate/route';
import * as taxProfileRoute from '@/app/api/tax/profile/route';
import * as setAside from '@/app/api/tax/set-aside/[transactionId]/route';
import * as setAsideEfka from '@/app/api/tax/set-aside-efka/[month]/route';
import { monthOf, toLocalDate } from '@/lib/dates';
import { getDb } from '@/server/db/client';
import { collectionsOf, type Collections } from '@/server/db/collections';
import { runMigrations } from '@/server/db/migrations';
import type { UserDoc } from '@/server/db/types';
import { loadPlan } from '@/server/services/plan';
import { ensureReport } from '@/server/services/reports';
import { loadTax, setAsideEfka as setAsideEfkaService, setAsideInvoice } from '@/server/services/tax';
import { monthEndReportsJob } from '@/worker/jobs/reports';
import { tick } from '@/worker/scheduler';
import { signedInUser } from './users';

type Session = Awaited<ReturnType<typeof signedInUser>>;
let c: Collections;

beforeAll(async () => {
  const db = await getDb();
  await runMigrations(db);
  c = collectionsOf(db);
});

const userDoc = async (s: Session) => (await c.users.findOne({ _id: s.user._id }))! as UserDoc;

async function tx(userId: ObjectId, t: { kind: 'income' | 'expense'; amountMinor: number; localDate: string; categoryId?: ObjectId | null; incomeSourceId?: ObjectId | null; accountId?: ObjectId | null }) {
  const now = new Date('2026-09-01T10:00:00Z');
  const doc = {
    _id: new ObjectId(),
    userId,
    kind: t.kind,
    status: 'done' as const,
    amountMinor: t.amountMinor,
    grossMinor: null,
    accountId: t.accountId ?? null,
    toAccountId: null,
    categoryId: t.categoryId ?? null,
    incomeSourceId: t.incomeSourceId ?? null,
    recurringExpenseId: null,
    localDate: t.localDate,
    month: monthOf(t.localDate),
    note: '',
    origin: 'manual' as const,
    occurrenceKey: null,
    clientId: null,
    doneAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await c.transactions.insertOne(doc);
  return doc;
}

describe('month-end report', () => {
  let a: Session;
  let food: ObjectId;
  let rent: ObjectId;

  beforeAll(async () => {
    a = await signedInUser('en');
    await c.users.updateOne({ _id: a.user._id }, { $set: { createdAt: new Date('2026-08-01T00:00:00Z') } });
    food = new ObjectId();
    rent = new ObjectId();
    const now = new Date();
    for (const [id, name, color] of [[food, 'Food', 2], [rent, 'Rent', 1]] as const) {
      await c.categories.insertOne({ _id: id, userId: a.user._id, kind: 'expense', name, parentId: null, color, icon: 'x', essential: true, archived: false, sort: 0, seedKey: null, createdAt: now, updatedAt: now });
    }
    await c.budgets.insertOne({ _id: new ObjectId(), userId: a.user._id, categoryId: food, amountMinor: 30000, updatedAt: now });
    await tx(a.user._id, { kind: 'income', amountMinor: 180000, localDate: '2026-08-25' });
    await tx(a.user._id, { kind: 'expense', amountMinor: 60000, localDate: '2026-08-02', categoryId: rent });
    await tx(a.user._id, { kind: 'income', amountMinor: 200000, localDate: '2026-09-25' });
    await tx(a.user._id, { kind: 'expense', amountMinor: 60000, localDate: '2026-09-02', categoryId: rent });
    await tx(a.user._id, { kind: 'expense', amountMinor: 33000, localDate: '2026-09-12', categoryId: food });
    const goal = new ObjectId();
    await c.goals.insertOne({ _id: goal, userId: a.user._id, name: 'Holiday', targetMinor: 90000, deadline: null, accountId: null, priority: 1, isEmergencyFund: false, archived: false, seq: 0, createdAt: new Date('2026-08-10T00:00:00Z'), updatedAt: now });
    await c.goalContributions.insertOne({ _id: new ObjectId(), userId: a.user._id, goalId: goal, amountMinor: 18000, localDate: '2026-09-05', month: '2026-09', source: 'manual', planMonth: null, note: '', createdAt: now });
    await c.recurringExpenses.insertOne({ _id: new ObjectId(), userId: a.user._id, name: 'Netflix', amountMinor: 1399, categoryId: null, accountId: null, schedule: { frequency: 'monthly', startDate: '2026-01-25' }, subscription: { status: 'active', reminderDaysBefore: null }, note: '', active: true, createdAt: now, updatedAt: now });
  });

  it('builds the snapshot with every section', async () => {
    const r = (await ensureReport(await userDoc(a), '2026-09', new Date('2026-10-01T07:00:00Z')))!;
    expect(r.data.totals).toEqual({ incomeMinor: 200000, expenseMinor: 93000, netMinor: 107000 });
    expect(r.data.savingsRateBps).toBe(5350);
    expect(r.data.previous).toEqual({ month: '2026-08', incomeMinor: 180000, expenseMinor: 60000, netMinor: 120000 });
    expect(r.data.change).toEqual({ incomeBps: 1111, expenseBps: 5500, netMinor: -13000 });
    expect(r.data.topCategories.map((x) => [x.label, x.amountMinor, x.shareBps])).toEqual([
      ['Rent', 60000, 6452],
      ['Food', 33000, 3548],
    ]);
    expect(r.data.budgets).toEqual([{ label: 'Food', color: 2, budgetMinor: 30000, spentMinor: 33000, usedBps: 11000, over: true }]);
    expect(r.data.goals).toEqual([{ name: 'Holiday', targetMinor: 90000, savedMinor: 18000, contributedMinor: 18000, progressBps: 2000, isEmergencyFund: false, deadline: null }]);
    expect(r.data.renewals).toEqual([{ name: 'Netflix', date: '2026-10-25', amountMinor: 1399, subscription: true }]);
    expect(r.data.tax).toBeNull();
  });

  it('is generated exactly once and never changes afterwards', async () => {
    const user = await userDoc(a);
    const db = await getDb();
    const jobs = [monthEndReportsJob()];
    await Promise.all([tick(db, new Date('2026-10-01T06:00:00Z'), jobs), tick(db, new Date('2026-10-01T06:00:30Z'), jobs), ensureReport(user, '2026-09', new Date('2026-10-02T06:00:00Z'))]);
    expect(await c.reports.countDocuments({ userId: a.user._id, month: '2026-09' })).toBe(1);
    const before = await c.reports.findOne({ userId: a.user._id, month: '2026-09' });
    await tx(a.user._id, { kind: 'expense', amountMinor: 99999, localDate: '2026-09-20', categoryId: food });
    await ensureReport(user, '2026-09', new Date('2026-10-05T06:00:00Z'));
    expect(await c.reports.findOne({ userId: a.user._id, month: '2026-09' })).toEqual(before);
    // An open month has no report.
    expect(await ensureReport(user, '2026-10', new Date('2026-10-05T06:00:00Z'))).toBeNull();
  });

  it('serves history and snapshots through the API, per user', async () => {
    const list = await a.client.call(reportsRoute.GET, 'GET', '/api/reports');
    const months = list.json.reports.map((r: { month: string }) => r.month);
    expect(months).toContain('2026-09');
    expect(months).toContain('2026-08');
    expect(months[0] > months.at(-1)).toBe(true);
    const sep = await a.client.call(reportByMonth.GET, 'GET', '/api/reports/2026-09', { params: { month: '2026-09' } });
    expect(sep.json.data.totals.incomeMinor).toBe(200000);
    const open = monthOf(toLocalDate(new Date(), 'Europe/Athens'));
    expect((await a.client.call(reportByMonth.GET, 'GET', `/api/reports/${open}`, { params: { month: open } })).status).toBe(404);
    expect((await a.client.call(reportByMonth.GET, 'GET', '/api/reports/bad', { params: { month: 'bad' } })).status).toBe(404);
    const b = await signedInUser('el');
    const theirs = await b.client.call(reportByMonth.GET, 'GET', '/api/reports/2026-09', { params: { month: '2026-09' } });
    expect(theirs.json?.data?.totals?.incomeMinor ?? 0).toBe(0);
  });
});

describe('tax/EFKA estimator', () => {
  let s: Session;
  let source: ObjectId;
  let checking: ObjectId;
  const NOW = new Date('2026-10-23T10:00:00Z');

  beforeAll(async () => {
    s = await signedInUser('el');
    source = new ObjectId();
    checking = new ObjectId();
    const now = new Date();
    await c.accounts.insertOne({ _id: checking, userId: s.user._id, name: 'Τρεχούμενος', type: 'checking', currency: 'EUR', openingBalanceMinor: 0, openingDate: '2026-01-01', archived: false, sort: 0, createdAt: now, updatedAt: now });
    await c.incomeSources.insertOne({ _id: source, userId: s.user._id, name: 'Τιμολόγια', type: 'one_time', categoryId: null, currency: 'EUR', accountId: checking, schedule: null, expectedNetMinor: null, expectedGrossMinor: null, freelance: true, active: true, createdAt: now, updatedAt: now });
    for (const m of [3, 4, 5, 6, 7, 8, 9, 10]) await tx(s.user._id, { kind: 'income', amountMinor: 150000, localDate: `2026-${String(m).padStart(2, '0')}-15`, incomeSourceId: source, accountId: checking });
    // A non-freelance income never counts as an invoice.
    await tx(s.user._id, { kind: 'income', amountMinor: 150000, localDate: '2026-05-25' });
    const profile = await s.client.call(taxProfileRoute.PUT, 'PUT', '/api/tax/profile', { body: { employmentIncomeMinor: 1800000, efkaClassId: 'special', insuranceStartYear: 2025 } });
    expect(profile.status).toBe(200);
  });

  it('reproduces the research worked example from stored freelance income', async () => {
    const v = await loadTax(await userDoc(s), 2026, NOW);
    expect(v.full.invoices).toHaveLength(8);
    expect(v.full.totals).toMatchObject({ vatMinor: 288000, efkaMinor: 192552, incomeTaxReserveMinor: 273512, setAsideMinor: 754064, prepaymentNextYearMinor: 90357 });
    // Year to date (October): invoices of Mar–Oct, EFKA due for Jan–Sep.
    expect(v.ytd.months).toHaveLength(10);
    expect(v.efkaDueThrough).toBe(9);
    expect(v.dueNowMinor).toBe(v.ytd.months.reduce((t, m) => t + m.setAsideMinor, 0) - 16046);
  });

  it('moves an invoice and a month of EFKA into the tax reserve once, and the plan sees what is left', async () => {
    const user = await userDoc(s);
    const dueBefore = (await loadTax(user, 2026, NOW)).dueNowMinor;
    // The Smart Plan's surplus reserves the estimator's unmoved set-aside first (capped by this month's surplus).
    const before = await loadPlan(user, NOW);
    expect(before.plan.surplus.taxReserveMinor).toBe(Math.min(dueBefore, before.plan.surplus.surplusMinor));
    expect(before.plan.surplus.taxReserveMinor).toBeGreaterThan(0);
    const first = (await c.transactions.findOne({ userId: s.user._id, incomeSourceId: source, localDate: '2026-03-15' }))!;
    const moved = (await setAsideInvoice(user, first._id.toHexString(), NOW))!;
    expect(moved.created).toBe(true);
    expect(moved.transaction).toMatchObject({ kind: 'transfer', origin: 'tax_set_aside', amountMinor: 36000 + 27621, accountId: checking });
    const reserve = (await c.accounts.findOne({ userId: s.user._id, type: 'tax_reserve' }))!;
    expect(moved.transaction.toAccountId!.equals(reserve._id)).toBe(true);
    expect((await setAsideInvoice(user, first._id.toHexString(), NOW))!.created).toBe(false);
    expect((await setAsideEfkaService(user, 2026, 1, NOW)).transaction.amountMinor).toBe(16046);
    await expect(setAsideEfkaService(user, 2026, 10, NOW)).rejects.toThrow(/not complete/);

    const after = await loadTax(user, 2026, NOW);
    expect(after.reserve.balanceMinor).toBe(36000 + 27621 + 16046);
    expect(after.movedThisYearMinor).toBe(36000 + 27621 + 16046);
    expect(after.dueNowMinor).toBe(dueBefore - (36000 + 27621) - 16046);
  });

  it('serves the estimate and set-aside through the API, isolated per user', async () => {
    const est = await s.client.call(taxEstimate.GET, 'GET', `/api/tax/estimate?year=2026`);
    expect(est.status).toBe(200);
    expect(est.json.disclaimer).toBe('estimate, not tax advice; confirm with an accountant');
    expect(est.json.full.totals.setAsideMinor).toBe(754064);
    const other = await signedInUser('el');
    const id = (await c.transactions.findOne({ userId: s.user._id, incomeSourceId: source, localDate: '2026-04-15' }))!._id.toHexString();
    expect((await other.client.call(setAside.POST, 'POST', `/api/tax/set-aside/${id}`, { params: { transactionId: id } })).status).toBe(404);
    expect((await other.client.call(taxEstimate.GET, 'GET', '/api/tax/estimate?year=2026')).json.full.invoices).toEqual([]);
    const ok = await s.client.call(setAside.POST, 'POST', `/api/tax/set-aside/${id}`, { params: { transactionId: id } });
    expect(ok.status).toBe(200);
    expect(ok.json.transaction.amountMinor).toBeGreaterThan(36000);
    expect((await s.client.call(setAsideEfka.POST, 'POST', '/api/tax/set-aside-efka/2026-13', { params: { month: '2026-13' } })).status).toBe(404);
  });

  it('reads rates from the editable config, never from code, and resets to the reviewed file', async () => {
    const cfg = await s.client.call(taxConfig.GET, 'GET', '/api/tax/config/2026', { params: { year: '2026' } });
    expect(cfg.json.config.sources.length).toBeGreaterThan(5);
    expect(cfg.json.config.lastReviewed).toBe('2026-10-22');
    expect(cfg.json.edited).toBe(false);
    const put = await s.client.call(taxConfig.PUT, 'PUT', '/api/tax/config/2026', { params: { year: '2026' }, body: { vatStandardRateBps: 1300, efkaClasses: { special: 20000 } } });
    expect(put.status).toBe(200);
    const edited = await loadTax(await userDoc(s), 2026, NOW);
    expect(edited.configEdited).toBe(true);
    expect(edited.full.totals.vatMinor).toBe(8 * 19500);
    expect(edited.full.efkaMonthlyMinor).toBe(21000);
    const bad = await s.client.call(taxConfig.PUT, 'PUT', '/api/tax/config/2026', { params: { year: '2026' }, body: { bands: [{ upToMinor: 100, rateBps: 900 }, { upToMinor: 50, rateBps: 2000 }] } });
    expect(bad.status).toBe(400);
    expect((await s.client.call(taxConfig.GET, 'GET', '/api/tax/config/1999', { params: { year: '1999' } })).status).toBe(404);
    await s.client.call(taxConfig.PUT, 'PUT', '/api/tax/config/2026', { params: { year: '2026' }, body: { reset: true } });
    expect((await loadTax(await userDoc(s), 2026, NOW)).full.totals.vatMinor).toBe(288000);
  });

  it('adds the tax reserve status to the month report', async () => {
    const r = (await ensureReport(await userDoc(s), '2026-09', NOW))!;
    expect(r.data.tax).not.toBeNull();
    expect(r.data.tax!.estimatedThroughMonthMinor).toBeGreaterThan(0);
    expect(r.data.tax!.reserveBalanceMinor).toBe(0); // the set-asides above were made in October
    expect(r.data.tax!.gapMinor).toBe(r.data.tax!.estimatedThroughMonthMinor);
  });
});
