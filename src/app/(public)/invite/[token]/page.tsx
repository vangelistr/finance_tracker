import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { InviteForm } from '@/components/auth/invite-form';
import { PublicFrame } from '@/components/shell/public-frame';
import { Notice } from '@/components/ui/notice';
import { tokenId } from '@/server/auth/crypto';
import { getCurrentSession } from '@/server/auth/current';
import { col } from '@/server/db/collections';

export async function generateMetadata() {
  const t = await getTranslations('auth.invite');
  return { title: t('title') };
}

export default async function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  const { token } = await params;
  const current = await getCurrentSession();
  if (current && !current.session.mfaPending) redirect('/');
  const t = await getTranslations('auth');
  const valid =
    /^[A-Za-z0-9_-]{20,100}$/.test(token) &&
    !!(await (await col()).invites.findOne({ _id: tokenId(token), usedAt: null, expiresAt: { $gt: new Date() } }, { projection: { _id: 1 } }));
  return (
    <PublicFrame title={t('invite.title')} intro={valid ? t('invite.intro') : undefined}>
      {valid ? <InviteForm token={token} /> : <Notice tone="warning">{t('errors.inviteInvalid')}</Notice>}
    </PublicFrame>
  );
}
