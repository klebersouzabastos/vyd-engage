import { Router } from 'express';
import { z } from 'zod';
import { taskService } from '../services/taskService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { TaskStatus, TaskPriority } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assignedTo: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  dueDate: z.coerce.date().optional(),
});

const updateTaskSchema = createTaskSchema.extend({
  id: z.string().uuid(),
});

const querySchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assignedTo: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  overdue: z.coerce.boolean().optional(),
  dueToday: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const filters = querySchema.parse(req.query);
    const result = await taskService.findAll(req.user.tenantId, filters);
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

    const task = await taskService.findById(req.user.tenantId, req.params.id);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    // Tasks don't have plan limits, but we could add if needed
    const data = createTaskSchema.parse(req.body);
    const task = await taskService.create(req.user.tenantId, data);
    res.status(201).json(task);
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

    const data = updateTaskSchema.parse({
      ...req.body,
      id: req.params.id,
    });
    const task = await taskService.update(req.user.tenantId, data);
    res.json(task);
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

    await taskService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

