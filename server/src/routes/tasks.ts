import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { taskService } from '../services/taskService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { ownerScope, isAnalyst } from '../utils/roleScope.js';
import { TaskStatus, TaskPriority, TaskType, NotificationType } from '@prisma/client';
import { notificationService } from '../services/notificationService.js';
import { googleCalendarService } from '../services/googleCalendarService.js';
import { emitToTenant } from '../services/socketService.js';

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
  // Desdobramento comercial — vínculos da ação (agenda do roadmap).
  type: z.nativeEnum(TaskType).optional(),
  companyId: z.string().uuid().optional(),
  empreendimentoId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  roadmapId: z.string().uuid().optional(),
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
    filters.assignedTo = ownerScope(req.user, filters.assignedTo);
    const result = await taskService.findAll(req.user.tenantId, filters);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// Guard de posse (req 6): analista (USER) só acessa tarefas em que é o responsável;
// caso contrário 404 (sem vazar existência). Cobre todas as rotas /tasks/:id*.
async function enforceTaskOwnership(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    if (!isAnalyst(req.user)) return next();
    const owned = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId,
        deletedAt: null,
        assignedTo: req.user.userId,
      },
      select: { id: true },
    });
    if (!owned) return next(createError('Task not found', 404, 'TASK_NOT_FOUND'));
    return next();
  } catch (err) {
    next(err);
  }
}
router.use('/:id', enforceTaskOwnership);

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
    // Analista (USER) só cria tarefas atribuídas a si mesmo (req 8) — paridade com deals.
    if (isAnalyst(req.user)) data.assignedTo = req.user.userId;
    const task = await taskService.create(req.user.tenantId, data);

    // Notify assignee if task is assigned to someone other than the creator
    if (data.assignedTo && data.assignedTo !== req.user.userId) {
      notificationService
        .create(req.user.tenantId, {
          userId: data.assignedTo,
          type: NotificationType.TASK_DUE,
          title: 'Nova tarefa atribuída',
          message: `A tarefa "${task.title}" foi atribuída a você.${task.dueDate ? ` Vencimento: ${new Date(task.dueDate).toLocaleDateString('pt-BR')}.` : ''}`,
          link: `/app/tasks`,
          metadata: { taskId: task.id, taskTitle: task.title, dueDate: task.dueDate },
        })
        .catch(() => {});
    }

    // Google Calendar sync (fire-and-forget)
    googleCalendarService.syncTaskForUser(req.user.userId, req.user.tenantId, task).catch(() => {});

    // Emit Socket.IO event for real-time cache updates
    emitToTenant(req.user.tenantId, 'task:created', { task });

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
    // Analista (USER) não reatribui tarefa para outra pessoa (req 8).
    if (isAnalyst(req.user)) delete data.assignedTo;
    const task = await taskService.update(req.user.tenantId, data);

    // Notify new assignee if task was reassigned to someone else
    if (data.assignedTo && data.assignedTo !== req.user.userId) {
      notificationService
        .create(req.user.tenantId, {
          userId: data.assignedTo,
          type: NotificationType.TASK_DUE,
          title: 'Tarefa atribuída a você',
          message: `A tarefa "${task.title}" foi atribuída a você.${task.dueDate ? ` Vencimento: ${new Date(task.dueDate).toLocaleDateString('pt-BR')}.` : ''}`,
          link: `/app/tasks`,
          metadata: { taskId: task.id, taskTitle: task.title, dueDate: task.dueDate },
        })
        .catch(() => {});
    }

    // Google Calendar sync (fire-and-forget)
    googleCalendarService.syncTaskForUser(req.user.userId, req.user.tenantId, task).catch(() => {});

    // Emit Socket.IO event for real-time cache updates
    emitToTenant(req.user.tenantId, 'task:updated', { task });

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

    // Fetch task before deleting to get googleEventId for calendar cleanup
    const taskToDelete = await taskService.findById(req.user.tenantId, req.params.id);
    const googleEventId = (taskToDelete as any).googleEventId;

    await taskService.delete(req.user.tenantId, req.params.id);

    // Google Calendar cleanup (fire-and-forget)
    if (googleEventId) {
      googleCalendarService
        .deleteEventForUser(req.user.userId, req.user.tenantId, googleEventId)
        .catch(() => {});
    }

    // Emit Socket.IO event for real-time cache updates
    emitToTenant(req.user.tenantId, 'task:deleted', { taskId: req.params.id });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
