import { z } from 'zod';
import { EXCHANGES, INSTRUMENT_TYPES, PRICE_SCALE, PROVIDERS, REGIONS, TRADING_CURRENCIES } from '@/lib/investing/instruments';
import { METRICS } from '@/lib/investing/metrics';
import { QUESTIONS, RISK_PROFILES } from '@/lib/investing/split';
import { localDateSchema, nameSchema } from './common';

// Tickers and provider symbols: letters, digits and the separators exchanges use (BRK.B, BT-A, VWCE.XETRA).
const symbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9.\-]{0,19}$/, 'invalid symbol');
const isinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}[A-Z0-9]{9}\d$/, 'invalid ISIN');
const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'invalid country code');

const providerSymbolsSchema = z.strictObject(Object.fromEntries(PROVIDERS.map((p) => [p, symbolSchema.optional()])) as Record<(typeof PROVIDERS)[number], z.ZodOptional<typeof symbolSchema>>);

const instrumentFields = {
  name: nameSchema,
  isin: isinSchema.nullable(),
  currency: z.enum(TRADING_CURRENCIES),
  type: z.enum(INSTRUMENT_TYPES),
  region: z.enum(REGIONS),
  domicile: countrySchema,
  terBps: z.number().int().min(0).max(1000).nullable(),
  core: z.boolean(),
  leveraged: z.boolean(),
  crypto: z.boolean(),
  providerSymbols: providerSymbolsSchema,
};

export const watchlistCreateSchema = z.strictObject({
  symbol: symbolSchema,
  exchange: z.enum(EXCHANGES),
  ...instrumentFields,
  isin: instrumentFields.isin.default(null),
  terBps: instrumentFields.terBps.default(null),
  core: instrumentFields.core.default(false),
  leveraged: instrumentFields.leveraged.default(false),
  crypto: instrumentFields.crypto.default(false),
  providerSymbols: providerSymbolsSchema.default({}),
});

/** Symbol and exchange identify the listing and its price history, so they are fixed after creation. */
export const watchlistPatchSchema = z.strictObject(Object.fromEntries(Object.entries(instrumentFields).map(([k, v]) => [k, v.optional()])) as { [K in keyof typeof instrumentFields]: z.ZodOptional<(typeof instrumentFields)[K]> });

export const manualPriceSchema = z.strictObject({
  watchlistId: z.string().regex(/^[0-9a-f]{24}$/i, 'invalid id'),
  localDate: localDateSchema,
  priceMicros: z.number().int().min(1).max(PRICE_SCALE * 1_000_000_000),
});

const bp = z.number().int().min(0).max(10_000);

export const investingProfileSchema = z.strictObject({
  answers: z.strictObject({ horizon: z.enum(QUESTIONS.horizon), drawdown: z.enum(QUESTIONS.drawdown), experience: z.enum(QUESTIONS.experience) }).nullable().optional(),
  profileOverride: z.enum(RISK_PROFILES).nullable().optional(),
  weights: z
    .strictObject(Object.fromEntries(METRICS.map((m) => [m, z.number().int().min(0).max(100)])) as Record<(typeof METRICS)[number], z.ZodNumber>)
    .refine((w) => Object.values(w).some((v) => v > 0), 'at least one weight above zero')
    .optional(),
  guardrails: z
    .strictObject({
      maxPerInstrumentBp: bp.min(500),
      maxPerRegionBp: bp.min(500),
      maxPerCurrencyBp: bp.min(500),
      allowLeveraged: z.boolean(),
      allowCrypto: z.boolean(),
    })
    .optional(),
  reset: z.boolean().optional(),
});
