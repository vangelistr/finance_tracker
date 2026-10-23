import { allocate } from '@/lib/money';
import type { Region } from './instruments';

// Monthly split of the investing amount across the top-ranked instruments (docs/PLAN.md section 6.6), in integer
// cents. The lines plus the unallocated remainder always sum exactly to the amount. Educational, not advice.

export const RISK_PROFILES = ['conservative', 'balanced', 'growth'] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

/** Instruments used and the minimum core (broad-market ETF) share per profile. */
export const PROFILE_RULES: Record<RiskProfile, { topN: number; coreMinBp: number }> = {
  conservative: { topN: 3, coreMinBp: 8000 },
  balanced: { topN: 5, coreMinBp: 6000 },
  growth: { topN: 7, coreMinBp: 4000 },
};

export interface Guardrails {
  maxPerInstrumentBp: number;
  maxPerRegionBp: number;
  maxPerCurrencyBp: number;
  allowLeveraged: boolean;
  allowCrypto: boolean;
}

export const DEFAULT_GUARDRAILS: Guardrails = { maxPerInstrumentBp: 4000, maxPerRegionBp: 7000, maxPerCurrencyBp: 8000, allowLeveraged: false, allowCrypto: false };

// ---------- risk questionnaire ----------

export const QUESTIONS = {
  horizon: ['short', 'medium', 'long'],
  drawdown: ['reduce', 'keep', 'continue'],
  experience: ['none', 'some', 'years'],
} as const;

export type Answers = { [K in keyof typeof QUESTIONS]: (typeof QUESTIONS)[K][number] };

/**
 * Each answer scores 0, 1 or 2 by its position; 0–2 conservative, 3–4 balanced, 5–6 growth. A horizon under three
 * years is always conservative, because a short horizon leaves little time to recover from a fall (D-054).
 */
export function profileFromAnswers(a: Answers): { profile: RiskProfile; points: number } {
  const points = (Object.keys(QUESTIONS) as Array<keyof typeof QUESTIONS>).reduce((s, q) => s + (QUESTIONS[q] as readonly string[]).indexOf(a[q]), 0);
  if (a.horizon === 'short') return { profile: 'conservative', points };
  return { profile: points <= 2 ? 'conservative' : points <= 4 ? 'balanced' : 'growth', points };
}

// ---------- split ----------

export interface SplitCandidate {
  key: string;
  symbol: string;
  /** Position in the ranking (1 = top); null when the data were insufficient. */
  rank: number | null;
  score: number | null;
  core: boolean;
  region: Region;
  currency: string;
  leveraged: boolean;
  crypto: boolean;
}

export type Exclusion = 'insufficient_data' | 'leveraged' | 'crypto' | 'below_top_n';
export type CapKind = 'instrument' | 'region' | 'currency';

export interface SplitLine {
  key: string;
  symbol: string;
  rank: number;
  core: boolean;
  amountMinor: number;
  /** Caps this line or its group had reached when the split finished. */
  capped: CapKind[];
}

export interface SplitResult {
  amountMinor: number;
  profile: RiskProfile;
  topN: number;
  coreMinBp: number;
  coreTargetMinor: number;
  coreMinor: number;
  caps: { instrumentMinor: number; regionMinor: number; currencyMinor: number };
  lines: SplitLine[];
  unallocatedMinor: number;
  excluded: Array<{ key: string; symbol: string; reason: Exclusion }>;
  notes: Array<'no_core' | 'no_other' | 'core_short' | 'caps_reached' | 'nothing_eligible'>;
}

const capOf = (amount: number, bp: number) => Math.floor((amount * bp) / 10_000);
/** Score as weight, floored at 1 so every selected instrument receives a share. */
const weightOf = (c: SplitCandidate) => Math.max(c.score ?? 0, 1);

