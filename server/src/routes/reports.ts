import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { ReportType } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { forecastService } from '../services/forecastService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const reportSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(ReportType).default(ReportType.CUSTOM),
  config: z.any().default({}),
});

// GET /api/reports - List all reports for tenant
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const reports = await prisma.report.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        config: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(reports);
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/funnel-conversion - Lead funnel conversion rates
router.get('/funnel-conversion', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const { from, to, source, assignedTo } = req.query;
    const data = await forecastService.getFunnelConversion(req.user.tenantId, {
      from: from as string | undefined,
      to: to as string | undefined,
      source: source as string | undefined,
      assignedTo: assignedTo as string | undefined,
    });

    res.json({ status: 200, data });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/metrics - Aggregated metrics for report widgets
router.get('/metrics', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const tenantId = req.user.tenantId;

    const { from, to } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Run all queries in parallel
    const [
      leads,
      tasks,
      interactions,
      automations,
      automationLogs,
    ] = await Promise.all([
      prisma.lead.findMany({
        where: {
          tenantId,
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { id: true, status: true, source: true, createdAt: true },
      }),
      prisma.task.findMany({
        where: {
          tenantId,
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { id: true, status: true, priority: true, dueDate: true, completedAt: true, createdAt: true },
      }),
      prisma.interaction.findMany({
        where: {
          tenantId,
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { id: true, type: true, direction: true, leadId: true, createdAt: true },
      }),
      prisma.automation.findMany({
        where: { tenantId },
        select: { id: true, name: true, status: true, steps: true, runsCount: true, successCount: true, errorCount: true },
      }),
      prisma.automationLog.findMany({
        where: {
          automation: { tenantId },
          createdAt: hasDateFilter ? dateFilter : { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, status: true, automationId: true, createdAt: true },
      }),
    ]);

    // --- Leads metrics ---
    const leadsByStatus: Record<string, number> = {};
    const leadsBySource: Record<string, number> = {};
    let closedLeads = 0;
    let newLeads = 0;

    for (const lead of leads) {
      leadsByStatus[lead.status] = (leadsByStatus[lead.status] || 0) + 1;
      leadsBySource[lead.source] = (leadsBySource[lead.source] || 0) + 1;
      if (lead.status === 'WON') closedLeads++;
      if (lead.status === 'NEW') newLeads++;
    }

    const totalLeads = leads.length;
    const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 1000) / 10 : 0;

    // --- Pipeline metrics ---
    const stageOrder = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
    const stageColors: Record<string, string> = {
      NEW: '#6B7280', CONTACTED: '#3B82F6', QUALIFIED: '#8B5CF6',
      PROPOSAL: '#F59E0B', NEGOTIATION: '#F97316', WON: '#16A34A', LOST: '#DC2626',
    };
    const stageNames: Record<string, string> = {
      NEW: 'Novo', CONTACTED: 'Contato', QUALIFIED: 'Qualificado',
      PROPOSAL: 'Proposta', NEGOTIATION: 'Negociação', WON: 'Ganho', LOST: 'Perdido',
    };
    const pipelineStages = stageOrder.map(s => ({
      name: stageNames[s] || s,
      count: leadsByStatus[s] || 0,
      color: stageColors[s] || '#6B7280',
    }));

    // --- Tasks metrics ---
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    let completedTasks = 0;
    let pendingTasks = 0;
    let overdueTasks = 0;
    let dueTodayTasks = 0;
    const tasksByPriority: Record<string, number> = {};

    for (const task of tasks) {
      if (task.status === 'COMPLETED') completedTasks++;
      else if (task.status === 'PENDING' || task.status === 'IN_PROGRESS') pendingTasks++;

      if (task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && task.dueDate && new Date(task.dueDate) < now) {
        overdueTasks++;
      }
      if (task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && task.dueDate) {
        const d = new Date(task.dueDate);
        if (d >= todayStart && d < todayEnd) dueTodayTasks++;
      }
      tasksByPriority[task.priority] = (tasksByPriority[task.priority] || 0) + 1;
    }

    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0;

    // --- Interactions metrics ---
    const interactionsByType: Record<string, number> = {};
    const interactionsByDay: Record<string, number> = {};
    const interactionLeadIds = new Set<string>();

    for (const interaction of interactions) {
      interactionsByType[interaction.type] = (interactionsByType[interaction.type] || 0) + 1;
      const dateKey = interaction.createdAt.toISOString().split('T')[0];
      interactionsByDay[dateKey] = (interactionsByDay[dateKey] || 0) + 1;
      if (interaction.leadId) interactionLeadIds.add(interaction.leadId);
    }

    const totalInteractions = interactions.length;
    const avgPerLead = interactionLeadIds.size > 0 ? Math.round((totalInteractions / interactionLeadIds.size) * 10) / 10 : 0;

    const byDay = Object.entries(interactionsByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- Automations metrics ---
    const totalAutomations = automations.length;
    const activeAutomations = automations.filter(a => a.status === 'ACTIVE').length;
    const pausedAutomations = automations.filter(a => a.status === 'PAUSED').length;
    const totalRuns = automations.reduce((sum, a) => sum + a.runsCount, 0);
    const totalSuccess = automations.reduce((sum, a) => sum + a.successCount, 0);
    const automationSuccessRate = totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 1000) / 10 : 0;

    let totalSentMessages = 0;
    for (const auto of automations) {
      const steps = auto.steps as any[];
      if (Array.isArray(steps)) {
        const msgSteps = steps.filter(s => s.type === 'send_whatsapp' || s.type === 'send_email');
        totalSentMessages += msgSteps.length * auto.successCount;
      }
    }

    const automationByType: Record<string, number> = {};
    const automationByStatus: Record<string, number> = {};
    for (const auto of automations) {
      automationByStatus[auto.status] = (automationByStatus[auto.status] || 0) + 1;
      const steps = auto.steps as any[];
      if (Array.isArray(steps)) {
        const hasWhatsapp = steps.some(s => s.type === 'send_whatsapp');
        const hasEmail = steps.some(s => s.type === 'send_email');
        if (hasWhatsapp) automationByType['whatsapp'] = (automationByType['whatsapp'] || 0) + 1;
        if (hasEmail) automationByType['email'] = (automationByType['email'] || 0) + 1;
        if (!hasWhatsapp && !hasEmail) automationByType['other'] = (automationByType['other'] || 0) + 1;
      }
    }

    res.json({
      leads: {
        total: totalLeads,
        byStatus: leadsByStatus,
        bySource: leadsBySource,
        conversionRate,
        avgResponseTime: 0,
        newLeads,
        closedLeads,
      },
      pipeline: {
        stages: pipelineStages,
        conversionRate,
        avgTimeInStage: {},
        totalLeads,
      },
      automations: {
        total: totalAutomations,
        active: activeAutomations,
        paused: pausedAutomations,
        totalLeadsEnrolled: 0,
        totalSentMessages,
        successRate: automationSuccessRate,
        byType: automationByType,
        byStatus: automationByStatus,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        pending: pendingTasks,
        overdue: overdueTasks,
        dueToday: dueTodayTasks,
        completionRate,
        avgCompletionTime: 0,
        byPriority: tasksByPriority,
      },
      interactions: {
        total: totalInteractions,
        byType: interactionsByType,
        byDay,
        avgPerLead,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/:id - Get single report
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const report = await prisma.report.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!report) {
      return next(createError('Report not found', 404));
    }

    res.json(report);
  } catch (error) {
    next(error);
  }
});

// POST /api/reports - Create report
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const data = reportSchema.parse(req.body);

    const report = await prisma.report.create({
      data: {
        name: data.name,
        description: data.description || null,
        type: data.type,
        config: data.config,
        tenantId: req.user.tenantId,
        createdById: req.user.userId,
      },
    });

    res.status(201).json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /api/reports/:id - Update report
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const existing = await prisma.report.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId,
      },
    });

    if (!existing) {
      return next(createError('Report not found', 404));
    }

    const data = reportSchema.partial().parse(req.body);

    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        config: data.config,
      },
    });

    res.json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/reports/:id - Delete report
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const existing = await prisma.report.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId,
      },
    });

    if (!existing) {
      return next(createError('Report not found', 404));
    }

    await prisma.report.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Report deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
