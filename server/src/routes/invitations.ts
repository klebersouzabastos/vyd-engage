import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { invitationService } from '../services/invitationService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { requireRole } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { UserRole } from '@prisma/client';

const tokenLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 0 : 20,
  message: 'Too many invitation token lookups, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
});

const acceptInvitationSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8),
  name: z.string().min(2),
});

// GET /api/invitations - List all pending invitations (Admin only)
router.get('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const invitations = await invitationService.findAll(req.user.tenantId);
    res.json(invitations);
  } catch (error) {
    next(error);
  }
});

// POST /api/invitations - Create invitation (Admin only)
router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = createInvitationSchema.parse(req.body);
    const invitation = await invitationService.create(
      req.user.tenantId,
      req.user.userId,
      data
    );
    res.status(201).json(invitation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// GET /api/invitations/token/:token - Get invitation by token (public)
router.get('/token/:token', tokenLookupLimiter, async (req, res, next) => {
  try {
    const invitation = await invitationService.findByToken(req.params.token);
    res.json(invitation);
  } catch (error) {
    next(error);
  }
});

// POST /api/invitations/accept - Accept invitation (public)
router.post('/accept', async (req, res, next) => {
  try {
    const data = acceptInvitationSchema.parse(req.body);
    const user = await invitationService.accept(data.token, data.password, data.name);
    res.status(201).json({ user, message: 'Invitation accepted successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/invitations/:id - Cancel invitation (Admin only)
router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await invitationService.cancel(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;








