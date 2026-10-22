import { describe, expect, it } from 'vitest';
import {
  buildPlan,
  computeBaseline,
  computeEssentials,
  DEFAULT_PLAN_SETTINGS,
  displayShares,
  incomeProfile,
  routeSavings,
  routeSurplus,
  splitBaseline,
  type PlanInput,
  type PlanSettings,
} from '@/lib/plan';

const S = DEFAULT_PLAN_SETTINGS;
const eur = (x: number) => Math.round(x * 100);
const months6 = (values: number[]) => values.map((v, i) => ({ month: `2026-0${i + 4}`, totalMinor: eur(v) }));

function plan(over: Partial<PlanInput>): ReturnType<typeof buildPlan> {
  return buildPlan({
    todayMonth: '2026-10',
    settings: S,
    baseline: { fixedMonthlyEquivalents: [], variableMonths: [], manualVariableBaselineMinor: null },
    essentials: { fixedEssentialMonthly: [], categories: [] },
    profile: { receivedFixed6: 0, receivedVariable6: 0, receivedOneTime6: 0, hasActiveFixedSource: false },
    emergencyGoal: null,
    goals: [],
    thisMonth: { receivedMinor: 0, taxReserveDueMinor: 0 },
    ...over,
  });
}

// Worked examples from docs/allocation-methodology.md section 4 (today 2026-10-22).
describe('worked examples', () => {
  const ex1 = (efSaved: number, efTarget: number | null): PlanInput => ({
    todayMonth: '2026-10',
    settings: S,
    baseline: { fixedMonthlyEquivalents: [eur(1800)], variableMonths: [], manualVariableBaselineMinor: null },
    essentials: {
      fixedEssentialMonthly: [{ name: 'fixed', monthlyMinor: eur(640) }],
      categories: [
        { categoryId: 'groceries', name: 'Groceries', monthTotals: [eur(270), eur(255), eur(265)], budgetMonthlyMinor: eur(280) },
        { categoryId: 'transport', name: 'Transport', monthTotals: [eur(60), eur(55), eur(65)], budgetMonthlyMinor: null },
        { categoryId: 'health', name: 'Health', monthTotals: [eur(20), 0, eur(40)], budgetMonthlyMinor: null },
      ],
    },
    profile: { receivedFixed6: eur(10800), receivedVariable6: 0, receivedOneTime6: 0, hasActiveFixedSource: true },
    emergencyGoal: { targetMinor: efTarget ?? 0, savedMinor: eur(efSaved) },
    goals: [{ id: 'holiday', name: 'Holiday', targetMinor: eur(900), savedMinor: 0, deadline: '2027-06', priority: 1, isEmergencyFund: false, createdSeq: 1 }],
    thisMonth: { receivedMinor: eur(1800), taxReserveDueMinor: 0 },
  });

  it('example 1: salary only', () => {
    const p = buildPlan(ex1(200, null));
    expect(p.baseline.baselineMinor).toBe(eur(1800));
    expect(p.essentials.totalMinor).toBe(eur(1000));
    expect(p.profile.profile).toBe('fixed');
    expect(p.emergencyFund).toMatchObject({ months: 3, targetMinor: eur(3000), needMinor: eur(2800), gateMinor: eur(3000) });
    expect(p.split).toMatchObject({ essentialsMinor: eur(1000), discretionaryMinor: eur(540), savingsMinor: eur(260), investingMinor: 0, mode: 'normal', gateOpen: false, investingHeldMinor: eur(170) });
    expect(p.shares).toEqual({ essentials: '55.6', discretionary: '30.0', savings: '14.4', investing: '0.0' });
    expect(p.routing.efMinor).toBe(eur(260));
    expect(p.routing.goals[0]).toMatchObject({ goalId: 'holiday', claimMinor: eur(112.5), allocMinor: 0, flags: ['deadline_at_risk'] });
    expect(p.monthsToFundEf).toBe(11);
  });

  it('variant 1b: emergency fund already funded', () => {
    const p = buildPlan(ex1(3200, eur(3000)));
    expect(p.split).toMatchObject({ discretionaryMinor: eur(540), investingMinor: eur(170), savingsMinor: eur(90), mode: 'squeeze', gateOpen: true });
    expect(p.shares).toEqual({ essentials: '55.6', discretionary: '30.0', savings: '5.0', investing: '9.4' });
    expect(p.routing.goals[0]).toMatchObject({ allocMinor: eur(90), flags: ['deadline_at_risk'] });
  });

  it('example 2: part-time salary plus ergosimo, with surplus', () => {
    const p = plan({
      baseline: { fixedMonthlyEquivalents: [eur(900)], variableMonths: months6([410, 620, 280, 350, 180, 520]), manualVariableBaselineMinor: null },
      essentials: { fixedEssentialMonthly: [{ name: 'fixed', monthlyMinor: eur(520) }], categories: [{ categoryId: 'g', name: 'g', monthTotals: [eur(240)], budgetMonthlyMinor: null }] },
      profile: { receivedFixed6: eur(5400), receivedVariable6: eur(2360), receivedOneTime6: 0, hasActiveFixedSource: true },
      emergencyGoal: { targetMinor: 0, savedMinor: eur(600) },
      thisMonth: { receivedMinor: eur(1600), taxReserveDueMinor: 0 },
    });
    expect(p.baseline).toMatchObject({ variableMinor: eur(180), baselineMinor: eur(1080), confidence: 'full', medianMinor: eur(380), meanMinor: 39333, lowestMonth: '2026-08' });
    expect(p.profile).toMatchObject({ profile: 'irregular', irregularShareBp: 3041 });
    expect(p.emergencyFund).toMatchObject({ months: 6, targetMinor: eur(4560), needMinor: eur(3960), gateMinor: eur(2280) });
    expect(p.split).toMatchObject({ essentialsMinor: eur(760), discretionaryMinor: eur(266), savingsMinor: eur(54), investingMinor: 0, mode: 'squeeze' });
    expect(p.shares).toEqual({ essentials: '70.4', discretionary: '24.6', savings: '5.0', investing: '0.0' });
    expect(p.surplus).toMatchObject({ surplusMinor: eur(520), taxReserveMinor: 0, discretionaryMinor: eur(52), efMinor: eur(468), investingMinor: 0, uncommittedMinor: 0 });
  });

  it('example 3: irregular income only, with an invoice and a tax reserve', () => {
    const p = plan({
      baseline: { fixedMonthlyEquivalents: [], variableMonths: months6([1640, 1220, 1900, 1080, 1400, 1320]), manualVariableBaselineMinor: null },
      essentials: { fixedEssentialMonthly: [{ name: 'fixed', monthlyMinor: eur(380) }], categories: [{ categoryId: 'g', name: 'g', monthTotals: [eur(230)], budgetMonthlyMinor: null }] },
      profile: { receivedFixed6: 0, receivedVariable6: eur(8560), receivedOneTime6: 0, hasActiveFixedSource: false },
      thisMonth: { receivedMinor: eur(2500), taxReserveDueMinor: eur(150) },
    });
    expect(p.baseline).toMatchObject({ baselineMinor: eur(1080), medianMinor: eur(1360) });
    expect(p.split).toMatchObject({ essentialsMinor: eur(610), discretionaryMinor: eur(324), savingsMinor: eur(146), investingMinor: 0, mode: 'normal', investingHeldMinor: eur(92) });
    expect(p.shares).toEqual({ essentials: '56.5', discretionary: '30.0', savings: '13.5', investing: '0.0' });
    expect(p.monthsToFundEf).toBe(26);
    expect(p.surplus).toMatchObject({ surplusMinor: eur(1420), taxReserveMinor: eur(150), discretionaryMinor: eur(127), efMinor: eur(1143), uncommittedMinor: 0 });
  });

  it('example 4a: deficit, and 4b: squeeze', () => {
    const deficit = plan({
      baseline: { fixedMonthlyEquivalents: [eur(700)], variableMonths: [], manualVariableBaselineMinor: null },
      essentials: { fixedEssentialMonthly: [{ name: 'f', monthlyMinor: eur(520) }], categories: [{ categoryId: 'v', name: 'v', monthTotals: [eur(330)], budgetMonthlyMinor: null }] },
    });
    expect(deficit.split).toMatchObject({ essentialsMinor: eur(700), discretionaryMinor: 0, savingsMinor: 0, investingMinor: 0, mode: 'deficit', shortfallMinor: eur(150) });
    expect(deficit.shares).toEqual({ essentials: '100.0', discretionary: '0.0', savings: '0.0', investing: '0.0' });
    const squeeze = plan({
      baseline: { fixedMonthlyEquivalents: [eur(700)], variableMonths: [], manualVariableBaselineMinor: null },
      essentials: { fixedEssentialMonthly: [{ name: 'f', monthlyMinor: eur(460) }], categories: [{ categoryId: 'v', name: 'v', monthTotals: [eur(180)], budgetMonthlyMinor: null }] },
    });
    expect(squeeze.split).toMatchObject({ essentialsMinor: eur(640), discretionaryMinor: eur(25), savingsMinor: eur(35), investingMinor: 0, mode: 'squeeze' });
    expect(squeeze.shares).toEqual({ essentials: '91.4', discretionary: '3.6', savings: '5.0', investing: '0.0' });
  });
});

