import { accountDto, categoryDto } from '@/server/services/dto';
import { listAccounts } from '@/server/services/accounts';
import { listCategories } from '@/server/services/categories';
import { api } from '@/server/http/api';

// What the offline quick-add needs: expense categories and active accounts (no amounts, no history).
export const GET = api('user', async ({ auth }) => {
  const userId = auth!.user._id;
  const [categories, accounts] = await Promise.all([listCategories(userId), listAccounts(userId)]);
  return {
    categories: categories.filter((c) => c.kind === 'expense').map(categoryDto),
    accounts: accounts.map((a) => accountDto(a)),
    currency: auth!.user.currency,
  };
});
