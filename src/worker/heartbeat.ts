import { writeFile } from 'node:fs/promises';
import type { Db } from 'mongodb';
import { collectionsOf } from '@/server/db/collections';

export const WORKER_VERSION = process.env.APP_VERSION ?? 'dev';

/** Records liveness in Mongo (read by /api/ready) and in a file (read by the container healthcheck). */
export async function writeHeartbeat(db: Db, now: Date, startedAt: Date, file: string): Promise<void> {
  const { appMeta } = collectionsOf(db);
  await appMeta.updateOne(
    { _id: 'worker' },
    { $set: { heartbeatAt: now, startedAt, version: WORKER_VERSION } },
    { upsert: true },
  );
  await writeFile(file, String(now.getTime()));
}
