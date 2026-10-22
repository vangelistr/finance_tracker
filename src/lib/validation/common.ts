import { z } from 'zod';
import { isLocalDate, isMonth, isValidTimeZone } from '@/lib/dates';
import { MAX_MINOR } from '@/lib/money';

export const LOCALES = ['el', 'en'] as const;
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const;

export const localeSchema = z.enum(LOCALES);
export const currencySchema = z.enum(CURRENCIES);
export const timezoneSchema = z.string().min(1).max(64).refine(isValidTimeZone, 'invalid time zone');
export const localDateSchema = z.string().refine(isLocalDate, 'invalid date');
export const monthSchema = z.string().refine(isMonth, 'invalid month');
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'invalid time');
export const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, 'invalid id');
export const minorSchema = z.number().int().min(-MAX_MINOR).max(MAX_MINOR);
export const positiveMinorSchema = z.number().int().min(1).max(MAX_MINOR);
export const nameSchema = z.string().trim().min(1).max(80);
export const noteSchema = z.string().trim().max(500);
