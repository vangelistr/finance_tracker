import { describe, expect, it } from 'vitest';
import cfg2025 from '../../config/tax/2025.json';
import cfg2026 from '../../config/tax/2026.json';
import type { TaxConfig } from '@/lib/tax/config';
import { DEFAULT_TAX_PROFILE, efkaMonthly, employmentReduction, estimateYear, scaleTax, totalIncomeTax, vatForInvoice, withheldByClient, type Invoice, type TaxProfile } from '@/lib/tax/estimate';

// The worked example of docs/research/tax-efka.md section 8 (tax year 2026) to the cent, plus bracket edges, the VAT
// crossing invoice, EFKA with and without parallel employment, and the first-year prepayment halving.

const c26 = cfg2026 as unknown as TaxConfig;
const c25 = cfg2025 as unknown as TaxConfig;
const eur = (x: number) => Math.round(x * 100);

const invoices: Invoice[] = [3, 4, 5, 6, 7, 8, 9, 10].map((m) => ({ id: `inv${m}`, date: `2026-${String(m).padStart(2, '0')}-15`, netMinor: eur(1500) }));
const example: TaxProfile = { ...DEFAULT_TAX_PROFILE, employmentIncomeMinor: eur(18000), efkaClassId: 'special', insuranceStartYear: 2025 };

describe('worked example (2026, scenario B)', () => {
  const normal = estimateYear({ taxYear: 2026, profile: example, config: c26, invoices });
  const exempt = estimateYear({ taxYear: 2026, profile: { ...example, vatRegime: 'smallBusinessExempt' }, config: c26, invoices });

  it('matches the monthly table', () => {
    expect(normal.efkaMonthlyMinor).toBe(16046);
    const rows = normal.months.map((r) => [r.netMinor, r.vatMinor, r.incomeTaxFromInvoicesMinor, r.efkaEffectMinor, r.efkaMinor, r.cumulativeIncomeTaxMinor]);
    expect(rows).toEqual([
      [0, 0, 0, 0, 16046, 0],
      [0, 0, 0, 0, 16046, 0],
      [150000, 36000, 27621, -3730, 16046, 23891],
      [150000, 36000, 37658, -4627, 16046, 56922],
      [150000, 36000, 42987, -4572, 16046, 95337],
      [150000, 36000, 42524, -4527, 16046, 133334],
      [150000, 36000, 42138, -4489, 16046, 170983],
      [150000, 36000, 41812, -4457, 16046, 208338],
      [150000, 36000, 41534, -4430, 16046, 245442],
      [150000, 36000, 41296, -4406, 16046, 282332],
      [0, 0, 0, -4408, 16046, 277924],
      [0, 0, 0, -4412, 16046, 273512],
    ]);
    expect(exempt.months.map((r) => r.vatMinor)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 36000, 36000, 0, 0]);
  });

  it('matches the year totals of both VAT cases and the prepayment', () => {
    expect(normal.totals).toMatchObject({ netMinor: eur(12000), vatMinor: eur(2880), efkaMinor: 192552, businessProfitMinor: 1007448, taxOnEmploymentMinor: 184300, taxTotalMinor: 457812, incomeTaxReserveMinor: 273512, setAsideMinor: 754064, prepaymentNextYearMinor: 90357 });
    expect(exempt.totals.vatMinor).toBe(eur(720));
    expect(exempt.totals.setAsideMinor).toBe(538064);
    expect(exempt.vatCrossedOn).toBe('2026-09-15');
    expect(exempt.invoices.find((x) => x.vatCrossing)?.id).toBe('inv9');
    // Per invoice: VAT + income tax moves at the invoice; the lines telescope to the year reserve with the EFKA effects.
    const fromInvoices = normal.invoices.reduce((s, x) => s + x.incomeTaxMinor, 0);
    expect(fromInvoices).toBe(317570);
    expect(fromInvoices + normal.months.reduce((s, r) => s + r.efkaEffectMinor, 0)).toBe(normal.totals.incomeTaxReserveMinor);
  });

  it('scenario A: the salaried job covers EFKA', () => {
    const a = estimateYear({ taxYear: 2026, profile: { ...example, hasParallelSalariedEmployment: true, salariedContributionsMonthlyMinor: eur(1000), extrasCoveredBySalary: true }, config: c26, invoices });
    expect(a.totals.efkaMinor).toBe(0);
    expect(a.totals.taxTotalMinor).toBe(510580);
    expect(a.totals.incomeTaxReserveMinor).toBe(326280);
    expect(a.totals.setAsideMinor).toBe(614280);
    expect(a.totals.prepaymentNextYearMinor).toBe(112328);
  });
});

