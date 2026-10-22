import { monthsBetween, type Month } from './dates';

// Smart Plan: the allocation rule from docs/allocation-methodology.md section 3, as deterministic pure functions on
// integer cents. Every result carries the numbers it was built from so the UI can show the working. Educational,
// not financial advice.

type Cents = number;
type Bp = number;

export type Mode = 'normal' | 'squeeze' | 'deficit';
export type Profile = 'fixed' | 'irregular';
export type Confidence = 'none' | 'provisional' | 'partial' | 'full';

export interface PlanSettings {
  baselineWindowMonths: number;
  essentialsWindowMonths: number;
  discretionaryBp: Bp;
  investingBp: Bp;
  minSavingsBp: Bp;
  essentialsBpOverride: Bp | null;
  efMonthsFixed: number;
  efMonthsIrregular: number;
  efMonthsOverride: number | null;
  efGateMonths: number;
  investWhileEfUnfunded: boolean;
  irregularShareBp: Bp;
  profileOverride: Profile | null;
  manualVariableBaselineMinor: Cents | null;
  surplusDiscretionaryBp: Bp;
}

export const DEFAULT_PLAN_SETTINGS: PlanSettings = {
  baselineWindowMonths: 6,
  essentialsWindowMonths: 3,
  discretionaryBp: 3000,
  investingBp: 1000,
  minSavingsBp: 500,
  essentialsBpOverride: null,
  efMonthsFixed: 3,
  efMonthsIrregular: 6,
  efMonthsOverride: null,
  efGateMonths: 3,
  investWhileEfUnfunded: false,
  irregularShareBp: 2500,
  profileOverride: null,
  manualVariableBaselineMinor: null,
  surplusDiscretionaryBp: 1000,
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
/** Half up for non-negative values (averages, monthly equivalents). */
const roundHalfUp = (x: number) => Math.floor(x + 0.5);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : roundHalfUp((s[mid - 1]! + s[mid]!) / 2);
};

// ---------- 3.1 baseline ----------

export interface BaselineInput {
  fixedMonthlyEquivalents: Cents[];
  /** Counted months of recurring_variable income, oldest first (at most the window). */
  variableMonths: Array<{ month: Month; totalMinor: Cents }>;
  manualVariableBaselineMinor: Cents | null;
}

export interface BaselineResult {
  fixedMinor: Cents;
  variableMinor: Cents;
  baselineMinor: Cents;
  method: 'min' | 'manual' | 'none';
  monthsUsed: number;
  confidence: Confidence;
  lowestMonth: Month | null;
  medianMinor: Cents | null;
  meanMinor: Cents | null;
}

export function computeBaseline(i: BaselineInput): BaselineResult {
  const fixed = sum(i.fixedMonthlyEquivalents);
  const totals = i.variableMonths.map((m) => Math.max(0, m.totalMinor));
  const n = totals.length;
  let variable = 0;
  let method: BaselineResult['method'] = 'none';
  let lowestMonth: Month | null = null;
  if (i.manualVariableBaselineMinor !== null) {
    variable = i.manualVariableBaselineMinor;
    method = 'manual';
  } else if (n > 0) {
    variable = Math.min(...totals);
    method = 'min';
    lowestMonth = i.variableMonths[totals.indexOf(variable)]!.month;
  }
  return {
    fixedMinor: fixed,
    variableMinor: variable,
    baselineMinor: fixed + variable,
    method,
    monthsUsed: n,
    confidence: n === 0 ? 'none' : n < 3 ? 'provisional' : n < 6 ? 'partial' : 'full',
    lowestMonth,
    medianMinor: n ? median(totals) : null,
    meanMinor: n ? roundHalfUp(sum(totals) / n) : null,
  };
}

// ---------- 3.2 essentials ----------

export interface EssentialsInput {
  fixedEssentialMonthly: Array<{ name: string; monthlyMinor: Cents }>;
  categories: Array<{ categoryId: string; name: string; monthTotals: Cents[]; budgetMonthlyMinor: Cents | null }>;
}

export interface EssentialsResult {
  fixedMinor: Cents;
  variableMinor: Cents;
  totalMinor: Cents;
  rows: Array<{ categoryId: string; name: string; averageMinor: Cents; budgetMinor: Cents | null; usedMinor: Cents }>;
}