export function suggestSplit(i: { amountMinor: number; candidates: SplitCandidate[]; profile: RiskProfile; guardrails: Guardrails }): SplitResult {
  const A = Math.max(0, Math.trunc(i.amountMinor));
  const g = i.guardrails;
  const { topN, coreMinBp } = PROFILE_RULES[i.profile];
  const excluded: SplitResult['excluded'] = [];

  // 1. Eligible: sufficient data, no leverage or crypto unless enabled, the top N by rank.
  const ranked = [...i.candidates].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (a.symbol < b.symbol ? -1 : 1));
  const eligible: Array<SplitCandidate & { rank: number }> = [];
  for (const c of ranked) {
    const reason: Exclusion | null =
      c.rank === null ? 'insufficient_data' : c.leveraged && !g.allowLeveraged ? 'leveraged' : c.crypto && !g.allowCrypto ? 'crypto' : eligible.length >= topN ? 'below_top_n' : null;
    if (reason) excluded.push({ key: c.key, symbol: c.symbol, reason });
    else eligible.push(c as SplitCandidate & { rank: number });
  }

  const caps = { instrumentMinor: capOf(A, g.maxPerInstrumentBp), regionMinor: capOf(A, g.maxPerRegionBp), currencyMinor: capOf(A, g.maxPerCurrencyBp) };
  const alloc = new Map<string, number>(eligible.map((c) => [c.key, 0]));
  const byRegion = new Map<string, number>();
  const byCurrency = new Map<string, number>();
  const room = (c: SplitCandidate) =>
    Math.min(caps.instrumentMinor - alloc.get(c.key)!, caps.regionMinor - (byRegion.get(c.region) ?? 0), caps.currencyMinor - (byCurrency.get(c.currency) ?? 0));

  // Water-filling: split `amount` by score among the members with room, clip at the caps, and repeat with the
  // excess until it is placed or no member has room. Each round fills at least one cap, so it ends.
  const fill = (group: SplitCandidate[], amount: number): number => {
    let left = amount;
    while (left > 0) {
      const open = group.filter((c) => room(c) > 0);
      if (open.length === 0) break;
      const shares = allocate(left, open.map(weightOf));
      let given = 0;
      open.forEach((c, k) => {
        const give = Math.min(shares[k]!, room(c));
        if (give <= 0) return;
        alloc.set(c.key, alloc.get(c.key)! + give);
        byRegion.set(c.region, (byRegion.get(c.region) ?? 0) + give);
        byCurrency.set(c.currency, (byCurrency.get(c.currency) ?? 0) + give);
        given += give;
      });
      if (given === 0) break;
      left -= given;
    }
    return left;
  };

  // 2–3. The core share first (rounded up: "at least"), the rest to the other eligible instruments, and anything the
  // caps refused on one side offered to the other.
  const core = eligible.filter((c) => c.core);
  const other = eligible.filter((c) => !c.core);
  const coreTarget = core.length ? Math.min(A, Math.ceil((A * coreMinBp) / 10_000)) : 0;
  const coreLeft = fill(core, coreTarget);
  const otherLeft = fill(other, A - coreTarget + coreLeft);
  const unallocated = fill(core, otherLeft);

  const coreMinor = core.reduce((s, c) => s + alloc.get(c.key)!, 0);
  const lines: SplitLine[] = eligible.map((c) => {
    const capped: CapKind[] = [];
    if (alloc.get(c.key)! >= caps.instrumentMinor) capped.push('instrument');
    if ((byRegion.get(c.region) ?? 0) >= caps.regionMinor) capped.push('region');
    if ((byCurrency.get(c.currency) ?? 0) >= caps.currencyMinor) capped.push('currency');
    return { key: c.key, symbol: c.symbol, rank: c.rank, core: c.core, amountMinor: alloc.get(c.key)!, capped: A > 0 ? capped : [] };
  });

  const notes: SplitResult['notes'] = [];
  if (eligible.length === 0) notes.push('nothing_eligible');
  else {
    if (core.length === 0) notes.push('no_core');
    if (other.length === 0) notes.push('no_other');
    if (core.length > 0 && coreMinor < coreTarget) notes.push('core_short');
  }
  if (unallocated > 0 && eligible.length > 0) notes.push('caps_reached');

  return { amountMinor: A, profile: i.profile, topN, coreMinBp, coreTargetMinor: coreTarget, coreMinor, caps, lines, unallocatedMinor: unallocated, excluded, notes };
}
