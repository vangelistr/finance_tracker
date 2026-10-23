import { ObjectId } from 'mongodb';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as manualPrices from '@/app/api/investing/manual-prices/route';
import * as profileRoute from '@/app/api/investing/profile/route';
import * as ranking from '@/app/api/investing/ranking/route';
import * as status from '@/app/api/investing/status/route';
import * as suggestion from '@/app/api/investing/suggestion/route';
import * as watchlist from '@/app/api/investing/watchlist/route';
import * as watchlistById from '@/app/api/investing/watchlist/[id]/route';
import * as incomeSources from '@/app/api/income-sources/route';
import { addDays, weekdayOf } from '@/lib/dates';
import { instrumentKey, STARTER_WATCHLIST, type ProviderId } from '@/lib/investing/instruments';
import { getDb } from '@/server/db/client';
import { collectionsOf, type Collections } from '@/server/db/collections';
import { runMigrations } from '@/server/db/migrations';
import { resetEnvCache } from '@/server/env';
import type { FetchOutcome, MarketProvider } from '@/server/market/providers';
import { refreshMarket, type RefreshDeps } from '@/server/market/refresh';
import type { PushPayload, PushSender } from '@/server/push/send';
import { loadInsights } from '@/server/services/investing';
import { buildJobs } from '@/worker/jobs';
import { marketDigestJob, marketRefreshJob } from '@/worker/jobs/market';
import { tick } from '@/worker/scheduler';
import { signedInUser } from './users';

// Investing module (brief req. 11, PLAN 6.6 and 8): off means no calls and no routes; on means the chain routes per
// instrument, falls back, respects budgets and converts to EUR. Every provider here is a mock (no keys exist, B-003).

type Session = Awaited<ReturnType<typeof signedInUser>>;
let c: Collections;

// Tuesday 27 Oct 2026, 07:45 Athens (EET) = 01:45 New York: Monday's US and European closes are expected.
const NOW = new Date('2026-10-27T05:45:00Z');
const EXPECTED = '2026-10-26';

/** Weekday bars ending at `last`, rising 0.1 % a day from 100. */
function weekdayBars(last: string, count: number) {
  const dates: string[] = [];
  for (let d = last; dates.length < count; d = addDays(d, -1)) if (weekdayOf(d) <= 5) dates.unshift(d);
  return dates.map((date, i) => ({ date, closeMicros: Math.round(100 * 1.001 ** i * 1e6) }));
}

interface Mock extends MarketProvider {
  calls: string[];
}

function mock(id: ProviderId, answer: (symbol: string) => FetchOutcome, budget = { dailyBudget: 100, perMinute: 100 }): Mock {
  const calls: string[] = [];
  return {
    id,
    ...budget,
    calls,
    async fetchDaily(symbol) {
      calls.push(symbol);
      return answer(symbol);
    },
  };
}

const ok = (last = EXPECTED, count = 300): FetchOutcome => ({ kind: 'ok', bars: weekdayBars(last, count), currency: 'USD', adjusted: false });

function fxHttp(calls: string[] = []): RefreshDeps['http'] {
  return (async (url: string | URL | Request) => {
    calls.push(String(url));
    return Response.json([
      { date: '2026-10-26', base: 'EUR', quote: 'USD', rate: 1.25 },
      { date: '2026-10-26', base: 'EUR', quote: 'GBP', rate: 0.85 },
    ]);
  }) as RefreshDeps['http'];
}

function deps(providers: Mock[], http = fxHttp()): RefreshDeps {
  return { providers: () => new Map(providers.map((p) => [p.id, p])), http, fxBaseUrl: 'https://fx.test' };
}

async function enable(s: Session, on = true) {
  await c.users.updateOne({ _id: s.user._id }, { $set: { 'settings.investingEnabled': on } });
}

async function addInstrument(userId: ObjectId, symbol: string, exchange: 'XNAS' | 'ARCX' | 'XETR' | 'XAMS', extra: Record<string, unknown> = {}) {
  await c.watchlist.insertOne({
    _id: new ObjectId(),
    userId,
    symbol,
    exchange,
    instrumentKey: instrumentKey({ symbol, exchange }),
    name: symbol,
    isin: null,
    currency: exchange === 'XNAS' || exchange === 'ARCX' ? 'USD' : 'EUR',
    type: 'etf',
    region: 'global',
    domicile: 'IE',
    terBps: null,
    core: false,
    leveraged: false,
    crypto: false,
    providerSymbols: {},
    seq: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...extra,
  });
}

