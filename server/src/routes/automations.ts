import { Router } from 'express';
import { z } from 'zod';
import { automationService } from '../services/automationService.js';
import { authenticate, requireCustomProfilePermission } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { AutomationStatus } from '@prisma/client';
import prisma from '../config/database.js';
import { planLimitsService } from '../services/planLimitsService.js';
import { dispatchTrigger } from '../jobs/automationEngine.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

/**
 * Gerenciar automações (Upgrade RD P1, req 13 — capability `manageAutomations`).
 *
 * Leitura (GET/HEAD/OPTIONS: listar, detalhe, stats, logs) permanece livre a qualquer
 * autenticado. As rotas MUTADORAS (POST/PUT/PATCH/DELETE, incl. POST /:id/execute)
 * passam a respeitar a capability `manageAutomations`.
 *
 * FAIL-CLOSED / DEFAULT == HOJE: hoje NÃO há guarda de papel nestas rotas — qualquer
 * autenticado gerencia automações. Por isso usamos `requireCustomProfilePermission`
 * (não `requirePermission`): os builtins passam sempre (o builtin USER tem
 * `manageAutomations=false`, mas hoje pode gerenciar — não regredimos); só um admin,
 * via perfil CUSTOM com `manageAutomations=false`, nega a escrita.
 */
const manageAutomationsGate = requireCustomProfilePermission('manageAutomations');
router.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return manageAutomationsGate(req, res, next);
});

const createAutomationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.any(),
  steps: z.array(z.any()),
  conditions: z.any().optional(),
  flowData: z.any().optional(),
});

const updateAutomationSchema = createAutomationSchema.partial().extend({
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

    const data = createAutomationSchema.parse(req.body) as any;
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

// POST /api/automations/:id/execute - Manually trigger automation for a lead
router.post('/:id/execute', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const { leadId } = req.body;
    if (!leadId) return next(createError('leadId is required', 400));

    const automation = await automationService.findById(req.user.tenantId, req.params.id);
    if (automation.status !== 'ACTIVE') {
      return next(createError('Automação precisa estar ativa para execução manual', 400));
    }

    const dispatched = await dispatchTrigger(req.user.tenantId, 'manual', leadId);
    res.json({ status: 200, data: { dispatched } });
  } catch (error) {
    next(error);
  }
});

// GET /api/automations/:id/stats - Get automation execution stats
router.get('/:id/stats', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const automation = await automationService.findById(req.user.tenantId, req.params.id);
    const successRate =
      automation.runsCount > 0
        ? Math.round((automation.successCount / automation.runsCount) * 100)
        : 0;

    res.json({
      status: 200,
      data: {
        runsCount: automation.runsCount,
        successCount: automation.successCount,
        errorCount: automation.errorCount,
        successRate,
        lastRunAt: automation.lastRunAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/logs', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    // Verify automation belongs to tenant
    await automationService.findById(req.user.tenantId, req.params.id);

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const where: any = { automationId: req.params.id };
    if (req.query.status) where.status = req.query.status;
    if (req.query.leadId) where.leadId = req.query.leadId;
    if (req.query.stepType) where.stepType = req.query.stepType;
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from as string);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to as string);
    }

    const [logs, total] = await Promise.all([
      prisma.automationLog.findMany({
        where,
        include: {
          lead: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.automationLog.count({ where }),
    ]);

    res.json({
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
