import { transactionDto } from '@/server/services/dto';
import { requireId } from '@/server/services/ids';
import { skipTransaction } from '@/server/services/transactions';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';

export const POST = api<{ id: string }>('user', async ({ params, auth }) => {
  const updated = await skipTransaction(auth!.user._id, requireId(params.id));
  if (!updated) throw notFound();
  return { transaction: transactionDto(updated) };
});