/** Clears the shared market cache between tests. */
async function clearMarket() {
  await Promise.all([c.prices.deleteMany({}), c.priceMeta.deleteMany({}), c.providerOutcomes.deleteMany({}), c.providerUsage.deleteMany({}), c.fxRates.deleteMany({})]);
}

beforeAll(async () => {
  const db = await getDb();
  await runMigrations(db);
  c = collectionsOf(db);
});

beforeEach(async () => {
  await clearMarket();
  await c.users.updateMany({}, { $set: { 'settings.investingEnabled': false } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ['TWELVEDATA_API_KEY', 'EODHD_API_KEY', 'FMP_API_KEY', 'ALPHAVANTAGE_API_KEY', 'FINNHUB_API_KEY']) delete process.env[k];
  resetEnvCache();
});

describe('module off', () => {
  it('makes zero market-data network calls, even with provider keys and a watchlist', async () => {
    for (const k of ['TWELVEDATA_API_KEY', 'EODHD_API_KEY', 'FMP_API_KEY', 'ALPHAVANTAGE_API_KEY', 'FINNHUB_API_KEY']) process.env[k] = 'test-key-not-real';
    resetEnvCache();
    const s = await signedInUser('el');
    await addInstrument(s.user._id, 'AAPL', 'XNAS');
    await c.users.updateOne({ _id: s.user._id }, { $set: { 'settings.notifications.marketDigest.enabled': true } });
    const fetchSpy = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchSpy);
    const db = await getDb();
    // The real job list at the refresh slot, the retry slot and the digest time on a weekday.
    for (const at of ['2026-10-27T05:30:00Z', '2026-10-27T06:00:00Z', '2026-10-27T10:30:00Z', '2026-10-28T05:31:00Z']) {
      const { failed } = await tick(db, new Date(at), buildJobs());
      expect(failed).toEqual([]);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await c.providerUsage.countDocuments()).toBe(0);
    expect(await c.priceMeta.countDocuments()).toBe(0);
    expect(await c.notificationLog.countDocuments({ userId: s.user._id, type: 'marketDigest' })).toBe(0);
  });

  it('answers 404 on every investing route', async () => {
    const s = await signedInUser('el');
    const id = '0123456789abcdef01234567';
    const calls = [
      s.client.call(watchlist.GET, 'GET', '/api/investing/watchlist'),
      s.client.call(watchlist.POST, 'POST', '/api/investing/watchlist', { body: { symbol: 'VT', exchange: 'ARCX', name: 'VT', currency: 'USD', type: 'etf', region: 'global', domicile: 'US' } }),
      s.client.call(watchlistById.PATCH, 'PATCH', `/api/investing/watchlist/${id}`, { params: { id }, body: { name: 'x' } }),
      s.client.call(watchlistById.DELETE, 'DELETE', `/api/investing/watchlist/${id}`, { params: { id } }),
      s.client.call(ranking.GET, 'GET', '/api/investing/ranking'),
      s.client.call(suggestion.GET, 'GET', '/api/investing/suggestion'),
      s.client.call(profileRoute.PUT, 'PUT', '/api/investing/profile', { body: { profileOverride: 'growth' } }),
      s.client.call(manualPrices.POST, 'POST', '/api/investing/manual-prices', { body: { watchlistId: id, localDate: '2026-10-26', priceMicros: 1 } }),
      s.client.call(status.GET, 'GET', '/api/investing/status'),
    ];
    expect((await Promise.all(calls)).map((r) => r.status)).toEqual(Array(9).fill(404));
    expect(await c.watchlist.countDocuments({ userId: s.user._id })).toBe(0);
  });
});

