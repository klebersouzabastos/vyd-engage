import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import prisma from '../config/database.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z
    .string()
    .optional()
    .refine((val) => {
      // If not provided or empty, it's valid
      if (!val || val.trim() === '') {
        return true;
      }
      // If provided, must be a valid email
      return z.string().email().safeParse(val.trim().toLowerCase()).success;
    }, {
      message: 'Email inválido',
    }),
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
    const parsedData = registerSchema.parse(req.body);
    // Normalize email: empty string becomes undefined
    const data = {
      ...parsedData,
      email: parsedData.email && parsedData.email.trim() !== '' ? parsedData.email.trim().toLowerCase() : undefined,
    };
    const result = await authService.register(data);
    res.status(201).json(result);
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
    res.json(result);
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
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refreshToken(refreshToken);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const token = req.headers.authorization?.substring(7);
    if (token) {
      await authService.logout(token);
    }
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
  email: z.string().email(),
});

router.post('/password/reset-request', async (req, res, next) => {
  try {
    const { email } = requestPasswordResetSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    // Always return success to prevent email enumeration
    res.json({ message: 'If the email exists, a password reset link has been sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
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

export default router;

