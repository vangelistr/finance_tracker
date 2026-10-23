import { describe, expect, it } from 'vitest';
import { expectedLastClose, isStale, refreshSlot } from '@/lib/investing/calendar';
import { chainFor, instrumentKey, needsEuRetailNote, parsePrice, providerSymbol, STARTER_WATCHLIST } from '@/lib/investing/instruments';
import { computeMetrics, type Metrics } from '@/lib/investing/metrics';
import { DEFAULT_WEIGHTS, rankUniverse, type RankInput } from '@/lib/investing/ranking';
import { effectiveProfile, investingSettings } from '@/lib/investing/settings';
import { DEFAULT_GUARDRAILS, profileFromAnswers, suggestSplit, type SplitCandidate } from '@/lib/investing/split';

const empty: Metrics = { r1m: null, r3m: null, r6m: null, r12m: null, volatility: null, drawdown: null, trend: null, riskAdjusted: null, cost: null };

describe('metrics', () => {
  it('computes returns, trend and zero risk on a steady series', () => {
    const closes = Array.from({ length: 300 }, (_, i) => 100 * 1.001 ** i);
    const m = computeMetrics(closes, 20);
    expect(m.r1m).toBeCloseTo(1.001 ** 21 - 1, 10);
    expect(m.r3m).toBeCloseTo(1.001 ** 63 - 1, 10);
    expect(m.r6m).toBeCloseTo(1.001 ** 126 - 1, 10);
    expect(m.r12m).toBeCloseTo(1.001 ** 252 - 1, 10);
    expect(m.volatility).toBeCloseTo(0, 12);
    expect(m.drawdown).toBe(0);
    // SMA of the last 200 closes of a geometric series: last / mean − 1.
    const last200 = closes.slice(-200);
    expect(m.trend).toBeCloseTo(closes.at(-1)! / (last200.reduce((a, b) => a + b, 0) / 200) - 1, 10);
    expect(m.riskAdjusted).toBeNull(); // volatility 0
    expect(m.cost).toBe(20);
  });

  it('measures volatility and the largest fall', () => {
    // Alternating +1 % / −1 % moves around a fall from 120 to 90.
    const closes: number[] = [];
    for (let i = 0; i < 80; i++) closes.push(i % 2 ? 101 : 100);
    closes.push(120, 110, 90, 95, 100);
    const m = computeMetrics(closes, null);
    expect(m.drawdown).toBeCloseTo((120 - 90) / 120, 12);
    const returns = closes.slice(1).map((c, i) => Math.log(c / closes[i]!));
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const sd = Math.sqrt(returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1));
    expect(m.volatility).toBeCloseTo(sd * Math.sqrt(252), 12);
    expect(m.r12m).toBeNull();
    expect(m.trend).toBeNull();
  });

  it('returns null for every metric that lacks data', () => {
    expect(computeMetrics([], null)).toEqual(empty);
    const m = computeMetrics([100, 101, 102], null);
    expect(m).toEqual(empty);
    expect(computeMetrics(Array.from({ length: 22 }, () => 50), null).r1m).toBe(0);
  });
});

const row = (symbol: string, m: Partial<Metrics>): RankInput => ({ key: `${symbol}:XNAS`, symbol, metrics: { ...empty, ...m } });

