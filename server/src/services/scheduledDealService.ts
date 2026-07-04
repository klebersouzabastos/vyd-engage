import prisma from '../config/database.js';
import { ScheduledDealStatus, ScheduledDealType } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

/**
 * Multi-vendas — negociações agendadas (Upgrade RD P0, spec req 4).
 *
 * O agendamento referencia o deal de origem por id simples (sem FK) e herda
 * companyId/leadId dele no momento da criação. O job salesOps varre os
 * agendamentos PENDING vencidos e cria o Deal correspondente.
 */

export interface CreateScheduledDealData {
  originDealId: string;
  type: ScheduledDealType;
  /** ISO 8601 — datas no passado são aceitas (criadas na próxima varredura do job). */
  scheduledFor: string;
  funnelId?: string;
  funnelColumnId?: string;
  estimatedValue?: number;
  assignedTo?: string;
  notes?: string;
}

export interface ScheduledDealListFilters {
  status?: ScheduledDealStatus;
  originDealId?: string;
  /** Escopo por papel (ownerScope): analista só vê os seus. */
  assignedTo?: string;
}

/** Rótulos pt-BR dos tipos de multi-venda (usados no nome do deal criado pelo job). */
export const SCHEDULED_DEAL_TYPE_LABELS: Record<ScheduledDealType, string> = {
  POS_VENDA: 'Pós-venda',
  CROSS_SELL: 'Cross-sell',
  UPSELL: 'Upsell',
  RECOMPRA: 'Recompra',
  RELACIONAMENTO: 'Relacionamento',
  OUTRO: 'Outro',
};

export const scheduledDealService = {
  async create(tenantId: string, userId: string, data: CreateScheduledDealData) {
    // Deal de origem precisa pertencer ao tenant (multi-tenant safety).
    const origin = await prisma.deal.findFirst({
      where: { id: data.originDealId, tenantId, deletedAt: null },
      select: { id: true, companyId: true, leadId: true, assignedTo: true },
    });
    if (!origin) {
      throw createError('Negociação de origem não encontrada', 404, 'DEAL_NOT_FOUND');
    }

    const scheduledFor = new Date(data.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      throw createError('Data de agendamento inválida', 400, 'VALIDATION_ERROR');
    }

    // Funil/etapa destino (opcionais) também precisam ser do tenant.
    if (data.funnelId) {
      const funnel = await prisma.funnel.findFirst({
        where: { id: data.funnelId, tenantId },
        select: { id: true },
      });
      if (!funnel) {
        throw createError('Funil de destino não encontrado', 400, 'FUNNEL_NOT_FOUND');
      }
    }
    if (data.funnelColumnId) {
      const column = await prisma.funnelColumn.findFirst({
        where: {
          id: data.funnelColumnId,
          funnel: { tenantId },
          ...(data.funnelId ? { funnelId: data.funnelId } : {}),
        },
        select: { id: true },
      });
      if (!column) {
        throw createError('Etapa de destino não encontrada', 400, 'FUNNEL_COLUMN_NOT_FOUND');
      }
    }
    if (data.assignedTo) {
      const user = await prisma.user.findFirst({
        where: { id: data.assignedTo, tenantId },
        select: { id: true },
      });
      if (!user) {
        throw createError('Responsável não encontrado', 400, 'USER_NOT_FOUND');
      }
    }

    return prisma.scheduledDeal.create({
      data: {
        tenantId,
        originDealId: origin.id,
        companyId: origin.companyId,
        leadId: origin.leadId,
        type: data.type,
        scheduledFor,
        funnelId: data.funnelId || null,
        funnelColumnId: data.funnelColumnId || null,
        estimatedValue: data.estimatedValue ?? null,
        // Padrão: mesmo responsável do deal de origem (spec req 4).
        assignedTo: data.assignedTo || origin.assignedTo || userId,
        notes: data.notes || null,
        createdById: userId,
      },
    });
  },

  async findAll(tenantId: string, filters?: ScheduledDealListFilters) {
    const where: Record<string, unknown> = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.originDealId) where.originDealId = filters.originDealId;
    if (filters?.assignedTo) where.assignedTo = filters.assignedTo;

    const items = await prisma.scheduledDeal.findMany({
      where,
      orderBy: { scheduledFor: 'asc' },
      take: 200,
    });

    // ScheduledDeal usa ids simples (sem FK) — enriquece nomes em lote para a UI.
    const userIds = [...new Set(items.map((i) => i.assignedTo).filter(Boolean))] as string[];
    const companyIds = [...new Set(items.map((i) => i.companyId).filter(Boolean))] as string[];
    const leadIds = [...new Set(items.map((i) => i.leadId).filter(Boolean))] as string[];

    const [users, companies, leads] = await Promise.all([
      userIds.length
        ? prisma.user.findMany({
            where: { id: { in: userIds }, tenantId },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      companyIds.length
        ? prisma.company.findMany({
            where: { id: { in: companyIds }, tenantId },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      leadIds.length
        ? prisma.lead.findMany({
            where: { id: { in: leadIds }, tenantId },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const companyMap = new Map(companies.map((c) => [c.id, c]));
    const leadMap = new Map(leads.map((l) => [l.id, l]));

    return items.map((item) => ({
      ...item,
      assignedUser: item.assignedTo ? (userMap.get(item.assignedTo) ?? null) : null,
      company: item.companyId ? (companyMap.get(item.companyId) ?? null) : null,
      lead: item.leadId ? (leadMap.get(item.leadId) ?? null) : null,
    }));
  },

  /**
   * Cancela um agendamento PENDING. `restrictToUserId` (analista) limita o
   * cancelamento aos agendamentos em que ele é o responsável.
   */
  async cancel(tenantId: string, id: string, restrictToUserId?: string) {
    const existing = await prisma.scheduledDeal.findFirst({
      where: {
        id,
        tenantId,
        ...(restrictToUserId ? { assignedTo: restrictToUserId } : {}),
      },
    });
    if (!existing) {
      throw createError('Agendamento não encontrado', 404, 'SCHEDULED_DEAL_NOT_FOUND');
    }
    if (existing.status !== ScheduledDealStatus.PENDING) {
      throw createError(
        'Somente agendamentos pendentes podem ser cancelados',
        400,
        'SCHEDULED_DEAL_NOT_PENDING'
      );
    }
    return prisma.scheduledDeal.update({
      where: { id: existing.id },
      data: { status: ScheduledDealStatus.CANCELLED },
    });
  },
};
