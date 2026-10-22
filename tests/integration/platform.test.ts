import { describe, expect, it } from 'vitest';
import { getDb } from '@/server/db/client';
import { collectionsOf, INDEXES } from '@/server/db/collections';
import { runMigrations } from '@/server/db/migrations';
import { hitRateLimit } from '@/server/auth/rate-limit';
import { readiness } from '@/server/health';
import { writeHeartbeat } from '@/worker/heartbeat';

describe('migrations', () => {
  it('are idempotent and create every declared index', async () => {
    const db = await getDb();
    expect(await runMigrations(db)).toEqual(['0001-baseline', '0002-finance-core', '0003-budgets', '0004-goals']);
    expect(await runMigrations(db)).toEqual([]);
    for (const [name, specs] of Object.entries(INDEXES)) {
      const existing = (await db.collection(name).indexes()).map((i) => i.name);
      for (const spec of specs) expect(existing).toContain(spec.name);
    }
  });
});

describe('rate limit window', () => {
  it('counts within the window and resets after it', async () => {
    const { rateLimits } = collectionsOf(await getDb());
    const t0 = new Date('2026-10-22T10:00:00Z');
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hitRateLimit(rateLimits, 'test:key', 3, 60_000, t0));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    const later = await hitRateLimit(rateLimits, 'test:key', 3, 60_000, new Date(t0.getTime() + 61_000));
    expect(later).toMatchObject({ allowed: true, remaining: 2 });
  });
});

describe('readiness', () => {
  it('needs a fresh worker heartbeat', async () => {
    const db = await getDb();
    const now = new Date();
    expect(await readiness(now)).toEqual({ ready: false, db: true, worker: false });
    await writeHeartbeat(db, now, now, process.env.WORKER_HEARTBEAT_FILE!);
    expect(await readiness(now)).toEqual({ ready: true, db: true, worker: true });
    expect((await readiness(new Date(now.getTime() + 4 * 60_000))).ready).toBe(false);
  });
});
