import rateLimit from 'express-rate-limit';

const isDevelopment = process.env.NODE_ENV === 'development';
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

// Dev: high limits to avoid blocking during testing (catches infinite loops / accidental DoS)
// Production: strict limits enforced normally
export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: isDevelopment ? 1000 : MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 200 : 30,
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 50 : 10,
  message: 'Too many password reset requests, please try again later.',
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
});

// Dedicated limiter for data imports: 5 imports per hour PER TENANT.
// Keyed by tenantId (not IP) — must run after `authenticate`/`tenantScope`.
export const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 100 : 5,
  message: 'Too many imports, please try again later. Limit is 5 per hour.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.tenantId || req.ip || 'anonymous',
  // Only count actual import submissions, not history/status reads.
  skip: (req) => req.method === 'GET',
});

// Dedicated limiter for AI Sales Assistant calls: 30 calls per minute PER TENANT
// (cost control, spec req 32). Keyed by tenantId — must run after
// `authenticate`/`tenantScope`. On limit, express-rate-limit returns HTTP 429.
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? 1000 : 30,
  message: {
    status: 429,
    error: 'Limite de chamadas de IA atingido (30/min). Tente novamente em instantes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.tenantId || req.ip || 'anonymous',
});
