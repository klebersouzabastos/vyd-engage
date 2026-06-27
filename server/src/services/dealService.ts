import prisma from '../config/database.js';
import { DealStage, CommercialRoadmapStatus } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { webhookDispatcher } from './webhookDispatcher.js';
import { notifyDealWon, notifyDealLost } from './slackService.js';
import { emitToTenant } from './socketService.js';

const STAGE_PROBABILITY: Record<DealStage, number> = {
  QUALIFICATION: 20,
  PROPOSAL: 40,
  NEGOTIATION: 60,
  CLOSING: 80,
  WON: 100,
  LOST: 0,
};

export interface CreateDealData {
  name: string;
  value: number;
  stage?: DealStage;
  probability?: number;
  expectedCloseDate?: string;
  leadId?: string | null;
  companyId?: string | null;
  empreendimentoId?: string | null;
  assignedTo?: string | null;
  notes?: string;
  customFields?: Record<string, any>;
  lostReason?: string;
  funnelId?: string | null;
  funnelColumnId?: string | null;
}

export interface UpdateDealData extends Partial<CreateDealData> {
  id: string;
}

export const dealService = {
  async create(tenantId: string, data: CreateDealData) {
    const stage = data.stage || DealStage.QUALIFICATION;
    const probability = data.probability ?? STAGE_PROBABILITY[stage];

    // If funnelId is provided but no funnelColumnId, use first column
    let funnelColumnId = data.funnelColumnId || null;
    if (data.funnelId && !funnelColumnId) {
      const firstColumn = await prisma.funnelColumn.findFirst({
        where: { funnelId: data.funnelId },
        orderBy: { order: 'asc' },
      });
      if (firstColumn) {
        funnelColumnId = firstColumn.id;
      }
    }

    const deal = await prisma.deal.create({
      data: {
        tenantId,
        name: data.name,
        value: data.value,
        stage,
        probability,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        leadId: data.leadId || null,
        companyId: data.companyId || null,
        empreendimentoId: data.empreendimentoId || null,
        assignedTo: data.assignedTo || null,
        notes: data.notes || null,
        customFields: data.customFields || {},
        lostReason: data.lostReason || null,
        funnelId: data.funnelId || null,
        funnelColumnId,
      },
      include: {
        lead: { select: { id: true, name: true, email: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    // Dispatch webhook event
    webhookDispatcher.emitDealEvent(tenantId, 'deal.created', deal);

    // Emit Socket.IO event for real-time cache updates
    emitToTenant(tenantId, 'deal:created', { deal });

    return deal;
  },

  async findById(tenantId: string, id: string) {
    const deal = await prisma.deal.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        lead: { select: { id: true, name: true, email: true, phone: true, company: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (!deal) {
      throw createError('Deal not found', 404, 'DEAL_NOT_FOUND');
    }

    return deal;
  },

  async findAll(
    tenantId: string,
    filters?: {
      stage?: DealStage;
      assignedTo?: string;
      leadId?: string;
      funnelId?: string;
      search?: string;
      minValue?: number;
      maxValue?: number;
      page?: number;
      limit?: number;
      sort?: string;
      order?: 'asc' | 'desc';
    }
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;
    const sortField = filters?.sort || 'createdAt';
    const sortOrder = filters?.order || 'desc';

    const where: any = { tenantId, deletedAt: null };

    if (filters?.stage) {
      where.stage = filters.stage;
    }

    if (filters?.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters?.leadId) {
      where.leadId = filters.leadId;
    }

    if (filters?.funnelId) {
      where.funnelId = filters.funnelId;
    }

    if (filters?.search) {
      where.OR = [{ name: { contains: filters.search, mode: 'insensitive' } }];
    }

    if (filters?.minValue !== undefined) {
      where.value = { ...where.value, gte: filters.minValue };
    }

    if (filters?.maxValue !== undefined) {
      where.value = { ...where.value, lte: filters.maxValue };
    }

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: {
          lead: { select: { id: true, name: true, email: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.deal.count({ where }),
    ]);

    return {
      deals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async update(tenantId: string, data: UpdateDealData) {
    const existing = await this.findById(tenantId, data.id);

    const stage = data.stage ?? existing.stage;
    // Auto-update probability when stage changes and probability wasn't explicitly set
    const probability =
      data.probability ?? (data.stage ? STAGE_PROBABILITY[data.stage] : undefined);

    const updateData: any = {
      name: data.name,
      value: data.value,
      stage: data.stage,
      probability,
      expectedCloseDate:
        data.expectedCloseDate !== undefined
          ? data.expectedCloseDate
            ? new Date(data.expectedCloseDate)
            : null
          : undefined,
      leadId: data.leadId,
      companyId: data.companyId,
      empreendimentoId: data.empreendimentoId,
      assignedTo: data.assignedTo,
      notes: data.notes,
      customFields: data.customFields,
      lostReason: data.lostReason,
      funnelId: data.funnelId,
      funnelColumnId: data.funnelColumnId,
    };

    // Auto-set closedAt when moving to WON or LOST
    const closedStages: DealStage[] = [DealStage.WON, DealStage.LOST];
    if (data.stage && closedStages.includes(data.stage)) {
      if (!existing.closedAt) {
        updateData.closedAt = new Date();
      }
    } else if (data.stage) {
      // Reopening a deal — clear closedAt
      updateData.closedAt = null;
    }

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Tenant-safe update: verify ownership before updating
    const verified = await prisma.deal.findFirst({
      where: { id: data.id, tenantId, deletedAt: null },
    });
    if (!verified) {
      throw createError('Deal not found', 404, 'DEAL_NOT_FOUND');
    }

    const deal = await prisma.deal.update({
      where: { id: data.id },
      data: updateData,
      include: {
        lead: { select: { id: true, name: true, email: true, phone: true, company: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    // HOOK A — Stage History tracking
    const newStage = deal.stage;
    if (existing.stage !== newStage) {
      await prisma.dealStageHistory
        .updateMany({
          where: { dealId: data.id, exitedAt: null },
          data: { exitedAt: new Date() },
        })
        .catch(() => {});
      await prisma.dealStageHistory
        .create({
          data: { dealId: data.id, stage: newStage },
        })
        .catch(() => {});
    }

    // HOOK B — Auto-task creation on funnel column change
    if (existing.funnelColumnId !== deal.funnelColumnId && deal.funnelColumnId) {
      prisma.stageTaskTemplate
        .findMany({
          where: { funnelColumnId: deal.funnelColumnId },
        })
        .then(async (templates) => {
          for (const t of templates) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + t.dueDaysFromNow);
            await prisma.task.create({
              data: {
                tenantId: deal.tenantId,
                title: t.taskTitle,
                priority: t.priority as any,
                dueDate,
                dealId: deal.id,
                assignedTo: t.assignToOwner ? deal.assignedTo || null : null,
              },
            });
          }
        })
        .catch((err) => {
          logger.error('Failed to create auto-tasks on stage change', err, { dealId: deal.id });
        });
    }

    // When deal is WON and has a leadId, update lead status to WON
    if (data.stage === DealStage.WON && deal.leadId) {
      await prisma.lead
        .update({
          where: { id: deal.leadId },
          data: { status: 'WON' },
        })
        .catch((err) => {
          logger.error('Failed to update lead status to WON after deal won', err, {
            dealId: deal.id,
            leadId: deal.leadId,
            tenantId,
          });
        });
    }

    // Desdobramento comercial — refletir a etapa do Deal no status dos roadmaps
    // vinculados (req 17). Só "espelha" os marcos relevantes; não rebaixa.
    if (data.stage && data.stage !== existing.stage) {
      const ROADMAP_STATUS_BY_STAGE: Partial<Record<DealStage, CommercialRoadmapStatus>> = {
        [DealStage.PROPOSAL]: CommercialRoadmapStatus.PROPOSTA,
        [DealStage.WON]: CommercialRoadmapStatus.GANHO,
        [DealStage.LOST]: CommercialRoadmapStatus.PERDIDO,
      };
      const roadmapStatus = ROADMAP_STATUS_BY_STAGE[data.stage];
      if (roadmapStatus) {
        prisma.commercialRoadmap
          .updateMany({
            where: { tenantId, dealId: deal.id, deletedAt: null },
            data: { status: roadmapStatus },
          })
          .catch(() => {});
      }
    }

    // Dispatch webhook events based on what changed
    if (data.stage && data.stage !== existing.stage) {
      webhookDispatcher.emitDealEvent(tenantId, 'deal.stage_changed', deal, {
        previous_stage: existing.stage,
        new_stage: data.stage,
      });

      if (data.stage === DealStage.WON) {
        webhookDispatcher.emitDealEvent(tenantId, 'deal.won', deal);
        notifyDealWon(tenantId, deal).catch(() => {});
      } else if (data.stage === DealStage.LOST) {
        webhookDispatcher.emitDealEvent(tenantId, 'deal.lost', deal, {
          lost_reason: deal.lostReason || null,
        });
        notifyDealLost(tenantId, deal).catch(() => {});
      }
    }

    // Always emit deal.updated for any update
    webhookDispatcher.emitDealEvent(tenantId, 'deal.updated', deal);

    // Emit Socket.IO event for real-time cache updates
    emitToTenant(tenantId, 'deal:updated', { deal });

    return deal;
  },

  async delete(tenantId: string, id: string) {
    // Tenant-safe delete: verify ownership before deleting
    const deal = await prisma.deal.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!deal) {
      throw createError('Deal not found', 404, 'DEAL_NOT_FOUND');
    }
    await prisma.deal.update({ where: { id }, data: { deletedAt: new Date() } });

    // Emit Socket.IO event for real-time cache updates
    emitToTenant(tenantId, 'deal:deleted', { dealId: id });
  },

  async getStats(tenantId: string) {
    const activeStages: DealStage[] = [
      DealStage.QUALIFICATION,
      DealStage.PROPOSAL,
      DealStage.NEGOTIATION,
      DealStage.CLOSING,
    ];

    // All aggregations at DB level — no full table load
    const [totalCount, stageGroups, activeAgg, wonAgg, lostAgg, wonCycleTimeDeals] =
      await Promise.all([
        // Total deal count
        prisma.deal.count({ where: { tenantId, deletedAt: null } }),

        // Group by stage: count + sum value
        prisma.deal.groupBy({
          by: ['stage'],
          where: { tenantId, deletedAt: null },
          _count: { id: true },
          _sum: { value: true },
        }),

        // Active pipeline aggregation (sum value for active stages)
        prisma.deal.aggregate({
          where: { tenantId, deletedAt: null, stage: { in: activeStages } },
          _sum: { value: true },
          _count: { id: true },
        }),

        // Won deals aggregation
        prisma.deal.aggregate({
          where: { tenantId, deletedAt: null, stage: DealStage.WON },
          _sum: { value: true },
          _count: { id: true },
          _avg: { value: true },
        }),

        // Lost deals aggregation
        prisma.deal.aggregate({
          where: { tenantId, deletedAt: null, stage: DealStage.LOST },
          _sum: { value: true },
          _count: { id: true },
        }),

        // Won deals with closedAt for cycle time calculation (lightweight select)
        prisma.deal.findMany({
          where: { tenantId, deletedAt: null, stage: DealStage.WON, closedAt: { not: null } },
          select: { createdAt: true, closedAt: true },
        }),
      ]);

    const totalPipelineValue = Number(activeAgg._sum.value || 0);
    const wonValue = Number(wonAgg._sum.value || 0);
    const lostValue = Number(lostAgg._sum.value || 0);
    const wonCount = wonAgg._count.id;
    const lostCount = lostAgg._count.id;
    const activeCount = activeAgg._count.id;
    const closedCount = wonCount + lostCount;
    const winRate = closedCount > 0 ? (wonCount / closedCount) * 100 : 0;
    const avgDealSize = wonCount > 0 ? wonValue / wonCount : 0;

    // Weighted pipeline value needs per-stage probability, compute from groupBy
    const stageGroupMap = new Map(stageGroups.map((g) => [g.stage, g]));
    let weightedValue = 0;
    for (const stage of activeStages) {
      const group = stageGroupMap.get(stage);
      if (group && group._sum.value) {
        weightedValue += Number(group._sum.value) * (STAGE_PROBABILITY[stage] / 100);
      }
    }

    // Average cycle time (days) for won deals
    const cycleTimes = wonCycleTimeDeals.map(
      (d) => (d.closedAt!.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const avgCycleTime =
      cycleTimes.length > 0 ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length : 0;

    // By stage breakdown
    const byStage = activeStages.map((stage) => {
      const group = stageGroupMap.get(stage);
      const totalValue = Number(group?._sum.value || 0);
      return {
        stage,
        count: group?._count.id || 0,
        totalValue,
        weightedValue: totalValue * (STAGE_PROBABILITY[stage] / 100),
      };
    });

    return {
      totalPipelineValue,
      weightedValue: Math.round(weightedValue * 100) / 100,
      wonValue,
      lostValue,
      winRate: Math.round(winRate * 10) / 10,
      avgDealSize: Math.round(avgDealSize * 100) / 100,
      avgCycleTime: Math.round(avgCycleTime * 10) / 10,
      byStage,
      totalDeals: totalCount,
      activeDeals: activeCount,
      wonDeals: wonCount,
      lostDeals: lostCount,
    };
  },
};
