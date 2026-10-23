// Instrument vocabulary for the investing module: exchanges, markets, regions, provider symbols and the starter
// watchlist (docs/MARKET-DATA.md sections 6 and 7). Pure data and helpers, shared by the server and the UI.

export const EXCHANGES = ['XNYS', 'XNAS', 'ARCX', 'XETR', 'XAMS', 'XPAR', 'XLON', 'XMIL', 'XSWX', 'OTHER'] as const;
export type Exchange = (typeof EXCHANGES)[number];

/** Provider routing groups: US-listed instruments have the most free coverage (MARKET-DATA 7.1). */
export type Market = 'us' | 'europe' | 'other';

export const EXCHANGE_INFO: Record<Exchange, { label: string; market: Market; timezone: string }> = {
  XNYS: { label: 'NYSE', market: 'us', timezone: 'America/New_York' },
  XNAS: { label: 'Nasdaq', market: 'us', timezone: 'America/New_York' },
  ARCX: { label: 'NYSE Arca', market: 'us', timezone: 'America/New_York' },
  XETR: { label: 'Xetra', market: 'europe', timezone: 'Europe/Berlin' },
  XAMS: { label: 'Euronext Amsterdam', market: 'europe', timezone: 'Europe/Amsterdam' },
  XPAR: { label: 'Euronext Paris', market: 'europe', timezone: 'Europe/Paris' },
  XLON: { label: 'London Stock Exchange', market: 'europe', timezone: 'Europe/London' },
  XMIL: { label: 'Borsa Italiana', market: 'europe', timezone: 'Europe/Rome' },
  XSWX: { label: 'SIX Swiss Exchange', market: 'europe', timezone: 'Europe/Zurich' },
  OTHER: { label: 'Other', market: 'other', timezone: 'UTC' },
};

export const REGIONS = ['global', 'us', 'europe', 'emerging', 'asia_pacific', 'other'] as const;
export type Region = (typeof REGIONS)[number];

export const INSTRUMENT_TYPES = ['etf', 'stock'] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

/** Trading currencies the FX feed converts (ECB reference rates, all present in Frankfurter). */
export const TRADING_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY'] as const;
export type TradingCurrency = (typeof TRADING_CURRENCIES)[number];

export const PROVIDERS = ['twelvedata', 'eodhd', 'fmp', 'alphavantage', 'finnhub'] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export type ProviderSymbols = Partial<Record<ProviderId, string>>;

export interface InstrumentRef {
  symbol: string;
  exchange: Exchange;
  providerSymbols?: ProviderSymbols;
}

/** Shared key of an instrument across users: the same listing shares one price history. */
export function instrumentKey(i: Pick<InstrumentRef, 'symbol' | 'exchange'>): string {
  return `${i.symbol.toUpperCase()}:${i.exchange}`;
}

export function marketOf(exchange: Exchange): Market {
  return EXCHANGE_INFO[exchange].market;
}

// Suffixes from the provider docs (MARKET-DATA 3.2 and 3.4). EODHD codes other than US, LSE and XETRA and every
// Alpha Vantage code are [uncertain] until the live check; a per-instrument override wins.
const EODHD_SUFFIX: Partial<Record<Exchange, string>> = {
  XNYS: 'US',
  XNAS: 'US',
  ARCX: 'US',
  XETR: 'XETRA',
  XAMS: 'AS',
  XPAR: 'PA',
  XLON: 'LSE',
  XMIL: 'MI',
  XSWX: 'SW',
};
const ALPHAVANTAGE_SUFFIX: Partial<Record<Exchange, string>> = { XLON: 'LON', XETR: 'DEX' };

/** The symbol to send to a provider, or null when the provider has no form for this listing. */
export function providerSymbol(i: InstrumentRef, provider: ProviderId): string | null {
  const override = i.providerSymbols?.[provider];
  if (override) return override;
  const symbol = i.symbol.toUpperCase();
  const us = marketOf(i.exchange) === 'us';
  switch (provider) {
    case 'twelvedata':
    case 'fmp':
    case 'finnhub':
      return us ? symbol : null;
    case 'eodhd': {
      const suffix = EODHD_SUFFIX[i.exchange];
      return suffix ? `${symbol}.${suffix}` : null;
    }
    case 'alphavantage': {
      if (us) return symbol;
      const suffix = ALPHAVANTAGE_SUFFIX[i.exchange];
      return suffix ? `${symbol}.${suffix}` : null;
    }
  }
}

/**
 * Provider chain per market (MARKET-DATA 7.1). Manual price entry is the last resort after the chain and is not a
 * provider. Finnhub's free `/quote` gives only the latest close, so it is the last automatic step for US listings.
 */