describe('provider chain (mocked providers)', () => {
  it('routes per instrument: US listings start at Twelve Data, European ones at EODHD', async () => {
    const s = await signedInUser('el');
    await enable(s);
    await addInstrument(s.user._id, 'VTI', 'ARCX');
    await addInstrument(s.user._id, 'VWCE', 'XETR');
    const td = mock('twelvedata', () => ok());
    const eod = mock('eodhd', () => ok());
    const results = await refreshMarket(c, [s.user._id], deps([td, eod]), NOW);
    expect(td.calls).toEqual(['VTI']);
    expect(eod.calls).toEqual(['VWCE.XETRA']);
    expect(results.get('VTI:ARCX')!.status).toBe('updated');
    const meta = await c.priceMeta.findOne({ _id: 'VWCE:XETR' });
    expect(meta).toMatchObject({ lastDate: EXPECTED, provider: 'eodhd', lastAttemptSlot: '2026-10-27T07:30' });
    // A second pass in the same slot is free: everything is fresh.
    await refreshMarket(c, [s.user._id], deps([td, eod]), new Date(NOW.getTime() + 60_000));
    expect(td.calls.length + eod.calls.length).toBe(2);
  });

  it('falls back on an error, a missing listing and a rate limit, and remembers each outcome', async () => {
    const s = await signedInUser('el');
    await enable(s);
    await addInstrument(s.user._id, 'AAPL', 'XNAS');
    await addInstrument(s.user._id, 'MSFT', 'XNAS');
    await addInstrument(s.user._id, 'AMZN', 'XNAS');
    const td = mock('twelvedata', (sym) => (sym === 'AAPL' ? { kind: 'error', detail: 'http 500' } : sym === 'MSFT' ? { kind: 'not_covered', detail: 'http 404' } : { kind: 'blocked', detail: 'http 429' }));
    const eod = mock('eodhd', () => ok());
    const results = await refreshMarket(c, [s.user._id], deps([td, eod]), NOW);
    expect([...results.values()].map((r) => r.status)).toEqual(['updated', 'updated', 'updated']);
    expect(results.get('AAPL:XNAS')!.steps).toEqual([
      { provider: 'twelvedata', result: 'error' },
      { provider: 'eodhd', result: 'ok' },
    ]);
    expect(td.calls).toEqual(['AAPL', 'MSFT', 'AMZN']);
    expect(await c.providerOutcomes.findOne({ _id: 'twelvedata:MSFT:XNAS' })).toMatchObject({ status: 'not_covered' });
    expect((await c.providerUsage.findOne({ _id: 'twelvedata:2026-10-27' }))?.blocked).toBe(true);

    // Next day: Twelve Data's block has reset, MSFT stays skipped for 30 days, AAPL's error has expired.
    const next = new Date('2026-10-28T05:45:00Z');
    td.calls.length = 0;
    const again = await refreshMarket(c, [s.user._id], deps([mock('twelvedata', () => ok('2026-10-27')), mock('eodhd', () => ok('2026-10-27'))]), next);
    expect(again.get('MSFT:XNAS')!.steps[0]).toEqual({ provider: 'twelvedata', result: 'skipped_cached' });
    expect(again.get('AAPL:XNAS')!.steps[0]).toEqual({ provider: 'twelvedata', result: 'ok' });
  });

  it('never exceeds a daily budget, also with concurrent refreshes, and then falls back', async () => {
    const s = await signedInUser('el');
    await enable(s);
    for (const sym of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) await addInstrument(s.user._id, sym, 'XNAS');
    const td = mock('twelvedata', () => ok(), { dailyBudget: 2, perMinute: 100 });
    const eod = mock('eodhd', () => ok(), { dailyBudget: 3, perMinute: 100 });
    // Three workers racing in the same slot.
    await Promise.all([0, 1, 2].map(() => refreshMarket(c, [s.user._id], deps([td, eod]), NOW)));
    expect(td.calls.length).toBe(2);
    expect(eod.calls.length).toBe(3);
    expect((await c.providerUsage.findOne({ _id: 'twelvedata:2026-10-27' }))!.calls).toBe(2);
    expect((await c.providerUsage.findOne({ _id: 'eodhd:2026-10-27' }))!.calls).toBe(3);
    // Racing workers may spend calls on the same listing; whatever found no budget left waits for manual entry and
    // shows as stale.
    const served = new Set([...td.calls, ...eod.calls.map((x) => x.replace('.US', ''))]);
    const insights = await loadInsights((await c.users.findOne({ _id: s.user._id }))!, NOW);
    expect(insights.rows.filter((r) => r.stale).length).toBe(6 - served.size);
    expect(served.size).toBeLessThan(6);
  });

  it('defers to the next tick when a per-minute cap is full instead of spending another budget', async () => {
    const s = await signedInUser('el');
    await enable(s);
    for (const sym of ['B1', 'B2', 'B3']) await addInstrument(s.user._id, sym, 'XNAS');
    const td = mock('twelvedata', () => ok(), { dailyBudget: 100, perMinute: 2 });
    const eod = mock('eodhd', () => ok());
    const first = await refreshMarket(c, [s.user._id], deps([td, eod]), NOW);
    expect(first.get('B3:XNAS')!.status).toBe('deferred');
    expect(eod.calls).toEqual([]);
    await refreshMarket(c, [s.user._id], deps([td, eod]), new Date(NOW.getTime() + 60_000));
    expect(td.calls).toEqual(['B1', 'B2', 'B3']);
  });

  it('accepts an old bar at 07:30 and tries the next provider at 12:30', async () => {
    const s = await signedInUser('el');
    await enable(s);
    await addInstrument(s.user._id, 'VT', 'ARCX');
    const td = mock('twelvedata', () => ok('2026-10-23'));
    const eod = mock('eodhd', () => ok());
    expect((await refreshMarket(c, [s.user._id], deps([td, eod]), NOW)).get('VT:ARCX')!.status).toBe('old');
    expect(eod.calls).toEqual([]);
    const retry = await refreshMarket(c, [s.user._id], deps([td, eod]), new Date('2026-10-27T10:31:00Z'));
    expect(retry.get('VT:ARCX')!.steps.map((x) => x.result)).toEqual(['old', 'ok']);
    expect(await c.priceMeta.findOne({ _id: 'VT:ARCX' })).toMatchObject({ lastDate: EXPECTED, provider: 'eodhd' });
  });

  it('stores ECB rates once per slot, falls back to v1, and converts prices to EUR with timestamps', async () => {
    const s = await signedInUser('el');
    await enable(s);
    await addInstrument(s.user._id, 'VTI', 'ARCX');
    const fxCalls: string[] = [];
    await refreshMarket(c, [s.user._id], deps([mock('twelvedata', () => ok())], fxHttp(fxCalls)), NOW);
    await refreshMarket(c, [s.user._id], deps([], fxHttp(fxCalls)), new Date(NOW.getTime() + 60_000));
    expect(fxCalls).toEqual(['https://fx.test/v2/rates?providers=ECB&base=EUR&quotes=USD%2CGBP%2CCHF%2CJPY']);
    expect((await c.fxRates.findOne({ _id: '2026-10-26' }))!.rates).toEqual({ USD: 1.25, GBP: 0.85 });

    const insights = await loadInsights((await c.users.findOne({ _id: s.user._id }))!, NOW);
    const vti = insights.rows[0]!;
    const lastClose = weekdayBars(EXPECTED, 300).at(-1)!.closeMicros;
    expect(vti).toMatchObject({ lastDate: EXPECTED, source: 'twelvedata', stale: false, lastPriceMicros: lastClose, lastEurMinor: Math.round(lastClose / 1.25 / 10_000), points: 300 });
    expect(vti.fetchedAt).toBe(NOW.toISOString());
    expect(vti.rank).toBe(1);

    // v2 fails in the retry slot: v1 answers.
    const v1Calls: string[] = [];
    const v1Http = (async (url: string | URL | Request) => {
      v1Calls.push(String(url));
      return String(url).includes('/v2/') ? new Response('nope', { status: 503 }) : Response.json({ amount: 1, base: 'EUR', date: '2026-10-27', rates: { USD: 1.2 } });
    }) as RefreshDeps['http'];
    await refreshMarket(c, [s.user._id], deps([], v1Http), new Date('2026-10-27T10:31:00Z'));
    expect(v1Calls).toHaveLength(2);
    expect((await c.fxRates.findOne({ _id: '2026-10-27' }))!.rates).toEqual({ USD: 1.2 });
  });

  it('leaves manual prices as the last resort when no provider has a key', async () => {
    const s = await signedInUser('el');
    await enable(s);
    await addInstrument(s.user._id, 'IWDA', 'XAMS');
    const r = await refreshMarket(c, [s.user._id], deps([]), NOW);
    expect(r.get('IWDA:XAMS')!.status).toBe('exhausted');
    const w = (await c.watchlist.findOne({ userId: s.user._id, symbol: 'IWDA' }))!;
    const res = await s.client.call(manualPrices.POST, 'POST', '/api/investing/manual-prices', { body: { watchlistId: w._id.toHexString(), localDate: EXPECTED, priceMicros: 105_250_000 } });
    expect(res.status).toBe(200);
    const insights = await loadInsights((await c.users.findOne({ _id: s.user._id }))!, NOW);
    expect(insights.rows[0]).toMatchObject({ source: 'manual', lastDate: EXPECTED, lastEurMinor: 10_525, stale: false, sufficient: false, rank: null });
  });
});

