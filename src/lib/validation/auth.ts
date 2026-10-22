import { z } from 'zod';
import { currencySchema, localeSchema, nameSchema, timezoneSchema } from './common';

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

export const setupSchema = z.strictObject({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
  locale: localeSchema,
  currency: currencySchema,
  timezone: timezoneSchema,
  investingEnabled: z.boolean(),
});

export const loginSchema = z.strictObject({
  email: z.string().trim().max(254),
  password: z.string().min(1).max(PASSWORD_MAX),
});

export const totpCodeSchema = z.strictObject({ code: z.string().regex(/^\d{6}$/) });

export const registerSchema = z.strictObject({
  token: z.string().min(20).max(100),
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
  locale: localeSchema,
});

export const changePasswordSchema = z.strictObject({
  current: z.string().min(1).max(PASSWORD_MAX),
  next: passwordSchema,
});

export const disableTotpSchema = z.strictObject({
  password: z.string().min(1).max(PASSWORD_MAX),
  code: z.string().regex(/^\d{6}$/),
});

export const inviteCreateSchema = z.strictObject({ note: z.string().trim().max(80).default('') });
