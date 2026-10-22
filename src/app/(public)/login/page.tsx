import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { PublicFrame } from '@/components/shell/public-frame';
import { getCurrentSession } from '@/server/auth/current';
import { isSetupComplete } from '@/server/auth/users';

export async function generateMetadata() {
  const t = await getTranslations('auth.login');
  return { title: t('title') };
}

export default async function LoginPage() {
  if (!(await isSetupComplete())) redirect('/setup');
  const current = await getCurrentSession();
  if (current) redirect(current.session.mfaPending ? '/login/2fa' : '/');
  const t = await getTranslations('auth.login');
  return (
    <PublicFrame title={t('title')}>
      <LoginForm />
    </PublicFrame>
  );
}
