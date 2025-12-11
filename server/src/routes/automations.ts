import { Router } from 'express';
import { z } from 'zod';
import { automationService } from '../services/automationService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { AutomationStatus } from '@prisma/client';
import { planLimitsService } from '../services/planLimitsService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createAutomationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.any(),
  steps: z.array(z.any()),
  conditions: z.any().optional(),
});

const updateAutomationSchema = createAutomationSchema.extend({
  id: z.string().uuid(),
  status: z.nativeEnum(AutomationStatus).optional(),
});

const querySchema = z.object({
  status: z.nativeEnum(AutomationStatus).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const filters = querySchema.parse(req.query);
    const result = await automationService.findAll(req.user.tenantId, filters);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const automation = await automationService.findById(req.user.tenantId, req.params.id);
    res.json(automation);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    // Check plan limits
    await planLimitsService.enforceLimit(req.user.tenantId, 'automations');

    const data = createAutomationSchema.parse(req.body);
    const automation = await automationService.create(req.user.tenantId, data);
    res.status(201).json(automation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = updateAutomationSchema.parse({
      ...req.body,
      id: req.params.id,
    });
    const automation = await automationService.update(req.user.tenantId, data);
    res.json(automation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await automationService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/:id/logs', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await automationService.getLogs(req.user.tenantId, req.params.id, limit);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

export default router;