describe('investing API', () => {
  let a: Session;
  let b: Session;

  beforeAll(async () => {
    a = await signedInUser('el');
    b = await signedInUser('en');
  });

  beforeEach(async () => {
    await enable(a);
    await enable(b);
  });

  it('adds the starter list once and keeps watchlists private', async () => {
    const first = await a.client.call(watchlist.GET, 'GET', '/api/investing/watchlist');
    expect(first.json.watchlist.map((w: { symbol: string }) => w.symbol)).toEqual(STARTER_WATCHLIST.map((x) => x.symbol));
    expect(first.json.watchlist.filter((w: { euRetailNote: boolean }) => w.euRetailNote).map((w: { symbol: string }) => w.symbol)).toEqual(['VT', 'VTI']);
    const vt = first.json.watchlist.find((w: { symbol: string }) => w.symbol === 'VT');
    expect((await a.client.call(watchlistById.DELETE, 'DELETE', `/api/investing/watchlist/${vt.id}`, { params: { id: vt.id } })).status).toBe(200);
    const again = await a.client.call(watchlist.GET, 'GET', '/api/investing/watchlist');
    expect(again.json.watchlist).toHaveLength(STARTER_WATCHLIST.length - 1);

    const other = await b.client.call(watchlist.GET, 'GET', '/api/investing/watchlist');
    const own = other.json.watchlist[0].id;
    expect((await a.client.call(watchlistById.PATCH, 'PATCH', `/api/investing/watchlist/${own}`, { params: { id: own }, body: { name: 'mine now' } })).status).toBe(404);
    expect((await a.client.call(watchlistById.DELETE, 'DELETE', `/api/investing/watchlist/${own}`, { params: { id: own } })).status).toBe(404);
    expect((await a.client.call(manualPrices.POST, 'POST', '/api/investing/manual-prices', { body: { watchlistId: own, localDate: EXPECTED, priceMicros: 1 } })).status).toBe(404);
  });

  it('validates new instruments, rejects duplicates and caps the list at 40', async () => {
    const body = { symbol: 'qqq', exchange: 'XNAS', name: 'Invesco QQQ', currency: 'USD', type: 'etf', region: 'us', domicile: 'us' };
    const created = await a.client.call(watchlist.POST, 'POST', '/api/investing/watchlist', { body });
    expect(created.status).toBe(200);
    expect(created.json.instrument).toMatchObject({ symbol: 'QQQ', instrumentKey: 'QQQ:XNAS', domicile: 'US', euRetailNote: true });
    expect((await a.client.call(watchlist.POST, 'POST', '/api/investing/watchlist', { body })).status).toBe(409);
    expect((await a.client.call(watchlist.POST, 'POST', '/api/investing/watchlist', { body: { ...body, symbol: 'BAD SYMBOL' } })).status).toBe(400);
    expect((await a.client.call(watchlist.POST, 'POST', '/api/investing/watchlist', { body: { ...body, symbol: 'X1', currency: 'XYZ' } })).status).toBe(400);
    const count = await c.watchlist.countDocuments({ userId: a.user._id });
    for (let i = count; i < 40; i++) await addInstrument(a.user._id, `Z${i}`, 'XETR');
    const over = await a.client.call(watchlist.POST, 'POST', '/api/investing/watchlist', { body: { ...body, symbol: 'ONEMORE' } });
    expect(over.status).toBe(409);
    await c.watchlist.deleteMany({ userId: a.user._id, symbol: /^Z\d+$/ });
  });

  it('ranks with the disclaimer and splits exactly the Smart Plan investing amount', async () => {
    await a.client.call(incomeSources.POST, 'POST', '/api/income-sources', {
      body: { name: 'Μισθός', type: 'recurring_fixed', expectedNetMinor: 200000, schedule: { frequency: 'monthly', startDate: '2026-01-25' } },
    });
    // Investing is held back until an emergency fund exists; allow it so the amount is not zero.
    await c.users.updateOne({ _id: a.user._id }, { $set: { 'settings.plan.investWhileEfUnfunded': true } });
    const list = await c.watchlist.find({ userId: a.user._id }).toArray();
    await c.prices.bulkWrite(
      list.flatMap((w, k) =>
        weekdayBars(EXPECTED, 300).map((bar, i) => ({
          insertOne: { document: { _id: new ObjectId(), instrumentKey: w.instrumentKey, date: bar.date, closeMicros: Math.round(bar.closeMicros * (1 + (k + 1) * 0.0005 * (i % 7))), currency: w.currency, provider: 'eodhd' as const, adjusted: true, fetchedAt: NOW, expiresAt: new Date('2027-12-01') } },
        })),
      ),
    );
    const r = await a.client.call(ranking.GET, 'GET', '/api/investing/ranking');
    expect(r.status).toBe(200);
    expect(r.json.disclaimer).toMatch(/past performance does not predict future results; educational, not financial advice/);
    expect(r.json.rows.every((x: { rank: number | null; sufficient: boolean }) => x.sufficient && x.rank !== null)).toBe(true);

    await a.client.call(profileRoute.PUT, 'PUT', '/api/investing/profile', { body: { answers: { horizon: 'long', drawdown: 'continue', experience: 'some' } } });
    const s = await a.client.call(suggestion.GET, 'GET', '/api/investing/suggestion');
    expect(s.status).toBe(200);
    expect(s.json.profile).toEqual({ profile: 'growth', source: 'questionnaire' });
    expect(s.json.plan.investingMinor).toBeGreaterThan(0);
    const { split } = s.json;
    expect(split.amountMinor).toBe(s.json.plan.investingMinor);
    expect(split.lines.reduce((t: number, l: { amountMinor: number }) => t + l.amountMinor, 0) + split.unallocatedMinor).toBe(split.amountMinor);
    expect(split.lines.length).toBeLessThanOrEqual(7);
    expect(split.lines.every((l: { amountMinor: number }) => l.amountMinor <= split.caps.instrumentMinor)).toBe(true);

    const bad = await a.client.call(profileRoute.PUT, 'PUT', '/api/investing/profile', { body: { weights: { r1m: 0, r3m: 0, r6m: 0, r12m: 0, volatility: 0, drawdown: 0, trend: 0, riskAdjusted: 0, cost: 0 } } });
    expect(bad.status).toBe(400);
    await a.client.call(profileRoute.PUT, 'PUT', '/api/investing/profile', { body: { reset: true } });
    expect((await a.client.call(suggestion.GET, 'GET', '/api/investing/suggestion')).json.profile.source).toBe('default');
  });

  it('reports data status without exposing keys', async () => {
    process.env.TWELVEDATA_API_KEY = 'secret-test-key-value';
    resetEnvCache();
    const res = await a.client.call(status.GET, 'GET', '/api/investing/status');
    expect(res.status).toBe(200);
    expect(res.json.providers.find((p: { id: string }) => p.id === 'twelvedata')).toMatchObject({ configured: true, dailyBudget: 640 });
    expect(res.json.providers.find((p: { id: string }) => p.id === 'eodhd').configured).toBe(false);
    expect(JSON.stringify(res.json)).not.toContain('secret-test-key-value');
  });
});

