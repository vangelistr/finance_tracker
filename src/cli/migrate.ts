import { closeDb, getDb } from '@/server/db/client';
import { runMigrations } from '@/server/db/migrations';
import { errorFields, log } from '@/server/log';

// Idempotent: ensures indexes, then applies data migrations that have not run yet.
async function main() {
  const db = await getDb();
  const ran = await runMigrations(db);
  log.info('migrations complete', { applied: ran.length });
  await closeDb();
}

main().catch((err) => {
  log.error('migration failed', errorFields(err));
  process.exit(1);
});
