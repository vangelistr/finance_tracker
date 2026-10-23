import 'server-only';
import { MongoServerError, ObjectId } from 'mongodb';
import type { LocalDate } from '@/lib/dates';
import { expectedLastClose, isStale } from '@/lib/investing/calendar';
import { instrumentKey, needsEuRetailNote, PROVIDERS, STARTER_WATCHLIST, WATCHLIST_MAX, WATCHLIST_WARN, type ProviderId } from '@/lib/investing/instruments';
import { computeMetrics, type Metrics } from '@/lib/investing/metrics';
import { rankUniverse, type RankedRow } from '@/lib/investing/ranking';
import { effectiveProfile, investingSettings } from '@/lib/investing/settings';
import { suggestSplit } from '@/lib/investing/split';
import { col } from '@/server/db/collections';
import type { UserDoc, WatchlistDoc } from '@/server/db/types';
import { env } from '@/server/env';
import { ApiError, notFound } from '@/server/http/errors';
import { usageToday } from '@/server/market/budget';
import { latestRates, toEurMinor } from '@/server/market/fx';
import { configuredProviders, PROVIDER_BUDGETS } from '@/server/market/providers';
import { loadPlan } from './plan';

// Investing module service: watchlist, insights (metrics + ranking over the cached prices) and the monthly
// suggestion. Reads only the local cache; it never calls a provider (the worker does that).

/** Every investing route and page answers 404 while the module is off. */
export function assertInvesting(user: Pick<UserDoc, 'settings'>): void {
  if (!user.settings.investingEnabled) throw notFound();
}

export const watchlistDto = (w: WatchlistDoc) => ({
  id: w._id.toHexString(),
  symbol: w.symbol,
  exchange: w.exchange,
  instrumentKey: w.instrumentKey,
  name: w.name,
  isin: w.isin,
  currency: w.currency,
  type: w.type,
  region: w.region,
  domicile: w.domicile,
  terBps: w.terBps,
  core: w.core,
  leveraged: w.leveraged,
  crypto: w.crypto,
  providerSymbols: w.providerSymbols,
  euRetailNote: needsEuRetailNote(w),
});

export type WatchlistItem = ReturnType<typeof watchlistDto>;

/** Adds the educational starter list once per user (D-053); deleting rows later never brings them back. */
export async function ensureStarter(user: Pick<UserDoc, '_id' | 'settings'>, now = new Date()): Promise<void> {
  if (user.settings.investing?.seeded) return;
  const c = await col();
  const docs: WatchlistDoc[] = STARTER_WATCHLIST.map((s, i) => ({
    _id: new ObjectId(),
    userId: user._id,
    ...s,
    instrumentKey: instrumentKey(s),
    leveraged: false,
    crypto: false,
    providerSymbols: {},
    seq: i,
    createdAt: now,
    updatedAt: now,
  }));
  try {
    await c.watchlist.insertMany(docs, { ordered: false });
  } catch (err) {
    if (!(err instanceof MongoServerError && err.code === 11000)) throw err;
  }
  await c.users.updateOne({ _id: user._id }, { $set: { 'settings.investing.seeded': true } });
}

export async function listWatchlist(userId: ObjectId): Promise<WatchlistDoc[]> {
  return (await col()).watchlist.find({ userId }).sort({ seq: 1 }).toArray();
}

type InstrumentInput = Omit<WatchlistDoc, '_id' | 'userId' | 'instrumentKey' | 'seq' | 'createdAt' | 'updatedAt'>;

export async function createInstrument(userId: ObjectId, input: InstrumentInput, now = new Date()) {
  const c = await col();
  const count = await c.watchlist.countDocuments({ userId });
  if (count >= WATCHLIST_MAX) throw new ApiError(409, 'conflict', `the watchlist holds at most ${WATCHLIST_MAX} instruments`, { symbol: 'limit' });
  const last = await c.watchlist.find({ userId }).sort({ seq: -1 }).limit(1).next();
  const doc: WatchlistDoc = { _id: new ObjectId(), userId, ...input, instrumentKey: instrumentKey(input), seq: (last?.seq ?? -1) + 1, createdAt: now, updatedAt: now };
  try {
    await c.watchlist.insertOne(doc);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) throw new ApiError(409, 'conflict', 'already on the watchlist', { symbol: 'exists' });
    throw err;
  }
  return { doc, warn: count + 1 > WATCHLIST_WARN };
}

export async function updateInstrument(userId: ObjectId, id: ObjectId, patch: Partial<InstrumentInput>) {
  const c = await col();
  return c.watchlist.findOneAndUpdate({ _id: id, userId }, { $set: { ...patch, updatedAt: new Date() } }, { returnDocument: 'after' });
}

export async function deleteInstrument(userId: ObjectId, id: ObjectId): Promise<boolean> {
  const c = await col();
  const doc = await c.watchlist.findOneAndDelete({ _id: id, userId });
  if (!doc) return false;
  await c.manualPrices.deleteMany({ userId, instrumentKey: doc.instrumentKey });
  return true;
}

/** Manual price entry, the last resort of the chain: one price per listing and day, replaced on re-entry. */
export async function setManualPrice(userId: ObjectId, watchlistId: ObjectId, localDate: LocalDate, priceMicros: number, now = new Date()) {
  const c = await col();
  const w = await c.watchlist.findOne({ _id: watchlistId, userId });
  if (!w) return null;
  await c.manualPrices.updateOne(
    { userId, instrumentKey: w.instrumentKey, localDate },
    { $set: { priceMicros, currency: w.currency }, $setOnInsert: { _id: new ObjectId(), createdAt: now } },
    { upsert: true },
  );
  return w;
}

