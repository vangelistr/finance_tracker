import { z } from 'zod';
import { AGE_BANDS, EFKA_CLASS_IDS, EXTRA_CLASS_IDS } from '@/lib/tax/estimate';
import { MAX_MINOR } from '@/lib/money';

const minor = z.number().int().min(0).max(MAX_MINOR);
const bp = z.number().int().min(0).max(10_000);

/** Profile fields for a partial update. */
export const taxProfileSchema = z.strictObject({
  employmentIncomeMinor: minor.optional(),
  dependentChildren: z.number().int().min(0).max(15).optional(),
  ageBand: z.enum(AGE_BANDS).optional(),
  applyNewSoleProprietorBandCut: z.boolean().optional(),
  minimumPresumedIncomeMinor: minor.nullable().optional(),
  efkaClassId: z.enum(EFKA_CLASS_IDS).optional(),
  insuranceStartYear: z.number().int().min(1950).max(2100).nullable().optional(),
  efkaFromMonth: z.number().int().min(1).max(13).optional(),
  hasParallelSalariedEmployment: z.boolean().optional(),
  salariedContributionsMonthlyMinor: minor.optional(),
  supplementaryClass: z.enum(EXTRA_CLASS_IDS).nullable().optional(),
  lumpSumClass: z.enum(EXTRA_CLASS_IDS).nullable().optional(),
  extrasCoveredBySalary: z.boolean().optional(),
  healthProfessional: z.boolean().optional(),
  vatRegime: z.enum(['normal', 'smallBusinessExempt']).optional(),
  vatRateBps: bp.nullable().optional(),
  previousYearGreekTurnoverMinor: minor.optional(),
  firstTimeBusinessIncome: z.boolean().optional(),
  clientsWithhold: z.boolean().optional(),
});

const bandsSchema = z
  .array(z.strictObject({ upToMinor: minor.nullable(), rateBps: bp }))
  .min(2)
  .max(10)
  .refine((b) => b.at(-1)!.upToMinor === null && b.slice(0, -1).every((x, i) => x.upToMinor !== null && (i === 0 || x.upToMinor > b[i - 1]!.upToMinor!)), 'bands must rise and end without a limit');

/** The editable rates of a year's config. Sources, notes and [uncertain] flags stay as reviewed. */
export const taxConfigPatchSchema = z.strictObject({
  bands: bandsSchema.optional(),
  efkaClasses: z.partialRecord(z.enum(EFKA_CLASS_IDS), minor).optional(),
  unemploymentMonthlyMinor: minor.optional(),
  vatStandardRateBps: bp.optional(),
  smallBusinessThresholdMinor: minor.optional(),
  prepaymentRateBps: bp.optional(),
  prepaymentReductionBps: bp.optional(),
  withholdingRateBps: bp.optional(),
  withholdingThresholdMinor: minor.optional(),
  reset: z.boolean().optional(),
});

export type TaxConfigPatch = z.infer<typeof taxConfigPatchSchema>;
