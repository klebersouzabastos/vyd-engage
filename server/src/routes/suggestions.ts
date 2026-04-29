import { Router } from 'express';
import { z } from 'zod';
import { suggestionService } from '../services/suggestionService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const suggestionTypes = ['IMPROVEMENT', 'BUG'] as const;
const suggestionStatuses = ['PENDING', 'IN_REVIEW', 'IN_PROGRESS', 'DONE', 'REJECTED'] as const;

const createSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(5000),
  route: z.string().max(500).optional().nullable(),
  type: z.enum(suggestionTypes),
});

const updateSchema = z.object({
  status: z.enum(suggestionStatuses).optional(),
  adminNotes: z.string().max(5000).nullable().optional(),
});

const listQuerySchema = z.object({
  status: z.enum(suggestionStatuses).optional(),
  type: z.enum(suggestionTypes).optional(),
  scope: z.enum(['mine', 'all']).optional(),
});

// GET /api/v1/suggestions
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const filters = listQuerySchema.parse({
      status: req.query.status,
      type: req.query.type,
      scope: req.query.scope,
    });
    const isAdmin = req.user.role === 'ADMIN';
    const suggestions = await suggestionService.findAll(
      req.user.tenantId,
      req.user.userId,
      isAdmin,
      filters,
    );
    res.json({ status: 200, data: suggestions });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// GET /api/v1/suggestions/:id
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const isAdmin = req.user.role === 'ADMIN';
    const suggestion = await suggestionService.findById(
      req.user.tenantId,
      req.user.userId,
      isAdmin,
      req.params.id,
    );
    res.json({ status: 200, data: suggestion });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/suggestions
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const data = createSchema.parse(req.body);
    const suggestion = await suggestionService.create(
      req.user.tenantId,
      req.user.userId,
      data,
    );
    res.status(201).json({ status: 201, data: suggestion });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /api/v1/suggestions/:id  (admin only)
router.put('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const data = updateSchema.parse(req.body);
    const suggestion = await suggestionService.update(req.user.tenantId, req.params.id, data);
    res.json({ status: 200, data: suggestion });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/v1/suggestions/:id  (owner if PENDING, or admin)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    const isAdmin = req.user.role === 'ADMIN';
    const result = await suggestionService.delete(
      req.user.tenantId,
      req.user.userId,
      isAdmin,
      req.params.id,
    );
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