export interface InsightRow extends Omit<RankedRow, 'metrics'> {
  item: WatchlistItem;
  metrics: Metrics;
  points: number;
  lastDate: LocalDate | null;
  lastPriceMicros: number | null;
  lastEurMinor: number | null;
  source: ProviderId | 'manual' | null;
  fetchedAt: string | null;
  expectedDate: LocalDate;
  stale: boolean;
}

/** Insights for the user's watchlist: merged price series, metrics, ranking, latest price in EUR and staleness. */
export async function loadInsights(user: UserDoc, now = new Date()) {
  const c = await col();
  const settings = investingSettings(user.settings.investing);
  const list = await listWatchlist(user._id);
  const keys = list.map((w) => w.instrumentKey);
  const [prices, manual, fx] = await Promise.all([
    c.prices.find({ instrumentKey: { $in: keys } }).sort({ date: 1 }).toArray(),
    c.manualPrices.find({ userId: user._id, instrumentKey: { $in: keys } }).sort({ localDate: 1 }).toArray(),
    latestRates(c),
  ]);

  const series = list.map((w) => {
    // Provider bars first; a manual price fills a date without one (the chain's last resort).
    const byDate = new Map<string, { micros: number; source: ProviderId | 'manual'; fetchedAt: Date | null }>();
    for (const p of prices) if (p.instrumentKey === w.instrumentKey) byDate.set(p.date, { micros: p.closeMicros, source: p.provider, fetchedAt: p.fetchedAt });
    for (const m of manual) if (m.instrumentKey === w.instrumentKey && !byDate.has(m.localDate)) byDate.set(m.localDate, { micros: m.priceMicros, source: 'manual', fetchedAt: m.createdAt });
    const dates = [...byDate.keys()].sort();
    const last = dates.length ? byDate.get(dates.at(-1)!)! : null;
    return { w, closes: dates.map((d) => byDate.get(d)!.micros), lastDate: dates.at(-1) ?? null, last };
  });

  const ranked = rankUniverse(
    series.map((s) => ({ key: s.w.instrumentKey, symbol: s.w.symbol, metrics: computeMetrics(s.closes, s.w.terBps) })),
    settings.weights,
  );
  const byKey = new Map(series.map((s) => [s.w.instrumentKey, s]));
  const rows: InsightRow[] = ranked.map((r) => {
    const s = byKey.get(r.key)!;
    return {
      ...r,
      item: watchlistDto(s.w),
      points: s.closes.length,
      lastDate: s.lastDate,
      lastPriceMicros: s.last?.micros ?? null,
      lastEurMinor: s.last ? toEurMinor(s.last.micros, s.w.currency, fx) : null,
      source: s.last?.source ?? null,
      fetchedAt: s.last?.fetchedAt?.toISOString() ?? null,
      expectedDate: expectedLastClose(s.w.exchange, now),
      stale: isStale(s.lastDate, s.w.exchange, now),
    };
  });
  return { rows, order: list.map((w) => w._id.toHexString()), settings, fx: fx ? { date: fx._id, rates: fx.rates } : null, generatedAt: now.toISOString() };
}

export type Insights = Awaited<ReturnType<typeof loadInsights>>;

/** This month's suggestion: the Smart Plan's investing share split across the top-ranked instruments. */
export async function loadSuggestion(user: UserDoc, now = new Date()) {
  const [insights, plan] = await Promise.all([loadInsights(user, now), loadPlan(user, now)]);
  const profile = effectiveProfile(insights.settings);
  const split = suggestSplit({
    amountMinor: plan.plan.split.investingMinor,
    profile: profile.profile,
    guardrails: insights.settings.guardrails,
    candidates: insights.rows.map((r) => ({
      key: r.key,
      symbol: r.symbol,
      rank: r.rank,
      score: r.score,
      core: r.item.core,
      region: r.item.region,
      currency: r.item.currency,
      leveraged: r.item.leveraged,
      crypto: r.item.crypto,
    })),
  });
  return {
    insights,
    split,
    profile,
    month: plan.month,
    plan: { investingBp: plan.settings.investingBp, investingMinor: plan.plan.split.investingMinor, heldMinor: plan.plan.split.investingHeldMinor, baselineMinor: plan.plan.baseline.baselineMinor },
  };
}

/** Data status for the module: which providers have keys (never the keys), today's usage, FX and quote ages. */
export async function dataStatus(user: UserDoc, now = new Date()) {
  const c = await col();
  const configured = configuredProviders(env());
  const [usage, fxMeta, fx, list] = await Promise.all([usageToday(c, now), c.priceMeta.findOne({ _id: 'fx' }), latestRates(c), listWatchlist(user._id)]);
  const metas = new Map((await c.priceMeta.find({ _id: { $in: list.map((w) => w.instrumentKey) } }).toArray()).map((m) => [m._id, m]));
  return {
    providers: PROVIDERS.map((id) => {
      const u = usage.get(id);
      return { id, configured: configured.has(id), dailyBudget: PROVIDER_BUDGETS[id].dailyBudget, callsToday: u?.calls ?? 0, blocked: u?.blocked ?? false };
    }),
    fx: { date: fx?._id ?? null, fetchedAt: fxMeta?.fetchedAt?.toISOString() ?? null, lastError: fxMeta?.lastError ?? null },
    instruments: list.map((w) => {
      const m = metas.get(w.instrumentKey);
      return { id: w._id.toHexString(), symbol: w.symbol, exchange: w.exchange, lastAttemptAt: m?.lastAttemptAt?.toISOString() ?? null, lastError: m?.lastError ?? null };
    }),
  };
}