describe('ranking', () => {
  it('scores by weighted percentiles with lower-is-better metrics inverted', () => {
    const ranked = rankUniverse(
      [row('A', { r12m: 0.1, volatility: 0.2 }), row('B', { r12m: 0.2, volatility: 0.3 }), row('C', { r12m: 0.3, volatility: 0.1 })],
      { ...DEFAULT_WEIGHTS, r6m: 0, r3m: 0, r1m: 0, riskAdjusted: 0, drawdown: 0, trend: 0, cost: 0, r12m: 2, volatility: 1 },
    );
    // r12m percentiles A 0, B 50, C 100; volatility (lower is better) A 50, B 0, C 100.
    expect(ranked.map((r) => [r.symbol, r.score, r.rank])).toEqual([
      ['C', 100, 1],
      ['B', round((2 * 50 + 0) / 3), 2],
      ['A', round((0 + 50) / 3), 3],
    ]);
    expect(ranked[2]!.percentiles).toEqual({ r12m: 0, volatility: 50 });
  });

  it('breaks ties by lower volatility, then symbol', () => {
    const w = { ...DEFAULT_WEIGHTS, r6m: 0, r3m: 0, r1m: 0, riskAdjusted: 0, drawdown: 0, trend: 0, cost: 0, volatility: 0, r12m: 1 };
    const ranked = rankUniverse([row('ZZ', { r12m: 0.1, volatility: 0.3 }), row('YY', { r12m: 0.1, volatility: 0.2 }), row('BB', { r12m: 0.1 }), row('AA', { r12m: 0.1 })], w);
    expect(ranked.map((r) => r.symbol)).toEqual(['YY', 'ZZ', 'AA', 'BB']);
    expect(ranked.every((r) => r.score === 50)).toBe(true);
  });

  it('lists instruments with less than half the weight as insufficient data, without a rank', () => {
    const ranked = rankUniverse(
      [row('FULL', { r1m: 0.01, r3m: 0.02, r6m: 0.03, r12m: 0.05, volatility: 0.2, drawdown: 0.1, trend: 0.02, riskAdjusted: 0.25, cost: 20 }), row('NEW', { r1m: 0.05, r3m: 0.1 }), row('NONE', {})],
      DEFAULT_WEIGHTS,
    );
    expect(ranked.map((r) => [r.symbol, r.sufficient, r.rank])).toEqual([
      ['FULL', true, 1],
      ['NEW', false, null],
      ['NONE', false, null],
    ]);
    expect(ranked[1]!.coverage).toBeCloseTo(15 / 100, 10);
    expect(ranked[2]!.score).toBeNull();
  });

  it('gives a single instrument the top percentile and is deterministic', () => {
    const input = [row('ONE', { r12m: -0.2, volatility: 0.4, drawdown: 0.3, r6m: -0.1, r3m: 0, r1m: 0.01, trend: -0.05, riskAdjusted: -0.5 })];
    const a = rankUniverse(input, DEFAULT_WEIGHTS);
    expect(a[0]!.score).toBe(100);
    expect(rankUniverse(input, DEFAULT_WEIGHTS)).toEqual(a);
  });
});

const round = (x: number) => Math.round(x * 1e6) / 1e6;

function cand(symbol: string, rank: number | null, extra: Partial<SplitCandidate> = {}): SplitCandidate {
  return { key: `${symbol}:XETR`, symbol, rank, score: rank === null ? null : 100 - rank * 10, core: false, region: 'global', currency: 'EUR', leveraged: false, crypto: false, ...extra };
}

const total = (r: ReturnType<typeof suggestSplit>) => r.lines.reduce((s, l) => s + l.amountMinor, 0) + r.unallocatedMinor;

