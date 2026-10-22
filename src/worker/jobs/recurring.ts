import type { Db } from 'mongodb';
import { collectionsOf } from '@/server/db/collections';
import { generateForUser } from '@/server/services/generation';
import type { Job } from '../scheduler';

const EVERY_MS = 60 * 60 * 1000;

/** Hourly: create the expected occurrences of fixed income and fixed expenses (idempotent per occurrence). */
export function recurringGenerationJob(): Job {
  let lastRun = 0;
  return {
    name: 'recurring-generation',
    async run({ db, now }: { db: Db; now: Date }) {
      if (now.getTime() - lastRun < EVERY_MS) return;
      lastRun = now.getTime();
      const { users } = collectionsOf(db);
      for (const user of await users.find({}, { projection: { _id: 1, timezone: 1 } }).toArray()) {
        await generateForUser(user._id, user.timezone, now);
      }
    },
  };
}
