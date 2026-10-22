import { confirmSchema } from '@/lib/validation/finance';
import { transactionDto } from '@/server/services/dto';
import { assertRefsOwned, optionalRef, requireId } from '@/server/services/ids';
import { confirmTransaction } from '@/server/services/transactions';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';

export const POST = api<{ id: string }>('user', async ({ params, body, req, auth }) => {
  const userId = auth!.user._id;
  const input = req.headers.get('content-type')?.startsWith('application/json') ? await body(confirmSchema) : {};
  const accountId = input.accountId !== undefined ? optionalRef(input.accountId) : undefined;
  await assertRefsOwned(userId, { account: [accountId] });
  const updated = await confirmTransaction(userId, requireId(params.id), { amountMinor: input.amountMinor, localDate: input.localDate, accountId });
  if (!updated) throw notFound();
  return { transaction: transactionDto(updated) };
});
