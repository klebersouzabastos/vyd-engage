import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import prisma from '../config/database.js';
import { DealStage } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);
// "Metas do time" é painel de nível-time (req 11): visível/gerenciável só por GESTOR/ADMIN.
router.use(requireRole('ADMIN', 'GESTOR'));

// ─── Zod Schemas ────────────────────────────────────────────────────────────

// Upgrade RD P1 (req 12): a meta é individual (userId) OU de equipe (teamId) —
// EXATAMENTE um. `.refine` garante a exclusividade (userId XOR teamId).
export const upsertGoalSchema = z
  .object({
    userId: z.string().uuid('userId must be a valid UUID').optional(),
    teamId: z.string().uuid('teamId must be a valid UUID').optional(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2100),
    targetRevenue: z.number().min(0).optional().default(0),
    targetDeals: z.number().int().min(0).optional().default(0),
    targetLeads: z.number().int().min(0).optional().default(0),
  })
  .refine((d) => (d.userId ? 1 : 0) + (d.teamId ? 1 : 0) === 1, {
    message: 'Informe exatamente um de userId ou teamId',
    path: ['userId'],
  });

const updateGoalSchema = z.object({
  targetRevenue: z.number().min(0).optional(),
  targetDeals: z.number().int().min(0).optional(),
  targetLeads: z.number().int().min(0).optional(),
});

const progressQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
});

const listQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});

