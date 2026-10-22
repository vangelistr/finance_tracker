import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlanView, type PlanViewData } from '@/components/finance/plan';
import el from '@/i18n/messages/el.json';
import en from '@/i18n/messages/en.json';
import { buildPlan, DEFAULT_PLAN_SETTINGS, type PlanInput } from '@/lib/plan';

// UI contract from docs/allocation-methodology.md section 6: every rendered plan shows the disclaimer, the formula
// and the inputs of each block. The worked examples of section 4 are the fixtures.

const eur = (x: number) => Math.round(x * 100);
const base: PlanInput = {
  todayMonth: '2026-10',
  settings: DEFAULT_PLAN_SETTINGS,
  baseline: { fixedMonthlyEquivalents: [], variableMonths: [], manualVariableBaselineMinor: null },
  essentials: { fixedEssentialMonthly: [], categories: [] },
  profile: { receivedFixed6: 0, receivedVariable6: 0, receivedOneTime6: 0, hasActiveFixedSource: false },
  emergencyGoal: null,
  goals: [],
  thisMonth: { receivedMinor: 0, taxReserveDueMinor: 0 },
};

function render(input: Partial<PlanInput>, locale: 'el' | 'en' = 'el', extra: Partial<PlanViewData['inputs']> = {}) {
  const full = { ...base, ...input };
  const data: PlanViewData = {
    plan: buildPlan(full),
    settings: full.settings,
    month: full.todayMonth,
    inputs: {
      fixedSources: full.baseline.fixedMonthlyEquivalents.map((m, i) => ({ name: `Source ${i + 1}`, monthlyMinor: m })),
      variableMonths: full.baseline.variableMonths,
      fixedEssential: full.essentials.fixedEssentialMonthly,
      emergencyGoalId: full.emergencyGoal ? 'ef' : null,
      goals: Object.fromEntries(full.goals.map((g) => [g.id, { name: g.name, priority: g.priority, deadline: g.deadline ? `${g.deadline}-30` : null, requiredMonthlyMinor: null }])),
      ...extra,
    },
  };
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'el' ? el : en} timeZone="Europe/Athens">
      <PlanView data={data} currency="EUR" />
    </NextIntlClientProvider>,
  );
  // Plain text: tags dropped, entities and non-breaking spaces normalised.
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/ | |&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

const months6 = (values: number[]) => values.map((v, i) => ({ month: `2026-0${i + 4}`, totalMinor: eur(v) }));
const examples: Record<string, Partial<PlanInput>> = {
  'example 1': {
    baseline: { fixedMonthlyEquivalents: [eur(1800)], variableMonths: [], manualVariableBaselineMinor: null },
    essentials: {
      fixedEssentialMonthly: [{ name: 'Rent', monthlyMinor: eur(640) }],
      categories: [
        { categoryId: 'groceries', name: 'Groceries', monthTotals: [eur(270), eur(255), eur(265)], budgetMonthlyMinor: eur(280) },
        { categoryId: 'transport', name: 'Transport', monthTotals: [eur(60), eur(55), eur(65)], budgetMonthlyMinor: null },
        { categoryId: 'health', name: 'Health', monthTotals: [eur(20), 0, eur(40)], budgetMonthlyMinor: null },
      ],
    },
    profile: { receivedFixed6: eur(10800), receivedVariable6: 0, receivedOneTime6: 0, hasActiveFixedSource: true },
    emergencyGoal: { targetMinor: 0, savedMinor: eur(200) },
    goals: [{ id: 'holiday', name: 'Holiday', targetMinor: eur(900), savedMinor: 0, deadline: '2027-06', priority: 1, isEmergencyFund: false, createdSeq: 1 }],
    thisMonth: { receivedMinor: eur(1800), taxReserveDueMinor: 0 },
  },
  'example 2': {
    baseline: { fixedMonthlyEquivalents: [eur(900)], variableMonths: months6([410, 620, 280, 350, 180, 520]), manualVariableBaselineMinor: null },
    essentials: { fixedEssentialMonthly: [{ name: 'Rent', monthlyMinor: eur(520) }], categories: [{ categoryId: 'g', name: 'Groceries', monthTotals: [eur(240)], budgetMonthlyMinor: null }] },
    profile: { receivedFixed6: eur(5400), receivedVariable6: eur(2360), receivedOneTime6: 0, hasActiveFixedSource: true },
    emergencyGoal: { targetMinor: 0, savedMinor: eur(600) },
    thisMonth: { receivedMinor: eur(1600), taxReserveDueMinor: 0 },
  },
  'example 3': {
    baseline: { fixedMonthlyEquivalents: [], variableMonths: months6([1640, 1220, 1900, 1080, 1400, 1320]), manualVariableBaselineMinor: null },
    essentials: { fixedEssentialMonthly: [{ name: 'Rent', monthlyMinor: eur(380) }], categories: [{ categoryId: 'g', name: 'Groceries', monthTotals: [eur(230)], budgetMonthlyMinor: null }] },
    profile: { receivedFixed6: 0, receivedVariable6: eur(8560), receivedOneTime6: 0, hasActiveFixedSource: false },
    thisMonth: { receivedMinor: eur(2500), taxReserveDueMinor: eur(150) },
  },
  'example 4a': {
    baseline: { fixedMonthlyEquivalents: [eur(700)], variableMonths: [], manualVariableBaselineMinor: null },
    essentials: { fixedEssentialMonthly: [{ name: 'Rent', monthlyMinor: eur(520) }], categories: [{ categoryId: 'v', name: 'Groceries', monthTotals: [eur(330)], budgetMonthlyMinor: null }] },
  },
  'example 4b': {
    baseline: { fixedMonthlyEquivalents: [eur(700)], variableMonths: [], manualVariableBaselineMinor: null },
    essentials: { fixedEssentialMonthly: [{ name: 'Rent', monthlyMinor: eur(460) }], categories: [{ categoryId: 'v', name: 'Groceries', monthTotals: [eur(180)], budgetMonthlyMinor: null }] },
  },
};

