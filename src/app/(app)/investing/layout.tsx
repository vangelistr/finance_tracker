import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { InvestingNav } from '@/components/investing/sub-nav';
import { PageHeader } from '@/components/shell/page-header';
import { requireInvestingUser } from '@/server/auth/investing';

/** Every investing view: 404 while the module is off (each page checks again, see requireInvestingUser). */
export default async function InvestingLayout({ children }: { children: ReactNode }) {
  await requireInvestingUser();
  const t = await getTranslations('investing');
  return (
    <>
      <PageHeader title={t('title')} />
      <InvestingNav />
      {children}
    </>
  );
}
