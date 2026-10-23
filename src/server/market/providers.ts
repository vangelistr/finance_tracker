import 'server-only';
import { toLocalDate, type LocalDate } from '@/lib/dates';
import { toMicros, type ProviderId } from '@/lib/investing/instruments';
import type { Env } from '@/server/env';

// Provider adapters for free end-of-day data (docs/MARKET-DATA.md sections 3 and 7). Each request carries only a
// ticker symbol, dates and the provider's own key: never a user id, an amount or anything personal. Providers are
// constructed only for keys present in `.env`, and only by the market refresh when the investing module is on.

export interface Bar {
  date: LocalDate;
  closeMicros: number;
}

export type FetchOutcome =
  | { kind: 'ok'; bars: Bar[]; currency: string | null; adjusted: boolean }
  /** The provider does not serve this listing on the free plan (403/404/unknown symbol). */
  | { kind: 'not_covered'; detail: string }
  /** Quota, rate limit or key problem: stop calling this provider until its daily reset. */
  | { kind: 'blocked'; detail: string }
  | { kind: 'error'; detail: string };

export interface DailyRequest {
  from: LocalDate;
  to: LocalDate;
  /** Upper bound on rows wanted (Twelve Data `outputsize`). */
  rows: number;
}

export interface MarketProvider {
  id: ProviderId;
  /** Calls the app allows itself per provider day: 80 % of the free limit (MARKET-DATA 7.2). */
  dailyBudget: number;
  perMinute: number;
  fetchDaily(symbol: string, req: DailyRequest): Promise<FetchOutcome>;
}

export type HttpFetch = typeof fetch;

/** App budgets per provider day (80 % of the free limit) and per minute, from docs/MARKET-DATA.md 7.2. */
export const PROVIDER_BUDGETS: Record<ProviderId, { dailyBudget: number; perMinute: number }> = {
  twelvedata: { dailyBudget: 640, perMinute: 6 },
  eodhd: { dailyBudget: 16, perMinute: 10 },
  fmp: { dailyBudget: 200, perMinute: 10 },
  alphavantage: { dailyBudget: 20, perMinute: 5 },
  finnhub: { dailyBudget: 300, perMinute: 30 },
};

type KeyEnv = Pick<Env, 'TWELVEDATA_API_KEY' | 'EODHD_API_KEY' | 'FMP_API_KEY' | 'ALPHAVANTAGE_API_KEY' | 'FINNHUB_API_KEY'>;

const KEY_OF: Record<ProviderId, keyof KeyEnv> = {
  twelvedata: 'TWELVEDATA_API_KEY',
  eodhd: 'EODHD_API_KEY',
  fmp: 'FMP_API_KEY',
  alphavantage: 'ALPHAVANTAGE_API_KEY',
  finnhub: 'FINNHUB_API_KEY',
};

/** Which providers have a key, without constructing any client. */
export function configuredProviders(e: KeyEnv): Set<ProviderId> {
  return new Set((Object.keys(KEY_OF) as ProviderId[]).filter((id) => !!e[KEY_OF[id]]));
}

const TIMEOUT_MS = 15_000;

async function getJson(http: HttpFetch, url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
  const res = await http(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function byStatus(status: number, detail: string): FetchOutcome {
  if (status === 401 || status === 402 || status === 429) return { kind: 'blocked', detail: `http ${status}${detail ? `: ${detail}` : ''}` };
  if (status === 403 || status === 404) return { kind: 'not_covered', detail: `http ${status}` };
  return { kind: 'error', detail: `http ${status}` };
}

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s);
const toNumber = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN);

