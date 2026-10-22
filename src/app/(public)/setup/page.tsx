import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { SetupWizard } from '@/components/auth/setup-wizard';
import { PublicFrame } from '@/components/shell/public-frame';
import { isSetupComplete } from '@/server/auth/users';

export async function generateMetadata() {
  const t = await getTranslations('auth.setup');
  return { title: t('title') };
}

export default async function SetupPage() {
  if (await isSetupComplete()) redirect('/login');
  const t = await getTranslations('auth.setup');
  return (
    <PublicFrame title={t('title')} intro={t('intro')}>
      <SetupWizard />
    </PublicFrame>
  );
}
