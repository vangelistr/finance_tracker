import { env } from '@/server/env';
import { webPushSender } from '@/server/push/send';
import { backupAlertsJob } from './jobs/backup-alerts';
import { marketDigestJob, marketRefreshJob } from './jobs/market';
import { dailyReminderJob, monthlyFlowJob, overspendAlertsJob, renewalAlertsJob } from './jobs/notifications';
import { recurringGenerationJob } from './jobs/recurring';
import { monthEndReportsJob } from './jobs/reports';
import type { Job } from './scheduler';

// The report job runs before the monthly flow so the 1st-of-month push links to a ready report. The market jobs do
// nothing while no user has the module on.
export function buildJobs(): Job[] {
  return [
    recurringGenerationJob(),
    monthEndReportsJob(),
    dailyReminderJob(webPushSender),
    monthlyFlowJob(webPushSender),
    renewalAlertsJob(webPushSender),
    overspendAlertsJob(webPushSender),
    backupAlertsJob(webPushSender, env().BACKUP_STALE_HOURS),
    marketRefreshJob(),
    marketDigestJob(webPushSender),
  ];
}