export function computeEssentials(i: EssentialsInput): EssentialsResult {
  const fixed = sum(i.fixedEssentialMonthly.map((f) => f.monthlyMinor));
  const rows = i.categories.map((c) => {
    const t = c.monthTotals.map((x) => Math.max(0, x));
    const average = t.length ? roundHalfUp(sum(t) / t.length) : 0;
    return { categoryId: c.categoryId, name: c.name, averageMinor: average, budgetMinor: c.budgetMonthlyMinor, usedMinor: Math.max(average, c.budgetMonthlyMinor ?? 0) };
  });
  const variable = sum(rows.map((r) => r.usedMinor));
  return { fixedMinor: fixed, variableMinor: variable, totalMinor: fixed + variable, rows };
}

// ---------- 3.3 profile and emergency fund ----------

export interface ProfileInput {
  receivedFixed6: Cents;
  receivedVariable6: Cents;
  receivedOneTime6: Cents;
  hasActiveFixedSource: boolean;
}

export function incomeProfile(i: ProfileInput, s: PlanSettings): { profile: Profile; irregularShareBp: Bp | null } {
  const total = i.receivedFixed6 + i.receivedVariable6 + i.receivedOneTime6;
  const share = total > 0 ? Math.floor(((i.receivedVariable6 + i.receivedOneTime6) * 10000) / total) : null;
  if (s.profileOverride) return { profile: s.profileOverride, irregularShareBp: share };
  if (share === null) return { profile: i.hasActiveFixedSource ? 'fixed' : 'irregular', irregularShareBp: null };
  return { profile: share >= s.irregularShareBp ? 'irregular' : 'fixed', irregularShareBp: share };
}

export interface EmergencyFund {
  months: number;
  formulaMinor: Cents;
  targetMinor: Cents;
  savedMinor: Cents;
  needMinor: Cents;
  gateMinor: Cents;
}

export function emergencyFund(essentials: Cents, profile: Profile, goalTarget: Cents | null, saved: Cents, s: PlanSettings): EmergencyFund {
  const months = s.efMonthsOverride ?? (profile === 'irregular' ? s.efMonthsIrregular : s.efMonthsFixed);
  const formula = months * essentials;
  const target = goalTarget && goalTarget > 0 ? goalTarget : formula;
  return {
    months,
    formulaMinor: formula,
    targetMinor: target,
    savedMinor: saved,
    needMinor: Math.max(0, target - saved),
    gateMinor: Math.min(s.efGateMonths * essentials, target),
  };
}

// ---------- 3.4 split ----------

export interface Split {
  essentialsMinor: Cents;
  discretionaryMinor: Cents;
  savingsMinor: Cents;
  investingMinor: Cents;
  mode: Mode;
  shortfallMinor: Cents;
  gateOpen: boolean;
  investingHeldMinor: Cents;
  wanted: { discretionaryMinor: Cents; investingMinor: Cents; savingsFloorMinor: Cents };
}

export function splitBaseline(i: { baselineMinor: Cents; essentialsMinor: Cents; efSavedMinor: Cents; efGateMinor: Cents; settings: PlanSettings }): Split {
  const B = i.baselineMinor;
  const s = i.settings;
  const gateOpen = s.investWhileEfUnfunded || i.efSavedMinor >= i.efGateMinor;
  if (B <= 0) {
    return {
      essentialsMinor: 0,
      discretionaryMinor: 0,
      savingsMinor: 0,
      investingMinor: 0,
      mode: 'deficit',
      shortfallMinor: Math.max(0, i.essentialsMinor),
      gateOpen,
      investingHeldMinor: 0,
      wanted: { discretionaryMinor: 0, investingMinor: 0, savingsFloorMinor: 0 },
    };
  }
  const bp = (x: Bp) => Math.floor((B * x) / 10000);
  const E = s.essentialsBpOverride !== null ? Math.min(bp(s.essentialsBpOverride), B) : Math.min(i.essentialsMinor, B);
  const shortfall = s.essentialsBpOverride !== null ? 0 : i.essentialsMinor - E;
  const R = B - E;
  const Dw = bp(s.discretionaryBp);
  const Iw = bp(s.investingBp);
  const Sf = Math.min(R, bp(s.minSavingsBp));
  const run = (open: boolean) => {
    const Ie = open ? Iw : 0;
    if (R - Dw - Ie >= Sf) return { D: Dw, I: Ie, S: R - Dw - Ie, squeeze: false };
    const rest = R - Sf;
    const D = Math.min(Dw, rest);
    const I = Math.min(Ie, rest - D);
    return { D, I, S: R - D - I, squeeze: true };
  };
  const a = run(gateOpen);
  const withGateOpen = run(true);
  const deficit = s.essentialsBpOverride === null && i.essentialsMinor >= B;
  return {
    essentialsMinor: E,
    discretionaryMinor: a.D,
    savingsMinor: a.S,
    investingMinor: a.I,
    mode: deficit ? 'deficit' : a.squeeze ? 'squeeze' : 'normal',
    shortfallMinor: shortfall,
    gateOpen,
    investingHeldMinor: Math.max(0, a.S - withGateOpen.S),
    wanted: { discretionaryMinor: Dw, investingMinor: Iw, savingsFloorMinor: Sf },
  };
}

