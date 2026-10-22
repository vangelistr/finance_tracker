import type { Db } from 'mongodb';
import { errorFields, log } from '@/server/log';

/** A job runs on every tick and decides from `now` whether it has work; it must be idempotent. */
export interface Job {
  name: string;
  run(ctx: { db: Db; now: Date }): Promise<void>;
}

/** Runs every job once for this instant. One failing job never stops the others. */
export async function tick(db: Db, now: Date, jobs: Job[]): Promise<{ failed: string[] }> {
  const failed: string[] = [];
  for (const job of jobs) {
    try {
      await job.run({ db, now });
    } catch (err) {
      failed.push(job.name);
      log.error('job failed', { job: job.name, ...errorFields(err) });
    }
  }
  return { failed };
}
