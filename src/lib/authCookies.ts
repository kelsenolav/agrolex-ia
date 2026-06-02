import 'server-only';

export const AUTH_ACCESS_COOKIE = 'agrolex-access-token';
export const AUTH_REFRESH_COOKIE = 'agrolex-refresh-token';

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/'
};
