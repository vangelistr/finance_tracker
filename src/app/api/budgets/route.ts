import { z } from 'zod';
import { minorSchema, objectIdSchema } from '@/lib/validation/common';
import { listBudgets, setBudgets } from '@/server/services/budgets';
import { optionalRef } from '@/server/services/ids';
import { api } from '@/server/http/api';

const budgetsSchema = z.strictObject({
  budgets: z
    .array(z.strictObject({ categoryId: objectIdSchema.nullable(), amountMinor: minorSchema.refine((v) => v >= 0, 'must not be negative') }))
    .max(100)
    .refine((list) => new Set(list.map((b) => b.categoryId ?? 'overall')).size === list.length, 'duplicate category'),
});

const dto = (b: { categoryId: { toHexString(): string } | null; amountMinor: number }) => ({ categoryId: b.categoryId?.toHexString() ?? null, amountMinor: b.amountMinor });

export const GET = api('user', async ({ auth }) => ({ budgets: (await listBudgets(auth!.user._id)).map(dto) }));

export const PUT = api('user', async ({ body, auth }) => {
  const { budgets } = await body(budgetsSchema);
  const saved = await setBudgets(
    auth!.user._id,
    budgets.map((b) => ({ categoryId: optionalRef(b.categoryId), amountMinor: b.amountMinor })),
  );
  return { budgets: saved.map(dto) };
});
