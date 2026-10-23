'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

const TABS = [
  { key: 'ranking', href: '/investing' },
  { key: 'suggestion', href: '/investing/suggestion' },
  { key: 'watchlist', href: '/investing/watchlist' },
  { key: 'profile', href: '/investing/profile' },
] as const;

/** The module's four views as a row of links; scrolls sideways on a phone instead of wrapping. */
export function InvestingNav() {
  const t = useTranslations('investing');
  const pathname = usePathname();
  return (
    <nav aria-label={t('title')} className="-mx-4 mb-6 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex min-w-max gap-1 border-b border-rule">
        {TABS.map((tab) => {
          const current = pathname === tab.href;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  '-mb-px flex min-h-11 items-center border-b-2 px-3 whitespace-nowrap transition-colors',
                  current ? 'border-accent font-semibold text-ink' : 'border-transparent text-ink-2 hover:text-ink',
                )}
              >
                {t(`tabs.${tab.key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