describe('Smart Plan view: disclaimer, formulas and inputs for every worked example', () => {
  for (const [name, input] of Object.entries(examples)) {
    it(name, () => {
      const text = render(input);
      expect(text).toContain(el.plan.disclaimer);
      expect(text).toContain(el.plan.baselineFormula);
      expect(text).toContain(el.plan.essentialsFormula);
      expect(text).toContain('Στόχος = ');
      expect(text).toContain(el.plan.surplusFormula);
      expect(text).toContain('Rent'); // fixed essential input
      expect(text).toContain('Groceries'); // essential category input
      expect(text).toContain('100,0 %'); // the split total
      expect(text).toContain(el.plan.why);
    });
  }

  it('example 1 shows its numbers, the held-back investing and the goal at risk', () => {
    const text = render(examples['example 1']!);
    expect(text).toContain('1.800,00 €');
    expect(text).toContain('55,6 %');
    expect(text).toContain('14,4 %');
    expect(text).toContain('Οι επενδύσεις ξεκινούν όταν το αποθεματικό φτάσει 3 μήνες απαραίτητων. Μέχρι τότε 170,00 € πάνε στην αποταμίευση.');
    expect(text).toContain(el.plan.flag_deadline_at_risk);
    expect(text).toContain(el.plan.fixAtRisk);
    expect(text).toContain('Περίπου 11 μήνες');
  });

  it('example 2 marks the lowest month and shows the irregular profile and the surplus routing', () => {
    const text = render(examples['example 2']!);
    expect(text).toMatch(/Αυγούστου 2026 · χαμηλότερος|Αύγουστος 2026 · χαμηλότερος/);
    expect(text).toContain('30,41 %');
    expect(text).toContain('Διάμεσος 380,00 €');
    expect(text).toContain('520,00 €'); // surplus
    expect(text).toContain('468,00 €'); // surplus to the emergency fund
  });

  it('example 3 shows the tax reserve as an estimate', () => {
    const text = render(examples['example 3']!);
    expect(text).toContain('Αποθεματικό φόρων (εκτίμηση)');
    expect(text).toContain('150,00 €');
  });

  it('deficit and squeeze are explained in words', () => {
    expect(render(examples['example 4a']!)).toContain('Τα απαραίτητα (850,00 €) ξεπερνούν τη βάση (700,00 €) κατά 150,00 €.');
    expect(render(examples['example 4b']!)).toContain(el.plan.modeSqueeze);
  });

  it('warns about a missing emergency fund goal and a zero month, and renders in English', () => {
    const text = render({ ...examples['example 2']!, emergencyGoal: null, baseline: { fixedMonthlyEquivalents: [eur(900)], variableMonths: months6([410, 0, 280]), manualVariableBaselineMinor: null } }, 'en');
    expect(text).toContain(en.plan.disclaimer);
    expect(text).toContain(en.plan.efMissing);
    expect(text).toMatch(/May 2026 had no variable income/);
    expect(text).toContain(en.plan.debtHint);
  });

  it('never names an instrument or says buy or sell', () => {
    for (const input of Object.values(examples)) {
      const text = render(input, 'en');
      expect(text).toContain(en.plan.disclaimer);
      // The disclaimer is the only place that may say "buy or sell".
      expect(text.replace(en.plan.disclaimer, '').toLowerCase()).not.toMatch(/\b(buy|sell|etf|stock|shares of|bond|predict)\w*/);
    }
  });
});
