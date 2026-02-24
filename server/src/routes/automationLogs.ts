import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import prisma from '../config/database.js';
import { AutomationLogStatus } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

// Shared query schema for log filters
const logFiltersSchema = z.object({
  status: z.nativeEnum(AutomationLogStatus).optional(),
  leadId: z.string().uuid().optional(),
  stepType: z.string().optional(),
  automationId: z.string().uuid().optional(),
  executionId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /api/automation-logs
 * Tenant-wide logs with full filtering and pagination.
 */
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const filters = logFiltersSchema.parse(req.query);
    const skip = (filters.page - 1) * filters.limit;

    const where: any = {
      automation: { tenantId: req.user.tenantId },
    };

    if (filters.status) where.status = filters.status;
    if (filters.leadId) where.leadId = filters.leadId;
    if (filters.stepType) where.stepType = filters.stepType;
    if (filters.automationId) where.automationId = filters.automationId;
    if (filters.executionId) where.executionId = filters.executionId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    const [logs, total] = await Promise.all([
      prisma.automationLog.findMany({
        where,
        include: {
          automation: { select: { id: true, name: true } },
          lead: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: filters.sort },
        skip,
        take: filters.limit,
      }),
      prisma.automationLog.count({ where }),
    ]);

    res.json({
      data: logs,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

/**
 * GET /api/automation-logs/stats
 * Aggregated metrics for the tenant.
 */
router.get('/stats', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const tenantId = req.user.tenantId;

    // Parse optional date filters
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    const dateFilter: any = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.gte = from;
      if (to) dateFilter.createdAt.lte = to;
    }

    const baseWhere = {
      automation: { tenantId },
      ...dateFilter,
    };

    const [total, byStatus, byAutomation] = await Promise.all([
      prisma.automationLog.count({ where: baseWhere }),

      prisma.automationLog.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { id: true },
      }),

      prisma.automationLog.groupBy({
        by: ['automationId'],
        where: baseWhere,
        _count: { id: true },
      }),
    ]);

    // Build status breakdown
    const statusMap: Record<string, number> = {};
    for (const row of byStatus) {
      statusMap[row.status] = row._count.id;
    }

    const successCount = statusMap['SUCCESS'] || 0;
    const errorCount = statusMap['ERROR'] || 0;
    const skippedCount = statusMap['SKIPPED'] || 0;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

    // Enrich automation names
    const automationIds = byAutomation.map((r) => r.automationId);
    const automations = await prisma.automation.findMany({
      where: { id: { in: automationIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(automations.map((a) => [a.id, a.name]));

    const perAutomation = byAutomation.map((r) => ({
      automationId: r.automationId,
      automationName: nameMap.get(r.automationId) || 'Desconhecida',
      count: r._count.id,
    }));

    res.json({
      data: {
        total,
        successCount,
        errorCount,
        skippedCount,
        successRate,
        perAutomation,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/automation-logs/execution/:executionId
 * All steps for a single execution, grouped and ordered.
 */
router.get('/execution/:executionId', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const logs = await prisma.automationLog.findMany({
      where: {
        executionId: req.params.executionId,
        automation: { tenantId: req.user.tenantId },
      },
      include: {
        automation: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (logs.length === 0) {
      return next(createError('Execution not found', 404, 'EXECUTION_NOT_FOUND'));
    }

    res.json({
      data: logs,
      executionId: req.params.executionId,
      automationId: logs[0].automationId,
      automationName: (logs[0] as any).automation?.name,
      totalSteps: logs.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
