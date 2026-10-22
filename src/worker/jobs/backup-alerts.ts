import type { Db } from 'mongodb';
import { toLocalDate } from '@/lib/dates';
import { collectionsOf } from '@/server/db/collections';
import type { BackupRunDoc } from '@/server/db/types';
import { log } from '@/server/log';
import { notify } from '@/server/notify';
import type { PushSender } from '@/server/push/send';
import type { Job } from '../scheduler';

type BackupStatus = BackupRunDoc['status'];
const OK_STATUSES: BackupStatus[] = ['success', 'success_with_warning'];

/**
 * Alerts owners (push + in-app) about failed backup jobs once per run, and once per day when no backup has
 * succeeded for `staleHours`. The backup container writes `backup_runs`; this job only reads and marks them.
 */
export function backupAlertsJob(sender: PushSender, staleHours: number): Job {
  return {
    name: 'backup-alerts',
    async run({ db, now }: { db: Db; now: Date }) {
      const c = collectionsOf(db);
      const owners = await c.users.find({ role: 'owner', 'settings.notifications.backup.enabled': true }).toArray();

      const failed = await c.backupRuns.find({ status: 'failed', notifiedAt: null }).sort({ startedAt: 1 }).limit(20).toArray();
      for (const run of failed) {
        log.warn('backup job failed', { kind: run.kind ?? 'backup', runId: run._id.toHexString() });
        for (const owner of owners) {
          await notify(c, sender, {
            user: owner,
            key: `backup:${run._id.toHexString()}`,
            type: 'backup_failed',
            titleKey: 'backupFailedTitle',
            bodyKey: 'backupFailedBody',
            params: { kind: run.kind ?? 'backup' },
            url: '/settings',
          }, now);
        }
        await c.backupRuns.updateOne({ _id: run._id }, { $set: { notifiedAt: now } });
      }

      // Staleness counts from the last success, or from setup when no backup has succeeded yet.
      const lastOk = await c.backupRuns.findOne(
        { kind: 'backup', status: { $in: OK_STATUSES as BackupStatus[] } },
        { sort: { startedAt: -1 } },
      );
      const setup = await c.appMeta.findOne({ _id: 'setup' });
      const since = lastOk?.finishedAt ?? lastOk?.startedAt ?? (setup && 'completedAt' in setup ? setup.completedAt : null);
      if (!since || now.getTime() - since.getTime() < staleHours * 3_600_000) return;
      for (const owner of owners) {
        await notify(c, sender, {
          user: owner,
          key: `backup-stale:${toLocalDate(now, owner.timezone)}`,
          type: 'backup_stale',
          titleKey: 'backupStaleTitle',
          bodyKey: 'backupStaleBody',
          params: { hours: staleHours },
          url: '/settings',
        }, now);
      }
    },
  };
}
