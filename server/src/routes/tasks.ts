import { Router } from 'express';
import { z } from 'zod';
import { taskService } from '../services/taskService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { TaskStatus, TaskPriority, NotificationType } from '@prisma/client';
import { notificationService } from '../services/notificationService.js';

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
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
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

    // Notify assignee if task is assigned to someone other than the creator
    if (data.assignedTo && data.assignedTo !== req.user.userId) {
      notificationService.create(req.user.tenantId, {
        userId: data.assignedTo,
        type: NotificationType.TASK_DUE,
        title: 'Nova tarefa atribuída',
        message: `A tarefa "${task.title}" foi atribuída a você.${task.dueDate ? ` Vencimento: ${new Date(task.dueDate).toLocaleDateString('pt-BR')}.` : ''}`,
        link: `/app/tasks`,
        metadata: { taskId: task.id, taskTitle: task.title, dueDate: task.dueDate },
      }).catch(() => {});
    }

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

    // Notify new assignee if task was reassigned to someone else
    if (data.assignedTo && data.assignedTo !== req.user.userId) {
      notificationService.create(req.user.tenantId, {
        userId: data.assignedTo,
        type: NotificationType.TASK_DUE,
        title: 'Tarefa atribuída a você',
        message: `A tarefa "${task.title}" foi atribuída a você.${task.dueDate ? ` Vencimento: ${new Date(task.dueDate).toLocaleDateString('pt-BR')}.` : ''}`,
        link: `/app/tasks`,
        metadata: { taskId: task.id, taskTitle: task.title, dueDate: task.dueDate },
      }).catch(() => {});
    }

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

