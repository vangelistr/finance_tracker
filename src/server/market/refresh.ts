import 'server-only';
import type { ObjectId } from 'mongodb';
import { addDays, type LocalDate } from '@/lib/dates';
import { expectedLastClose, isStale, refreshSlot } from '@/lib/investing/calendar';
import { chainFor, providerSymbol, type ProviderId } from '@/lib/investing/instruments';
import type { Collections } from '@/server/db/collections';
import type { WatchlistDoc } from '@/server/db/types';
import { log } from '@/server/log';
import { blockProvider, reserveCall } from './budget';
import { fetchEcbRates, storeRates } from './fx';
import type { Bar, MarketProvider, HttpFetch } from './providers';

// The daily end-of-day refresh (docs/MARKET-DATA.md 5.4 and 7). It walks the provider chain per instrument, honours
// the negative cache and the call budgets, stores bars in the shared TTL cache and leaves manual prices as the last
// resort. Runs only for instruments on the watchlists of users who turned the module on.

const DAY_MS = 86_400_000;
const NOT_COVERED_MS = 30 * DAY_MS;
const ERROR_MS = 60 * 60_000;
const KEEP_DAYS = 400; // bars older than this fall out of the TTL cache (the metrics need 252 trading days)
const BACKFILL_DAYS = 400;
const GAP_DAYS = 10;

export interface ChainStep {
  provider: ProviderId;
  result: 'ok' | 'old' | 'not_covered' | 'blocked' | 'error' | 'skipped_cached' | 'skipped_budget' | 'no_symbol';
}

export type InstrumentRefresh = { status: 'fresh' | 'updated' | 'old' | 'exhausted' | 'deferred'; steps: ChainStep[] };

type Instrument = Pick<WatchlistDoc, 'symbol' | 'exchange' | 'instrumentKey' | 'providerSymbols'>;

