// Shape of a per-tax-year rate config (config/tax/<year>.json, docs/research/tax-efka.md section 9). Money is integer
// euro cents, rates are basis points. Only the fields the estimator reads are typed; the rest (notes, calendar,
// sources) is carried through for display. No rate lives in code: every number comes from one of these files or the
// user's edited copy.

export interface Band {
  upToMinor: number | null;
  rateBps: number;
}

export interface Source {
  id: string;
  title: string;
  url: string;
  read: string;
}

export interface Flagged {
  sourceId?: string;
  uncertain?: boolean;
}

export interface TaxConfig {
  taxYear: number;
  lastReviewed: string;
  sources: Source[];
  incomeTax: Flagged & {
    bands: Band[];
    dependentChildrenRates:
      | (Flagged & { band2RateBpsByChildren: number[]; band3RateBpsByChildren: number[]; band3ExtraChildReductionBpsAbove4: number; fourOrMoreChildrenBand1And2RateBps: number })
      | null;
    ageRates: (Flagged & { upToIncomeMinor: number; ageUpTo25RateBps: number; age26To30RateBps: number; appliesToFirstTwoBands: boolean }) | null;
    employmentReduction: Flagged & { baseByChildrenMinor: number[]; extraChildMinor: number; phaseOutStartMinor: number; phaseOutBpsOfIncomeOverStart: number };
  };
  efka: Flagged & {
    classes: Array<{ id: string; monthlyMinor: number }>;
    defaultClassId: string;
    newProfessional: Flagged & { classId: string; maxYearsOfInsurance: number };
    parallelSalariedEmployment: Flagged & { standardMinimumClassId: string; newProfessionalPaysClassId: string };
    extras: {
      supplementary: { classes: Array<{ id: string; monthlyMinor: number }>; uncertain?: boolean };
      lumpSum: { classes: Array<{ id: string; monthlyMinor: number }>; uncertain?: boolean };
      unemploymentMonthlyMinor: number;
      healthProfessionalsHousingMonthlyMinor: number;
    };
    dueRule?: Flagged & { type: string };
  };
  vat: Flagged & { standardRateBps: number; smallBusinessThresholdMinor: number };
  prepayment: Flagged & { rateBps: number; newProfessionalReductionBps: number; minimumAssessedMinor: number; baseMethod: 'proportionalShareOfTotalTax' | 'marginalTax' };
  withholding: Flagged & { rateBps: number; thresholdMinor: number };
  other: {
    minimumPresumedIncome?: Flagged & { exemptYearsFromFirstStart: number; maxMinor: number };
    newSoleProprietorFirstBandCut?: Flagged & { cutBps: number; years: number; maxGrossBusinessIncomeMinor: number };
    [key: string]: unknown;
  };
}

/** Half up to the cent for non-negative integers: rhu(n, d) = floor((2n + d) / (2d)). Negative n rounds symmetrically. */
export function rhu(n: number, d: number): number {
  if (n < 0) return -rhu(-n, d);
  return Math.floor((2 * n + d) / (2 * d));
}

/** Applies the editable fields to a copy of a config; everything else is kept as reviewed. */
export function applyConfigPatch(
  cfg: TaxConfig,
  patch: {
    bands?: Band[];
    efkaClasses?: Partial<Record<string, number>>;
    unemploymentMonthlyMinor?: number;
    vatStandardRateBps?: number;
    smallBusinessThresholdMinor?: number;
    prepaymentRateBps?: number;
    prepaymentReductionBps?: number;
    withholdingRateBps?: number;
    withholdingThresholdMinor?: number;
  },
): TaxConfig {
  const next: TaxConfig = structuredClone(cfg);
  if (patch.bands) next.incomeTax.bands = patch.bands.map((b) => ({ upToMinor: b.upToMinor, rateBps: b.rateBps }));
  if (patch.efkaClasses) for (const cls of next.efka.classes) if (patch.efkaClasses[cls.id] !== undefined) cls.monthlyMinor = patch.efkaClasses[cls.id]!;
  if (patch.unemploymentMonthlyMinor !== undefined) next.efka.extras.unemploymentMonthlyMinor = patch.unemploymentMonthlyMinor;
  if (patch.vatStandardRateBps !== undefined) next.vat.standardRateBps = patch.vatStandardRateBps;
  if (patch.smallBusinessThresholdMinor !== undefined) next.vat.smallBusinessThresholdMinor = patch.smallBusinessThresholdMinor;
  if (patch.prepaymentRateBps !== undefined) next.prepayment.rateBps = patch.prepaymentRateBps;
  if (patch.prepaymentReductionBps !== undefined) next.prepayment.newProfessionalReductionBps = patch.prepaymentReductionBps;
  if (patch.withholdingRateBps !== undefined) next.withholding.rateBps = patch.withholdingRateBps;
  if (patch.withholdingThresholdMinor !== undefined) next.withholding.thresholdMinor = patch.withholdingThresholdMinor;
  return next;
}