// ─── GET / — List goals ──────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { userId, teamId, month, year } = listQuerySchema.parse(req.query);
    const { tenantId } = req.user;

    const goals = await prisma.goal.findMany({
      where: {
        tenantId,
        ...(userId ? { userId } : {}),
        ...(teamId ? { teamId } : {}),
        ...(month !== undefined ? { month } : {}),
        ...(year !== undefined ? { year } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    res.json({ status: 200, data: goals });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── GET /progress — Goals + actual progress ─────────────────────────────────
// Must be registered before /:id to avoid Express matching "progress" as an id.

router.get('/progress', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { month, year } = progressQuerySchema.parse(req.query);
    const { tenantId } = req.user;

    // Date range for the requested month
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 1); // exclusive upper bound

    // Fetch all goals for that period. Progresso individual: só metas de usuário
    // (userId != null). Metas de equipe (Upgrade RD P1) têm seu próprio agregado
    // e ficam fora deste endpoint — preserva o comportamento de hoje.
    const goals = await prisma.goal.findMany({
      where: { tenantId, month, year, userId: { not: null } },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Fetch WON deals closed in the period (for revenue + deals count)
    const wonDeals = await prisma.deal.findMany({
      where: {
        tenantId,
        stage: DealStage.WON,
        closedAt: { gte: periodStart, lt: periodEnd },
      },
      select: { assignedTo: true, value: true },
    });

    // Fetch leads created in the period (for lead count)
    const newLeads = await prisma.lead.findMany({
      where: {
        tenantId,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      select: { assignedTo: true },
    });

    // Aggregate actuals per user
    const actualsByUser: Record<string, { revenue: number; deals: number; leads: number }> = {};

    for (const deal of wonDeals) {
      const uid = deal.assignedTo ?? '__unassigned__';
      if (!actualsByUser[uid]) actualsByUser[uid] = { revenue: 0, deals: 0, leads: 0 };
      // Prisma Decimal → number coercion
      actualsByUser[uid].revenue += Number(deal.value);
      actualsByUser[uid].deals += 1;
    }

    for (const lead of newLeads) {
      const uid = lead.assignedTo ?? '__unassigned__';
      if (!actualsByUser[uid]) actualsByUser[uid] = { revenue: 0, deals: 0, leads: 0 };
      actualsByUser[uid].leads += 1;
    }

    // Build result array. `userId != null` garantido pela query acima; o
    // fallback ('' / '—') existe apenas para satisfazer o tipo nullable.
    const result = goals.map((goal) => {
      const actual = actualsByUser[goal.userId ?? ''] ?? { revenue: 0, deals: 0, leads: 0 };

      const pctRevenue =
        goal.targetRevenue > 0 ? Math.round((actual.revenue / goal.targetRevenue) * 100) : 0;
      const pctDeals =
        goal.targetDeals > 0 ? Math.round((actual.deals / goal.targetDeals) * 100) : 0;
      const pctLeads =
        goal.targetLeads > 0 ? Math.round((actual.leads / goal.targetLeads) * 100) : 0;

      return {
        userId: goal.userId,
        userName: goal.user?.name ?? '—',
        goal: {
          targetRevenue: goal.targetRevenue,
          targetDeals: goal.targetDeals,
          targetLeads: goal.targetLeads,
        },
        actual,
        pct: { revenue: pctRevenue, deals: pctDeals, leads: pctLeads },
      };
    });

    res.json({ status: 200, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── GET /progress/team — progresso de METAS DE EQUIPE (soma dos membros) ─────
// Upgrade RD P1 (req 12): agrega os "realizados" (WON deals + leads criados) dos
// membros de cada equipe com meta no período. ADITIVO: o endpoint individual
// (/progress) segue intacto. Registrado antes de /:id.

router.get('/progress/team', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { month, year } = progressQuerySchema.parse(req.query);
    const { tenantId } = req.user;

    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 1); // exclusive upper bound

    // Metas de equipe do período, com os membros de cada equipe.
    const goals = await prisma.goal.findMany({
      where: { tenantId, month, year, teamId: { not: null } },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            members: { select: { id: true } },
          },
        },
      },
    });

    if (goals.length === 0) {
      res.json({ status: 200, data: [] });
      return;
    }

    // Realizados por usuário no período (mesma base do endpoint individual).
    const [wonDeals, newLeads] = await Promise.all([
      prisma.deal.findMany({
        where: { tenantId, stage: DealStage.WON, closedAt: { gte: periodStart, lt: periodEnd } },
        select: { assignedTo: true, value: true },
      }),
      prisma.lead.findMany({
        where: { tenantId, createdAt: { gte: periodStart, lt: periodEnd } },
        select: { assignedTo: true },
      }),
    ]);

    const actualsByUser: Record<string, { revenue: number; deals: number; leads: number }> = {};
    for (const deal of wonDeals) {
      const uid = deal.assignedTo ?? '__unassigned__';
      if (!actualsByUser[uid]) actualsByUser[uid] = { revenue: 0, deals: 0, leads: 0 };
      actualsByUser[uid].revenue += Number(deal.value);
      actualsByUser[uid].deals += 1;
    }
    for (const lead of newLeads) {
      const uid = lead.assignedTo ?? '__unassigned__';
      if (!actualsByUser[uid]) actualsByUser[uid] = { revenue: 0, deals: 0, leads: 0 };
      actualsByUser[uid].leads += 1;
    }

    const result = goals.map((goal) => {
      // Soma os realizados dos membros atuais da equipe.
      const actual = { revenue: 0, deals: 0, leads: 0 };
      for (const member of goal.team?.members ?? []) {
        const a = actualsByUser[member.id];
        if (a) {
          actual.revenue += a.revenue;
          actual.deals += a.deals;
          actual.leads += a.leads;
        }
      }

      const pctRevenue =
        goal.targetRevenue > 0 ? Math.round((actual.revenue / goal.targetRevenue) * 100) : 0;
      const pctDeals =
        goal.targetDeals > 0 ? Math.round((actual.deals / goal.targetDeals) * 100) : 0;
      const pctLeads =
        goal.targetLeads > 0 ? Math.round((actual.leads / goal.targetLeads) * 100) : 0;

      return {
        teamId: goal.teamId,
        teamName: goal.team?.name ?? '—',
        goal: {
          targetRevenue: goal.targetRevenue,
          targetDeals: goal.targetDeals,
          targetLeads: goal.targetLeads,
        },
        actual,
        pct: { revenue: pctRevenue, deals: pctDeals, leads: pctLeads },
      };
    });

    res.json({ status: 200, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── POST / — Create or upsert goal ─────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = upsertGoalSchema.parse(req.body);
    const { tenantId } = req.user;

    const targets = {
      targetRevenue: data.targetRevenue,
      targetDeals: data.targetDeals,
      targetLeads: data.targetLeads,
    };
    const include = {
      user: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true } },
    };

    // userId XOR teamId garantido pelo schema. A constraint única é a do tipo
    // de meta (individual OU de equipe) — Upgrade RD P1 (req 12).
    let goal;
    if (data.teamId) {
      // Valida a equipe no tenant antes de criar (multi-tenant estrito).
      const team = await prisma.team.findFirst({
        where: { id: data.teamId, tenantId },
        select: { id: true },
      });
      if (!team) return next(createError('Equipe não encontrada', 404, 'TEAM_NOT_FOUND'));

      goal = await prisma.goal.upsert({
        where: {
          tenantId_teamId_month_year: {
            tenantId,
            teamId: data.teamId,
            month: data.month,
            year: data.year,
          },
        },
        create: { tenantId, teamId: data.teamId, month: data.month, year: data.year, ...targets },
        update: targets,
        include,
      });
    } else {
      const userId = data.userId!;
      // Valida o usuário no tenant (multi-tenant estrito).
      const target = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: { id: true },
      });
      if (!target) return next(createError('Usuário não encontrado', 404, 'USER_NOT_FOUND'));

      goal = await prisma.goal.upsert({
        where: {
          tenantId_userId_month_year: { tenantId, userId, month: data.month, year: data.year },
        },
        create: { tenantId, userId, month: data.month, year: data.year, ...targets },
        update: targets,
        include,
      });
    }

    res.status(201).json({ status: 201, data: goal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── PUT /:id — Update goal ──────────────────────────────────────────────────

router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { id } = req.params;
    const { tenantId } = req.user;

    const existing = await prisma.goal.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return next(createError('Goal not found', 404));
    }

    const data = updateGoalSchema.parse(req.body);

    const goal = await prisma.goal.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, name: true } },
      },
    });

    res.json({ status: 200, data: goal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── DELETE /:id — Delete goal ───────────────────────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { id } = req.params;
    const { tenantId } = req.user;

    const existing = await prisma.goal.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return next(createError('Goal not found', 404));
    }

    await prisma.goal.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
