import { PRICE_SCALE } from '@/lib/investing/instruments';

// Number formats for the investing screens: tabular figures are applied by the `num` class; signs use U+2212.

const minus = (s: string) => s.replace(/-/g, '−');

/** A ratio (0.0523) as a signed percentage with one decimal ("+5,2 %"). */
export function formatPct(ratio: number | null, loc: string, signed = true): string | null {
  if (ratio === null) return null;
  return `${minus(new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: signed ? 'exceptZero' : 'auto' }).format(ratio * 100))} %`;
}

/** A market price in its trading currency, 2 to 4 decimals. */
export function formatPrice(micros: number, currency: string, loc: string): string {
  return minus(new Intl.NumberFormat(loc, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(micros / PRICE_SCALE));
}

export function formatScore(score: number | null, loc: string): string {
  return score === null ? '—' : new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }).format(score);
}

export function formatBp(bp: number, loc: string): string {
  return new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(bp / 100);
}