// ---------- 3.6 savings routing ----------

export interface PlanGoal {
  id: string;
  name: string;
  targetMinor: Cents;
  savedMinor: Cents;
  deadline: Month | null;
  priority: number;
  isEmergencyFund: boolean;
  createdSeq: number;
}

export type GoalFlag = 'deadline_at_risk' | 'deadline_passed' | 'funded';

export interface GoalAllocation {
  goalId: string;
  name: string;
  allocMinor: Cents;
  claimMinor: Cents;
  remainingMinor: Cents;
  flags: GoalFlag[];
}

export interface Routing {
  efMinor: Cents;
  goals: GoalAllocation[];
  uncommittedMinor: Cents;
}

export function routeSavings(S: Cents, goals: PlanGoal[], ef: { needMinor: Cents }, todayMonth: Month): Routing {
  const toEf = Math.min(S, ef.needMinor);
  let left = S - toEf;
  const funded = goals.filter((g) => !g.isEmergencyFund && g.targetMinor - g.savedMinor <= 0);
  const open = goals
    .filter((g) => !g.isEmergencyFund && g.targetMinor - g.savedMinor > 0)
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.deadline && b.deadline ? (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0) : a.deadline ? -1 : b.deadline ? 1 : 0) ||
        a.createdSeq - b.createdSeq,
    );
  const rows = open.map((g) => {
    const remaining = g.targetMinor - g.savedMinor;
    const diff = g.deadline ? monthsBetween(todayMonth, g.deadline) : null;
    const m = diff === null ? 1 : Math.max(1, diff);
    return { g, remaining, claim: g.deadline ? Math.ceil(remaining / m) : remaining, alloc: 0, passed: diff !== null && diff < 0 };
  });
  for (const r of rows) {
    r.alloc = Math.min(r.claim, left);
    left -= r.alloc;
  }
  for (const r of rows) {
    const x = Math.min(r.remaining - r.alloc, left);
    r.alloc += x;
    left -= x;
  }
  return {
    efMinor: toEf,
    uncommittedMinor: left,
    goals: [
      ...rows.map((r) => ({
        goalId: r.g.id,
        name: r.g.name,
        allocMinor: r.alloc,
        claimMinor: r.claim,
        remainingMinor: r.remaining,
        flags: [...(r.g.deadline && r.alloc < r.claim ? (['deadline_at_risk'] as const) : []), ...(r.passed ? (['deadline_passed'] as const) : [])],
      })),
      ...funded.map((g) => ({ goalId: g.id, name: g.name, allocMinor: 0, claimMinor: 0, remainingMinor: 0, flags: ['funded' as const] })),
    ],
  };
}

// ---------- 3.7 surplus ----------

export interface Surplus {
  surplusMinor: Cents;
  shortfallMinor: Cents;
  taxReserveMinor: Cents;
  discretionaryMinor: Cents;
  efMinor: Cents;
  goals: GoalAllocation[];
  investingMinor: Cents;
  uncommittedMinor: Cents;
}

export function routeSurplus(i: {
  receivedMinor: Cents;
  baselineMinor: Cents;
  taxReserveDueMinor: Cents;
  efNeedAfterPlanMinor: Cents;
  goalsAfterPlan: PlanGoal[];
  gateOpenAfterEf: boolean;
  investingWantedMinor: Cents;
  settings: PlanSettings;
  todayMonth: Month;
}): Surplus {
  const X = Math.max(0, i.receivedMinor - i.baselineMinor);
  const t = Math.min(X, Math.max(0, i.taxReserveDueMinor));
  const d = Math.floor(((X - t) * i.settings.surplusDiscretionaryBp) / 10000);
  const r = routeSavings(X - t - d, i.goalsAfterPlan, { needMinor: i.efNeedAfterPlanMinor }, i.todayMonth);
  const inv = i.settings.investingBp > 0 && i.gateOpenAfterEf ? Math.min(r.uncommittedMinor, i.investingWantedMinor) : 0;
  return {
    surplusMinor: X,
    shortfallMinor: Math.max(0, i.baselineMinor - i.receivedMinor),
    taxReserveMinor: t,
    discretionaryMinor: d,
    efMinor: r.efMinor,
    goals: r.goals,
    investingMinor: inv,
    uncommittedMinor: r.uncommittedMinor - inv,
  };
}

