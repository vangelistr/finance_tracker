import { accountCreateSchema } from '@/lib/validation/finance';
import { accountBalances, createAccount, listAccounts } from '@/server/services/accounts';
import { accountDto } from '@/server/services/dto';
import { api } from '@/server/http/api';

export const GET = api('user', async ({ auth }) => {
  const userId = auth!.user._id;
  const [accounts, balances] = await Promise.all([listAccounts(userId, { includeArchived: true }), accountBalances(userId)]);
  return { accounts: accounts.map((a) => accountDto(a, balances.get(a._id.toHexString()))) };
});

export const POST = api('user', async ({ body, auth }) => {
  const input = await body(accountCreateSchema);
  return { account: accountDto(await createAccount(auth!.user._id, input)) };
});
