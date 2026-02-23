import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { passwordResetLimiter } from '../middleware/rateLimit.js';
import { logger } from '../utils/logger.js';
import prisma from '../config/database.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookies.js';
import { setCsrfCookie } from '../middleware/csrf.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido').toLowerCase().trim(),
  password: z.string().min(8),
  name: z.string().min(2),
  companyName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// Register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    setCsrfCookie(res);
    res.status(201).json({ user: result.user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    setCsrfCookie(res);
    res.json({ user: result.user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    // Read refreshToken from httpOnly cookie (primary) or body (fallback)
    const refreshTokenValue = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshTokenValue) {
      return next(createError('Refresh token missing', 401, 'NO_REFRESH_TOKEN'));
    }
    const result = await authService.refreshToken(refreshTokenValue);
    // Set new accessToken cookie
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // Invalidate refresh token from cookie or header
    const refreshTokenValue = req.cookies?.refreshToken;
    if (refreshTokenValue) {
      await authService.logout(refreshTokenValue);
    }
    clearAuthCookies(res);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Logout all devices
router.post('/logout-all', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    await authService.logoutAll(req.user.userId);
    clearAuthCookies(res);
    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        tenantId: true,
        emailVerified: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
    });

    if (!user) {
      return next(createError('User not found', 404));
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// Request password reset
const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
});

router.post('/password/reset-request', async (req, res, next) => {
  try {
    const { email } = requestPasswordResetSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    // Always return success to prevent email enumeration
    res.json({ message: 'If the email exists, a password reset link has been sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Password reset validation error', { errors: error.errors });
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// Reset password
const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8),
});

router.post('/password/reset', async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(token, password);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// Send verification email
router.post('/email/verify-request', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    await authService.sendVerificationEmail(req.user.userId);
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    next(error);
  }
});

// Verify email
const verifyEmailSchema = z.object({
  token: z.string().uuid(),
});

router.post('/email/verify', async (req, res, next) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);
    await authService.verifyEmail(token);
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// Update profile
const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatar: z.string().nullable().optional(),
});

router.put('/profile', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        tenantId: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        tenant: {
          select: { id: true, name: true, slug: true, logo: true },
        },
      },
    });

    res.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// Change password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.put('/change-password', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return next(createError('User not found', 404));
    }

    const { comparePassword: comparePw } = await import('../utils/password.js');
    const isValid = await comparePw(currentPassword, user.passwordHash);
    if (!isValid) {
      return next(createError('Senha atual incorreta', 400, 'INVALID_PASSWORD'));
    }

    const { hashPassword: hashPw } = await import('../utils/password.js');
    const newHash = await hashPw(newPassword);

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { passwordHash: newHash },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// Update tenant (company info)
const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  logo: z.string().nullable().optional(),
});

router.put('/tenant', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = updateTenantSchema.parse(req.body);

    const tenant = await prisma.tenant.update({
      where: { id: req.user.tenantId },
      data,
      select: { id: true, name: true, slug: true, logo: true },
    });

    res.json({ tenant });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

export default router;

