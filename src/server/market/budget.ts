import 'server-only';
import { MongoServerError } from 'mongodb';
import type { ProviderId } from '@/lib/investing/instruments';
import type { Collections } from '@/server/db/collections';

// Per-provider call budgets (docs/MARKET-DATA.md 7.2). A call is reserved before it is made with a conditional
// upsert, so concurrent workers can never push a counter past its budget. Every free tier resets at midnight UTC
// (Twelve Data, EODHD) or does not say (the others), so provider days are UTC days; a quota answer is the true signal.

type Counted = ProviderId | 'frankfurter';

const DAY_MS = 86_400_000;

export const providerDay = (now: Date) => now.toISOString().slice(0, 10);
const minuteOf = (now: Date) => now.toISOString().slice(0, 16);
const nextUtcMidnight = (now: Date) => new Date(Date.parse(`${providerDay(now)}T00:00:00Z`) + DAY_MS);

async function take(c: Collections, id: string, provider: Counted, limit: number, expiresAt: Date): Promise<boolean> {
  try {
    await c.providerUsage.updateOne(
      { _id: id, calls: { $lt: limit }, blocked: { $ne: true } },
      { $inc: { calls: 1 }, $setOnInsert: { provider, expiresAt } },
      { upsert: true },
    );
    return true;
  } catch (err) {
    // The filter did not match an existing counter, so the upsert collided with it: the budget is spent.
    if (err instanceof MongoServerError && err.code === 11000) return false;
    throw err;
  }
}

export type Reservation = 'ok' | 'minute' | 'day';

/** Reserves one call: the daily budget first, then the per-minute cap (released again if the minute is full). */
export async function reserveCall(c: Collections, provider: Counted, budget: { dailyBudget: number; perMinute: number }, now: Date): Promise<Reservation> {
  const dayId = `${provider}:${providerDay(now)}`;
  if (!(await take(c, dayId, provider, budget.dailyBudget, new Date(now.getTime() + 7 * DAY_MS)))) return 'day';
  if (!(await take(c, `${provider}:m:${minuteOf(now)}`, provider, budget.perMinute, new Date(now.getTime() + 2 * 60_000)))) {
    await c.providerUsage.updateOne({ _id: dayId }, { $inc: { calls: -1 } });
    return 'minute';
  }
  return 'ok';
}

/** After a quota or key error: no more calls to this provider until the next UTC midnight. */
export async function blockProvider(c: Collections, provider: Counted, now: Date): Promise<void> {
  await c.providerUsage.updateOne(
    { _id: `${provider}:${providerDay(now)}` },
    { $set: { blocked: true }, $setOnInsert: { provider, calls: 0, expiresAt: new Date(now.getTime() + 7 * DAY_MS) } },
    { upsert: true },
  );
}

export async function usageToday(c: Collections, now: Date): Promise<Map<string, { calls: number; blocked: boolean; resetsAt: Date }>> {
  const day = providerDay(now);
  const docs = await c.providerUsage.find({ _id: { $regex: `^[a-z]+:${day}$` } }).toArray();
  return new Map(docs.map((d) => [d.provider, { calls: d.calls, blocked: d.blocked === true, resetsAt: nextUtcMidnight(now) }]));
}
