import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { CSRF_HEADER, csrfCookieName, sessionCookieName } from '@/lib/cookie-names';
import { safeEqual } from '@/server/auth/crypto';
import { findSession, type ActiveSession } from '@/server/auth/sessions';
import { env, isHttps } from '@/server/env';
import { errorFields, log } from '@/server/log';
import { ApiError } from './errors';

type Access = 'public' | 'mfa' | 'user' | 'owner';

export interface ApiContext<P> {
  req: NextRequest;
  params: P;
  /** Set for `user`, `owner` and `mfa` access. */
  auth: ActiveSession | null;
  body: <S extends z.ZodType>(schema: S) => Promise<z.infer<S>>;
  query: <S extends z.ZodType>(schema: S) => z.infer<S>;
  /** Session cookie changes, applied to the response (HttpOnly, Secure over HTTPS, SameSite=Lax). */
  sessionCookie: { set: (token: string, expiresAt: Date) => void; clear: () => void };
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MAX_BODY_BYTES = 64 * 1024;

export function jsonError(err: ApiError): Response {
  return Response.json(
    { error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } },
    { status: err.status, headers: { 'cache-control': 'no-store', ...err.headers } },
  );
}

function zodFields(err: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Origin must match APP_URL and the double-submit token must match its cookie. */
export function checkCsrf(req: NextRequest): void {
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(env().APP_URL).origin) throw new ApiError(403, 'csrf', 'origin mismatch');
  const cookie = req.cookies.get(csrfCookieName(isHttps()))?.value ?? '';
  const header = req.headers.get(CSRF_HEADER) ?? '';
  if (!cookie || !header || !safeEqual(cookie, header)) throw new ApiError(403, 'csrf', 'token mismatch');
}

async function readJson(req: NextRequest): Promise<unknown> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.startsWith('application/json')) throw new ApiError(415, 'bad_request', 'expected application/json');
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, 'bad_request', 'body too large');
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'bad_request', 'invalid JSON');
  }
}

/**
 * Wraps a route handler: CSRF for unsafe methods, session and role checks, zod parsing helpers and one
 * error shape. Handlers return a Response or a JSON-serialisable value.
 */
export function api<P = Record<string, never>>(
  access: Access,
  handler: (ctx: ApiContext<P>) => Promise<Response | object | null>,
) {
  return async (req: NextRequest, routeCtx?: { params: Promise<P> }): Promise<Response> => {
    try {
      if (UNSAFE.has(req.method)) checkCsrf(req);
      let auth: ActiveSession | null = null;
      if (access !== 'public') {
        auth = await findSession(req.cookies.get(sessionCookieName(isHttps()))?.value);
        if (!auth) throw new ApiError(401, 'unauthorized');
        if (access === 'mfa') {
          if (!auth.session.mfaPending) throw new ApiError(400, 'bad_request', 'no pending second factor');
        } else if (auth.session.mfaPending) {
          throw new ApiError(401, 'mfa_required');
        }
        if (access === 'owner' && auth.user.role !== 'owner') throw new ApiError(403, 'forbidden');
      }
      const params = (routeCtx ? await routeCtx.params : {}) as P;
      let cookie: { token: string; expiresAt: Date | null } | undefined;
      const ctx: ApiContext<P> = {
        req,
        params,
        auth,
        body: async (schema) => schema.parse(await readJson(req)),
        query: (schema) => schema.parse(Object.fromEntries(req.nextUrl.searchParams)),
        sessionCookie: {
          set: (token, expiresAt) => (cookie = { token, expiresAt }),
          clear: () => (cookie = { token: '', expiresAt: null }),
        },
      };
      const result = await handler(ctx);
      const res =
        result instanceof Response
          ? new NextResponse(result.body, { status: result.status, headers: result.headers })
          : NextResponse.json(result ?? { ok: true });
      res.headers.set('cache-control', 'no-store');
      if (cookie) {
        const https = isHttps();
        res.cookies.set(sessionCookieName(https), cookie.token, {
          httpOnly: true,
          secure: https,
          sameSite: 'lax',
          path: '/',
          ...(cookie.expiresAt ? { expires: cookie.expiresAt } : { maxAge: 0 }),
        });
      }
      return res;
    } catch (err) {
      if (err instanceof ApiError) return jsonError(err);
      if (err instanceof z.ZodError) return jsonError(new ApiError(400, 'validation', 'invalid input', zodFields(err)));
      log.error('api error', { path: req.nextUrl.pathname, method: req.method, ...errorFields(err) });
      return jsonError(new ApiError(500, 'internal', 'internal error'));
    }
  };
}

/** Client IP for rate limiting. The app is only reachable through tailscale serve on loopback. */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || 'local';
}
