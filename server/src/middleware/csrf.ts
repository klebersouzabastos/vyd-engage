import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a random CSRF token
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Set CSRF cookie on response (non-httpOnly so JS can read it)
 */
export function setCsrfCookie(res: Response): string {
  const IS_PRODUCTION = process.env.NODE_ENV === 'production';
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // JS needs to read this to send in header
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'none' as const : 'strict' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  });
  return token;
}

/**
 * CSRF protection middleware using double-submit cookie pattern.
 * Skips safe methods (GET, HEAD, OPTIONS) and non-authenticated routes.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!cookieToken || !headerToken) {
    res.status(403).json({ error: 'CSRF token missing' });
    return;
  }

  // Timing-safe comparison
  try {
    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(headerToken);
    if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
      res.status(403).json({ error: 'CSRF token mismatch' });
      return;
    }
  } catch {
    res.status(403).json({ error: 'CSRF token invalid' });
    return;
  }

  next();
}
