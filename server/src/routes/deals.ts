import { Router } from 'express';
import { z } from 'zod';
import { dealService } from '../services/dealService.js';
import { forecastService } from '../services/forecastService.js';
import { getDealNextAction, getActionSummary } from '../services/nextActionService.js';
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
  funnelId: z.string().uuid().optional().nullable(),
  funnelColumnId: z.string().uuid().optional().nullable(),
});

const updateDealSchema = createDealSchema.partial().extend({
  id: z.string().uuid(),
});

const querySchema = z.object({
  stage: z.nativeEnum(DealStage).optional(),
  assignedTo: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  funnelId: z.string().uuid().optional(),
  search: z.string().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'name', 'value', 'stage', 'expectedCloseDate']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// GET /api/deals/forecast - Monthly revenue forecast (MUST be before /:id)
router.get('/forecast', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const months = req.query.months ? Number(req.query.months) : 6;
    const assignedTo = req.query.assignedTo as string | undefined;
    const stage = req.query.stage as DealStage | undefined;

    if (stage && !Object.values(DealStage).includes(stage)) {
      return next(createError('Invalid stage', 400, 'VALIDATION_ERROR'));
    }

    const forecast = await forecastService.getForecast(req.user.tenantId, {
      months,
      assignedTo,
      stage,
    });
    res.json({ status: 200, data: forecast });
  } catch (error) {
    next(error);
  }
});

// GET /api/deals/trend - Won vs Lost trend (MUST be before /:id)
router.get('/trend', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const months = req.query.months ? Number(req.query.months) : 6;
    const trend = await forecastService.getTrend(req.user.tenantId, months);
    res.json({ status: 200, data: trend });
  } catch (error) {
    next(error);
  }
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

// GET /api/deals/action-summary - Top urgent actions across leads and deals
router.get('/action-summary', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const limit = req.query.limit ? Number(req.query.limit) : 5;
    const actions = await getActionSummary(req.user.tenantId, limit);
    res.json({ status: 200, data: actions });
  } catch (error) {
    next(error);
  }
});

// GET /api/deals/:id/next-action - Get suggested next action for a deal
// NOTE: This must be registered before /:id to avoid conflict, but Express
// handles sub-paths like /:id/next-action correctly since they have more segments.

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

// GET /api/deals/:id/next-action - Get suggested next action for a deal
router.get('/:id/next-action', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const action = await getDealNextAction(req.user.tenantId, req.params.id);
    res.json({ status: 200, data: action });
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
