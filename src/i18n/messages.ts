import type { Locale } from '@/server/db/types';
import el from './messages/el.json';
import en from './messages/en.json';

export type Messages = typeof el;

const ALL: Record<Locale, Messages> = { el, en };

/** Messages for server-side text outside a request (worker, push payloads). */
export async function loadMessages(locale: Locale): Promise<Messages> {
  return ALL[locale] ?? ALL.el;
}
