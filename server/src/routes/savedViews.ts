import { Router } from 'express';
import { z } from 'zod';
import { savedViewService } from '../services/savedViewService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  page: z.enum(['leads', 'deals', 'tasks', 'companies']),
  filters: z.record(z.any()),
  columns: z.record(z.any()).nullable().optional(),
  isDefault: z.boolean().optional(),
  isShared: z.boolean().optional(),
  sortBy: z.string().max(50).nullable().optional(),
  sortOrder: z.enum(['asc', 'desc']).nullable().optional(),
});

const updateSchema = createSchema.partial().omit({ page: true });

// GET /api/v1/saved-views?page=leads
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const page = req.query.page as string | undefined;
    const views = await savedViewService.findAll(req.user.tenantId, req.user.userId, page);
    res.json({ status: 200, data: views });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/saved-views
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = createSchema.parse(req.body);
    const view = await savedViewService.create(req.user.tenantId, req.user.userId, data);
    res.status(201).json({ status: 201, data: view });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// PUT /api/v1/saved-views/:id
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = updateSchema.parse(req.body);
    const view = await savedViewService.update(req.user.tenantId, req.user.userId, req.params.id, data);
    res.json({ status: 200, data: view });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// DELETE /api/v1/saved-views/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const result = await savedViewService.delete(req.user.tenantId, req.user.userId, req.params.id);
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
