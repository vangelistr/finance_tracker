import { z } from 'zod';
import { FREQUENCIES } from '@/lib/recurrence';
import { compareLocalDates } from '@/lib/dates';
import { currencySchema, localDateSchema, monthSchema, nameSchema, noteSchema, objectIdSchema, positiveMinorSchema, minorSchema } from './common';

export const ACCOUNT_TYPE_VALUES = ['checking', 'cash', 'savings', 'investment', 'bills', 'tax_reserve'] as const;
export const INCOME_TYPE_VALUES = ['recurring_fixed', 'recurring_variable', 'one_time'] as const;

const optionalId = objectIdSchema.nullable().optional();

export const scheduleSchema = z
  .strictObject({
    frequency: z.enum(FREQUENCIES),
    startDate: localDateSchema,
    endDate: localDateSchema.nullable().optional(),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  })
  .refine((s) => !s.endDate || compareLocalDates(s.endDate, s.startDate) >= 0, { message: 'end before start', path: ['endDate'] });

export const accountCreateSchema = z.strictObject({
  name: nameSchema,
  type: z.enum(ACCOUNT_TYPE_VALUES),
  currency: currencySchema.default('EUR'),
  openingBalanceMinor: minorSchema.default(0),
  openingDate: localDateSchema,
});
export const accountPatchSchema = accountCreateSchema.partial().extend({ archived: z.boolean().optional(), sort: z.number().int().min(0).max(10_000).optional() });

export const categoryCreateSchema = z.strictObject({
  kind: z.enum(['expense', 'income']),
  name: nameSchema,
  parentId: optionalId,
  color: z.number().int().min(1).max(8).default(8),
  icon: z.string().max(40).default('circle'),
  essential: z.boolean().default(false),
});
export const categoryPatchSchema = z.strictObject({
  name: nameSchema.optional(),
  color: z.number().int().min(1).max(8).optional(),
  icon: z.string().max(40).optional(),
  essential: z.boolean().optional(),
  archived: z.boolean().optional(),
  sort: z.number().int().min(0).max(10_000).optional(),
});

const incomeSourceBase = z.strictObject({
  name: nameSchema,
  type: z.enum(INCOME_TYPE_VALUES),
  categoryId: optionalId,
  accountId: optionalId,
  currency: currencySchema.default('EUR'),
  schedule: scheduleSchema.nullable().optional(),
  expectedNetMinor: positiveMinorSchema.nullable().optional(),
  expectedGrossMinor: positiveMinorSchema.nullable().optional(),
  freelance: z.boolean().default(false),
  active: z.boolean().default(true),
});
export const incomeSourceCreateSchema = incomeSourceBase.refine(
  (s) => s.type !== 'recurring_fixed' || (!!s.schedule && !!s.expectedNetMinor),
  { message: 'a fixed income needs a schedule and an expected net amount', path: ['schedule'] },
);
export const incomeSourcePatchSchema = incomeSourceBase.partial();

export const recurringExpenseCreateSchema = z.strictObject({
  name: nameSchema,
  amountMinor: positiveMinorSchema,
  categoryId: optionalId,
  accountId: optionalId,
  schedule: scheduleSchema,
  subscription: z
    .strictObject({
      status: z.enum(['active', 'paused', 'cancelled']).default('active'),
      reminderDaysBefore: z.number().int().min(0).max(60).nullable().default(null),
    })
    .nullable()
    .default(null),
  note: noteSchema.default(''),
  active: z.boolean().default(true),
});
export const recurringExpensePatchSchema = z.strictObject({
  name: nameSchema.optional(),
  amountMinor: positiveMinorSchema.optional(),
  categoryId: optionalId,
  accountId: optionalId,
  schedule: scheduleSchema.optional(),
  subscription: z
    .strictObject({
      status: z.enum(['active', 'paused', 'cancelled']),
      reminderDaysBefore: z.number().int().min(0).max(60).nullable(),
    })
    .nullable()
    .optional(),
  note: noteSchema.optional(),
  active: z.boolean().optional(),
});

export const transactionCreateSchema = z
  .strictObject({
    kind: z.enum(['income', 'expense', 'transfer']),
    status: z.enum(['expected', 'done']).default('done'),
    amountMinor: positiveMinorSchema,
    grossMinor: positiveMinorSchema.nullable().optional(),
    accountId: optionalId,
    toAccountId: optionalId,
    categoryId: optionalId,
    incomeSourceId: optionalId,
    localDate: localDateSchema,
    note: noteSchema.default(''),
    clientId: z.uuid().optional(),
    origin: z.enum(['manual', 'offline']).default('manual'),
  })
  .refine((t) => t.kind !== 'transfer' || (!!t.accountId && !!t.toAccountId && t.accountId !== t.toAccountId), {
    message: 'a transfer needs two different accounts',
    path: ['toAccountId'],
  });

export const transactionPatchSchema = z.strictObject({
  amountMinor: positiveMinorSchema.optional(),
  grossMinor: positiveMinorSchema.nullable().optional(),
  accountId: optionalId,
  categoryId: optionalId,
  incomeSourceId: optionalId,
  localDate: localDateSchema.optional(),
  note: noteSchema.optional(),
});

export const confirmSchema = z.strictObject({
  amountMinor: positiveMinorSchema.optional(),
  localDate: localDateSchema.optional(),
  accountId: optionalId,
});

export const transactionListQuery = z.strictObject({
  month: monthSchema.optional(),
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
  kind: z.enum(['income', 'expense', 'transfer']).optional(),
  status: z.enum(['expected', 'done', 'skipped']).optional(),
  categoryId: objectIdSchema.optional(),
  accountId: objectIdSchema.optional(),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type AccountCreate = z.infer<typeof accountCreateSchema>;
export type CategoryCreate = z.infer<typeof categoryCreateSchema>;
export type IncomeSourceCreate = z.infer<typeof incomeSourceCreateSchema>;
export type RecurringExpenseCreate = z.infer<typeof recurringExpenseCreateSchema>;
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;
