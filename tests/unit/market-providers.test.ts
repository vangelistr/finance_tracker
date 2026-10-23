import { describe, expect, it } from 'vitest';
import { alphaVantage, configuredProviders, createProviders, eodhd, finnhub, fmp, twelveData, type HttpFetch } from '@/server/market/providers';
import { fetchEcbRates, toEurMinor } from '@/server/market/fx';

// Response parsing and error mapping for each adapter, with recorded request URLs. Response shapes follow
// docs/MARKET-DATA.md (demo-key calls of 2026-10-22); no network is used.

function fake(status: number, body: unknown, seen: Array<{ url: string; headers: Record<string, string> }> = []): HttpFetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), headers: Object.fromEntries(new Headers(init?.headers).entries()) });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as HttpFetch;
}

const req = { from: '2026-10-19', to: '2026-10-23', rows: 15 };

describe('Twelve Data', () => {
  it('parses time_series and sends only the symbol, dates and the key header', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const body = { meta: { symbol: 'AAPL', currency: 'USD' }, values: [{ datetime: '2026-10-21', close: '262.82' }, { datetime: '2026-10-22', close: '264.10' }, { datetime: '2026-10-10', close: '1' }], status: 'ok' };
    const out = await twelveData('k', fake(200, body, seen)).fetchDaily('AAPL', req);
    expect(out).toEqual({ kind: 'ok', bars: [{ date: '2026-10-21', closeMicros: 262_820_000 }, { date: '2026-10-22', closeMicros: 264_100_000 }], currency: 'USD', adjusted: false });
    const url = new URL(seen[0]!.url);
    expect(url.origin + url.pathname).toBe('https://api.twelvedata.com/time_series');
    expect([...url.searchParams.keys()].sort()).toEqual(['end_date', 'interval', 'order', 'outputsize', 'start_date', 'symbol']);
    expect(seen[0]!.headers.authorization).toBe('apikey k');
  });

  it('maps errors inside a 200 and HTTP codes', async () => {
    expect((await twelveData('k', fake(200, { code: 429, message: 'API request limit reached', status: 'error' })).fetchDaily('AAPL', req)).kind).toBe('blocked');
    expect((await twelveData('k', fake(200, { code: 400, message: 'symbol not found', status: 'error' })).fetchDaily('X', req)).kind).toBe('not_covered');
    expect(await twelveData('k', fake(200, { code: 400, message: 'No data is available on the specified dates', status: 'error' })).fetchDaily('X', req)).toEqual({ kind: 'ok', bars: [], currency: null, adjusted: false });
    expect((await twelveData('k', fake(403, {})).fetchDaily('X', req)).kind).toBe('not_covered');
    expect((await twelveData('k', fake(500, 'oops')).fetchDaily('X', req)).kind).toBe('error');
    const throwing = (async () => {
      throw new TypeError('fetch failed');
    }) as HttpFetch;
    expect(await twelveData('k', throwing).fetchDaily('X', req)).toEqual({ kind: 'error', detail: 'TypeError' });
  });
});

describe('EODHD', () => {
  it('uses the adjusted close and maps 402 and 403', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const out = await eodhd('k', fake(200, [{ date: '2026-10-21', open: 1, close: 379.15, adjusted_close: 378.5 }], seen)).fetchDaily('VTI.US', req);
    expect(out).toEqual({ kind: 'ok', bars: [{ date: '2026-10-21', closeMicros: 378_500_000 }], currency: null, adjusted: true });
    expect(seen[0]!.url).toMatch(/^https:\/\/eodhd\.com\/api\/eod\/VTI\.US\?/);
    expect((await eodhd('k', fake(402, 'API Rate Limit Exceeded')).fetchDaily('VTI.US', req)).kind).toBe('blocked');
    expect((await eodhd('k', fake(403, '<html>Forbidden</html>')).fetchDaily('VWCE.XETRA', req)).kind).toBe('not_covered');
  });
});

describe('FMP, Alpha Vantage, Finnhub', () => {
  it('parses each shape', async () => {
    expect(await fmp('k', fake(200, [{ symbol: 'AAPL', date: '2026-10-22', price: 264.1, volume: 1 }])).fetchDaily('AAPL', req)).toMatchObject({ kind: 'ok', bars: [{ date: '2026-10-22', closeMicros: 264_100_000 }] });
    expect((await fmp('k', fake(402, {})).fetchDaily('AAPL', req)).kind).toBe('not_covered');
    const av = { 'Meta Data': {}, 'Time Series (Daily)': { '2026-10-22': { '4. close': '250.5000' }, '2026-10-21': { '4. close': '249.0' } } };
    expect(await alphaVantage('k', fake(200, av)).fetchDaily('IBM', req)).toMatchObject({ kind: 'ok', bars: [{ date: '2026-10-21' }, { date: '2026-10-22', closeMicros: 250_500_000 }] });
    expect((await alphaVantage('k', fake(200, { Information: 'rate limit' })).fetchDaily('IBM', req)).kind).toBe('blocked');
    expect((await alphaVantage('k', fake(200, { 'Error Message': 'Invalid API call' })).fetchDaily('NOPE', req)).kind).toBe('not_covered');
    // 1792785600 = 2026-10-23T20:00:00Z = 16:00 New York.
    expect(await finnhub('k', fake(200, { c: 264.1, pc: 262.8, t: 1792785600 })).fetchDaily('AAPL', { ...req, to: '2026-10-30' })).toMatchObject({ kind: 'ok', bars: [{ closeMicros: 264_100_000 }], currency: 'USD' });
    expect((await finnhub('k', fake(200, { c: 0, t: 0 })).fetchDaily('NOPE', req)).kind).toBe('not_covered');
  });

  it('constructs only providers whose key is present', () => {
    const none = { TWELVEDATA_API_KEY: undefined, EODHD_API_KEY: undefined, FMP_API_KEY: undefined, ALPHAVANTAGE_API_KEY: undefined, FINNHUB_API_KEY: undefined };
    expect(createProviders(none, fake(200, {})).size).toBe(0);
    expect([...configuredProviders({ ...none, EODHD_API_KEY: 'x' })]).toEqual(['eodhd']);
  });
});

describe('FX', () => {
  it('reads ECB rates from v2 and converts to euro cents', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const http = fake(200, [{ date: '2026-10-21', base: 'EUR', quote: 'USD', rate: 1.1234 }, { date: '2026-10-21', base: 'EUR', quote: 'GBP', rate: 0.83825 }], seen);
    expect(await fetchEcbRates('https://api.frankfurter.dev', http)).toEqual({ date: '2026-10-21', rates: { USD: 1.1234, GBP: 0.83825 } });
    expect(seen[0]!.url).toBe('https://api.frankfurter.dev/v2/rates?providers=ECB&base=EUR&quotes=USD%2CGBP%2CCHF%2CJPY');
    expect(toEurMinor(112_340_000, 'USD', { rates: { USD: 1.1234 } })).toBe(10_000);
    expect(toEurMinor(50_000_000, 'EUR', null)).toBe(5_000);
    expect(toEurMinor(50_000_000, 'CHF', { rates: {} })).toBeNull();
  });
});
