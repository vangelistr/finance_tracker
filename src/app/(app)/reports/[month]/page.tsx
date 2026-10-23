import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { PrintButton } from '@/components/reports/print-button';
import { ReportView } from '@/components/reports/report-view';
import { PageHeader } from '@/components/shell/page-header';
import { isMonth } from '@/lib/dates';
import { formatMonth } from '@/lib/intl';
import { requireUser } from '@/server/auth/current';
import { ensureReport } from '@/server/services/reports';

export async function generateMetadata({ params }: { params: Promise<{ month: string }> }) {
  const [t, locale, { month }] = await Promise.all([getTranslations('reports'), getLocale(), params]);
  return { title: isMonth(month) ? `${formatMonth(month, locale)} · ${t('title')}` : t('title') };
}

export default async function ReportPage({ params }: { params: Promise<{ month: string }> }) {
  const { user } = await requireUser();
  const { month } = await params;
  if (!isMonth(month)) notFound();
  const report = await ensureReport(user, month);
  if (!report) notFound();
  const [t, locale] = await Promise.all([getTranslations('reports'), getLocale()]);
  const title = formatMonth(month, locale);
  return (
    <>
      <Link href="/reports" prefetch={false} className="no-print mb-2 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">
        ← {t('back')}
      </Link>
      <PageHeader title={title.charAt(0).toUpperCase() + title.slice(1)} actions={<PrintButton label={t('print')} />} />
      <ReportView data={report.data} generatedAt={report.generatedAt.toISOString()} />
    </>
  );
}
