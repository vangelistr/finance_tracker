import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { NotificationBanner } from '@/components/notifications/banner';
import { QueueSync } from '@/components/pwa/queue-sync';
import { QuickAdd } from '@/components/quick-add/quick-add';
import { AppShell } from '@/components/shell/app-shell';
import { toLocalDate } from '@/lib/dates';
import { requireUser } from '@/server/auth/current';
import { listAccounts } from '@/server/services/accounts';
import { listCategories } from '@/server/services/categories';
import { recentUnread } from '@/server/services/inbox';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireUser();
  if (!user.onboardingDoneAt) redirect('/onboarding');
  const [categories, accounts, unread] = await Promise.all([listCategories(user._id), listAccounts(user._id), recentUnread(user._id)]);
  const quick = {
    categories: categories
      .filter((c) => c.kind === 'expense')
      .map((c) => ({ id: c._id.toHexString(), name: c.name, parentId: c.parentId?.toHexString() ?? null, color: c.color })),
    accounts: accounts.map((a) => ({ id: a._id.toHexString(), name: a.name })),
    currency: user.currency,
    today: toLocalDate(new Date(), user.timezone),
  };
  return (
    <AppShell
      userName={user.name}
      investingEnabled={user.settings.investingEnabled}
      quickAdd={{ rail: <QuickAdd {...quick} variant="rail" />, bar: <QuickAdd {...quick} variant="bar" /> }}
      banner={
        <>
          <QueueSync />
          <NotificationBanner initial={unread} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