function bars(rows: Array<{ date: unknown; close: unknown }>, req: DailyRequest): Bar[] {
  const out = new Map<string, Bar>();
  for (const r of rows) {
    const close = toNumber(r.close);
    if (!isDate(r.date) || !(close > 0)) continue;
    const date = r.date.slice(0, 10);
    if (date < req.from || date > req.to) continue;
    out.set(date, { date, closeMicros: toMicros(close) });
  }
  return [...out.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

async function guarded(run: () => Promise<FetchOutcome>): Promise<FetchOutcome> {
  try {
    return await run();
  } catch (err) {
    return { kind: 'error', detail: err instanceof Error ? err.name : 'error' };
  }
}

/** Twelve Data Basic: 800 credits/day, 8/min, 1 credit per symbol; reset at midnight UTC. US listings only. */
export function twelveData(key: string, http: HttpFetch): MarketProvider {
  return {
    id: 'twelvedata',
    ...PROVIDER_BUDGETS.twelvedata,
    fetchDaily: (symbol, req) =>
      guarded(async () => {
        const q = new URLSearchParams({ symbol, interval: '1day', start_date: req.from, end_date: req.to, outputsize: String(Math.min(req.rows, 5000)), order: 'asc' });
        const { status, body } = await getJson(http, `https://api.twelvedata.com/time_series?${q}`, { authorization: `apikey ${key}` });
        const b = body as { status?: string; code?: number; message?: string; meta?: { currency?: string }; values?: Array<{ datetime?: string; close?: string }> } | null;
        if (status !== 200) return byStatus(status, '');
        if (b?.status === 'error') {
          // "No data is available on the specified dates" comes back as 400 inside a 200.
          if (b.code === 400 && /no data/i.test(b.message ?? '')) return { kind: 'ok', bars: [], currency: null, adjusted: false };
          return b.code === 400 ? { kind: 'not_covered', detail: 'code 400' } : byStatus(b.code ?? 500, '');
        }
        return { kind: 'ok', bars: bars((b?.values ?? []).map((v) => ({ date: v.datetime, close: v.close })), req), currency: b?.meta?.currency ?? null, adjusted: false };
      }),
  };
}

/** EODHD free: 20 calls/day, 1 call per EOD request, 1 year of history; reset at midnight GMT. */
export function eodhd(key: string, http: HttpFetch): MarketProvider {
  return {
    id: 'eodhd',
    ...PROVIDER_BUDGETS.eodhd,
    fetchDaily: (symbol, req) =>
      guarded(async () => {
        const q = new URLSearchParams({ api_token: key, fmt: 'json', period: 'd', order: 'a', from: req.from, to: req.to });
        const { status, body } = await getJson(http, `https://eodhd.com/api/eod/${encodeURIComponent(symbol)}?${q}`);
        if (status !== 200) return byStatus(status, '');
        if (!Array.isArray(body)) return { kind: 'error', detail: 'unexpected body' };
        const rows = (body as Array<{ date?: string; close?: number; adjusted_close?: number }>).map((r) => ({ date: r.date, close: r.adjusted_close ?? r.close }));
        return { kind: 'ok', bars: bars(rows, req), currency: null, adjusted: true };
      }),
  };
}

/** Financial Modeling Prep Basic: 250 calls/day, end of day only, US listings per its own how-to page. */
export function fmp(key: string, http: HttpFetch): MarketProvider {
  return {
    id: 'fmp',
    ...PROVIDER_BUDGETS.fmp,
    fetchDaily: (symbol, req) =>
      guarded(async () => {
        const q = new URLSearchParams({ symbol, from: req.from, to: req.to, apikey: key });
        const { status, body } = await getJson(http, `https://financialmodelingprep.com/stable/historical-price-eod/light?${q}`);
        if (status !== 200) return status === 402 ? { kind: 'not_covered', detail: 'http 402' } : byStatus(status, '');
        if (!Array.isArray(body)) return { kind: 'error', detail: 'unexpected body' };
        const rows = (body as Array<{ date?: string; price?: number }>).map((r) => ({ date: r.date, close: r.price }));
        return { kind: 'ok', bars: bars(rows, req), currency: null, adjusted: false };
      }),
  };
}

/** Alpha Vantage free: 25 requests/day; `compact` = latest 100 daily points. Quota comes back as 200 + `Information`. */
export function alphaVantage(key: string, http: HttpFetch): MarketProvider {
  return {
    id: 'alphavantage',
    ...PROVIDER_BUDGETS.alphavantage,
    fetchDaily: (symbol, req) =>
      guarded(async () => {
        const q = new URLSearchParams({ function: 'TIME_SERIES_DAILY', symbol, outputsize: 'compact', apikey: key });
        const { status, body } = await getJson(http, `https://www.alphavantage.co/query?${q}`);
        if (status !== 200) return byStatus(status, '');
        const b = (body ?? {}) as Record<string, unknown>;
        if ('Error Message' in b) return { kind: 'not_covered', detail: 'error message' };
        const series = b['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
        if (!series) return { kind: 'blocked', detail: 'Information' in b || 'Note' in b ? 'quota or plan message' : 'no series' };
        const rows = Object.entries(series).map(([date, v]) => ({ date, close: v['4. close'] }));
        return { kind: 'ok', bars: bars(rows, req), currency: null, adjusted: false };
      }),
  };
}

/** Finnhub free `/quote`: the latest US close only (candles are premium), 60 calls/minute. */
export function finnhub(key: string, http: HttpFetch): MarketProvider {
  return {
    id: 'finnhub',
    ...PROVIDER_BUDGETS.finnhub,
    fetchDaily: (symbol, req) =>
      guarded(async () => {
        const { status, body } = await getJson(http, `https://finnhub.io/api/v1/quote?${new URLSearchParams({ symbol })}`, { 'x-finnhub-token': key });
        if (status !== 200) return byStatus(status, '');
        const b = (body ?? {}) as { c?: number; t?: number };
        if (!b.c || !b.t) return { kind: 'not_covered', detail: 'empty quote' };
        const date = toLocalDate(new Date(b.t * 1000), 'America/New_York');
        return { kind: 'ok', bars: bars([{ date, close: b.c }], req), currency: 'USD', adjusted: false };
      }),
  };
}

/** The providers that have a key in `.env`. Without keys the chain is empty and manual prices are the only source. */
export function createProviders(e: KeyEnv, http: HttpFetch): Map<ProviderId, MarketProvider> {
  const list: MarketProvider[] = [];
  if (e.TWELVEDATA_API_KEY) list.push(twelveData(e.TWELVEDATA_API_KEY, http));
  if (e.EODHD_API_KEY) list.push(eodhd(e.EODHD_API_KEY, http));
  if (e.FMP_API_KEY) list.push(fmp(e.FMP_API_KEY, http));
  if (e.ALPHAVANTAGE_API_KEY) list.push(alphaVantage(e.ALPHAVANTAGE_API_KEY, http));
  if (e.FINNHUB_API_KEY) list.push(finnhub(e.FINNHUB_API_KEY, http));
  return new Map(list.map((p) => [p.id, p]));
}
