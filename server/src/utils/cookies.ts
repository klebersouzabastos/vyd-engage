import { Response } from 'express';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Cross-origin deployment (frontend and backend on different domains) requires SameSite=none + Secure
const SAME_SITE = IS_PRODUCTION ? 'none' as const : 'strict' as const;

/**
 * Set authentication cookies (httpOnly, secure)
 */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: SAME_SITE,
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: '/',
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: SAME_SITE,
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: '/api/auth', // Only sent to auth endpoints (refresh/logout)
  });
}

/**
 * Clear authentication cookies
 * Options must match those used in setCookie (except expires/maxAge) for browser to clear them
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: SAME_SITE,
    path: '/',
  });
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: SAME_SITE,
    path: '/api/auth',
  });
  res.clearCookie('csrf-token', {
    secure: IS_PRODUCTION,
    sameSite: SAME_SITE,
    path: '/',
  });
}
