import { NextRequest } from 'next/server';

type Handler = (req: NextRequest, ctx?: { params: Promise<never> }) => Promise<Response>;

const ORIGIN = 'http://localhost:3000';

/**
 * Calls route handlers in-process like a browser would: a cookie jar, the Origin header and the double-submit
 * CSRF token. Options can drop the Origin or the token to test the CSRF defence.
 */
export class TestClient {
  readonly jar = new Map<string, string>([['ft_csrf', 'test-csrf-token-0123456789']]);

  async call(
    handler: Handler,
    method: string,
    path: string,
    opts: { body?: unknown; params?: Record<string, string>; origin?: string | null; csrf?: string | null; ip?: string } = {},
  ) {
    const headers = new Headers({ accept: 'application/json', 'x-forwarded-for': opts.ip ?? '10.0.0.1' });
    if (opts.body !== undefined) headers.set('content-type', 'application/json');
    if (opts.origin !== null) headers.set('origin', opts.origin ?? ORIGIN);
    const csrf = opts.csrf === undefined ? this.jar.get('ft_csrf') : opts.csrf;
    if (csrf) headers.set('x-csrf-token', csrf);
    headers.set('cookie', [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '));
    const req = new NextRequest(new URL(path, ORIGIN), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const res = await handler(req, opts.params ? { params: Promise.resolve(opts.params as never) } : undefined);
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      const [name, ...rest] = pair!.split('=');
      const value = rest.join('=');
      if (/max-age=0/i.test(raw) || value === '') this.jar.delete(name!);
      else this.jar.set(name!, value);
    }
    const json = await res.json().catch(() => null);
    return { status: res.status, json, headers: res.headers };
  }

  get sessionToken() {
    return this.jar.get('ft_session');
  }
}
