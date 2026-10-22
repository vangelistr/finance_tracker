/** BCP 47 locale for Intl formatting from the app locale. */
export function intlLocale(locale: string): string {
  return locale === 'en' ? 'en-IE' : 'el-GR';
}

/** "Τετάρτη 22 Οκτωβρίου" / "Wednesday 22 October" for a local date, without time-zone shifts. */
export function formatDay(date: string, locale: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return new Intl.DateTimeFormat(intlLocale(locale), { ...opts, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

export function formatMonth(month: string, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
}
