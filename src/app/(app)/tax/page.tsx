import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { RatesPanel, TaxProfileForm } from '@/components/tax/forms';
import { TaxView } from '@/components/tax/tax-view';
import { PageHeader } from '@/components/shell/page-header';
import { cn } from '@/lib/cn';
import { zonedParts } from '@/lib/dates';
import { TAX_YEARS } from '@/lib/tax/configs';
import { requireUser } from '@/server/auth/current';
import { col } from '@/server/db/collections';
import { loadTax } from '@/server/services/tax';

export async function generateMetadata() {
  const t = await getTranslations('tax');
  return { title: t('title') };
}

export default async function TaxPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { user } = await requireUser();
  const t = await getTranslations('tax');
  const current = zonedParts(new Date(), user.timezone).year;
  const years = [...new Set([...TAX_YEARS, current])].sort();
  const requested = Number((await searchParams).year);
  const year = years.includes(requested) ? requested : current;
  const [v, hasFreelance] = await Promise.all([loadTax(user, year), (await col()).incomeSources.countDocuments({ userId: user._id, freelance: true }, { limit: 1 })]);

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <nav aria-label={t('year')} className="flex gap-1">
            {years.map((y) => (
              <Link
                key={y}
                href={y === current ? '/tax' : `/tax?year=${y}`}
                prefetch={false}
                aria-current={y === year ? 'page' : undefined}
                className={cn('num flex min-h-11 items-center rounded-md px-3', y === year ? 'bg-accent-soft font-semibold text-ink' : 'text-ink-2 hover:bg-surface-hover')}
              >
                {y}
              </Link>
            ))}
          </nav>
        }
      />
      <TaxView
        data={{
          taxYear: v.taxYear,
          throughMonth: v.throughMonth,
          efkaDueThrough: v.efkaDueThrough,
          configYear: v.configYear,
          configFallback: v.configFallback,
          hasFreelance: hasFreelance > 0,
          full: v.full,
          ytd: v.ytd,
          invoiceMeta: Object.fromEntries([...v.invoiceMeta].map(([k, m]) => [k, { source: m.source }])),
          moved: Object.fromEntries(v.moved),
          reserve: v.reserve,
          movedThisYearMinor: v.movedThisYearMinor,
          dueNowMinor: v.dueNowMinor,
        }}
        currency={user.currency}
        profile={<TaxProfileForm profile={v.profile} currency={user.currency} />}
        rates={<RatesPanel key={JSON.stringify(v.config)} config={v.config} edited={v.configEdited} year={v.configYear} currency={user.currency} />}
      />
    </>
  );
}
