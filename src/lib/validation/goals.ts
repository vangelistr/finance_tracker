import { z } from 'zod';
import { localDateSchema, nameSchema, noteSchema, objectIdSchema, positiveMinorSchema } from './common';

export const goalCreateSchema = z.strictObject({
  name: nameSchema,
  targetMinor: positiveMinorSchema,
  deadline: localDateSchema.nullable().default(null),
  accountId: objectIdSchema.nullable().default(null),
  priority: z.number().int().min(1).max(9).default(3),
  isEmergencyFund: z.boolean().default(false),
});

export const goalPatchSchema = z.strictObject({
  name: nameSchema.optional(),
  targetMinor: positiveMinorSchema.optional(),
  deadline: localDateSchema.nullable().optional(),
  accountId: objectIdSchema.nullable().optional(),
  priority: z.number().int().min(1).max(9).optional(),
  isEmergencyFund: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export const contributionSchema = z.strictObject({
  amountMinor: positiveMinorSchema,
  localDate: localDateSchema,
  note: noteSchema.default(''),
});

const bp = z.number().int().min(0).max(10_000);

/** Smart Plan overrides; null restores the default for that key. */
export const planSettingsSchema = z.strictObject({
  discretionaryBp: bp.nullable().optional(),
  investingBp: bp.nullable().optional(),
  essentialsBpOverride: bp.nullable().optional(),
  efMonthsOverride: z.number().int().min(1).max(12).nullable().optional(),
  investWhileEfUnfunded: z.boolean().nullable().optional(),
  profileOverride: z.enum(['fixed', 'irregular']).nullable().optional(),
  manualVariableBaselineMinor: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
  reset: z.boolean().optional(),
});
