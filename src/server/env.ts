import 'server-only';
import { z } from 'zod';

// Environment contract (see .env.example). Errors name the variable, never its value.

const hex32 = z.string().regex(/^[0-9a-f]{64}$/i, 'must be 32 bytes as 64 hex characters');
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.url({ protocol: /^https?$/ }),
  SESSION_SECRET: hex32,
  DATA_ENCRYPTION_KEY: hex32,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  MONGO_URL: optional,
  MONGO_HOST: z.string().default('mongo'),
  MONGO_PORT: z.coerce.number().int().min(1).max(65535).default(27017),
  MONGO_DB: z.string().regex(/^[A-Za-z0-9_-]{1,63}$/).default('finance'),
  MONGO_APP_USER: optional,
  MONGO_APP_PASSWORD: optional,

  VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: optional.refine((v) => v === undefined || /^(mailto:|https:\/\/)/.test(v), 'must start with mailto: or https://'),

  TWELVEDATA_API_KEY: optional,
  EODHD_API_KEY: optional,
  FMP_API_KEY: optional,
  ALPHAVANTAGE_API_KEY: optional,
  FINNHUB_API_KEY: optional,
  FX_BASE_URL: z.url({ protocol: /^https$/ }).default('https://api.frankfurter.dev'),

  WORKER_HEARTBEAT_FILE: z.string().default('/tmp/worker-heartbeat'),
  BACKUP_STALE_HOURS: z.coerce.number().int().min(1).max(24 * 14).default(26),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }
  return result.data;
}

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** For tests only. */
export function resetEnvCache() {
  cached = undefined;
}

export function mongoUrl(e: Env = env()): string {
  if (e.MONGO_URL) return e.MONGO_URL;
  if (!e.MONGO_APP_USER || !e.MONGO_APP_PASSWORD) {
    throw new Error('Invalid environment configuration: MONGO_URL or MONGO_APP_USER and MONGO_APP_PASSWORD are required');
  }
  const user = encodeURIComponent(e.MONGO_APP_USER);
  const pass = encodeURIComponent(e.MONGO_APP_PASSWORD);
  return `mongodb://${user}:${pass}@${e.MONGO_HOST}:${e.MONGO_PORT}/${e.MONGO_DB}?authSource=${e.MONGO_DB}`;
}

export function isHttps(e: Env = env()): boolean {
  return e.APP_URL.startsWith('https://');
}

export function pushConfigured(e: Env = env()): boolean {
  return !!(e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY && e.VAPID_SUBJECT);
}
