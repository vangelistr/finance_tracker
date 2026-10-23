import { rhu, type Band, type TaxConfig } from './config';

// Greek freelancer tax/EFKA set-aside estimator (docs/research/tax-efka.md section 7), deterministic on integer cents.
// Every result is an estimate, not tax advice; confirm with an accountant. Rules marked [uncertain] in the research
// are applied in their conservative reading and flagged in the result so the UI can show the tag.

type Cents = number;

export const AGE_BANDS = ['<=25', '26-30', '31+'] as const;
export const EFKA_CLASS_IDS = ['1', '2', '3', '4', '5', '6', 'special'] as const;
export const EXTRA_CLASS_IDS = ['1', '2', '3'] as const;

export interface TaxProfile {
  /** E: forecast annual taxable employment and pension income (incl. εργόσημο net). */
  employmentIncomeMinor: Cents;
  dependentChildren: number;
  ageBand: (typeof AGE_BANDS)[number];
  applyNewSoleProprietorBandCut: boolean;
  /** Minimum presumed net income (art. 28A) for the year view only; null = not applied (default). */
  minimumPresumedIncomeMinor: Cents | null;
  efkaClassId: (typeof EFKA_CLASS_IDS)[number];
  /** First year of insurance: the special class ends after five years. */
  insuranceStartYear: number | null;
  /** First month (1–12) of the tax year in which EFKA accrues. */
  efkaFromMonth: number;
  hasParallelSalariedEmployment: boolean;
  salariedContributionsMonthlyMinor: Cents;
  supplementaryClass: (typeof EXTRA_CLASS_IDS)[number] | null;
  lumpSumClass: (typeof EXTRA_CLASS_IDS)[number] | null;
  extrasCoveredBySalary: boolean;
  healthProfessional: boolean;
  vatRegime: 'normal' | 'smallBusinessExempt';
  /** null = the config's standard rate. */
  vatRateBps: number | null;
  previousYearGreekTurnoverMinor: Cents;
  /** True only in the first year business income is declared (halves the prepayment). */
  firstTimeBusinessIncome: boolean;
  /** Clients withhold 20 % on fees above the threshold (art. 64). */
  clientsWithhold: boolean;
}

export const DEFAULT_TAX_PROFILE: TaxProfile = {
  employmentIncomeMinor: 0,
  dependentChildren: 0,
  ageBand: '31+',
  applyNewSoleProprietorBandCut: false,
  minimumPresumedIncomeMinor: null,
  efkaClassId: '1',
  insuranceStartYear: null,
  efkaFromMonth: 1,
  hasParallelSalariedEmployment: false,
  salariedContributionsMonthlyMinor: 0,
  supplementaryClass: null,
  lumpSumClass: null,
  extrasCoveredBySalary: false,
  healthProfessional: false,
  vatRegime: 'normal',
  vatRateBps: null,
  previousYearGreekTurnoverMinor: 0,
  firstTimeBusinessIncome: false,
  clientsWithhold: false,
};

export interface Invoice {
  id: string;
  /** YYYY-MM-DD in Europe/Athens, inside the tax year. */
  date: string;
  /** Amount without VAT. */
  netMinor: Cents;
  expensesMinor?: Cents;
}

// ---------- income tax ----------

export function scaleTax(income: Cents, bands: Band[]): Cents {
  let tax = 0;
  let prev = 0;
  for (const b of bands) {
    const hi = b.upToMinor === null ? income : Math.min(income, b.upToMinor);
    if (hi > prev) tax += rhu((hi - prev) * b.rateBps, 10_000);
    if (b.upToMinor === null || income <= b.upToMinor) break;
    prev = b.upToMinor;
  }
  return tax;
}

