import { beforeAll, describe, expect, it } from 'vitest';
import * as goals from '@/app/api/goals/route';
import * as goalById from '@/app/api/goals/[id]/route';
import * as contributions from '@/app/api/goals/[id]/contributions/route';
import * as incomeSources from '@/app/api/income-sources/route';
import * as planRoute from '@/app/api/plan/route';
import * as planApply from '@/app/api/plan/apply/route';
import * as planSettings from '@/app/api/plan/settings/route';
import { getDb } from '@/server/db/client';
import { collectionsOf } from '@/server/db/collections';
import { runMigrations } from '@/server/db/migrations';
import { getCalendar } from '@/server/services/calendar';
import { signedInUser } from './users';

type Session = Awaited<ReturnType<typeof signedInUser>>;
let a: Session;
let b: Session;

beforeAll(async () => {
  await runMigrations(await getDb());
  a = await signedInUser('el');
  b = await signedInUser('el');
  await a.client.call(incomeSources.POST, 'POST', '/api/income-sources', {
    body: { name: 'Μισθός', type: 'recurring_fixed', expectedNetMinor: 180000, schedule: { frequency: 'monthly', startDate: '2026-01-25' } },
  });
});

describe('goals', () => {
  let holiday: { id: string };

  it('creates goals, allows one emergency fund, and keeps them private', async () => {
    const ef = await a.client.call(goals.POST, 'POST', '/api/goals', { body: { name: 'Αποθεματικό έκτακτης ανάγκης', targetMinor: 300000, isEmergencyFund: true, priority: 1 } });
    expect(ef.status).toBe(200);
    expect((await a.client.call(goals.POST, 'POST', '/api/goals', { body: { name: 'Δεύτερο', targetMinor: 1000, isEmergencyFund: true } })).status).toBe(409);
    holiday = (await a.client.call(goals.POST, 'POST', '/api/goals', { body: { name: 'Διακοπές', targetMinor: 90000, deadline: '2027-06-30', priority: 1 } })).json.goal;
    expect((await b.client.call(goals.GET, 'GET', '/api/goals')).json.goals).toEqual([]);
    expect((await b.client.call(goalById.PATCH, 'PATCH', `/api/goals/${holiday.id}`, { params: { id: holiday.id }, body: { name: 'x' } })).status).toBe(404);
    expect((await b.client.call(contributions.POST, 'POST', `/api/goals/${holiday.id}/contributions`, { params: { id: holiday.id }, body: { amountMinor: 100, localDate: '2026-10-01' } })).status).toBe(404);
  });

  it('records contributions and reports progress and required monthly amount', async () => {
    await a.client.call(contributions.POST, 'POST', `/api/goals/${holiday.id}/contributions`, { params: { id: holiday.id }, body: { amountMinor: 18000, localDate: '2026-10-05' } });
    const list = (await a.client.call(goals.GET, 'GET', '/api/goals')).json.goals;
    const h = list.find((g: { id: string }) => g.id === holiday.id);
    expect(h.savedMinor).toBe(18000);
    expect(h.status.progressBps).toBe(2000);
    expect(h.status.requiredMonthlyMinor).toBeGreaterThan(0);
  });

  it('shows contributions and the monthly amount due on the calendar', async () => {
    const now = new Date('2026-10-22T10:00:00Z');
    const items = async (month: string) => (await getCalendar(a.user._id, month, 'Europe/Athens', now)).days.flatMap((d) => d.items.filter((i) => i.kind === 'goal').map((i) => ({ ...i, date: d.date, inMonth: d.inMonth }))).filter((i) => i.inMonth);
    const october = await items('2026-10');
    expect(october).toContainEqual(expect.objectContaining({ label: 'Διακοπές', state: 'done', localDate: '2026-10-05', amountMinor: 18000 }));
    // 720 € left over the 8 months after October (Nov to Jun) = 90 € due at the end of each of them.
    expect(october.filter((i) => i.state !== 'done')).toEqual([]);
    expect(await items('2026-11')).toEqual([expect.objectContaining({ label: 'Διακοπές', state: 'projected', localDate: '2026-11-30', amountMinor: 9000 })]);
    expect(await items('2027-06')).toEqual([expect.objectContaining({ localDate: '2027-06-30', amountMinor: 9000 })]);
    expect(await items('2027-07')).toEqual([]);
  });
});

describe('smart plan', () => {
  it('splits the baseline exactly and always carries the disclaimer', async () => {
    const res = await a.client.call(planRoute.GET, 'GET', '/api/plan');
    const { plan } = res.json;
    expect(res.json.disclaimer).toBe('educational, not financial advice');
    expect(plan.baseline.baselineMinor).toBe(180000);
    const s = plan.split;
    expect(s.essentialsMinor + s.discretionaryMinor + s.savingsMinor + s.investingMinor).toBe(180000);
    const shares = Object.values(plan.shares).map(Number);
    expect(shares.reduce((x: number, y: number) => x + y, 0)).toBeCloseTo(100, 5);
  });

  it('applies plan contributions idempotently', async () => {
    const c = collectionsOf(await getDb());
    await a.client.call(planApply.POST, 'POST', '/api/plan/apply');
    const first = await c.goalContributions.find({ userId: a.user._id, source: 'plan' }).toArray();
    await a.client.call(planApply.POST, 'POST', '/api/plan/apply');
    const second = await c.goalContributions.find({ userId: a.user._id, source: 'plan' }).toArray();
    expect(first.length).toBeGreaterThan(0);
    expect(second.map((x) => [x.goalId.toHexString(), x.amountMinor])).toEqual(first.map((x) => [x.goalId.toHexString(), x.amountMinor]));
    expect(await c.goalContributions.countDocuments({ userId: b.user._id })).toBe(0);
  });

  it('honours overrides and resets them', async () => {
    await a.client.call(planSettings.PUT, 'PUT', '/api/plan/settings', { body: { discretionaryBp: 2000, investingBp: 0 } });
    let plan = (await a.client.call(planRoute.GET, 'GET', '/api/plan')).json.plan;
    expect(plan.split.discretionaryMinor).toBe(36000);
    expect(plan.split.investingMinor).toBe(0);
    await a.client.call(planSettings.PUT, 'PUT', '/api/plan/settings', { body: { reset: true } });
    plan = (await a.client.call(planRoute.GET, 'GET', '/api/plan')).json.plan;
    expect(plan.split.wanted.discretionaryMinor).toBe(54000);
    expect((await b.client.call(planRoute.GET, 'GET', '/api/plan')).json.plan.baseline.baselineMinor).toBe(0);
  });
});
