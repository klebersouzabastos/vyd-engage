import { Router } from 'express';
import { z } from 'zod';
import { TaskType, StakeholderRole, TaskPriority, CommercialFunction } from '@prisma/client';
import { playbookService } from '../services/playbookService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const stepSchema = z.object({
  order: z.number().int(),
  title: z.string().min(1),
  actionType: z.nativeEnum(TaskType),
  targetRole: z.nativeEnum(StakeholderRole).nullable().optional(),
  responsibleFunction: z.nativeEnum(CommercialFunction).nullable().optional(),
  offsetDays: z.number().int().min(0),
  priority: z.nativeEnum(TaskPriority),
  description: z.string().nullable().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(stepSchema).min(1),
});

const updateSchema = createSchema.partial();

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    res.json(await playbookService.findAll(req.user.tenantId));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    res.json(await playbookService.findById(req.user.tenantId, req.params.id));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = createSchema.parse(req.body);
    const tpl = await playbookService.create(req.user.tenantId, req.user.userId, data);
    res.status(201).json(tpl);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.put('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateSchema.parse(req.body);
    const tpl = await playbookService.update(req.user.tenantId, req.params.id, data);
    res.json(tpl);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    await playbookService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
