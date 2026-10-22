import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { TotpForm } from '@/components/auth/totp-form';
import { PublicFrame } from '@/components/shell/public-frame';
import { getCurrentSession } from '@/server/auth/current';

export async function generateMetadata() {
  const t = await getTranslations('auth.twofa');
  return { title: t('title') };
}

export default async function TwoFactorPage() {
  const current = await getCurrentSession();
  if (!current) redirect('/login');
  if (!current.session.mfaPending) redirect('/');
  const t = await getTranslations('auth.twofa');
  return (
    <PublicFrame title={t('title')} intro={t('body')}>
      <TotpForm />
    </PublicFrame>
  );
}