describe('edge cases (methodology section 5)', () => {
  it('no history: baseline 0, zero split, shortfall = essentials', () => {
    const p = plan({ essentials: { fixedEssentialMonthly: [{ name: 'rent', monthlyMinor: eur(400) }], categories: [] } });
    expect(p.baseline).toMatchObject({ baselineMinor: 0, confidence: 'none', method: 'none' });
    expect(p.split).toMatchObject({ essentialsMinor: 0, savingsMinor: 0, mode: 'deficit', shortfallMinor: eur(400) });
  });

  it('confidence follows the number of months; a zero month sets the variable baseline to 0', () => {
    expect(computeBaseline({ fixedMonthlyEquivalents: [], variableMonths: months6([500, 600]), manualVariableBaselineMinor: null }).confidence).toBe('provisional');
    expect(computeBaseline({ fixedMonthlyEquivalents: [], variableMonths: months6([500, 600, 700, 800]), manualVariableBaselineMinor: null }).confidence).toBe('partial');
    expect(computeBaseline({ fixedMonthlyEquivalents: [], variableMonths: months6([500, 0, 700]), manualVariableBaselineMinor: null }).variableMinor).toBe(0);
    expect(computeBaseline({ fixedMonthlyEquivalents: [], variableMonths: months6([500, -50]), manualVariableBaselineMinor: null }).variableMinor).toBe(0);
  });

  it('a manual variable baseline wins over the minimum', () => {
    const b = computeBaseline({ fixedMonthlyEquivalents: [eur(100)], variableMonths: months6([500, 0, 700]), manualVariableBaselineMinor: eur(300) });
    expect(b).toMatchObject({ method: 'manual', variableMinor: eur(300), baselineMinor: eur(400) });
  });

  it('essentials take the larger of average and budget, clamping refunds at 0', () => {
    const e = computeEssentials({ fixedEssentialMonthly: [], categories: [{ categoryId: 'a', name: 'a', monthTotals: [-100, eur(10)], budgetMonthlyMinor: eur(20) }] });
    expect(e.rows[0]).toMatchObject({ averageMinor: 500, usedMinor: eur(20) });
  });

  it('profile: override, no history with and without a fixed source', () => {
    expect(incomeProfile({ receivedFixed6: 0, receivedVariable6: 0, receivedOneTime6: 0, hasActiveFixedSource: true }, S).profile).toBe('fixed');
    expect(incomeProfile({ receivedFixed6: 0, receivedVariable6: 0, receivedOneTime6: 0, hasActiveFixedSource: false }, S).profile).toBe('irregular');
    expect(incomeProfile({ receivedFixed6: 100, receivedVariable6: 0, receivedOneTime6: 0, hasActiveFixedSource: true }, { ...S, profileOverride: 'irregular' }).profile).toBe('irregular');
  });

  it('goals: past deadline, no deadline, funded, priority order', () => {
    const r = routeSavings(
      eur(1000),
      [
        { id: 'late', name: 'late', targetMinor: eur(300), savedMinor: 0, deadline: '2026-08', priority: 2, isEmergencyFund: false, createdSeq: 1 },
        { id: 'open', name: 'open', targetMinor: eur(5000), savedMinor: 0, deadline: null, priority: 3, isEmergencyFund: false, createdSeq: 2 },
        { id: 'done', name: 'done', targetMinor: eur(100), savedMinor: eur(100), deadline: null, priority: 1, isEmergencyFund: false, createdSeq: 3 },
        { id: 'first', name: 'first', targetMinor: eur(1200), savedMinor: 0, deadline: '2027-10', priority: 1, isEmergencyFund: false, createdSeq: 4 },
      ],
      { needMinor: 0 },
      '2026-10',
    );
    const by = Object.fromEntries(r.goals.map((g) => [g.goalId, g]));
    // Pass 1 in priority order: first (claim 1200/12 = 100), late (past deadline: all 300), open (no deadline: rest).
    expect([by.first!.allocMinor, by.late!.allocMinor, by.open!.allocMinor]).toEqual([eur(100), eur(300), eur(600)]);
    expect(by.first!.claimMinor).toBe(eur(100));
    expect(by.late!.flags).toContain('deadline_passed');
    expect(by.late!.claimMinor).toBe(eur(300));
    expect(by.done!.flags).toEqual(['funded']);
    expect(r.goals.reduce((s, g) => s + g.allocMinor, 0) + r.uncommittedMinor + r.efMinor).toBe(eur(1000));
  });

  it('all percentages at 0 put the whole baseline into savings', () => {
    const settings: PlanSettings = { ...S, essentialsBpOverride: 0, discretionaryBp: 0, investingBp: 0 };
    const s = splitBaseline({ baselineMinor: eur(1000), essentialsMinor: eur(600), efSavedMinor: 0, efGateMinor: eur(1800), settings });
    expect(s).toMatchObject({ essentialsMinor: 0, discretionaryMinor: 0, investingMinor: 0, savingsMinor: eur(1000) });
  });

  it('overrides above 100 % are squeezed in the documented order', () => {
    const settings: PlanSettings = { ...S, essentialsBpOverride: 7000, discretionaryBp: 5000, investingBp: 2000, investWhileEfUnfunded: true };
    const s = splitBaseline({ baselineMinor: eur(1000), essentialsMinor: 0, efSavedMinor: 0, efGateMinor: 0, settings });
    expect(s).toMatchObject({ essentialsMinor: eur(700), savingsMinor: eur(50), discretionaryMinor: eur(250), investingMinor: 0, mode: 'squeeze' });
  });

  it('the gate can be turned off; one-time income only is all surplus', () => {
    const open = splitBaseline({ baselineMinor: eur(2000), essentialsMinor: eur(800), efSavedMinor: 0, efGateMinor: eur(2400), settings: { ...S, investWhileEfUnfunded: true } });
    expect(open.investingMinor).toBe(eur(200));
    const sur = routeSurplus({ receivedMinor: eur(1000), baselineMinor: 0, taxReserveDueMinor: eur(250), efNeedAfterPlanMinor: eur(5000), goalsAfterPlan: [], gateOpenAfterEf: false, investingWantedMinor: 0, settings: S, todayMonth: '2026-10' });
    expect(sur).toMatchObject({ surplusMinor: eur(1000), taxReserveMinor: eur(250), discretionaryMinor: eur(75), efMinor: eur(675), uncommittedMinor: 0 });
  });

  it('received below the baseline gives a shortfall and no surplus', () => {
    const sur = routeSurplus({ receivedMinor: eur(800), baselineMinor: eur(1000), taxReserveDueMinor: 0, efNeedAfterPlanMinor: 0, goalsAfterPlan: [], gateOpenAfterEf: true, investingWantedMinor: 0, settings: S, todayMonth: '2026-10' });
    expect(sur).toMatchObject({ surplusMinor: 0, shortfallMinor: eur(200) });
  });

  it('displayed shares always add to 100.0', () => {
    expect(displayShares([1, 1, 1, 0])).toEqual(['33.4', '33.3', '33.3', '0.0']);
    expect(displayShares([0, 0, 0, 0])).toEqual(['0.0', '0.0', '0.0', '0.0']);
  });
});

describe('property: the split always covers the baseline exactly', () => {
  it('parts are non-negative and sum to B for 200 000 random inputs', () => {
    let seed = 42;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    const pick = (max: number) => Math.floor(rand() * max);
    for (let k = 0; k < 200_000; k++) {
      const settings: PlanSettings = {
        ...S,
        discretionaryBp: pick(10_001),
        investingBp: pick(10_001),
        minSavingsBp: pick(3000),
        essentialsBpOverride: rand() < 0.2 ? pick(10_001) : null,
        investWhileEfUnfunded: rand() < 0.3,
      };
      const B = rand() < 0.05 ? pick(3) : pick(1_000_000);
      const s = splitBaseline({ baselineMinor: B, essentialsMinor: pick(1_200_000), efSavedMinor: pick(2_000_000), efGateMinor: pick(2_000_000), settings });
      const parts = [s.essentialsMinor, s.discretionaryMinor, s.savingsMinor, s.investingMinor];
      if (parts.some((p) => p < 0 || !Number.isInteger(p)) || parts.reduce((a, b) => a + b, 0) !== Math.max(0, B)) {
        throw new Error(`invariant broken for B=${B}: ${parts.join(',')}`);
      }
    }
  });
});
