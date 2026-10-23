import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataHeader, summarise } from '@/components/investing/data-header';
import { RankingView } from '@/components/investing/ranking';
import { SuggestionView } from '@/components/investing/suggestion';
import el from '@/i18n/messages/el.json';
import en from '@/i18n/messages/en.json';
import { computeMetrics } from '@/lib/investing/metrics';
import { DEFAULT_WEIGHTS, rankUniverse } from '@/lib/investing/ranking';
import { DEFAULT_GUARDRAILS, suggestSplit } from '@/lib/investing/split';
import type { InsightRow } from '@/server/services/investing';

// Brief 11f and the acceptance item "a test over the i18n strings finds no buy/sell or predictive wording", plus the
// view contract: every investing result shows the disclaimer, its inputs, the data timestamp, provider and staleness.

type Tree = { [k: string]: string | Tree };
function strings(tree: Tree, prefix = ''): Array<[string, string]> {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [[`${prefix}${k}`, v] as [string, string]] : strings(v, `${prefix}${k}.`)));
}

// Strings that may carry these words because they deny them: the two disclaimers. `status.projected` is the Greek
// calendar state "Προβλέπεται" (scheduled), used for goal amounts due, not for markets.
const ALLOWED = new Set(['disclaimers.investing', 'plan.disclaimer', 'status.projected']);
const BANNED = {
  en: /\b(buy|buying|bought|sell|selling|sold|predict\w*|forecast\w*|signals?|best|guarantee\w*|will (rise|grow|outperform))\b/i,
  el: /(αγοράστε|αγόρασε|αγοράζ|πούλ|πουλ|πώλησ|πωλήσ|πρόβλεψ|προβλέπ|προβλεπ|σήμα|καλύτερ|εγγυημ|θα ανέβ)/i,
};

describe('investing wording', () => {
  for (const [lang, messages] of [['en', en], ['el', el]] as const) {
    it(`${lang}: no message says buy, sell, predict, signal or best`, () => {
      const offending = strings(messages as unknown as Tree).filter(([key, text]) => !ALLOWED.has(key) && BANNED[lang].test(text));
      expect(offending).toEqual([]);
    });
  }

  it('keeps the full disclaimer in both languages', () => {
    expect(en.disclaimers.investing).toBe('Ranked by past-performance criteria; past performance does not predict future results; educational, not financial advice.');
    expect(el.disclaimers.investing).toMatch(/ιστορικής απόδοσης.*δεν προβλέπει μελλοντικά αποτελέσματα.*όχι οικονομική συμβουλή/);
  });
});

function render(node: ReactNode, locale: 'el' | 'en') {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'el' ? el : en} timeZone="Europe/Athens">
      {node}
    </NextIntlClientProvider>,
  );
  return html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/ | /g, ' ').replace(/\s+/g, ' ');
}

const series = (n: number, step: number) => Array.from({ length: n }, (_, i) => 100 * (1 + step) ** i + (i % 3));

function fixtureRows(): InsightRow[] {
  const inputs = [
    { symbol: 'VWCE', exchange: 'XETR' as const, currency: 'EUR', core: true, closes: series(300, 0.0008), source: 'eodhd' as const, lastDate: '2026-10-26', stale: false },
    { symbol: 'VT', exchange: 'ARCX' as const, currency: 'USD', core: true, closes: series(300, 0.0006), source: 'twelvedata' as const, lastDate: '2026-10-23', stale: true },
    { symbol: 'AAPL', exchange: 'XNAS' as const, currency: 'USD', core: false, closes: series(300, 0.001), source: 'twelvedata' as const, lastDate: '2026-10-26', stale: false },
    { symbol: 'IWDA', exchange: 'XAMS' as const, currency: 'EUR', core: true, closes: [101.5], source: 'manual' as const, lastDate: '2026-10-26', stale: false },
  ];
  const ranked = rankUniverse(inputs.map((x) => ({ key: `${x.symbol}:${x.exchange}`, symbol: x.symbol, metrics: computeMetrics(x.closes, x.symbol === 'AAPL' ? null : 20) })), DEFAULT_WEIGHTS);
  return ranked.map((r) => {
    const x = inputs.find((i) => i.symbol === r.symbol)!;
    return {
      ...r,
      item: {
        id: r.symbol,
        symbol: x.symbol,
        exchange: x.exchange,
        instrumentKey: r.key,
        name: `${x.symbol} fund`,
        isin: null,
        currency: x.currency,
        type: x.symbol === 'AAPL' ? 'stock' : 'etf',
        region: 'global',
        domicile: x.symbol === 'VT' ? 'US' : 'IE',
        terBps: 20,
        core: x.core,
        leveraged: false,
        crypto: false,
        providerSymbols: {},
        euRetailNote: x.symbol === 'VT',
      },
      points: x.closes.length,
      lastDate: x.lastDate,
      lastPriceMicros: Math.round(x.closes.at(-1)! * 1e6),
      lastEurMinor: Math.round((x.closes.at(-1)! / (x.currency === 'USD' ? 1.25 : 1)) * 100),
      source: x.source,
      fetchedAt: '2026-10-27T05:31:00.000Z',
      expectedDate: '2026-10-26',
      stale: x.stale,
    } satisfies InsightRow;
  });
}

