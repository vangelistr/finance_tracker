import 'server-only';
import { col } from '@/server/db/collections';
import { pingDb } from '@/server/db/client';

export const WORKER_STALE_MS = 3 * 60 * 1000;

/** Readiness: the database answers and the worker wrote a heartbeat in the last 3 minutes. */
export async function readiness(now = new Date()): Promise<{ ready: boolean; db: boolean; worker: boolean }> {
  const db = await pingDb();
  let worker = false;
  if (db) {
    const { appMeta } = await col();
    const meta = await appMeta.findOne({ _id: 'worker' });
    worker = !!meta && 'heartbeatAt' in meta && now.getTime() - meta.heartbeatAt.getTime() < WORKER_STALE_MS;
  }
  return { ready: db && worker, db, worker };
}
