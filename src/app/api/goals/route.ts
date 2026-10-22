import { goalCreateSchema } from '@/lib/validation/goals';
import { createGoal, listGoals } from '@/server/services/goals';
import { assertRefsOwned, optionalRef } from '@/server/services/ids';
import { goalDto } from '@/server/services/dto';
import { api } from '@/server/http/api';


export const GET = api('user', async ({ auth }) => {
  const { user } = auth!;
  const list = await listGoals(user._id, user.timezone);
  return {
    goals: list.map((x) => ({
      ...goalDto(x.goal),
      savedMinor: x.savedMinor,
      status: x.status,
      contributions: x.contributions.slice(0, 50).map((c) => ({ id: c._id.toHexString(), amountMinor: c.amountMinor, localDate: c.localDate, source: c.source, note: c.note })),
    })),
  };
});

export const POST = api('user', async ({ body, auth }) => {
  const userId = auth!.user._id;
  const input = await body(goalCreateSchema);
  const accountId = optionalRef(input.accountId);
  await assertRefsOwned(userId, { account: [accountId] });
  return { goal: goalDto(await createGoal(userId, { ...input, accountId })) };
});
