// Past-performance metrics over daily closes (docs/PLAN.md section 6.6). Inputs are closes in the instrument's own
// currency, oldest first; every metric is null when the series is too short. These describe the past only.

export const METRICS = ['r1m', 'r3m', 'r6m', 'r12m', 'volatility', 'drawdown', 'trend', 'riskAdjusted', 'cost'] as const;
export type Metric = (typeof METRICS)[number];

export interface Metrics {
  r1m: number | null;
  r3m: number | null;
  r6m: number | null;
  r12m: number | null;
  /** Annualised standard deviation of daily log returns over the last 252 days. */
  volatility: number | null;
  /** Largest peak-to-trough fall over the last 252 days, as a positive fraction. */
  drawdown: number | null;
  /** close / 200-day simple moving average − 1. */
  trend: number | null;
  /** r12m / volatility. */
  riskAdjusted: number | null;
  /** Total expense ratio in basis points, entered by the user. */
  cost: number | null;
}

export const TRADING_DAYS = { r1m: 21, r3m: 63, r6m: 126, r12m: 252 } as const;
const YEAR = 252;
const MIN_RISK_POINTS = 60;
const SMA = 200;

function trailingReturn(closes: number[], n: number): number | null {
  if (closes.length < n + 1) return null;
  const last = closes[closes.length - 1]!;
  const past = closes[closes.length - 1 - n]!;
  return past > 0 ? last / past - 1 : null;
}

function volatility(closes: number[]): number | null {
  const window = closes.slice(-(YEAR + 1));
  const returns: number[] = [];
  for (let i = 1; i < window.length; i++) {
    if (window[i - 1]! > 0 && window[i]! > 0) returns.push(Math.log(window[i]! / window[i - 1]!));
  }
  if (returns.length < MIN_RISK_POINTS) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
  // A perfectly steady series leaves only floating-point noise; call it zero so risk-adjusted stays undefined.
  return variance < 1e-20 ? 0 : Math.sqrt(variance) * Math.sqrt(YEAR);
}

function maxDrawdown(closes: number[]): number | null {
  const window = closes.slice(-YEAR);
  if (window.length < MIN_RISK_POINTS) return null;
  let peak = window[0]!;
  let worst = 0;
  for (const c of window) {
    peak = Math.max(peak, c);
    if (peak > 0) worst = Math.max(worst, (peak - c) / peak);
  }
  return worst;
}

function trend(closes: number[]): number | null {
  if (closes.length < SMA) return null;
  const sma = closes.slice(-SMA).reduce((a, b) => a + b, 0) / SMA;
  return sma > 0 ? closes[closes.length - 1]! / sma - 1 : null;
}

export function computeMetrics(closes: number[], terBps: number | null): Metrics {
  const r12m = trailingReturn(closes, TRADING_DAYS.r12m);
  const vol = volatility(closes);
  return {
    r1m: trailingReturn(closes, TRADING_DAYS.r1m),
    r3m: trailingReturn(closes, TRADING_DAYS.r3m),
    r6m: trailingReturn(closes, TRADING_DAYS.r6m),
    r12m,
    volatility: vol,
    drawdown: maxDrawdown(closes),
    trend: trend(closes),
    riskAdjusted: r12m !== null && vol !== null && vol > 0 ? r12m / vol : null,
    cost: terBps,
  };
}
