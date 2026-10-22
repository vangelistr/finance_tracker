import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Wordmark } from '@/components/brand/station-mark';
import { LocaleSwitch } from '@/components/locale-switch';

/** Signed-out frame: the navy rail carries the name and a line; the task sits on the ground. */
export async function PublicFrame({
  title,
  intro,
  showLocale = true,
  wide = false,
  children,
}: {
  title: string;
  intro?: ReactNode;
  showLocale?: boolean;
  /** Onboarding needs room for lists; sign-in forms stay narrow. */
  wide?: boolean;
  children: ReactNode;
}) {
  const t = await getTranslations('app');
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(320px,2fr)_3fr]">
      <header className="relative overflow-hidden bg-rail text-rail-ink">
        <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-4 lg:px-10 lg:pt-10">
          <Wordmark name={t('name')} className="text-lg" />
        </div>
        <LineMotif />
        <p className="hidden px-10 pb-10 text-lg text-rail-ink-2 lg:absolute lg:bottom-0 lg:block lg:max-w-sm">{t('tagline')}</p>
      </header>
      <main id="main" className={`mx-auto flex w-full flex-col gap-6 px-5 py-8 lg:justify-center lg:py-16 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-[-0.015em]">{title}</h1>
          {showLocale && <LocaleSwitch className="shrink-0" />}
        </div>
        {intro && <p className="-mt-2 text-ink-2">{intro}</p>}
        {children}
      </main>
    </div>
  );
}

/** A short run of line with stations: filled behind, hollow ahead. Decorative. */
function LineMotif() {
  return (
    <svg aria-hidden viewBox="0 0 400 28" preserveAspectRatio="xMinYMid meet" className="block h-7 w-full px-5 pb-2 lg:mt-8 lg:h-auto lg:px-10">
      <line x1="0" y1="14" x2="400" y2="14" stroke="var(--income)" strokeWidth="6" />
      {[30, 110, 190].map((x) => (
        <circle key={x} cx={x} cy="14" r="8" fill="var(--rail-ink)" stroke="var(--income)" strokeWidth="4" />
      ))}
      {[270, 350].map((x) => (
        <circle key={x} cx={x} cy="14" r="8" fill="var(--rail)" stroke="var(--rail-ink)" strokeWidth="4" />
      ))}
    </svg>
  );
}