describe('worker jobs (fake clock)', () => {
  class RecordingSender implements PushSender {
    sent: PushPayload[] = [];
    async sendToUser(_userId: ObjectId, payload: PushPayload) {
      this.sent.push(payload);
      return { sent: 1, failed: 0, subscriptions: 1 };
    }
  }

  it('refreshes through the job and sends the digest once a day after the refresh, only when enabled', async () => {
    const s = await signedInUser('en');
    await enable(s);
    await addInstrument(s.user._id, 'VTI', 'ARCX');
    await addInstrument(s.user._id, 'AAPL', 'XNAS');
    const td = mock('twelvedata', () => ok());
    const sender = new RecordingSender();
    const jobs = [marketRefreshJob(() => deps([td])), marketDigestJob(sender)];
    const db = await getDb();

    await tick(db, new Date('2026-10-27T06:05:00Z'), jobs); // 08:05, digest still off
    expect(sender.sent).toEqual([]);
    await c.users.updateOne({ _id: s.user._id }, { $set: { 'settings.notifications.marketDigest.enabled': true } });
    await tick(db, new Date('2026-10-27T05:00:00Z'), jobs); // 07:00: before the digest time
    expect(sender.sent).toEqual([]);
    for (const at of ['2026-10-27T06:10:00Z', '2026-10-27T06:40:00Z', '2026-10-27T15:00:00Z']) await tick(db, new Date(at), jobs);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]!.title).toBe('Investing ranking updated');
    expect(sender.sent[0]!.body).toContain('VTI');
    expect(sender.sent[0]!.body).not.toMatch(/\b(buy|sell|predict)/i);
    expect(td.calls).toEqual(['VTI', 'AAPL']);

    // Monday morning follows no US session: no digest.
    await tick(db, new Date('2026-11-02T07:00:00Z'), jobs);
    expect(sender.sent).toHaveLength(1);
  });
});
