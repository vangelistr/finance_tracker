import { ObjectId } from 'mongodb';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMember } from '@/server/auth/users';
import { getDb } from '@/server/db/client';
import { collectionsOf } from '@/server/db/collections';
import { runMigrations } from '@/server/db/migrations';
import type { UserDoc } from '@/server/db/types';
import type { PushPayload, PushSender } from '@/server/push/send';
import { FakeClock } from '@/worker/clock';
import { dailyReminderJob, monthlyFlowJob, overspendAlertsJob, renewalAlertsJob } from '@/worker/jobs/notifications';
import { tick, type Job } from '@/worker/scheduler';

class RecordingSender implements PushSender {
  sent: Array<{ userId: string; payload: PushPayload }> = [];
  async sendToUser(userId: ObjectId, payload: PushPayload) {
    this.sent.push({ userId: userId.toHexString(), payload });
    return { sent: 1, failed: 0, subscriptions: 1 };
  }
  titles() {
    return this.sent.map((s) => s.payload.title);
  }
}

let n = 0;
async function newUser(): Promise<UserDoc> {
  n++;
  return createMember({
    email: `notify${n}@example.com`,
    name: `N${n}`,
    password: 'integration-pass-1', // gitleaks:allow (test-only password)
    locale: 'el',
    currency: 'EUR',
    timezone: 'Europe/Athens',
    investingEnabled: false,
  });
}

/** Runs the jobs at each instant, like the worker loop does every 30 seconds. */
async function runAt(jobs: Job[], instants: string[]) {
  const db = await getDb();
  const clock = new FakeClock(new Date(instants[0]!));
  for (const at of instants) {
    clock.set(at);
    await tick(db, clock.now(), jobs);
  }
}

beforeAll(async () => {
  await runMigrations(await getDb());
});

let sender: RecordingSender;
beforeEach(() => {
  sender = new RecordingSender();
});

describe('daily reminder (fake clock, Europe/Athens)', () => {
  it('fires at 21:00 local once per day, also on the autumn DST day', async () => {
    const user = await newUser();
    const job = dailyReminderJob(sender);
    // 2026-10-24 is EEST (UTC+3): 21:00 local = 18:00Z. 2026-10-25 is EET (UTC+2): 21:00 local = 19:00Z.
    await runAt([job], ['2026-10-24T17:59:30Z', '2026-10-24T18:00:00Z', '2026-10-24T18:00:30Z', '2026-10-24T19:30:00Z', '2026-10-24T22:00:00Z']);
    const mine = () => sender.sent.filter((s) => s.userId === user._id.toHexString());
    expect(mine()).toHaveLength(1);
    expect(mine()[0]!.payload.title).toBe('Τα σημερινά έξοδα');
    await runAt([job], ['2026-10-25T18:59:30Z', '2026-10-25T19:00:00Z', '2026-10-25T19:00:30Z']);
    expect(mine()).toHaveLength(2);
    const c = collectionsOf(await getDb());
    expect(await c.notificationLog.countDocuments({ userId: user._id, type: 'daily' })).toBe(2);
    expect(await c.notifications.countDocuments({ userId: user._id, type: 'daily' })).toBe(2);
  });

  it('honours a custom time and the off switch', async () => {
    const custom = await newUser();
    const off = await newUser();
    const c = collectionsOf(await getDb());
    await c.users.updateOne({ _id: custom._id }, { $set: { 'settings.notifications.daily.time': '22:30' } });
    await c.users.updateOne({ _id: off._id }, { $set: { 'settings.notifications.daily.enabled': false } });
    await runAt([dailyReminderJob(sender)], ['2026-11-02T20:00:00Z', '2026-11-02T20:29:59Z', '2026-11-02T20:30:00Z']);
    expect(sender.sent.filter((s) => s.userId === custom._id.toHexString())).toHaveLength(1);
    expect(sender.sent.filter((s) => s.userId === off._id.toHexString())).toHaveLength(0);
  });
});

describe('monthly flow on the 1st', () => {
  it('fires once at 09:00 local on the 1st and links to the month flow', async () => {
    const user = await newUser();
    // 2026-11-01 is EET: 09:00 local = 07:00Z.
    await runAt([monthlyFlowJob(sender)], ['2026-10-31T07:00:00Z', '2026-11-01T06:59:59Z', '2026-11-01T07:00:00Z', '2026-11-01T07:00:30Z', '2026-11-01T15:00:00Z']);
    const mine = sender.sent.filter((s) => s.userId === user._id.toHexString());
    expect(mine).toHaveLength(1);
    expect(mine[0]!.payload).toMatchObject({ title: 'Καλό μήνα', url: '/monthly' });
  });
});

