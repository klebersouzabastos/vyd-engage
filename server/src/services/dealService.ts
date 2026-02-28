import prisma from '../config/database.js';
import { DealStage } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

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
  assignedTo?: string | null;
  notes?: string;
  customFields?: Record<string, any>;
  lostReason?: string;
}

export interface UpdateDealData extends Partial<CreateDealData> {
  id: string;
}

export const dealService = {
  async create(tenantId: string, data: CreateDealData) {
    const stage = data.stage || DealStage.QUALIFICATION;
    const probability = data.probability ?? STAGE_PROBABILITY[stage];

    const deal = await prisma.deal.create({
      data: {
        tenantId,
        name: data.name,
        value: data.value,
        stage,
        probability,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        leadId: data.leadId || null,
        assignedTo: data.assignedTo || null,
        notes: data.notes || null,
        customFields: data.customFields || {},
        lostReason: data.lostReason || null,
      },
      include: {
        lead: { select: { id: true, name: true, email: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    return deal;
  },

  async findById(tenantId: string, id: string) {
    const deal = await prisma.deal.findFirst({
      where: { id, tenantId },
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

  async findAll(tenantId: string, filters?: {
    stage?: DealStage;
    assignedTo?: string;
    leadId?: string;
    search?: string;
    minValue?: number;
    maxValue?: number;
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;
    const sortField = filters?.sort || 'createdAt';
    const sortOrder = filters?.order || 'desc';

    const where: any = { tenantId };

    if (filters?.stage) {
      where.stage = filters.stage;
    }

    if (filters?.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters?.leadId) {
      where.leadId = filters.leadId;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
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
    const probability = data.probability ?? (data.stage ? STAGE_PROBABILITY[data.stage] : undefined);

    const updateData: any = {
      name: data.name,
      value: data.value,
      stage: data.stage,
      probability,
      expectedCloseDate: data.expectedCloseDate !== undefined
        ? (data.expectedCloseDate ? new Date(data.expectedCloseDate) : null)
        : undefined,
      leadId: data.leadId,
      assignedTo: data.assignedTo,
      notes: data.notes,
      customFields: data.customFields,
      lostReason: data.lostReason,
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

    const deal = await prisma.deal.update({
      where: { id: data.id },
      data: updateData,
      include: {
        lead: { select: { id: true, name: true, email: true, phone: true, company: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });

    // When deal is WON and has a leadId, update lead status to WON
    if (data.stage === DealStage.WON && deal.leadId) {
      await prisma.lead.update({
        where: { id: deal.leadId },
        data: { status: 'WON' },
      }).catch(() => {});
    }

    return deal;
  },

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.deal.delete({ where: { id } });
  },

  async getStats(tenantId: string) {
    const deals = await prisma.deal.findMany({
      where: { tenantId },
      select: {
        value: true,
        stage: true,
        probability: true,
        createdAt: true,
        closedAt: true,
      },
    });

    const activeStages = new Set<string>([
      DealStage.QUALIFICATION,
      DealStage.PROPOSAL,
      DealStage.NEGOTIATION,
      DealStage.CLOSING,
    ]);

    const activeDeals = deals.filter(d => activeStages.has(d.stage));
    const wonDeals = deals.filter(d => d.stage === (DealStage.WON as string));
    const lostDeals = deals.filter(d => d.stage === (DealStage.LOST as string));
    const closedDeals = [...wonDeals, ...lostDeals];

    const totalPipelineValue = activeDeals.reduce((sum, d) => sum + Number(d.value), 0);
    const weightedValue = activeDeals.reduce((sum, d) => sum + Number(d.value) * (d.probability / 100), 0);
    const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.value), 0);
    const lostValue = lostDeals.reduce((sum, d) => sum + Number(d.value), 0);
    const winRate = closedDeals.length > 0 ? (wonDeals.length / closedDeals.length) * 100 : 0;
    const avgDealSize = wonDeals.length > 0 ? wonValue / wonDeals.length : 0;

    // Average cycle time (days from creation to close) for won deals
    const cycleTimes = wonDeals
      .filter(d => d.closedAt)
      .map(d => (d.closedAt!.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const avgCycleTime = cycleTimes.length > 0 ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length : 0;

    // By stage breakdown
    const byStage = Array.from(activeStages).map(stage => {
      const stageDeals = deals.filter(d => d.stage === stage);
      const total = stageDeals.reduce((sum, d) => sum + Number(d.value), 0);
      const weighted = stageDeals.reduce((sum, d) => sum + Number(d.value) * (d.probability / 100), 0);
      return {
        stage,
        count: stageDeals.length,
        totalValue: total,
        weightedValue: weighted,
      };
    });

    return {
      totalPipelineValue,
      weightedValue,
      wonValue,
      lostValue,
      winRate: Math.round(winRate * 10) / 10,
      avgDealSize: Math.round(avgDealSize * 100) / 100,
      avgCycleTime: Math.round(avgCycleTime * 10) / 10,
      byStage,
      totalDeals: deals.length,
      activeDeals: activeDeals.length,
      wonDeals: wonDeals.length,
      lostDeals: lostDeals.length,
    };
  },
};