describe('monthly split', () => {
  it('gives the core share first, splits by score and sums to the amount', () => {
    const r = suggestSplit({
      amountMinor: 50_000,
      profile: 'balanced',
      guardrails: DEFAULT_GUARDRAILS,
      candidates: [cand('C1', 1, { core: true, score: 90 }), cand('S1', 2, { score: 60, region: 'emerging' }), cand('C2', 3, { core: true, score: 30, region: 'us', currency: 'USD' })],
    });
    expect(total(r)).toBe(50_000);
    expect(r.coreTargetMinor).toBe(30_000);
    expect(r.coreMinor).toBeGreaterThanOrEqual(30_000);
    // 30 000 core split 90:30 = 22 500 / 7 500; 20 000 to the only other instrument (cap 40 % = 20 000).
    expect(r.lines.map((l) => [l.symbol, l.amountMinor])).toEqual([
      ['C1', 20_000],
      ['S1', 20_000],
      ['C2', 10_000],
    ]);
    // C1 wanted 22 500 but the 40 % instrument cap stops it at 20 000; the excess goes to C2.
    expect(r.lines[0]!.capped).toContain('instrument');
    expect(r.unallocatedMinor).toBe(0);
  });

  it('respects region and currency caps and reports what cannot be placed', () => {
    const r = suggestSplit({
      amountMinor: 10_000,
      profile: 'growth',
      guardrails: { ...DEFAULT_GUARDRAILS, maxPerInstrumentBp: 10_000, maxPerRegionBp: 5000, maxPerCurrencyBp: 6000 },
      candidates: [cand('A', 1, { region: 'us' }), cand('B', 2, { region: 'us' }), cand('C', 3, { region: 'europe' })],
    });
    expect(total(r)).toBe(10_000);
    const us = r.lines.filter((l) => l.symbol !== 'C').reduce((s, l) => s + l.amountMinor, 0);
    expect(us).toBeLessThanOrEqual(5000);
    expect(r.lines.reduce((s, l) => s + l.amountMinor, 0)).toBeLessThanOrEqual(6000); // all in EUR
    expect(r.unallocatedMinor).toBe(4000);
    expect(r.notes).toContain('caps_reached');
  });

  it('shows the whole amount as unallocated when caps are infeasible or nothing is eligible', () => {
    const infeasible = suggestSplit({ amountMinor: 999, profile: 'conservative', guardrails: { ...DEFAULT_GUARDRAILS, maxPerInstrumentBp: 1000 }, candidates: [cand('A', 1), cand('B', 2)] });
    expect(infeasible.lines.map((l) => l.amountMinor)).toEqual([99, 99]);
    expect(infeasible.unallocatedMinor).toBe(801);
    const none = suggestSplit({ amountMinor: 5000, profile: 'balanced', guardrails: DEFAULT_GUARDRAILS, candidates: [cand('X', null)] });
    expect(none.lines).toEqual([]);
    expect(none.unallocatedMinor).toBe(5000);
    expect(none.notes).toEqual(['nothing_eligible']);
    expect(none.excluded).toEqual([{ key: 'X:XETR', symbol: 'X', reason: 'insufficient_data' }]);
  });

  it('excludes leverage and crypto unless enabled, and keeps only the top N', () => {
    const candidates = [cand('LEV', 1, { leveraged: true }), cand('BTC', 2, { crypto: true }), cand('A', 3), cand('B', 4), cand('C', 5), cand('D', 6)];
    const r = suggestSplit({ amountMinor: 1000, profile: 'conservative', guardrails: { ...DEFAULT_GUARDRAILS, maxPerInstrumentBp: 10_000, maxPerRegionBp: 10_000, maxPerCurrencyBp: 10_000 }, candidates });
    expect(r.lines.map((l) => l.symbol)).toEqual(['A', 'B', 'C']);
    expect(r.excluded.map((e) => [e.symbol, e.reason])).toEqual([
      ['LEV', 'leveraged'],
      ['BTC', 'crypto'],
      ['D', 'below_top_n'],
    ]);
    const allowed = suggestSplit({ amountMinor: 1000, profile: 'conservative', guardrails: { ...DEFAULT_GUARDRAILS, allowLeveraged: true, allowCrypto: true }, candidates });
    expect(allowed.lines.map((l) => l.symbol)).toEqual(['LEV', 'BTC', 'A']);
  });

  it('hands out the remaining cents by score order and handles zero', () => {
    const r = suggestSplit({ amountMinor: 101, profile: 'growth', guardrails: { ...DEFAULT_GUARDRAILS, maxPerInstrumentBp: 10_000, maxPerRegionBp: 10_000, maxPerCurrencyBp: 10_000 }, candidates: [cand('A', 1, { score: 50 }), cand('B', 2, { score: 50 })] });
    expect(r.lines.map((l) => l.amountMinor)).toEqual([51, 50]);
    const zero = suggestSplit({ amountMinor: 0, profile: 'growth', guardrails: DEFAULT_GUARDRAILS, candidates: [cand('A', 1)] });
    expect(zero.lines.map((l) => l.amountMinor)).toEqual([0]);
    expect(zero.unallocatedMinor).toBe(0);
  });

  it('property: always sums to the amount and never breaks a cap (5 000 random cases)', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
    const regions = ['global', 'us', 'europe', 'emerging'] as const;
    const currencies = ['EUR', 'USD', 'GBP'];
    for (let n = 0; n < 5000; n++) {
      const count = Math.floor(rand() * 9);
      const candidates = Array.from({ length: count }, (_, k) =>
        cand(`I${k}`, rand() < 0.15 ? null : k + 1, {
          score: Math.round(rand() * 100),
          core: rand() < 0.5,
          region: regions[Math.floor(rand() * regions.length)]!,
          currency: currencies[Math.floor(rand() * currencies.length)]!,
          leveraged: rand() < 0.1,
        }),
      );
      const guardrails = { ...DEFAULT_GUARDRAILS, maxPerInstrumentBp: 500 + Math.floor(rand() * 9500), maxPerRegionBp: 500 + Math.floor(rand() * 9500), maxPerCurrencyBp: 500 + Math.floor(rand() * 9500) };
      const amountMinor = Math.floor(rand() * 2_000_000);
      const profile = (['conservative', 'balanced', 'growth'] as const)[n % 3]!;
      const r = suggestSplit({ amountMinor, profile, guardrails, candidates });
      expect(total(r)).toBe(amountMinor);
      expect(r.lines.every((l) => l.amountMinor >= 0 && l.amountMinor <= r.caps.instrumentMinor)).toBe(true);
      const sumBy = (f: (c: SplitCandidate) => string) => {
        const m = new Map<string, number>();
        for (const l of r.lines) {
          const c = candidates.find((x) => x.key === l.key)!;
          m.set(f(c), (m.get(f(c)) ?? 0) + l.amountMinor);
        }
        return [...m.values()];
      };
      expect(sumBy((c) => c.region).every((v) => v <= r.caps.regionMinor)).toBe(true);
      expect(sumBy((c) => c.currency).every((v) => v <= r.caps.currencyMinor)).toBe(true);
      expect(r.lines.length).toBeLessThanOrEqual(r.topN);
    }
  });
});

