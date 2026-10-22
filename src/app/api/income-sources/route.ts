import { incomeSourceCreateSchema } from '@/lib/validation/finance';
import { incomeSourceDto } from '@/server/services/dto';
import { assertRefsOwned, optionalRef } from '@/server/services/ids';
import { createIncomeSource, listIncomeSources } from '@/server/services/sources';
import { api } from '@/server/http/api';

export const GET = api('user', async ({ auth }) => ({
  incomeSources: (await listIncomeSources(auth!.user._id, { includeInactive: true })).map(incomeSourceDto),
}));

export const POST = api('user', async ({ body, auth }) => {
  const { user } = auth!;
  const input = await body(incomeSourceCreateSchema);
  const categoryId = optionalRef(input.categoryId);
  const accountId = optionalRef(input.accountId);
  await assertRefsOwned(user._id, { category: [categoryId], account: [accountId] });
  const doc = await createIncomeSource(
    user._id,
    {
      name: input.name,
      type: input.type,
      categoryId,
      accountId,
      currency: input.currency,
      schedule: input.schedule ?? null,
      expectedNetMinor: input.expectedNetMinor ?? null,
      expectedGrossMinor: input.expectedGrossMinor ?? null,
      freelance: input.freelance,
      active: input.active,
    },
    user.timezone,
  );
  return { incomeSource: incomeSourceDto(doc) };
});