describe('investing views', () => {
  const rows = fixtureRows();

  it('ranking shows the disclaimer, data dates, provider, staleness and the working of every score', () => {
    for (const locale of ['el', 'en'] as const) {
      const text = render(
        <>
          <DataHeader summary={summarise(rows, '2026-10-26')} />
          <RankingView rows={rows} weights={DEFAULT_WEIGHTS} currency="EUR" />
        </>,
        locale,
      );
      const m = locale === 'en' ? en : el;
      expect(text).toContain(m.disclaimers.investing.replace(/’/g, '’'));
      if (locale === 'en') {
        expect(text).toContain('Prices up to 26 October 2026');
        expect(text).toContain('EUR at the ECB rate of 26 October 2026');
        expect(text).toContain('1 quote is stale');
        expect(text).toContain('Twelve Data · 23 Oct 2026');
        expect(text).toContain('Stale: Missing the close of 26 Oct 2026');
        expect(text).toContain('Manual price · 26 Oct 2026');
        expect(text).toContain('May not be available to EU retail investors; check your broker.');
        expect(text).toContain('Not enough history to rank');
        expect(text).toContain('1 of 252 trading days');
      }
      // Each ranked row lists all nine figures with value, percentile and weight.
      for (const metric of Object.values(m.investing.metric)) expect(text).toContain(metric);
      expect(text.match(new RegExp(m.investing.why, 'g'))).toHaveLength(3);
    }
  });

  it('suggestion shows the amount source, rules, formula, lines that add up and exclusions', () => {
    const split = suggestSplit({
      amountMinor: 25_000,
      profile: 'balanced',
      guardrails: DEFAULT_GUARDRAILS,
      candidates: rows.map((r) => ({ key: r.key, symbol: r.symbol, rank: r.rank, score: r.score, core: r.item.core, region: r.item.region, currency: r.item.currency, leveraged: false, crypto: false })),
    });
    const text = render(
      <SuggestionView
        data={{ split, profile: { profile: 'balanced', source: 'questionnaire' }, guardrails: DEFAULT_GUARDRAILS, plan: { investingBp: 1000, investingMinor: 25_000, heldMinor: 0, baselineMinor: 250_000 }, names: Object.fromEntries(rows.map((r) => [r.key, r.item.name])) }}
        currency="EUR"
      />,
      'en',
    );
    expect(text).toContain('From the Smart Plan: 10 % of the baseline of €2,500.00.');
    expect(text).toContain('Balanced from your answers');
    expect(text).toContain('Top 5 ranked instruments, at least 60 % to broad-market ETFs (core), at most 40 % per instrument, 70 % per region and 80 % per currency.');
    expect(text).toContain(en.investing.suggestion.formula);
    expect(text).toContain('IWDA : not enough history');
    expect(split.lines.reduce((s, l) => s + l.amountMinor, 0) + split.unallocatedMinor).toBe(25_000);
    expect(text).toMatch(/Total 100\.0 % € 250\.00/);
  });
});
