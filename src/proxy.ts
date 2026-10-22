import { NextResponse, type NextRequest } from 'next/server';
import { csrfCookieName, sessionCookieName } from '@/lib/cookie-names';

// Runs before every page and API request (Node.js runtime): CSP nonce, CSRF cookie, Origin check for
// unsafe API methods, and a cheap redirect to /login when no session cookie is present. The full session
// check happens in the pages and route handlers.

const PUBLIC_PAGES = [/^\/setup$/, /^\/login(\/2fa)?$/, /^\/invite\/[^/]+$/, /^\/offline$/];
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function appOrigin(): string {
  return new URL(process.env.APP_URL ?? 'http://localhost:3000').origin;
}

function contentSecurityPolicy(nonce: string, https: boolean): string {
  const dev = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const https = appOrigin().startsWith('https:');

  if (pathname.startsWith('/api/')) {
    if (UNSAFE.has(request.method) && request.headers.get('origin') !== appOrigin()) {
      return NextResponse.json({ error: { code: 'csrf', message: 'origin mismatch' } }, { status: 403 });
    }
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(sessionCookieName(https));
  if (!hasSession && !PUBLIC_PAGES.some((re) => re.test(pathname))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce, https);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);

  const csrfName = csrfCookieName(https);
  if (!request.cookies.has(csrfName)) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    response.cookies.set(csrfName, Buffer.from(bytes).toString('base64url'), {
      httpOnly: false, // read by the client and sent back in the x-csrf-token header (double submit)
      secure: https,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|icons/|fonts/|favicon.ico|sw.js|manifest.webmanifest|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
