import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { ReportType } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { forecastService } from '../services/forecastService.js';
import { ownerScope, isManager } from '../utils/roleScope.js';

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
      assignedTo: ownerScope(req.user, assignedTo as string | undefined),
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
    // Escopo do analista (USER): métricas refletem só os próprios registros (req 4).
    const owner = ownerScope(req.user);

    const { from, to } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Run all queries in parallel
    const [leads, tasks, interactions, automations, automationLogs] = await Promise.all([
      prisma.lead.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(owner ? { assignedTo: owner } : {}),
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { id: true, status: true, source: true, createdAt: true },
      }),
      prisma.task.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(owner ? { assignedTo: owner } : {}),
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
        select: {
          id: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      prisma.interaction.findMany({
        where: {
          tenantId,
          ...(owner
            ? {
                OR: [
                  { userId: owner },
                  { deal: { assignedTo: owner } },
                  { lead: { assignedTo: owner } },
                ],
              }
            : {}),
          ...(hasDateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { id: true, type: true, direction: true, leadId: true, createdAt: true },
      }),
      prisma.automation.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          status: true,
          steps: true,
          runsCount: true,
          successCount: true,
          errorCount: true,
        },
      }),
      prisma.automationLog.findMany({
        where: {
          automation: { tenantId },
          createdAt: hasDateFilter
            ? dateFilter
            : { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
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
      NEW: '#6B7280',
      CONTACTED: '#3B82F6',
      QUALIFIED: '#8B5CF6',
      PROPOSAL: '#F59E0B',
      NEGOTIATION: '#F97316',
      WON: '#16A34A',
      LOST: '#DC2626',
    };
    const stageNames: Record<string, string> = {
      NEW: 'Novo',
      CONTACTED: 'Contato',
      QUALIFIED: 'Qualificado',
      PROPOSAL: 'Proposta',
      NEGOTIATION: 'Negociação',
      WON: 'Ganho',
      LOST: 'Perdido',
    };
    const pipelineStages = stageOrder.map((s) => ({
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

      if (
        task.status !== 'COMPLETED' &&
        task.status !== 'CANCELLED' &&
        task.dueDate &&
        new Date(task.dueDate) < now
      ) {
        overdueTasks++;
      }
      if (task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && task.dueDate) {
        const d = new Date(task.dueDate);
        if (d >= todayStart && d < todayEnd) dueTodayTasks++;
      }
      tasksByPriority[task.priority] = (tasksByPriority[task.priority] || 0) + 1;
    }

    const totalTasks = tasks.length;
    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0;

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
    const avgPerLead =
      interactionLeadIds.size > 0
        ? Math.round((totalInteractions / interactionLeadIds.size) * 10) / 10
        : 0;

    const byDay = Object.entries(interactionsByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- Automations metrics ---
    const totalAutomations = automations.length;
    const activeAutomations = automations.filter((a) => a.status === 'ACTIVE').length;
    const pausedAutomations = automations.filter((a) => a.status === 'PAUSED').length;
    const totalRuns = automations.reduce((sum, a) => sum + a.runsCount, 0);
    const totalSuccess = automations.reduce((sum, a) => sum + a.successCount, 0);
    const automationSuccessRate =
      totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 1000) / 10 : 0;

    let totalSentMessages = 0;
    for (const auto of automations) {
      const steps = auto.steps as any[];
      if (Array.isArray(steps)) {
        const msgSteps = steps.filter((s) => s.type === 'send_whatsapp' || s.type === 'send_email');
        totalSentMessages += msgSteps.length * auto.successCount;
      }
    }

    const automationByType: Record<string, number> = {};
    const automationByStatus: Record<string, number> = {};
    for (const auto of automations) {
      automationByStatus[auto.status] = (automationByStatus[auto.status] || 0) + 1;
      const steps = auto.steps as any[];
      if (Array.isArray(steps)) {
        const hasWhatsapp = steps.some((s) => s.type === 'send_whatsapp');
        const hasEmail = steps.some((s) => s.type === 'send_email');
        if (hasWhatsapp) automationByType['whatsapp'] = (automationByType['whatsapp'] || 0) + 1;
        if (hasEmail) automationByType['email'] = (automationByType['email'] || 0) + 1;
        if (!hasWhatsapp && !hasEmail)
          automationByType['other'] = (automationByType['other'] || 0) + 1;
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

// GET /api/reports/team-performance?from=&to=&funnelId= - Per-user performance metrics (admin/gestor)
router.get('/team-performance', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    // Painel de time (req 11): apenas GESTOR/ADMIN. (Corrige checagem que comparava
    // role MAIÚSCULO contra ['admin','gestor'] minúsculo, bloqueando até ADMIN.)
    if (!isManager(req.user)) {
      return next(createError('Forbidden', 403, 'INSUFFICIENT_PERMISSIONS'));
    }
    const tenantId = req.user.tenantId;
    const { from, to, funnelId } = req.query;

    const fromDate = from
      ? new Date(from as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to as string) : new Date();

    // Fetch all users in this tenant
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true },
    });

    const results = await Promise.all(
      users.map(async (user) => {
        const closedFilter: any = {
          tenantId,
          assignedTo: user.id,
          closedAt: { gte: fromDate, lte: toDate },
          deletedAt: null,
          ...(funnelId ? { funnelId: funnelId as string } : {}),
        };

        const [wonDeals, lostCount, openDeals, tasksDone, wonCycleDeals] = await Promise.all([
          prisma.deal.aggregate({
            where: { ...closedFilter, stage: 'WON' },
            _count: { id: true },
            _sum: { value: true },
          }),
          prisma.deal.count({ where: { ...closedFilter, stage: 'LOST' } }),
          prisma.deal.aggregate({
            where: {
              tenantId,
              assignedTo: user.id,
              stage: { notIn: ['WON', 'LOST'] },
              deletedAt: null,
              ...(funnelId ? { funnelId: funnelId as string } : {}),
            },
            _sum: { value: true },
          }),
          prisma.task.count({
            where: {
              tenantId,
              assignedTo: user.id,
              status: 'COMPLETED',
              completedAt: { gte: fromDate, lte: toDate },
              deletedAt: null,
            },
          }),
          prisma.deal.findMany({
            where: { ...closedFilter, stage: 'WON', closedAt: { not: null } },
            select: { createdAt: true, closedAt: true },
          }),
        ]);

        const wonCount = wonDeals._count.id;
        const revenueWon = Number(wonDeals._sum.value || 0);
        const closedCount = wonCount + lostCount;
        const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 1000) / 10 : 0;

        const cycleTimes = wonCycleDeals.map(
          (d) => (d.closedAt!.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        const avgCycleDays =
          cycleTimes.length > 0
            ? Math.round((cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10) / 10
            : 0;

        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          dealsWon: wonCount,
          revenueWon: Math.round(revenueWon * 100) / 100,
          dealsLost: lostCount,
          winRate,
          avgCycleDays,
          pipelineValue: Math.round(Number(openDeals._sum.value || 0) * 100) / 100,
          tasksDone,
        };
      })
    );

    results.sort((a, b) => b.revenueWon - a.revenueWon);
    res.json({ status: 200, data: results });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/win-loss?from=&to= - Win/loss analysis with reason breakdown
router.get('/win-loss', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    if (!isManager(req.user)) {
      return next(createError('Forbidden', 403, 'INSUFFICIENT_PERMISSIONS'));
    }
    const tenantId = req.user.tenantId;
    const { from, to } = req.query;

    const fromDate = from
      ? new Date(from as string)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to as string) : new Date();

    const closedDeals = await prisma.deal.findMany({
      where: {
        tenantId,
        deletedAt: null,
        stage: { in: ['WON', 'LOST'] },
        closedAt: { gte: fromDate, lte: toDate },
      },
      select: { stage: true, value: true, closedAt: true, lostReason: true, lostCompetitor: true },
    });

    // Reason breakdown for LOST deals
    const reasonMap = new Map<string, number>();
    for (const deal of closedDeals) {
      if (deal.stage === 'LOST') {
        const reason = deal.lostReason || 'Não informado';
        reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
      }
    }
    const lostTotal = Array.from(reasonMap.values()).reduce((a, b) => a + b, 0);
    const reasonBreakdown = Array.from(reasonMap.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: lostTotal > 0 ? Math.round((count / lostTotal) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Monthly trend
    const monthMap = new Map<
      string,
      { month: string; won: number; lost: number; wonValue: number; lostValue: number }
    >();
    for (const deal of closedDeals) {
      if (!deal.closedAt) continue;
      const key = `${deal.closedAt.getFullYear()}-${String(deal.closedAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(key))
        monthMap.set(key, { month: key, won: 0, lost: 0, wonValue: 0, lostValue: 0 });
      const bucket = monthMap.get(key)!;
      if (deal.stage === 'WON') {
        bucket.won++;
        bucket.wonValue += Number(deal.value);
      } else {
        bucket.lost++;
        bucket.lostValue += Number(deal.value);
      }
    }
    const monthlyTrend = Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({
        ...m,
        wonValue: Math.round(m.wonValue * 100) / 100,
        lostValue: Math.round(m.lostValue * 100) / 100,
      }));

    // Competitor breakdown
    const competitorMap = new Map<string, number>();
    for (const deal of closedDeals) {
      if (deal.lostCompetitor) {
        competitorMap.set(deal.lostCompetitor, (competitorMap.get(deal.lostCompetitor) || 0) + 1);
      }
    }
    const competitors = Array.from(competitorMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({ status: 200, data: { reasonBreakdown, monthlyTrend, competitors } });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/pipeline-health - Pipeline health indicators
router.get('/pipeline-health', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    if (!isManager(req.user)) {
      return next(createError('Forbidden', 403, 'INSUFFICIENT_PERMISSIONS'));
    }
    const tenantId = req.user.tenantId;

    const { getPipelineHealth } = await import('../services/pipelineHealthService.js');
    const result = await getPipelineHealth(tenantId);
    res.json({ status: 200, data: result });
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