async function storeBars(c: Collections, key: string, bars: Bar[], provider: ProviderId, currency: string | null, adjusted: boolean, now: Date) {
  if (bars.length === 0) return;
  await c.prices.bulkWrite(
    bars.map((b) => ({
      updateOne: {
        filter: { instrumentKey: key, date: b.date },
        update: {
          $set: { closeMicros: b.closeMicros, currency, provider, adjusted, fetchedAt: now, expiresAt: new Date(Date.parse(`${b.date}T00:00:00Z`) + KEEP_DAYS * DAY_MS) },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

/**
 * One instrument through its chain. `retry` is the 12:30 slot: a provider that still returns an older bar than
 * expected is then passed over for the next one (MARKET-DATA 5.4 step 2). A full per-minute cap defers the
 * instrument to the next tick instead of spending another provider's smaller budget.
 */
export async function refreshInstrument(
  c: Collections,
  providers: Map<ProviderId, MarketProvider>,
  inst: Instrument,
  lastDate: LocalDate | null,
  now: Date,
  retry: boolean,
): Promise<InstrumentRefresh> {
  const expected = expectedLastClose(inst.exchange, now);
  if (lastDate && lastDate >= expected) return { status: 'fresh', steps: [] };
  const from = lastDate ? addDays(lastDate, -GAP_DAYS) : addDays(expected, -BACKFILL_DAYS);
  const steps: ChainStep[] = [];
  let gotOld = false;

  for (const id of chainFor(inst.exchange)) {
    const provider = providers.get(id);
    if (!provider) continue;
    const symbol = providerSymbol(inst, id);
    if (!symbol) {
      steps.push({ provider: id, result: 'no_symbol' });
      continue;
    }
    const outcomeId = `${id}:${inst.instrumentKey}`;
    const cached = await c.providerOutcomes.findOne({ _id: outcomeId, until: { $gt: now } });
    if (cached) {
      steps.push({ provider: id, result: 'skipped_cached' });
      continue;
    }
    const reservation = await reserveCall(c, id, provider, now);
    if (reservation === 'minute') return { status: 'deferred', steps };
    if (reservation === 'day') {
      steps.push({ provider: id, result: 'skipped_budget' });
      continue;
    }

    const out = await provider.fetchDaily(symbol, { from, to: expected, rows: lastDate ? GAP_DAYS + 5 : 300 });
    if (out.kind === 'ok') {
      await storeBars(c, inst.instrumentKey, out.bars, id, out.currency, out.adjusted, now);
      const newest = out.bars.at(-1)?.date ?? null;
      if (newest && newest >= expected) {
        steps.push({ provider: id, result: 'ok' });
        return { status: 'updated', steps };
      }
      steps.push({ provider: id, result: 'old' });
      gotOld = true;
      // Not yet published: keep what we have; on the retry slot, try the next provider.
      if (!retry) return { status: 'old', steps };
      continue;
    }
    steps.push({ provider: id, result: out.kind });
    if (out.kind === 'blocked') await blockProvider(c, id, now);
    else {
      await c.providerOutcomes.updateOne(
        { _id: outcomeId },
        { $set: { status: out.kind, detail: out.detail, until: new Date(now.getTime() + (out.kind === 'not_covered' ? NOT_COVERED_MS : ERROR_MS)) } },
        { upsert: true },
      );
    }
  }
  return { status: gotOld ? 'old' : 'exhausted', steps };
}

/** The distinct listings on the watchlists of users with the module on (first user's provider overrides win). */
export async function marketUniverse(c: Collections, userIds: ObjectId[]): Promise<Instrument[]> {
  const rows = await c.watchlist.find({ userId: { $in: userIds } }, { projection: { symbol: 1, exchange: 1, instrumentKey: 1, providerSymbols: 1 } }).sort({ seq: 1 }).toArray();
  const seen = new Map<string, Instrument>();
  for (const r of rows) if (!seen.has(r.instrumentKey)) seen.set(r.instrumentKey, r);
  return [...seen.values()];
}

export interface RefreshDeps {
  providers: () => Map<ProviderId, MarketProvider>;
  http: HttpFetch;
  fxBaseUrl: string;
}

/**
 * One pass for `now`: FX once per slot, then every stale instrument once per slot. Instruments deferred by a
 * per-minute cap are left for the next tick. Returns per-instrument results for logs and tests.
 */
export async function refreshMarket(c: Collections, userIds: ObjectId[], deps: RefreshDeps, now: Date): Promise<Map<string, InstrumentRefresh>> {
  const results = new Map<string, InstrumentRefresh>();
  if (userIds.length === 0) return results;
  const slot = refreshSlot(now);

  const fxMeta = await c.priceMeta.findOne({ _id: 'fx' });
  if (fxMeta?.lastAttemptSlot !== slot.key) {
    let error: string | null = null;
    let date: string | null = fxMeta?.lastDate ?? null;
    if ((await reserveCall(c, 'frankfurter', { dailyBudget: 4, perMinute: 2 }, now)) === 'ok') {
      try {
        const rates = await fetchEcbRates(deps.fxBaseUrl, deps.http);
        await storeRates(c, rates, now);
        date = rates.date;
      } catch (err) {
        error = err instanceof Error ? err.message : 'error';
        log.warn('fx refresh failed', { error });
      }
    } else error = 'budget';
    await c.priceMeta.updateOne(
      { _id: 'fx' },
      { $set: { lastDate: date, provider: 'frankfurter', lastAttemptSlot: slot.key, lastAttemptAt: now, lastError: error, ...(error ? {} : { fetchedAt: now }) } },
      { upsert: true },
    );
  }

  const universe = await marketUniverse(c, userIds);
  if (universe.length === 0) return results;
  const metas = new Map((await c.priceMeta.find({ _id: { $in: universe.map((u) => u.instrumentKey) } }).toArray()).map((m) => [m._id, m]));
  let providers: Map<ProviderId, MarketProvider> | null = null;

  for (const inst of universe) {
    const meta = metas.get(inst.instrumentKey);
    if (meta?.lastAttemptSlot === slot.key) continue;
    if (!isStale(meta?.lastDate ?? null, inst.exchange, now)) continue;
    providers ??= deps.providers();
    const r = await refreshInstrument(c, providers, inst, meta?.lastDate ?? null, now, slot.retry);
    results.set(inst.instrumentKey, r);
    if (r.status === 'deferred') continue;
    const newest = await c.prices.find({ instrumentKey: inst.instrumentKey }).sort({ date: -1 }).limit(1).next();
    await c.priceMeta.updateOne(
      { _id: inst.instrumentKey },
      {
        $set: {
          lastDate: newest?.date ?? null,
          provider: newest?.provider ?? null,
          fetchedAt: newest?.fetchedAt ?? null,
          lastAttemptSlot: slot.key,
          lastAttemptAt: now,
          lastError: r.status === 'exhausted' ? r.steps.map((s) => `${s.provider}:${s.result}`).join(',') || 'no provider' : null,
        },
      },
      { upsert: true },
    );
  }
  return results;
}
