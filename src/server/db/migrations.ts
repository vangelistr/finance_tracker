import 'server-only';
import type { Db } from 'mongodb';
import { collectionsOf, ensureIndexes } from './collections';
import { log } from '@/server/log';

// Data migrations run once each, in order, after the indexes are ensured. Each `up` must be safe to re-run
// if the process dies before its marker is written.

export interface Migration {
  id: string;
  up: (db: Db) => Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '0001-baseline',
    up: async () => {
      // Indexes only (created by ensureIndexes). Kept as a marker for the first schema version.
    },
  },
  {
    id: '0002-finance-core',
    up: async () => {
      // Phase 2 collections; their indexes come from ensureIndexes. Users created before this migration get their
      // default categories when they open onboarding or the categories page (seedCategories is idempotent).
    },
  },
  {
    id: '0003-budgets',
    up: async () => {
      // Budgets collection (index from ensureIndexes).
    },
  },
  {
    id: '0004-goals',
    up: async () => {
      // Goals and contributions (indexes from ensureIndexes).
    },
  },
];

export async function runMigrations(db: Db, migrations: Migration[] = MIGRATIONS): Promise<string[]> {
  await ensureIndexes(db);
  const { migrations: applied } = collectionsOf(db);
  const done = new Set((await applied.find({}, { projection: { _id: 1 } }).toArray()).map((m) => m._id));
  const ran: string[] = [];
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    await m.up(db);
    await applied.updateOne({ _id: m.id }, { $setOnInsert: { appliedAt: new Date() } }, { upsert: true });
    ran.push(m.id);
    log.info('migration applied', { id: m.id });
  }
  return ran;
}
