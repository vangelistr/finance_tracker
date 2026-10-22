import { randomBytes } from 'node:crypto';
import { afterAll } from 'vitest';

// Each test file gets its own throwaway database on a local or CI Mongo (no auth), and fixed test secrets.
const base = process.env.TEST_MONGO_URL ?? 'mongodb://127.0.0.1:27018';
const db = `finance_test_${process.pid}_${randomBytes(4).toString('hex')}`;
Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_URL: 'http://localhost:3000',
  SESSION_SECRET: 'a'.repeat(64),
  DATA_ENCRYPTION_KEY: 'b'.repeat(64),
  MONGO_URL: `${base}/${db}`,
  MONGO_DB: db,
  VAPID_PUBLIC_KEY: '',
  VAPID_PRIVATE_KEY: '',
  VAPID_SUBJECT: '',
  WORKER_HEARTBEAT_FILE: `${process.env.TMPDIR ?? '/tmp'}/ft-test-heartbeat-${db}`,
});

afterAll(async () => {
  const { getDb, closeDb } = await import('@/server/db/client');
  await (await getDb()).dropDatabase();
  await closeDb();
});
