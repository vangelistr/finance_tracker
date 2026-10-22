import { getTranslations } from 'next-intl/server';
import { Accounts } from '@/components/finance/accounts';
import { PageHeader } from '@/components/shell/page-header';
import { toLocalDate } from '@/lib/dates';
import { requireUser } from '@/server/auth/current';
import { accountBalances, listAccounts } from '@/server/services/accounts';
import { accountDto } from '@/server/services/dto';

export async function generateMetadata() {
  const t = await getTranslations('accounts');
  return { title: t('title') };
}

export default async function AccountsPage() {
  const { user } = await requireUser();
  const t = await getTranslations('accounts');
  const [accounts, balances] = await Promise.all([listAccounts(user._id, { includeArchived: true }), accountBalances(user._id)]);
  return (
    <>
      <PageHeader title={t('title')} />
      <Accounts rows={accounts.map((a) => accountDto(a, balances.get(a._id.toHexString())))} currency={user.currency} today={toLocalDate(new Date(), user.timezone)} />
    </>
  );
}
