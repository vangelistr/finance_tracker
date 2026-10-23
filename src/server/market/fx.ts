import 'server-only';
import { TRADING_CURRENCIES } from '@/lib/investing/instruments';
import type { Collections } from '@/server/db/collections';
import type { FxRateDoc } from '@/server/db/types';
import type { HttpFetch } from './providers';

// ECB euro reference rates through Frankfurter (docs/MARKET-DATA.md section 4): v2 with `providers=ECB`, v1 as the
// documented fallback, then the last stored rate with its date. Requests carry only currency codes.

const QUOTES = TRADING_CURRENCIES.filter((c) => c !== 'EUR');
const KEEP_MS = 400 * 86_400_000;
const TIMEOUT_MS = 15_000;

async function get(http: HttpFetch, url: string): Promise<unknown> {
  const res = await http(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res.json();
}

/** Latest ECB rates as `{date, rates}`; throws when both API versions fail. */
export async function fetchEcbRates(baseUrl: string, http: HttpFetch): Promise<{ date: string; rates: Record<string, number> }> {
  try {
    const rows = (await get(http, `${baseUrl}/v2/rates?${new URLSearchParams({ providers: 'ECB', base: 'EUR', quotes: QUOTES.join(',') })}`)) as Array<{ date?: string; quote?: string; rate?: number }>;
    const valid = Array.isArray(rows) ? rows.filter((r) => typeof r.date === 'string' && typeof r.quote === 'string' && typeof r.rate === 'number' && r.rate > 0) : [];
    if (valid.length > 0) {
      const date = valid.map((r) => r.date!).sort().at(-1)!;
      return { date, rates: Object.fromEntries(valid.filter((r) => r.date === date).map((r) => [r.quote!, r.rate!])) };
    }
    throw new Error('empty v2 response');
  } catch {
    const body = (await get(http, `${baseUrl}/v1/latest?${new URLSearchParams({ base: 'EUR', symbols: QUOTES.join(',') })}`)) as { date?: string; rates?: Record<string, number> };
    if (typeof body?.date !== 'string' || !body.rates) throw new Error('unexpected v1 response');
    return { date: body.date, rates: body.rates };
  }
}

export async function storeRates(c: Collections, r: { date: string; rates: Record<string, number> }, now: Date): Promise<void> {
  await c.fxRates.updateOne(
    { _id: r.date },
    { $set: { base: 'EUR', rates: r.rates, fetchedAt: now, expiresAt: new Date(Date.parse(`${r.date}T00:00:00Z`) + KEEP_MS) } },
    { upsert: true },
  );
}

export async function latestRates(c: Collections): Promise<FxRateDoc | null> {
  return c.fxRates.find().sort({ _id: -1 }).limit(1).next();
}

/** Converts a price in micros of `currency` to euro cents; null when no rate is known. */
export function toEurMinor(priceMicros: number, currency: string, fx: Pick<FxRateDoc, 'rates'> | null): number | null {
  if (currency === 'EUR') return Math.round(priceMicros / 10_000);
  const rate = fx?.rates[currency];
  return rate && rate > 0 ? Math.round(priceMicros / rate / 10_000) : null;
}
