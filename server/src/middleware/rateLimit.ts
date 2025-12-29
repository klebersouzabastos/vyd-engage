import rateLimit from 'express-rate-limit';

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// More permissive in development
const isDevelopment = process.env.NODE_ENV === 'development';
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 50 : 10, // More permissive in development
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// More permissive rate limiter for password reset requests
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Allow 10 password reset requests per hour per IP
  message: 'Too many password reset requests, please try again later.',
  skipSuccessfulRequests: false, // Count all requests, even successful ones
  standardHeaders: true,
  legacyHeaders: false,
});








