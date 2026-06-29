import { Router } from 'express';
import { z, ZodError } from 'zod';
import { suggestionService } from '../services/suggestionService.js';
import { authenticate, requirePlatformAdmin } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const STATUS = ['PENDING', 'IN_REVIEW', 'IN_PROGRESS', 'DONE', 'REJECTED'] as const;
const TYPE = ['IMPROVEMENT', 'BUG'] as const;

const createSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(5000),
  type: z.enum(TYPE),
  route: z.string().max(500).nullable().optional(),
});

const updateSchema = z.object({
  status: z.enum(STATUS).optional(),
  adminNotes: z.string().max(5000).nullable().optional(),
});

const listQuerySchema = z.object({
  status: z.enum(STATUS).optional(),
  type: z.enum(TYPE).optional(),
  scope: z.enum(['mine', 'all']).optional(),
});

function zodError(res: import('express').Response, error: ZodError) {
  return res
    .status(400)
    .json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: error.errors });
}

// GET /api/v1/suggestions?status=&type=&scope=
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const filters = listQuerySchema.parse(req.query);
    const data = await suggestionService.findAll(
      req.user.tenantId,
      req.user.userId,
      !!req.user.isPlatformAdmin,
      filters
    );
    res.json({ status: 200, data });
  } catch (error) {
    if (error instanceof ZodError) return zodError(res, error);
    next(error);
  }
});

// GET /api/v1/suggestions/:id
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = await suggestionService.findById(
      req.user.userId,
      !!req.user.isPlatformAdmin,
      req.params.id
    );
    res.json({ status: 200, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/suggestions
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = createSchema.parse(req.body);
    const suggestion = await suggestionService.create(req.user.tenantId, req.user.userId, data);
    res.status(201).json({ status: 201, data: suggestion });
  } catch (error) {
    if (error instanceof ZodError) return zodError(res, error);
    next(error);
  }
});

// PATCH /api/v1/suggestions/:id  (status + adminNotes — platform admin only)
router.patch('/:id', requirePlatformAdmin, async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateSchema.parse(req.body);
    const suggestion = await suggestionService.update(req.params.id, data);
    res.json({ status: 200, data: suggestion });
  } catch (error) {
    if (error instanceof ZodError) return zodError(res, error);
    next(error);
  }
});

// DELETE /api/v1/suggestions/:id  (owner if PENDING, or platform admin any)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const result = await suggestionService.delete(
      req.user.userId,
      !!req.user.isPlatformAdmin,
      req.params.id
    );
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