/** The scale with the optional 2026 children and age rates and the first-years band cut applied (lowest rate wins). */
export function effectiveBands(p: TaxProfile, cfg: TaxConfig, grossBusinessMinor: Cents): Band[] {
  const it = cfg.incomeTax;
  const bands = it.bands.map((b) => ({ ...b }));
  const set = (i: number, bps: number) => {
    if (bands[i]) bands[i]!.rateBps = Math.min(bands[i]!.rateBps, Math.max(0, bps));
  };
  const c = it.dependentChildrenRates;
  if (c && p.dependentChildren > 0) {
    if (p.dependentChildren >= 4) {
      set(0, c.fourOrMoreChildrenBand1And2RateBps);
      set(1, c.fourOrMoreChildrenBand1And2RateBps);
    } else set(1, c.band2RateBpsByChildren[p.dependentChildren] ?? bands[1]!.rateBps);
    const b3 = c.band3RateBpsByChildren;
    set(2, p.dependentChildren < b3.length ? b3[p.dependentChildren]! : b3.at(-1)! - (p.dependentChildren - (b3.length - 1)) * c.band3ExtraChildReductionBpsAbove4);
  }
  const a = it.ageRates;
  if (a && p.ageBand !== '31+') {
    const bps = p.ageBand === '<=25' ? a.ageUpTo25RateBps : a.age26To30RateBps;
    set(0, bps);
    set(1, bps);
  }
  const cut = cfg.other.newSoleProprietorFirstBandCut;
  if (cut && p.applyNewSoleProprietorBandCut && grossBusinessMinor <= cut.maxGrossBusinessIncomeMinor) set(0, rhu(bands[0]!.rateBps * (10_000 - cut.cutBps), 10_000));
  return bands;
}

/** Art. 16 employment reduction before proration. */
export function employmentReduction(E: Cents, cfg: TaxConfig, children: number): Cents {
  const r = cfg.incomeTax.employmentReduction;
  const base = r.baseByChildrenMinor[Math.min(children, r.baseByChildrenMinor.length - 1)]! + Math.max(0, children - (r.baseByChildrenMinor.length - 1)) * r.extraChildMinor;
  const over = Math.max(0, E - r.phaseOutStartMinor);
  return Math.max(0, base - rhu(over * r.phaseOutBpsOfIncomeOverStart, 10_000));
}

/** Tax on employment income E plus business profit B; the reduction is prorated by the employment share [uncertain]. */
export function totalIncomeTax(E: Cents, B: Cents, bands: Band[], p: TaxProfile, cfg: TaxConfig): Cents {
  const S = E + B;
  if (S <= 0) return 0;
  const scale = scaleTax(S, bands);
  const R = E > 0 ? Math.min(scale, rhu(employmentReduction(E, cfg, p.dependentChildren) * E, S)) : 0;
  return scale - R;
}

// ---------- EFKA ----------

export function efkaClassInForce(p: TaxProfile, cfg: TaxConfig, taxYear: number): { classId: string; specialExpired: boolean } {
  const np = cfg.efka.newProfessional;
  if (p.efkaClassId === np.classId && p.insuranceStartYear !== null && taxYear - p.insuranceStartYear >= np.maxYearsOfInsurance) {
    return { classId: cfg.efka.defaultClassId, specialExpired: true };
  }
  return { classId: p.efkaClassId, specialExpired: false };
}

/** EFKA owed for one month (section 7.5). */
export function efkaMonthly(p: TaxProfile, cfg: TaxConfig, taxYear: number): Cents {
  const amount = (id: string) => cfg.efka.classes.find((c) => c.id === id)?.monthlyMinor ?? 0;
  const { classId } = efkaClassInForce(p, cfg, taxYear);
  const par = cfg.efka.parallelSalariedEmployment;
  let main: Cents;
  if (p.hasParallelSalariedEmployment) {
    const target = classId === cfg.efka.newProfessional.classId ? amount(par.newProfessionalPaysClassId) : Math.max(amount(classId), amount(par.standardMinimumClassId));
    main = Math.max(0, target - p.salariedContributionsMonthlyMinor);
  } else main = amount(classId);
  const x = cfg.efka.extras;
  const extras = p.extrasCoveredBySalary
    ? 0
    : (x.supplementary.classes.find((c) => c.id === p.supplementaryClass)?.monthlyMinor ?? 0) +
      (x.lumpSum.classes.find((c) => c.id === p.lumpSumClass)?.monthlyMinor ?? 0) +
      x.unemploymentMonthlyMinor +
      (p.healthProfessional ? x.healthProfessionalsHousingMonthlyMinor : 0);
  return main + extras;
}

// ---------- VAT and withholding ----------

