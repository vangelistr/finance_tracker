import { env } from '@/server/env';
import { webPushSender } from '@/server/push/send';
import { backupAlertsJob } from './jobs/backup-alerts';
import { marketDigestJob, marketRefreshJob } from './jobs/market';
import { dailyReminderJob, monthlyFlowJob, overspendAlertsJob, renewalAlertsJob } from './jobs/notifications';
import { recurringGenerationJob } from './jobs/recurring';
import type { Job } from './scheduler';

// Reports (Phase 7) join this list in their phase. The market jobs do nothing while no user has the module on.
export function buildJobs(): Job[] {
  return [
    recurringGenerationJob(),
    dailyReminderJob(webPushSender),
    monthlyFlowJob(webPushSender),
    renewalAlertsJob(webPushSender),
    overspendAlertsJob(webPushSender),
    backupAlertsJob(webPushSender, env().BACKUP_STALE_HOURS),
    marketRefreshJob(),
    marketDigestJob(webPushSender),
  ];
}
