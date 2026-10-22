import { env } from '@/server/env';
import { webPushSender } from '@/server/push/send';
import { backupAlertsJob } from './jobs/backup-alerts';
import type { Job } from './scheduler';

// The job list grows phase by phase: reminders, monthly flow, renewals and overspend (Phase 4),
// recurring generation (Phase 2), reports (Phase 7), market refresh and digest (Phase 6).
export function buildJobs(): Job[] {
  return [backupAlertsJob(webPushSender, env().BACKUP_STALE_HOURS)];
}
