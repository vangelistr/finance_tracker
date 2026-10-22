import { setTimeout as sleep } from 'node:timers/promises';
import { closeDb, getDb } from '@/server/db/client';
import { env } from '@/server/env';
import { errorFields, log } from '@/server/log';
import { systemClock } from './clock';
import { writeHeartbeat } from './heartbeat';
import { buildJobs } from './jobs';
import { tick } from './scheduler';

const TICK_MS = 30_000;

async function main() {
  const e = env();
  const startedAt = systemClock.now();
  const jobs = buildJobs();
  const controller = new AbortController();
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      log.info('worker stopping', { signal });
      controller.abort();
    });
  }
  log.info('worker started', { tickMs: TICK_MS });
  while (!controller.signal.aborted) {
    const now = systemClock.now();
    try {
      const db = await getDb();
      await writeHeartbeat(db, now, startedAt, e.WORKER_HEARTBEAT_FILE);
      await tick(db, now, jobs);
    } catch (err) {
      log.error('worker tick failed', errorFields(err));
    }
    await sleep(TICK_MS, undefined, { signal: controller.signal }).catch(() => undefined);
  }
  await closeDb();
}

main().catch((err) => {
  log.error('worker crashed', errorFields(err));
  process.exit(1);
});