export function vatRate(p: TaxProfile, cfg: TaxConfig): number {
  return p.vatRateBps ?? cfg.vat.standardRateBps;
}

/** VAT on one invoice; under the small-business scheme the crossing invoice carries VAT in full. */
export function vatForInvoice(p: TaxProfile, cfg: TaxConfig, netMinor: Cents, ytdTurnoverBefore: Cents): { vatMinor: Cents; crossing: boolean } {
  const full = rhu(netMinor * vatRate(p, cfg), 10_000);
  if (p.vatRegime === 'normal') return { vatMinor: full, crossing: false };
  const T = cfg.vat.smallBusinessThresholdMinor;
  if (p.previousYearGreekTurnoverMinor > T) return { vatMinor: full, crossing: false };
  if (ytdTurnoverBefore + netMinor <= T) return { vatMinor: 0, crossing: false };
  return { vatMinor: full, crossing: ytdTurnoverBefore <= T };
}

export function withheldByClient(p: TaxProfile, cfg: TaxConfig, netMinor: Cents): Cents {
  return p.clientsWithhold && netMinor > cfg.withholding.thresholdMinor ? rhu(netMinor * cfg.withholding.rateBps, 10_000) : 0;
}

// ---------- the year ----------

export interface InvoiceLine {
  id: string;
  date: string;
  month: number;
  netMinor: Cents;
  vatMinor: Cents;
  vatCrossing: boolean;
  incomeTaxMinor: Cents;
  withheldMinor: Cents;
  /** VAT + income tax: what moves to the tax reserve at the invoice (EFKA moves at month end). */
  setAsideMinor: Cents;
  /** Cash the client pays: net + VAT − withheld. */
  cashMinor: Cents;
}

export interface MonthLine {
  month: number;
  netMinor: Cents;
  vatMinor: Cents;
  incomeTaxFromInvoicesMinor: Cents;
  /** Negative: the reserve released because the month's EFKA reduces business profit. */
  efkaEffectMinor: Cents;
  efkaMinor: Cents;
  cumulativeIncomeTaxMinor: Cents;
  setAsideMinor: Cents;
}

export interface YearEstimate {
  taxYear: number;
  /** Months 1..throughMonth are counted (12 for the full-year view). */
  throughMonth: number;
  invoices: InvoiceLine[];
  months: MonthLine[];
  totals: {
    netMinor: Cents;
    vatMinor: Cents;
    efkaMinor: Cents;
    businessProfitMinor: Cents;
    taxOnEmploymentMinor: Cents;
    taxTotalMinor: Cents;
    incomeTaxReserveMinor: Cents;
    withheldMinor: Cents;
    setAsideMinor: Cents;
    prepaymentNextYearMinor: Cents;
  };
  efkaMonthlyMinor: Cents;
  efkaClassId: string;
  specialClassExpired: boolean;
  vatCrossedOn: string | null;
  bands: Band[];
}

const monthOfDate = (d: string) => Number(d.slice(5, 7));

/**
 * The reserve event model (section 7.4): events are invoices (raise profit) and month-end EFKA accruals (lower it),
 * in date order; each event's income-tax reserve is the change in tax(E + max(0, N)) − tax(E). The deltas telescope,
 * so month and year totals agree by construction.
 */
