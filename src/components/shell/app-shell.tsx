'use client';

import { LogOut, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { Wordmark } from '@/components/brand/station-mark';
import { Sheet } from '@/components/ui/sheet';
import { BOTTOM_BAR_KEYS, isActive, NAV, type NavItem } from './nav';

interface AppShellProps {
  userName: string;
  investingEnabled: boolean;
  quickAdd?: { rail: ReactNode; bar: ReactNode };
  banner?: ReactNode;
  children: ReactNode;
}

/**
 * Desktop: a navy rail on the left. Phone: a bottom bar with the main destinations around a central Add,
 * and everything else under More.
 */
export function AppShell({ userName, investingEnabled, quickAdd, banner, children }: AppShellProps) {
  const t = useTranslations('nav');
  const tApp = useTranslations('app');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const items = NAV.filter((i) => !i.investingOnly || investingEnabled);
  const barItems = items.filter((i) => BOTTOM_BAR_KEYS.includes(i.key));
  const moreItems = items.filter((i) => !BOTTOM_BAR_KEYS.includes(i.key));

  async function signOut() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        {t('skipToContent')}
      </a>

      {/* Desktop rail */}
      <div className="hidden bg-rail lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col text-rail-ink">
          <div className="px-5 pt-6 pb-5">
            <Wordmark name={tApp('name')} />
          </div>
          {quickAdd && <div className="px-4 pb-4">{quickAdd.rail}</div>}
          <nav aria-label={t('main')} className="flex-1 overflow-y-auto px-3">
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => (
                <li key={item.key}>
                  <RailLink item={item} label={t(item.key)} active={isActive(pathname, item.href)} />
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center justify-between gap-2 border-t border-rail-rule px-5 py-4 text-sm">
            <span className="truncate text-rail-ink-2">{userName}</span>
            <button
              type="button"
              onClick={signOut}
              className="-mr-2 grid size-10 shrink-0 place-items-center rounded-md text-rail-ink-2 hover:bg-rail-2 hover:text-rail-ink"
              aria-label={t('signOut')}
              title={t('signOut')}
            >
              <LogOut aria-hidden className="size-4.5" strokeWidth={1.75} />
            </button>
          </div>
        </aside>
      </div>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <main id="main" className="mx-auto w-full max-w-[72rem] flex-1 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
          {banner}
          {children}
        </main>
      </div>

      {/* Phone bottom bar */}
      <nav aria-label={t('main')} className="fixed inset-x-0 bottom-0 z-30 bg-rail text-rail-ink pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5 items-stretch">
          {barItems.slice(0, 2).map((item) => (
            <li key={item.key}>
              <BarLink item={item} label={t(item.key)} active={isActive(pathname, item.href)} />
            </li>
          ))}
          {barItems.length < 2 && <li aria-hidden />}
          <li className="grid place-items-center">{quickAdd?.bar}</li>
          {barItems.slice(2, 3).map((item) => (
            <li key={item.key}>
              <BarLink item={item} label={t(item.key)} active={isActive(pathname, item.href)} />
            </li>
          ))}
          {barItems.length < 3 && <li aria-hidden />}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(barLinkClasses, moreItems.some((i) => isActive(pathname, i.href)) && 'text-rail-ink')}
            >
              <Menu aria-hidden className="size-5" strokeWidth={1.75} />
              <span>{t('more')}</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t('more')} closeLabel={tc('close')}>
        <ul className="-mx-2 flex flex-col">
          {moreItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-md px-2 text-base',
                    active ? 'bg-accent-soft font-semibold text-ink' : 'text-ink hover:bg-surface-hover',
                  )}
                >
                  <Icon aria-hidden className="size-5 text-ink-2" strokeWidth={1.75} />
                  {t(item.key)}
                </Link>
              </li>
            );
          })}
          <li className="mt-2 border-t border-rule pt-2">
            <button type="button" onClick={signOut} className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left text-ink hover:bg-surface-hover">
              <LogOut aria-hidden className="size-5 text-ink-2" strokeWidth={1.75} />
              {t('signOut')}
            </button>
          </li>
        </ul>
      </Sheet>
    </div>
  );
}

function RailLink({ item, label, active }: { item: NavItem; label: string; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-h-10 items-center gap-3 rounded-md px-3 text-[0.9375rem] transition-colors duration-150',
        active ? 'bg-rail-2 font-semibold text-rail-ink' : 'text-rail-ink-2 hover:bg-rail-2/60 hover:text-rail-ink',
      )}
    >
      {/* The current destination is a station on the rail's line */}
      <span
        aria-hidden
        className={cn('absolute -left-3 size-2.5 rounded-full border-2', active ? 'border-rail-ink bg-rail-ink' : 'border-transparent')}
      />
      <Icon aria-hidden className="size-[1.125rem] shrink-0" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

const barLinkClasses =
  'flex h-full w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-rail-ink-2 transition-colors duration-150 hover:text-rail-ink';

function BarLink({ item, label, active }: { item: NavItem; label: string; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} className={cn(barLinkClasses, active && 'text-rail-ink')}>
      <span className="relative">
        <Icon aria-hidden className="size-5" strokeWidth={active ? 2.25 : 1.75} />
      </span>
      <span className="max-w-full truncate px-1">{label}</span>
      <span aria-hidden className={cn('h-0.5 w-5 rounded-full', active ? 'bg-rail-ink' : 'bg-transparent')} />
    </Link>
  );
}
