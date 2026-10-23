import type { Db } from 'mongodb';
import { collectionsOf } from '@/server/db/collections';
import { ensureReport, lastClosedMonth } from '@/server/services/reports';
import type { Job } from '../scheduler';

/**
 * Month-end reports: as soon as a month closes in the user's time zone, its snapshot is generated once (the
 * 1st-of-month flow then links to it). Older missing months are filled in lazily by the history page.
 */
export function monthEndReportsJob(): Job {
  return {
    name: 'month-end-reports',
    async run({ db, now }: { db: Db; now: Date }) {
      const c = collectionsOf(db);
      for (const user of await c.users.find({}).toArray()) {
        const month = lastClosedMonth(user, now);
        if (await c.reports.countDocuments({ userId: user._id, month }, { limit: 1 })) continue;
        // Accounts opened this month have no closed month to report.
        if (user.createdAt.getTime() > now.getTime() - 1) continue;
        await ensureReport(user, month, now);
      }
    },
  };
}
