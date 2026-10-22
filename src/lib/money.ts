// Money is always an integer number of minor units (cents). Never use floats for stored amounts.

export type Minor = number;

export const MAX_MINOR = 100_000_000_000; // 1 billion in a 2-decimal currency; well inside Number.MAX_SAFE_INTEGER

export function isMinor(value: unknown): value is Minor {
  return typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= MAX_MINOR;
}

export function assertMinor(value: number, label = 'amount'): Minor {
  if (!isMinor(value)) throw new RangeError(`${label} must be an integer number of minor units`);
  return value;
}

/**
 * Parses user input such as "12,50", "12.50", "1.234,56", "1,234.56" or "€ 7" into minor units.
 * A separator followed by one or two digits at the end is the decimal separator; any other
 * separator is a thousands separator. Returns null for anything that is not a plain amount.
 */
export function parseMoney(input: string): Minor | null {
  const cleaned = input.replace(/[\s  €$£]/g, '').replace(/−/g, '-');
  if (!/^-?[\d.,]+$/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const body = negative ? cleaned.slice(1) : cleaned;
  if (!/\d/.test(body)) return null;

  let integerPart = body;
  let fractionPart = '';
  const decimalMatch = /[.,](\d{1,2})$/.exec(body);
  if (decimalMatch) {
    integerPart = body.slice(0, decimalMatch.index);
    fractionPart = decimalMatch[1] ?? '';
    // The decimal separator cannot also be the thousands separator ("12,345,6").
    if (integerPart.includes(body.charAt(decimalMatch.index))) return null;
  }
  if (integerPart !== '' && !/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(integerPart)) return null;
  const digits = integerPart.replace(/[.,]/g, '') || '0';
  const minor = Number(digits) * 100 + Number(fractionPart.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) return null;
  return negative ? -minor : minor;
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, currency: string, signDisplay: Intl.NumberFormatOptions['signDisplay']) {
  const key = `${locale}|${currency}|${signDisplay}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: 'currency', currency, signDisplay });
    formatters.set(key, f);
  }
  return f;
}

/** Formats minor units for display, using a true minus sign (U+2212). */
export function formatMoney(
  minor: Minor,
  currency = 'EUR',
  locale = 'el-GR',
  options: { signDisplay?: Intl.NumberFormatOptions['signDisplay'] } = {},
): string {
  const text = formatter(locale, currency, options.signDisplay ?? 'auto').format(minor / 100);
  return text.replace(/-/g, '−');
}

/** Formats minor units as a plain decimal for input fields ("1234,50" in Greek, "1234.50" in English). */
export function toInputValue(minor: Minor, locale = 'el-GR'): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const sep = locale.startsWith('el') ? ',' : '.';
  return `${sign}${Math.floor(abs / 100)}${sep}${String(abs % 100).padStart(2, '0')}`;
}

/** Rate in basis points (1 % = 100 bps) applied to minor units, rounded half away from zero. */
export function applyBps(minor: Minor, bps: number): Minor {
  const raw = (minor * bps) / 10_000;
  return Math.sign(raw) * Math.round(Math.abs(raw));
}

/**
 * Splits `total` into integer parts proportional to `weights` (largest remainder method).
 * The parts always sum exactly to `total`. Ties in the remainder go to the earlier index.
 */
export function allocate(total: Minor, weights: readonly number[]): Minor[] {
  if (weights.length === 0) return [];
  if (weights.some((w) => !(w >= 0) || !Number.isFinite(w))) throw new RangeError('weights must be finite and >= 0');
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  if (sumWeights === 0) return weights.map((_, i) => (i === 0 ? total : 0));
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const exact = weights.map((w) => (abs * w) / sumWeights);
  const parts = exact.map((x) => Math.floor(x));
  let remainder = abs - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    const idx = order[k]!.i;
    parts[idx] = parts[idx]! + 1;
  }
  return parts.map((p) => p * sign);
}

export function sumMinor(values: readonly Minor[]): Minor {
  return values.reduce((a, b) => a + b, 0);
}
