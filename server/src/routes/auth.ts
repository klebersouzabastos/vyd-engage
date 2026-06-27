import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService.js';
import { twoFactorService } from '../services/twoFactorService.js';
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

    // Check if 2FA is enabled
    const has2FA = await twoFactorService.isEnabled(result.user.id);
    if (has2FA) {
      // If 2FA code provided in request, validate it
      const totpCode = req.body.totpCode;
      if (!totpCode) {
        // Return partial response requiring 2FA
        return res.json({
          requiresTwoFactor: true,
          userId: result.user.id,
        });
      }

      const isValid = await twoFactorService.validateCode(result.user.id, totpCode);
      if (!isValid) {
        return next(createError('Invalid 2FA code', 401, 'INVALID_TOTP_CODE'));
      }
    }

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
    // Set new accessToken cookie (use setAuthCookies-consistent options)
    setAuthCookies(res, result.accessToken, refreshTokenValue);
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
        isPlatformAdmin: true,
        tenantId: true,
        emailVerified: true,
        twoFactorEnabled: true,
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
  settings: z
    .object({
      slackWebhookUrl: z.string().url().optional().nullable(),
      teamsWebhookUrl: z.string().url().optional().nullable(),
    })
    .optional(),
});

router.get('/tenant', authenticate, async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { id: true, name: true, slug: true, logo: true, settings: true },
    });
    res.json({ tenant });
  } catch (error) {
    next(error);
  }
});

router.put('/tenant', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = updateTenantSchema.parse(req.body);

    // Merge settings JSON so existing keys are preserved
    let updateData: Record<string, unknown> = { name: data.name, logo: data.logo };
    if (data.settings) {
      const current = await prisma.tenant.findUnique({
        where: { id: req.user.tenantId },
        select: { settings: true },
      });
      updateData.settings = { ...((current?.settings as object) ?? {}), ...data.settings };
    }
    // Remove undefined keys
    updateData = Object.fromEntries(Object.entries(updateData).filter(([, v]) => v !== undefined));

    const tenant = await prisma.tenant.update({
      where: { id: req.user.tenantId },
      data: updateData,
      select: { id: true, name: true, slug: true, logo: true, settings: true },
    });

    res.json({ tenant });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ========================
// 2FA endpoints
// ========================

// Setup 2FA - generates secret and QR code
router.post('/2fa/setup', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const result = await twoFactorService.setup(req.user.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Verify and enable 2FA
const verify2FASchema = z.object({
  code: z.string().length(6),
});

router.post('/2fa/verify', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const { code } = verify2FASchema.parse(req.body);
    const result = await twoFactorService.verifyAndEnable(req.user.userId, code);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// Disable 2FA
const disable2FASchema = z.object({
  code: z.string().length(6),
});

router.post('/2fa/disable', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const { code } = disable2FASchema.parse(req.body);
    const result = await twoFactorService.disable(req.user.userId, code);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// Get 2FA status
router.get('/2fa/status', authenticate, async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const enabled = await twoFactorService.isEnabled(req.user.userId);
    res.json({ enabled });
  } catch (error) {
    next(error);
  }
});

export default router;
