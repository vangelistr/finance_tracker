import { isMonth } from '@/lib/dates';
import { api } from '@/server/http/api';
import { notFound } from '@/server/http/errors';
import { transactionDto } from '@/server/services/dto';
import { setAsideEfka } from '@/server/services/tax';

/** Moves a complete month's EFKA estimate into the tax reserve, once per month. */
export const POST = api<{ month: string }>('user', async ({ params, auth }) => {
  if (!isMonth(params.month)) throw notFound();
  const res = await setAsideEfka(auth!.user, Number(params.month.slice(0, 4)), Number(params.month.slice(5, 7)));
  return { transaction: transactionDto(res.transaction), created: res.created };
});
