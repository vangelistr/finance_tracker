import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { requireUser } from '@/server/auth/current';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireUser();
  if (!user.onboardingDoneAt) redirect('/onboarding');
  return (
    <AppShell userName={user.name} investingEnabled={user.settings.investingEnabled}>
      {children}
    </AppShell>
  );
}