describe('risk profile', () => {
  it('maps the questionnaire to a profile and keeps short horizons cautious', () => {
    expect(profileFromAnswers({ horizon: 'long', drawdown: 'continue', experience: 'years' })).toEqual({ profile: 'growth', points: 6 });
    expect(profileFromAnswers({ horizon: 'medium', drawdown: 'keep', experience: 'some' })).toEqual({ profile: 'balanced', points: 3 });
    expect(profileFromAnswers({ horizon: 'medium', drawdown: 'reduce', experience: 'none' }).profile).toBe('conservative');
    expect(profileFromAnswers({ horizon: 'short', drawdown: 'continue', experience: 'years' }).profile).toBe('conservative');
  });

  it('uses the cautious profile until answered, and an override wins', () => {
    expect(effectiveProfile(investingSettings(undefined))).toEqual({ profile: 'conservative', source: 'default' });
    expect(effectiveProfile(investingSettings({ answers: { horizon: 'long', drawdown: 'continue', experience: 'years' } }))).toEqual({ profile: 'growth', source: 'questionnaire' });
    expect(effectiveProfile(investingSettings({ answers: { horizon: 'long', drawdown: 'continue', experience: 'years' }, profileOverride: 'balanced' })).source).toBe('override');
  });
});

describe('exchange calendar', () => {
  const at = (iso: string) => new Date(iso);

  it('expects the previous US session, skipping weekends and NYSE holidays', () => {
    // Monday 2026-10-26 07:30 Athens (EET after 25 Oct) = 00:30 New York (still EDT): Friday's bar is due.
    expect(expectedLastClose('XNAS', at('2026-10-26T05:30:00Z'))).toBe('2026-10-23');
    // Saturday after Good Friday 2026-04-03: Thursday's close.
    expect(expectedLastClose('ARCX', at('2026-04-04T06:00:00Z'))).toBe('2026-04-02');
    // Friday 2026-11-27 morning in Athens: Thanksgiving (26th) was closed, so Wednesday.
    expect(expectedLastClose('XNYS', at('2026-11-27T05:30:00Z'))).toBe('2026-11-25');
    // Before midnight in New York the same day's bar is not yet expected.
    expect(expectedLastClose('XNYS', at('2026-10-22T03:00:00Z'))).toBe('2026-10-20');
  });

  it('uses the exchange time zone and Euronext holidays', () => {
    expect(expectedLastClose('XAMS', at('2026-04-07T06:00:00Z'))).toBe('2026-04-02'); // Good Friday and Easter Monday closed
    expect(expectedLastClose('XETR', at('2026-04-07T06:00:00Z'))).toBe('2026-04-06'); // Xetra list not read: weekdays only
  });

  it('marks a quote stale after one missed expected close', () => {
    const now = at('2026-10-23T05:00:00Z');
    expect(isStale('2026-10-22', 'XNAS', now)).toBe(false);
    expect(isStale('2026-10-21', 'XNAS', now)).toBe(true);
    expect(isStale(null, 'XNAS', now)).toBe(true);
  });

  it('assigns refresh slots at 07:30 and 12:30 Athens across the DST change', () => {
    expect(refreshSlot(at('2026-10-24T04:29:00Z'))).toEqual({ key: '2026-10-23T12:30', retry: true }); // 07:29 EEST
    expect(refreshSlot(at('2026-10-24T04:30:00Z'))).toEqual({ key: '2026-10-24T07:30', retry: false });
    expect(refreshSlot(at('2026-10-24T09:30:00Z'))).toEqual({ key: '2026-10-24T12:30', retry: true });
    expect(refreshSlot(at('2026-10-26T05:30:00Z'))).toEqual({ key: '2026-10-26T07:30', retry: false }); // 07:30 EET
    expect(refreshSlot(at('2026-10-26T05:29:00Z')).key).toBe('2026-10-25T12:30');
  });
});