// ---------- top level ----------

export interface PlanInput {
  todayMonth: Month;
  settings: PlanSettings;
  baseline: BaselineInput;
  essentials: EssentialsInput;
  profile: ProfileInput;
  /** The goal flagged as the emergency fund, if any. */
  emergencyGoal: { targetMinor: Cents; savedMinor: Cents } | null;
  goals: PlanGoal[];
  thisMonth: { receivedMinor: Cents; taxReserveDueMinor: Cents };
}

export interface Plan {
  baseline: BaselineResult;
  essentials: EssentialsResult;
  profile: { profile: Profile; irregularShareBp: Bp | null };
  emergencyFund: EmergencyFund;
  split: Split;
  routing: Routing;
  surplus: Surplus;
  /** Displayed percentages of the baseline (one decimal, adding up to 100.0). */
  shares: { essentials: string; discretionary: string; savings: string; investing: string };
  monthsToFundEf: number | null;
}

/** Largest-remainder percentages in tenths, ties broken in the fixed order essentials, discretionary, savings, investing. */
export function displayShares(parts: Cents[]): string[] {
  const total = sum(parts);
  if (total <= 0) return parts.map(() => '0.0');
  const exact = parts.map((p) => (p * 1000) / total);
  const floors = exact.map(Math.floor);
  let left = 1000 - sum(floors);
  const order = exact.map((x, i) => ({ i, f: x - Math.floor(x) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let k = 0; left > 0; k++, left--) floors[order[k % order.length]!.i]! += 1;
  return floors.map((t) => (t / 10).toFixed(1));
}

export function buildPlan(input: PlanInput): Plan {
  const s = input.settings;
  const baseline = computeBaseline({ ...input.baseline, manualVariableBaselineMinor: s.manualVariableBaselineMinor });
  const essentials = computeEssentials(input.essentials);
  const profile = incomeProfile(input.profile, s);
  const ef = emergencyFund(essentials.totalMinor, profile.profile, input.emergencyGoal?.targetMinor ?? null, input.emergencyGoal?.savedMinor ?? 0, s);
  const split = splitBaseline({ baselineMinor: baseline.baselineMinor, essentialsMinor: essentials.totalMinor, efSavedMinor: ef.savedMinor, efGateMinor: ef.gateMinor, settings: s });
  const routing = routeSavings(split.savingsMinor, input.goals, ef, input.todayMonth);

  // The surplus is routed after this month's planned contributions are counted.
  const allocated = new Map(routing.goals.map((g) => [g.goalId, g.allocMinor]));
  const goalsAfterPlan = input.goals.map((g) => ({ ...g, savedMinor: g.savedMinor + (allocated.get(g.id) ?? 0) }));
  const efNeedAfterPlan = Math.max(0, ef.needMinor - routing.efMinor);
  const surplusBeforeInvesting = routeSurplus({
    receivedMinor: input.thisMonth.receivedMinor,
    baselineMinor: baseline.baselineMinor,
    taxReserveDueMinor: input.thisMonth.taxReserveDueMinor,
    efNeedAfterPlanMinor: efNeedAfterPlan,
    goalsAfterPlan,
    gateOpenAfterEf: false,
    investingWantedMinor: split.wanted.investingMinor,
    settings: s,
    todayMonth: input.todayMonth,
  });
  const efSavedAfter = ef.savedMinor + routing.efMinor + surplusBeforeInvesting.efMinor;
  const surplus = routeSurplus({
    receivedMinor: input.thisMonth.receivedMinor,
    baselineMinor: baseline.baselineMinor,
    taxReserveDueMinor: input.thisMonth.taxReserveDueMinor,
    efNeedAfterPlanMinor: efNeedAfterPlan,
    goalsAfterPlan,
    gateOpenAfterEf: s.investWhileEfUnfunded || efSavedAfter >= ef.gateMinor,
    investingWantedMinor: split.wanted.investingMinor,
    settings: s,
    todayMonth: input.todayMonth,
  });
  const [e, d, sv, inv] = displayShares([split.essentialsMinor, split.discretionaryMinor, split.savingsMinor, split.investingMinor]);
  return {
    baseline,
    essentials,
    profile,
    emergencyFund: ef,
    split,
    routing,
    surplus,
    shares: { essentials: e!, discretionary: d!, savings: sv!, investing: inv! },
    monthsToFundEf: ef.needMinor > 0 && routing.efMinor > 0 ? Math.ceil(ef.needMinor / routing.efMinor) : ef.needMinor === 0 ? 0 : null,
  };
}