export function chainFor(exchange: Exchange): ProviderId[] {
  switch (marketOf(exchange)) {
    case 'us':
      return ['twelvedata', 'eodhd', 'fmp', 'alphavantage', 'finnhub'];
    case 'europe':
      return ['eodhd', 'alphavantage'];
    case 'other':
      return [];
  }
}

/** US-domiciled ETFs get a neutral availability note (brief 11a). */
export function needsEuRetailNote(i: { type: InstrumentType; domicile: string }): boolean {
  return i.type === 'etf' && i.domicile.toUpperCase() === 'US';
}

export interface StarterInstrument {
  symbol: string;
  exchange: Exchange;
  name: string;
  isin: string;
  currency: TradingCurrency;
  type: InstrumentType;
  region: Region;
  domicile: string;
  terBps: number | null;
  core: boolean;
}

/**
 * Educational starter list from docs/MARKET-DATA.md 6.1 (issuer pages read 2026-10-22). Not a recommendation. AGGH
 * (bonds) is left out of `core` so the core share stays with broad equity ETFs.
 */
export const STARTER_WATCHLIST: StarterInstrument[] = [
  { symbol: 'IWDA', exchange: 'XAMS', name: 'iShares Core MSCI World UCITS ETF USD (Acc)', isin: 'IE00B4L5Y983', currency: 'EUR', type: 'etf', region: 'global', domicile: 'IE', terBps: 20, core: true },
  { symbol: 'VWCE', exchange: 'XETR', name: 'Vanguard FTSE All-World UCITS ETF USD (Acc)', isin: 'IE00BK5BQT80', currency: 'EUR', type: 'etf', region: 'global', domicile: 'IE', terBps: 14, core: true },
  { symbol: 'SXR8', exchange: 'XETR', name: 'iShares Core S&P 500 UCITS ETF USD (Acc)', isin: 'IE00B5BMR087', currency: 'EUR', type: 'etf', region: 'us', domicile: 'IE', terBps: 7, core: true },
  { symbol: 'IS3N', exchange: 'XETR', name: 'iShares Core MSCI EM IMI UCITS ETF USD (Acc)', isin: 'IE00BKM4GZ66', currency: 'EUR', type: 'etf', region: 'emerging', domicile: 'IE', terBps: 18, core: false },
  { symbol: 'AGGH', exchange: 'XETR', name: 'iShares Core Global Aggregate Bond UCITS ETF EUR Hedged (Acc)', isin: 'IE00BDBRDM35', currency: 'EUR', type: 'etf', region: 'global', domicile: 'IE', terBps: 10, core: false },
  { symbol: 'VT', exchange: 'ARCX', name: 'Vanguard Total World Stock ETF', isin: 'US9220427424', currency: 'USD', type: 'etf', region: 'global', domicile: 'US', terBps: 6, core: true },
  { symbol: 'VTI', exchange: 'ARCX', name: 'Vanguard Morningstar Total Stock Market ETF', isin: 'US9229087690', currency: 'USD', type: 'etf', region: 'us', domicile: 'US', terBps: 3, core: true },
  { symbol: 'AAPL', exchange: 'XNAS', name: 'Apple Inc.', isin: 'US0378331005', currency: 'USD', type: 'stock', region: 'us', domicile: 'US', terBps: null, core: false },
  { symbol: 'MSFT', exchange: 'XNAS', name: 'Microsoft Corp.', isin: 'US5949181045', currency: 'USD', type: 'stock', region: 'us', domicile: 'US', terBps: null, core: false },
  { symbol: 'AMZN', exchange: 'XNAS', name: 'Amazon.com Inc.', isin: 'US0231351067', currency: 'USD', type: 'stock', region: 'us', domicile: 'US', terBps: null, core: false },
];

/** Universe guard (MARKET-DATA 7.3): warn above 30 instruments, block above 40. */
export const WATCHLIST_WARN = 30;
export const WATCHLIST_MAX = 40;

/** Prices are market data stored as integer millionths of the trading currency (D-052). */
export const PRICE_SCALE = 1_000_000;

export function toMicros(price: number): number {
  return Math.round(price * PRICE_SCALE);
}

/** Parses a decimal price typed by a person ("123,45" or "123.45") into micros; null when invalid or not positive. */
export function parsePrice(input: string): number | null {
  const s = input.trim().replace(/\s/g, '');
  if (!/^\d{1,9}([.,]\d{1,6})?$/.test(s)) return null;
  const micros = toMicros(Number(s.replace(',', '.')));
  return micros > 0 ? micros : null;
}
