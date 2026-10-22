import { ObjectId } from 'mongodb';
import { beforeAll, describe, expect, it } from 'vitest';
import { defaultSettings } from '@/server/auth/users';
import { getDb } from '@/server/db/client';
import { collectionsOf } from '@/server/db/collections';
import { runMigrations } from '@/server/db/migrations';
import type { BackupRunDoc } from '@/server/db/types';
import type { PushPayload, PushSender } from '@/server/push/send';
import { FakeClock } from '@/worker/clock';
import { backupAlertsJob } from '@/worker/jobs/backup-alerts';
import { tick } from '@/worker/scheduler';

class RecordingSender implements PushSender {
  sent: PushPayload[] = [];
  async sendToUser(_userId: ObjectId, payload: PushPayload) {
    this.sent.push(payload);
    return { sent: 1, failed: 0, subscriptions: 1 };
  }
}

const ownerId = new ObjectId();

function run(over: Partial<BackupRunDoc>): BackupRunDoc {
  return {
    _id: new ObjectId(),
    kind: 'backup',
    trigger: 'schedule',
    status: 'success',
    startedAt: new Date(),
    finishedAt: new Date(),
    durationMs: 1000,
    snapshotId: null,
    countsBefore: null,
    countsAfter: null,
    offsite: false,
    error: null,
    notifiedAt: null,
    ...over,
  };
}

beforeAll(async () => {
  const db = await getDb();
  await runMigrations(db);
  const c = collectionsOf(db);
  const now = new Date('2026-10-20T08:00:00Z');
  await c.appMeta.insertOne({ _id: 'setup', completedAt: now, ownerId });
  await c.users.insertOne({
    _id: ownerId, email: 'o@example.com', name: 'O', passwordHash: 'x', role: 'owner', locale: 'el', currency: 'EUR',
    timezone: 'Europe/Athens', totp: { enabled: false }, settings: defaultSettings(), onboardingDoneAt: now,
    passwordChangedAt: now, createdAt: now, updatedAt: now,
  });
});

describe('backup failure alerts (fake clock)', () => {
  it('alerts once per failed run, in Greek, and marks the run notified', async () => {
    const db = await getDb();
    const c = collectionsOf(db);
    const clock = new FakeClock(new Date('2026-10-22T01:00:00Z'));
    await c.backupRuns.insertOne(run({ startedAt: new Date('2026-10-22T00:30:00Z'), finishedAt: new Date('2026-10-22T00:31:00Z') }));
    await c.backupRuns.insertOne(run({ status: 'failed', error: 'restic backup exited 1', startedAt: clock.now() }));
    const sender = new RecordingSender();
    const job = backupAlertsJob(sender, 26);

    await tick(db, clock.now(), [job]);
    clock.advance(30_000);
    await tick(db, clock.now(), [job]);

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]!.title).toBe('Το αντίγραφο ασφαλείας απέτυχε');
    expect(await c.notifications.countDocuments({ userId: ownerId, type: 'backup_failed' })).toBe(1);
    expect(await c.backupRuns.countDocuments({ status: 'failed', notifiedAt: null })).toBe(0);
  });

  it('alerts once a day when no backup succeeded for 26 hours', async () => {
    const db = await getDb();
    const sender = new RecordingSender();
    const job = backupAlertsJob(sender, 26);
    // Last success 2026-10-22 00:31Z. 25 hours later: quiet. 27 hours later: one alert, even over several ticks.
    await tick(db, new Date('2026-10-23T01:31:00Z'), [job]);
    expect(sender.sent).toHaveLength(0);
    for (const t of ['2026-10-23T03:31:00Z', '2026-10-23T04:00:00Z', '2026-10-23T20:00:00Z']) await tick(db, new Date(t), [job]);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]!.body).toContain('26');
    // Next local day (Europe/Athens): one more reminder.
    await tick(db, new Date('2026-10-23T22:30:00Z'), [job]);
    expect(sender.sent).toHaveLength(2);
  });

  it('respects the owner’s backup notification toggle', async () => {
    const db = await getDb();
    const c = collectionsOf(db);
    await c.users.updateOne({ _id: ownerId }, { $set: { 'settings.notifications.backup.enabled': false } });
    await c.backupRuns.insertOne(run({ status: 'failed', startedAt: new Date('2026-10-24T00:00:00Z') }));
    const sender = new RecordingSender();
    await tick(db, new Date('2026-10-24T00:10:00Z'), [backupAlertsJob(sender, 26)]);
    expect(sender.sent).toHaveLength(0);
    expect(await c.backupRuns.countDocuments({ status: 'failed', notifiedAt: null })).toBe(0);
  });
});
