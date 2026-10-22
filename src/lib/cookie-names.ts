// Cookie names shared by the proxy, route handlers and client code.
// `__Host-` cookies require HTTPS, so plain names are used on local http.

export function sessionCookieName(https: boolean): string {
  return https ? '__Host-ft_session' : 'ft_session';
}

export function csrfCookieName(https: boolean): string {
  return https ? '__Host-ft_csrf' : 'ft_csrf';
}

export const LOCALE_COOKIE = 'ft_locale';
export const THEME_COOKIE = 'ft_theme';
export const CSRF_HEADER = 'x-csrf-token';
