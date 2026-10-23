import { METRICS, type Metric, type Metrics } from './metrics';

// Insights ranking (docs/PLAN.md section 6.6): every metric becomes a percentile within the universe (higher is
// better; volatility, drawdown and cost inverted) and the score is the weighted mean of the available percentiles.
// Deterministic: the same inputs always give the same order. A ranking of the past, never a forecast.

export type Weights = Record<Metric, number>;

export const DEFAULT_WEIGHTS: Weights = { r12m: 20, r6m: 15, r3m: 10, r1m: 5, riskAdjusted: 20, volatility: 10, drawdown: 10, trend: 5, cost: 5 };

const LOWER_IS_BETTER: ReadonlySet<Metric> = new Set(['volatility', 'drawdown', 'cost']);

export interface RankInput {
  key: string;
  symbol: string;
  metrics: Metrics;
}

export interface RankedRow extends RankInput {
  /** 0–100 per metric that has a value (and a weight above zero). */
  percentiles: Partial<Record<Metric, number>>;
  /** Weighted mean of the available percentiles, 0–100, rounded to 6 decimals; null when no metric is available. */
  score: number | null;
  /** Share of the total weight that had data, 0–1. */
  coverage: number;
  /** False when less than half of the weight had data: listed, never used in the split. */
  sufficient: boolean;
  /** 1-based position among the sufficient rows; null for the others. */
  rank: number | null;
}

/** Percentile of `v` among `values` (ties share the mid rank); 100 when it is the only value. */
function percentile(v: number, values: number[]): number {
  if (values.length === 1) return 100;
  let below = 0;
  let equal = 0;
  for (const x of values) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return ((below + (equal - 1) / 2) / (values.length - 1)) * 100;
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

export function rankUniverse(rows: RankInput[], weights: Weights): RankedRow[] {
  const active = METRICS.filter((m) => weights[m] > 0);
  const totalWeight = active.reduce((s, m) => s + weights[m], 0);
  const valuesOf = new Map<Metric, number[]>(
    active.map((m) => [m, rows.map((r) => r.metrics[m]).filter((v): v is number => v !== null).map((v) => (LOWER_IS_BETTER.has(m) ? -v : v))]),
  );

  const scored = rows.map((r) => {
    const percentiles: Partial<Record<Metric, number>> = {};
    let weighted = 0;
    let available = 0;
    for (const m of active) {
      const raw = r.metrics[m];
      if (raw === null) continue;
      const p = round6(percentile(LOWER_IS_BETTER.has(m) ? -raw : raw, valuesOf.get(m)!));
      percentiles[m] = p;
      weighted += weights[m] * p;
      available += weights[m];
    }
    const coverage = totalWeight > 0 ? available / totalWeight : 0;
    return {
      ...r,
      percentiles,
      score: available > 0 ? round6(weighted / available) : null,
      coverage,
      sufficient: available > 0 && available * 2 >= totalWeight,
      rank: null as number | null,
    };
  });

  // Ties break by lower volatility (unknown last), then symbol.
  const vol = (r: RankedRow) => r.metrics.volatility ?? Number.POSITIVE_INFINITY;
  scored.sort((a, b) => {
    if (a.sufficient !== b.sufficient) return a.sufficient ? -1 : 1;
    if (a.sufficient && a.score !== b.score) return b.score! - a.score!;
    if (a.sufficient && vol(a) !== vol(b)) return vol(a) - vol(b);
    return a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  let n = 0;
  for (const r of scored) if (r.sufficient) r.rank = ++n;
  return scored;
}