export function estimateYear(i: { taxYear: number; profile: TaxProfile; config: TaxConfig; invoices: Invoice[]; throughMonth?: number }): YearEstimate {
  const { profile: p, config: cfg, taxYear } = i;
  const through = i.throughMonth ?? 12;
  const invoices = i.invoices.filter((x) => x.date.startsWith(`${taxYear}-`) && monthOfDate(x.date) <= through).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
  const gross = invoices.reduce((s, x) => s + x.netMinor, 0);
  const bands = effectiveBands(p, cfg, gross);
  const E = p.employmentIncomeMinor;
  const taxOnE = totalIncomeTax(E, 0, bands, p, cfg);
  const reserve = (N: Cents) => totalIncomeTax(E, Math.max(0, N), bands, p, cfg) - taxOnE;
  const efka = efkaMonthly(p, cfg, taxYear);
  const { classId, specialExpired } = efkaClassInForce(p, cfg, taxYear);

  let N = 0;
  let turnover = 0;
  let crossedOn: string | null = null;
  const lines: InvoiceLine[] = [];
  const months: MonthLine[] = [];
  let cumulative = 0;
  for (let m = 1; m <= through; m++) {
    const row: MonthLine = { month: m, netMinor: 0, vatMinor: 0, incomeTaxFromInvoicesMinor: 0, efkaEffectMinor: 0, efkaMinor: 0, cumulativeIncomeTaxMinor: 0, setAsideMinor: 0 };
    for (const inv of invoices.filter((x) => monthOfDate(x.date) === m)) {
      const before = reserve(N);
      N += inv.netMinor - (inv.expensesMinor ?? 0);
      const tax = reserve(N) - before;
      const vat = vatForInvoice(p, cfg, inv.netMinor, turnover);
      if (vat.crossing && !crossedOn) crossedOn = inv.date;
      turnover += inv.netMinor;
      const withheld = withheldByClient(p, cfg, inv.netMinor);
      lines.push({ id: inv.id, date: inv.date, month: m, netMinor: inv.netMinor, vatMinor: vat.vatMinor, vatCrossing: vat.crossing, incomeTaxMinor: tax, withheldMinor: withheld, setAsideMinor: vat.vatMinor + tax, cashMinor: inv.netMinor + vat.vatMinor - withheld });
      row.netMinor += inv.netMinor;
      row.vatMinor += vat.vatMinor;
      row.incomeTaxFromInvoicesMinor += tax;
    }
    if (m >= p.efkaFromMonth) {
      const before = reserve(N);
      N -= efka;
      row.efkaEffectMinor = reserve(N) - before;
      row.efkaMinor = efka;
    }
    cumulative += row.incomeTaxFromInvoicesMinor + row.efkaEffectMinor;
    row.cumulativeIncomeTaxMinor = cumulative;
    row.setAsideMinor = row.vatMinor + row.incomeTaxFromInvoicesMinor + row.efkaEffectMinor + row.efkaMinor;
    months.push(row);
  }

  let B = Math.max(0, N);
  if (p.minimumPresumedIncomeMinor !== null && through === 12) B = Math.max(B, p.minimumPresumedIncomeMinor);
  const taxTotal = totalIncomeTax(E, B, bands, p, cfg);
  const incomeTaxReserve = taxTotal - taxOnE;
  const vatTotal = months.reduce((s, r) => s + r.vatMinor, 0);
  const efkaTotal = months.reduce((s, r) => s + r.efkaMinor, 0);
  const withheld = lines.reduce((s, l) => s + l.withheldMinor, 0);

  return {
    taxYear,
    throughMonth: through,
    invoices: lines,
    months,
    totals: {
      netMinor: gross,
      vatMinor: vatTotal,
      efkaMinor: efkaTotal,
      businessProfitMinor: B,
      taxOnEmploymentMinor: taxOnE,
      taxTotalMinor: taxTotal,
      incomeTaxReserveMinor: incomeTaxReserve,
      withheldMinor: withheld,
      setAsideMinor: vatTotal + incomeTaxReserve + efkaTotal,
      prepaymentNextYearMinor: prepayment(E, B, taxTotal, taxOnE, withheld, p, cfg),
    },
    efkaMonthlyMinor: efka,
    efkaClassId: classId,
    specialClassExpired: specialExpired,
    vatCrossedOn: crossedOn,
    bands,
  };
}

/** Prepayment for next year (section 7.6): 55 % of the business share of the tax, halved the first time [uncertain]. */
function prepayment(E: Cents, B: Cents, taxTotal: Cents, taxOnE: Cents, withheld: Cents, p: TaxProfile, cfg: TaxConfig): Cents {
  if (B <= 0) return 0;
  const pp = cfg.prepayment;
  const bizTax = pp.baseMethod === 'proportionalShareOfTotalTax' ? rhu(taxTotal * B, E + B) : taxTotal - taxOnE;
  let pre = rhu(Math.max(0, bizTax - withheld) * pp.rateBps, 10_000);
  if (p.firstTimeBusinessIncome) pre = rhu(pre * (10_000 - pp.newProfessionalReductionBps), 10_000);
  return pre < pp.minimumAssessedMinor ? 0 : pre;
}