describe('subscription renewal alerts', () => {
  it('fire N days before each renewal, exactly once per renewal', async () => {
    const user = await newUser();
    const c = collectionsOf(await getDb());
    const now = new Date('2026-10-01T00:00:00Z');
    await c.recurringExpenses.insertOne({
      _id: new ObjectId(),
      userId: user._id,
      name: 'Spotify',
      amountMinor: 1099,
      categoryId: null,
      accountId: null,
      schedule: { frequency: 'monthly', startDate: '2026-01-15' },
      subscription: { status: 'active', reminderDaysBefore: 3 },
      note: '',
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const job = renewalAlertsJob(sender);
    // 3 days before 15 Nov = 12 Nov, at 09:00 local (07:00Z in EET).
    await runAt([job], ['2026-11-11T07:00:00Z', '2026-11-12T06:59:00Z', '2026-11-12T07:00:00Z', '2026-11-12T07:00:30Z', '2026-11-13T07:00:00Z', '2026-11-15T07:00:00Z']);
    const mine = () => sender.sent.filter((s) => s.userId === user._id.toHexString());
    expect(mine()).toHaveLength(1);
    expect(mine()[0]!.payload.title).toBe('Ανανέωση: Spotify');
    expect(mine()[0]!.payload.body).toContain('15 Νοεμβρίου');
    // Next month's renewal gets its own alert.
    await runAt([job], ['2026-12-12T07:00:00Z', '2026-12-12T08:00:00Z']);
    expect(mine()).toHaveLength(2);
    // A paused subscription stays quiet.
    await c.recurringExpenses.updateOne({ userId: user._id }, { $set: { 'subscription.status': 'paused' } });
    await runAt([job], ['2027-01-12T07:00:00Z']);
    expect(mine()).toHaveLength(2);
  });
});

describe('overspend alerts', () => {
  it('fire once per threshold per budget per month', async () => {
    const user = await newUser();
    const c = collectionsOf(await getDb());
    const food = (await c.categories.findOne({ userId: user._id, seedKey: 'expense:groceries' }))!;
    await c.budgets.insertMany([
      { _id: new ObjectId(), userId: user._id, categoryId: food._id, amountMinor: 10000, updatedAt: new Date() },
      { _id: new ObjectId(), userId: user._id, categoryId: null, amountMinor: 50000, updatedAt: new Date() },
    ]);
    const add = async (amountMinor: number, localDate: string) =>
      c.transactions.insertOne({
        _id: new ObjectId(),
        userId: user._id,
        kind: 'expense',
        status: 'done',
        amountMinor,
        grossMinor: null,
        accountId: null,
        toAccountId: null,
        categoryId: food._id,
        incomeSourceId: null,
        recurringExpenseId: null,
        localDate,
        month: localDate.slice(0, 7),
        note: '',
        origin: 'manual',
        occurrenceKey: null,
        clientId: null,
        doneAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    const job = overspendAlertsJob(sender);
    const mine = () => sender.sent.filter((s) => s.userId === user._id.toHexString()).map((s) => s.payload.title);

    await add(7000, '2026-11-03');
    await runAt([job], ['2026-11-03T10:00:00Z']);
    expect(mine()).toEqual([]);

    await add(1500, '2026-11-04'); // 85 % of the food budget
    await runAt([job], ['2026-11-04T10:00:00Z', '2026-11-04T10:00:30Z', '2026-11-04T12:00:00Z']);
    expect(mine()).toEqual(['Προϋπολογισμός: Σούπερ μάρκετ']);

    await add(2000, '2026-11-05'); // 105 %
    await runAt([job], ['2026-11-05T10:00:00Z', '2026-11-05T10:00:30Z']);
    expect(mine()).toEqual(['Προϋπολογισμός: Σούπερ μάρκετ', 'Υπέρβαση: Σούπερ μάρκετ']);

    // A new month starts clean; a jump straight past 100 % sends only the 100 % alert, never a late 80 % one.
    await add(12000, '2026-12-02');
    await runAt([job], ['2026-12-02T10:00:00Z', '2026-12-02T10:00:30Z']);
    expect(mine().slice(2)).toEqual(['Υπέρβαση: Σούπερ μάρκετ']);
    expect(await c.notificationLog.countDocuments({ userId: user._id, key: { $regex: '^overspend:.*:2026-12:80$' }, status: 'superseded' })).toBe(1);

    // The overall budget (500 €) crosses 80 % only when total spending reaches 400 €.
    await add(30000, '2026-12-03');
    await runAt([job], ['2026-12-03T10:00:00Z']);
    expect(mine().at(-1)).toBe('Προϋπολογισμός: Συνολικά');
  });
});

describe('in-app notifications API', () => {
  it('lists only the caller’s notifications and marks them read', async () => {
    const { signedInUser } = await import('./users');
    const notificationsRoute = await import('@/app/api/notifications/route');
    const readRoute = await import('@/app/api/notifications/[id]/read/route');
    const a = await signedInUser('el');
    const b = await signedInUser('el');
    const c = collectionsOf(await getDb());
    const id = new ObjectId();
    await c.notifications.insertOne({ _id: id, userId: a.user._id, type: 'daily', titleKey: 'dailyTitle', bodyKey: 'dailyBody', params: {}, url: '/transactions', createdAt: new Date(), readAt: null });
    expect((await a.client.call(notificationsRoute.GET, 'GET', '/api/notifications')).json.notifications).toHaveLength(1);
    expect((await b.client.call(notificationsRoute.GET, 'GET', '/api/notifications')).json.notifications).toHaveLength(0);
    expect((await b.client.call(readRoute.POST, 'POST', `/api/notifications/${id}/read`, { params: { id: id.toHexString() } })).status).toBe(404);
    expect((await a.client.call(readRoute.POST, 'POST', `/api/notifications/${id}/read`, { params: { id: id.toHexString() } })).status).toBe(200);
    expect((await c.notifications.findOne({ _id: id }))!.readAt).not.toBeNull();
  });
});