describe('rules', () => {
  it('applies the scale band by band at the edges', () => {
    const bands = c26.incomeTax.bands;
    expect(scaleTax(eur(10000), bands)).toBe(eur(900));
    expect(scaleTax(eur(10000.01), bands)).toBe(eur(900));
    expect(scaleTax(eur(20000), bands)).toBe(eur(2900));
    expect(scaleTax(eur(60000), bands)).toBe(eur(900 + 2000 + 2600 + 3400 + 7800));
    expect(scaleTax(eur(70000), bands)).toBe(eur(16700 + 4400));
    expect(scaleTax(eur(20000), c25.incomeTax.bands)).toBe(eur(900 + 2200));
    expect(employmentReduction(eur(18000), c26, 0)).toBe(eur(657));
    expect(employmentReduction(eur(60000), c26, 0)).toBe(0);
    expect(totalIncomeTax(eur(18000), 0, bands, DEFAULT_TAX_PROFILE, c26)).toBe(184300);
    expect(totalIncomeTax(0, 0, bands, DEFAULT_TAX_PROFILE, c26)).toBe(0);
  });

  it('charges the crossing invoice in full under the small-business scheme', () => {
    const p = { ...DEFAULT_TAX_PROFILE, vatRegime: 'smallBusinessExempt' as const };
    expect(vatForInvoice(p, c26, eur(1000), eur(9000))).toEqual({ vatMinor: 0, crossing: false });
    expect(vatForInvoice(p, c26, eur(1000.01), eur(9000))).toEqual({ vatMinor: 24000, crossing: true });
    expect(vatForInvoice(p, c26, eur(100), eur(11000))).toEqual({ vatMinor: 2400, crossing: false });
    expect(vatForInvoice({ ...p, previousYearGreekTurnoverMinor: eur(12000) }, c26, eur(100), 0).vatMinor).toBe(2400);
  });

  it('computes EFKA with parallel employment floors, extras and the end of the special class', () => {
    expect(efkaMonthly({ ...DEFAULT_TAX_PROFILE, efkaClassId: '1' }, c26, 2026)).toBe(25077 + 1000);
    // With a salaried job: never below class 2, minus the user's salaried contributions.
    expect(efkaMonthly({ ...DEFAULT_TAX_PROFILE, efkaClassId: '1', hasParallelSalariedEmployment: true, salariedContributionsMonthlyMinor: 10000 }, c26, 2026)).toBe(30093 - 10000 + 1000);
    // New professional with a salaried job pays class 1.
    expect(efkaMonthly({ ...DEFAULT_TAX_PROFILE, efkaClassId: 'special', hasParallelSalariedEmployment: true, extrasCoveredBySalary: true }, c26, 2026)).toBe(25077);
    expect(efkaMonthly({ ...DEFAULT_TAX_PROFILE, efkaClassId: '3', supplementaryClass: '1', lumpSumClass: '2', healthProfessional: true }, c26, 2026)).toBe(36063 + 4657 + 3702 + 1000 + 200);
    // The special class ends after five years of insurance.
    expect(efkaMonthly({ ...DEFAULT_TAX_PROFILE, efkaClassId: 'special', insuranceStartYear: 2021 }, c26, 2026)).toBe(25077 + 1000);
    expect(efkaMonthly({ ...DEFAULT_TAX_PROFILE, efkaClassId: 'special', insuranceStartYear: 2022 }, c26, 2026)).toBe(15046 + 1000);
  });

  it('halves the prepayment in the first year and skips amounts under the minimum', () => {
    const full = estimateYear({ taxYear: 2026, profile: example, config: c26, invoices }).totals.prepaymentNextYearMinor;
    const first = estimateYear({ taxYear: 2026, profile: { ...example, firstTimeBusinessIncome: true }, config: c26, invoices }).totals.prepaymentNextYearMinor;
    expect(first).toBe(Math.floor((2 * full * 5000 + 10000) / 20000));
    const tiny = estimateYear({ taxYear: 2026, profile: { ...DEFAULT_TAX_PROFILE, efkaFromMonth: 13 }, config: c26, invoices: [{ id: 'x', date: '2026-05-01', netMinor: eur(400) }] });
    expect(tiny.totals.prepaymentNextYearMinor).toBe(0); // 55 % of 36.00 = 19.80 < 30.00
  });

  it('withholds 20 % only above the threshold and only when clients withhold', () => {
    const p = { ...DEFAULT_TAX_PROFILE, clientsWithhold: true };
    expect(withheldByClient(p, c26, eur(300))).toBe(0);
    expect(withheldByClient(p, c26, eur(300.01))).toBe(6000);
    expect(withheldByClient(DEFAULT_TAX_PROFILE, c26, eur(1000))).toBe(0);
  });

  it('applies the optional 2026 children and age rates, never raising a rate', () => {
    const base = estimateYear({ taxYear: 2026, profile: example, config: c26, invoices }).totals.taxTotalMinor;
    const kids = estimateYear({ taxYear: 2026, profile: { ...example, dependentChildren: 2 }, config: c26, invoices });
    expect(kids.bands.map((b) => b.rateBps).slice(0, 3)).toEqual([900, 1600, 2200]);
    expect(kids.totals.taxTotalMinor).toBeLessThan(base);
    expect(estimateYear({ taxYear: 2026, profile: { ...example, ageBand: '<=25' }, config: c26, invoices }).bands.slice(0, 2).map((b) => b.rateBps)).toEqual([0, 0]);
    expect(estimateYear({ taxYear: 2025, profile: { ...example, dependentChildren: 2 }, config: c25, invoices: [] }).bands.map((b) => b.rateBps)).toEqual(c25.incomeTax.bands.map((b) => b.rateBps));
  });

  it('counts only months up to the view month', () => {
    const sept = estimateYear({ taxYear: 2026, profile: example, config: c26, invoices, throughMonth: 9 });
    expect(sept.months).toHaveLength(9);
    expect(sept.months.at(-1)!.cumulativeIncomeTaxMinor).toBe(245442);
    expect(sept.invoices).toHaveLength(7);
  });
});
