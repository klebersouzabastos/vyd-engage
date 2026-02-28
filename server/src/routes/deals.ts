import { Router } from 'express';
import { z } from 'zod';
import { dealService } from '../services/dealService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { DealStage } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createDealSchema = z.object({
  name: z.string().min(1),
  value: z.number().min(0),
  stage: z.nativeEnum(DealStage).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional(),
  leadId: z.string().uuid().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  customFields: z.record(z.any()).optional(),
  lostReason: z.string().optional(),
});

const updateDealSchema = createDealSchema.partial().extend({
  id: z.string().uuid(),
});

const querySchema = z.object({
  stage: z.nativeEnum(DealStage).optional(),
  assignedTo: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  search: z.string().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'name', 'value', 'stage', 'expectedCloseDate']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// GET /api/deals/stats - Aggregated metrics (MUST be before /:id)
router.get('/stats', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const stats = await dealService.getStats(req.user.tenantId);
    res.json({ status: 200, data: stats });
  } catch (error) {
    next(error);
  }
});

// GET /api/deals - List deals with filters/pagination
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const filters = querySchema.parse(req.query);
    const result = await dealService.findAll(req.user.tenantId, filters);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// GET /api/deals/:id - Get deal by ID
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const deal = await dealService.findById(req.user.tenantId, req.params.id);
    res.json(deal);
  } catch (error) {
    next(error);
  }
});

// POST /api/deals - Create deal
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = createDealSchema.parse(req.body);
    const deal = await dealService.create(req.user.tenantId, data);
    res.status(201).json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /api/deals/:id - Update deal
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = updateDealSchema.parse({
      ...req.body,
      id: req.params.id,
    });
    const deal = await dealService.update(req.user.tenantId, data);
    res.json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/deals/:id - Delete deal
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await dealService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