describe('instruments', () => {
  it('builds provider symbols and per-market chains', () => {
    const vwce = { symbol: 'vwce', exchange: 'XETR' as const };
    expect(instrumentKey(vwce)).toBe('VWCE:XETR');
    expect(providerSymbol(vwce, 'eodhd')).toBe('VWCE.XETRA');
    expect(providerSymbol(vwce, 'twelvedata')).toBeNull();
    expect(providerSymbol(vwce, 'alphavantage')).toBe('VWCE.DEX');
    expect(providerSymbol({ symbol: 'AAPL', exchange: 'XNAS' }, 'eodhd')).toBe('AAPL.US');
    expect(providerSymbol({ symbol: 'IWDA', exchange: 'XAMS', providerSymbols: { eodhd: 'IWDA.AS' } }, 'eodhd')).toBe('IWDA.AS');
    expect(chainFor('ARCX')).toEqual(['twelvedata', 'eodhd', 'fmp', 'alphavantage', 'finnhub']);
    expect(chainFor('XAMS')).toEqual(['eodhd', 'alphavantage']);
    expect(chainFor('OTHER')).toEqual([]);
  });

  it('notes US-domiciled ETFs only, and the starter list is diversified', () => {
    expect(STARTER_WATCHLIST.filter(needsEuRetailNote).map((i) => i.symbol)).toEqual(['VT', 'VTI']);
    expect(new Set(STARTER_WATCHLIST.map((i) => i.region)).size).toBeGreaterThanOrEqual(3);
    expect(STARTER_WATCHLIST.some((i) => i.core)).toBe(true);
    expect(new Set(STARTER_WATCHLIST.map(instrumentKey)).size).toBe(STARTER_WATCHLIST.length);
  });

  it('parses typed prices into micros', () => {
    expect(parsePrice('123,45')).toBe(123_450_000);
    expect(parsePrice('0.000001')).toBe(1);
    expect(parsePrice('0')).toBeNull();
    expect(parsePrice('-1')).toBeNull();
    expect(parsePrice('1e5')).toBeNull();
  });
});
