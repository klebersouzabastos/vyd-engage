import prisma from '../config/database.js';
import {
  Prisma,
  CommercialRoadmapStatus,
  StakeholderRole,
  StakeholderPosture,
  DealStage,
  TaskStatus,
} from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { taskService } from './taskService.js';
import { dealService } from './dealService.js';
import { googleCalendarService } from './googleCalendarService.js';

export interface CreateRoadmapData {
  title: string;
  companyId: string;
  empreendimentoId?: string;
  dealId?: string;
  deepResearchId?: string;
  playbookTemplateId?: string;
  status?: CommercialRoadmapStatus;
  targetProposalDate?: string;
  notes?: string;
}

export interface UpdateRoadmapData {
  title?: string;
  empreendimentoId?: string | null;
  dealId?: string | null;
  status?: CommercialRoadmapStatus;
  targetProposalDate?: string | null;
  notes?: string;
}

async function assertCompany(tenantId: string, companyId: string) {
  const c = await prisma.company.findFirst({
    where: { id: companyId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!c) throw createError('Empresa não encontrada.', 400, 'COMPANY_NOT_FOUND');
}

async function assertEmpreendimento(tenantId: string, id: string) {
  const e = await prisma.empreendimento.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!e) throw createError('Empreendimento não encontrado.', 400, 'EMPREENDIMENTO_NOT_FOUND');
}

const detailInclude = {
  company: { select: { id: true, name: true } },
  empreendimento: { select: { id: true, name: true } },
  deal: { select: { id: true, name: true, stage: true } },
  deepResearch: { select: { id: true, title: true } },
  playbookTemplate: { select: { id: true, name: true } },
  stakeholders: {
    include: {
      lead: { select: { id: true, name: true, email: true, position: true, reportsToId: true } },
    },
  },
  tasks: {
    where: { deletedAt: null },
    orderBy: { dueDate: 'asc' as const },
    include: { lead: { select: { id: true, name: true } } },
  },
} as const;

/**
 * Gera uma Task por passo do playbook (modo "Playbook + manual"). As ações
 * nascem via taskService.create → entram na agenda e nos lembretes. O contato-alvo
 * (leadId) fica a definir; o usuário atribui depois ao montar a hierarquia.
 */
async function generateActionsFromPlaybook(
  tenantId: string,
  roadmap: {
    id: string;
    companyId: string;
    empreendimentoId: string | null;
    playbookTemplateId: string | null;
  },
  ownerId?: string
) {
  if (!roadmap.playbookTemplateId) return;
  const tpl = await prisma.playbookTemplate.findFirst({
    where: { id: roadmap.playbookTemplateId, tenantId },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!tpl) return;
  const start = new Date();
  for (const step of tpl.steps) {
    const due = new Date(start);
    due.setDate(due.getDate() + step.offsetDays);
    const task = await taskService.create(tenantId, {
      title: step.title,
      description: step.description ?? undefined,
      priority: step.priority,
      type: step.actionType,
      assignedTo: ownerId,
      companyId: roadmap.companyId,
      empreendimentoId: roadmap.empreendimentoId ?? undefined,
      roadmapId: roadmap.id,
      dueDate: due,
    });
    // As ações entram na agenda do dono e sincronizam com o Google Calendar
    // quando ele estiver conectado (fire-and-forget; nunca quebra a geração).
    if (ownerId) {
      googleCalendarService.syncTaskForUser(ownerId, tenantId, task).catch(() => {});
    }
  }
}

/** Desdobramento comercial (roadmap): hierarquia + ações de acesso até a proposta. */
export const roadmapService = {
  async create(tenantId: string, createdById: string | undefined, data: CreateRoadmapData) {
    await assertCompany(tenantId, data.companyId);
    if (data.empreendimentoId) await assertEmpreendimento(tenantId, data.empreendimentoId);

    const roadmap = await prisma.commercialRoadmap.create({
      data: {
        tenantId,
        createdById: createdById || null,
        title: data.title,
        companyId: data.companyId,
        empreendimentoId: data.empreendimentoId || null,
        dealId: data.dealId || null,
        deepResearchId: data.deepResearchId || null,
        playbookTemplateId: data.playbookTemplateId || null,
        status: data.status || CommercialRoadmapStatus.PLANEJAMENTO,
        targetProposalDate: data.targetProposalDate ? new Date(data.targetProposalDate) : null,
        notes: data.notes || null,
      },
    });

    await generateActionsFromPlaybook(tenantId, roadmap, createdById);
    return this.findById(tenantId, roadmap.id);
  },

  async findAll(
    tenantId: string,
    filters?: {
      companyId?: string;
      empreendimentoId?: string;
      status?: CommercialRoadmapStatus;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const where: Prisma.CommercialRoadmapWhereInput = { tenantId, deletedAt: null };
    if (filters?.companyId) where.companyId = filters.companyId;
    if (filters?.empreendimentoId) where.empreendimentoId = filters.empreendimentoId;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) where.title = { contains: filters.search, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      prisma.commercialRoadmap.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          company: { select: { id: true, name: true } },
          empreendimento: { select: { id: true, name: true } },
          _count: { select: { tasks: true, stakeholders: true } },
        },
      }),
      prisma.commercialRoadmap.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async findById(tenantId: string, id: string) {
    const item = await prisma.commercialRoadmap.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: detailInclude,
    });
    if (!item) throw createError('Desdobramento não encontrado', 404, 'ROADMAP_NOT_FOUND');
    return item;
  },

  async update(tenantId: string, id: string, data: UpdateRoadmapData) {
    await this.findById(tenantId, id);
    if (data.empreendimentoId) await assertEmpreendimento(tenantId, data.empreendimentoId);

    const updateData: Prisma.CommercialRoadmapUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.targetProposalDate !== undefined)
      updateData.targetProposalDate = data.targetProposalDate
        ? new Date(data.targetProposalDate)
        : null;
    if (data.empreendimentoId !== undefined)
      updateData.empreendimento = data.empreendimentoId
        ? { connect: { id: data.empreendimentoId } }
        : { disconnect: true };
    if (data.dealId !== undefined)
      updateData.deal = data.dealId ? { connect: { id: data.dealId } } : { disconnect: true };

    await prisma.commercialRoadmap.update({ where: { id }, data: updateData });
    return this.findById(tenantId, id);
  },

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.commercialRoadmap.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  /** Adiciona/atualiza um stakeholder (decisor/influenciador) do desdobramento. */
  async upsertStakeholder(
    tenantId: string,
    roadmapId: string,
    data: {
      leadId: string;
      roleInDecision?: StakeholderRole;
      posture?: StakeholderPosture;
      notes?: string;
    }
  ) {
    await this.findById(tenantId, roadmapId);
    const lead = await prisma.lead.findFirst({
      where: { id: data.leadId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) throw createError('Contato não encontrado.', 400, 'LEAD_NOT_FOUND');

    return prisma.roadmapStakeholder.upsert({
      where: { roadmapId_leadId: { roadmapId, leadId: data.leadId } },
      create: {
        roadmapId,
        leadId: data.leadId,
        roleInDecision: data.roleInDecision ?? StakeholderRole.USUARIO,
        posture: data.posture ?? StakeholderPosture.DESCONHECIDO,
        notes: data.notes ?? null,
      },
      update: {
        roleInDecision: data.roleInDecision,
        posture: data.posture,
        notes: data.notes ?? null,
      },
      include: { lead: { select: { id: true, name: true, email: true, position: true } } },
    });
  },

  async removeStakeholder(tenantId: string, roadmapId: string, leadId: string) {
    await this.findById(tenantId, roadmapId);
    await prisma.roadmapStakeholder.deleteMany({ where: { roadmapId, leadId } });
  },

  /**
   * Avança o desdobramento para "pedido de proposta": reusa o Deal aberto da
   * empresa/empreendimento (ou cria um novo) na etapa PROPOSAL, vincula-o ao
   * roadmap e reflete o status (req 17). Nunca duplica um Deal aberto.
   */
  async advanceToProposal(tenantId: string, roadmapId: string, ownerId?: string) {
    const roadmap = await this.findById(tenantId, roadmapId);
    const openStages = { notIn: [DealStage.WON, DealStage.LOST] };

    // 1. Deal aberto já vinculado tem prioridade; senão, um Deal aberto da
    //    empresa (e empreendimento, quando houver).
    let deal = roadmap.dealId
      ? await prisma.deal.findFirst({
          where: { id: roadmap.dealId, tenantId, deletedAt: null, stage: openStages },
        })
      : null;
    if (!deal) {
      deal = await prisma.deal.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          companyId: roadmap.companyId,
          ...(roadmap.empreendimentoId ? { empreendimentoId: roadmap.empreendimentoId } : {}),
          stage: openStages,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 2. Reusar (mover para PROPOSAL) ou criar um novo Deal em PROPOSAL.
    if (deal) {
      if (deal.stage !== DealStage.PROPOSAL) {
        deal = await dealService.update(tenantId, { id: deal.id, stage: DealStage.PROPOSAL });
      }
    } else {
      const estimated = roadmap.empreendimentoId
        ? (
            await prisma.empreendimento.findUnique({
              where: { id: roadmap.empreendimentoId },
              select: { estimatedValue: true },
            })
          )?.estimatedValue
        : null;
      deal = await dealService.create(tenantId, {
        name: `Proposta — ${roadmap.company.name}${
          roadmap.empreendimento ? ' / ' + roadmap.empreendimento.name : ''
        }`,
        value: estimated != null ? Number(estimated) : 0,
        stage: DealStage.PROPOSAL,
        companyId: roadmap.companyId,
        empreendimentoId: roadmap.empreendimentoId ?? undefined,
        assignedTo: ownerId,
      });
    }

    // 3. Vincular o Deal e refletir o status do roadmap.
    await prisma.commercialRoadmap.update({
      where: { id: roadmapId },
      data: { dealId: deal.id, status: CommercialRoadmapStatus.PROPOSTA },
    });
    return this.findById(tenantId, roadmapId);
  },

  /**
   * Painel "não deixar passar": próximas ações, ações atrasadas e roadmaps em
   * risco (sem ação concluída há `riskDays` dias). Segmentável por vendedor.
   */
  async getPanel(tenantId: string, filters?: { assignedTo?: string; riskDays?: number }) {
    const now = new Date();
    const riskDays = filters?.riskDays ?? 7;
    const riskCutoff = new Date(now);
    riskCutoff.setDate(riskCutoff.getDate() - riskDays);

    const taskWhere: Prisma.TaskWhereInput = {
      tenantId,
      deletedAt: null,
      roadmapId: { not: null },
      status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
    };
    if (filters?.assignedTo) taskWhere.assignedTo = filters.assignedTo;

    const taskInclude = {
      lead: { select: { id: true, name: true } },
      roadmap: { select: { id: true, title: true } },
    } as const;

    const [overdue, upcoming, activeRoadmaps] = await Promise.all([
      prisma.task.findMany({
        where: { ...taskWhere, dueDate: { lt: now } },
        orderBy: { dueDate: 'asc' },
        take: 100,
        include: taskInclude,
      }),
      prisma.task.findMany({
        where: { ...taskWhere, dueDate: { gte: now } },
        orderBy: { dueDate: 'asc' },
        take: 100,
        include: taskInclude,
      }),
      prisma.commercialRoadmap.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: {
            in: [
              CommercialRoadmapStatus.PLANEJAMENTO,
              CommercialRoadmapStatus.EM_ANDAMENTO,
              CommercialRoadmapStatus.PROPOSTA,
            ],
          },
          ...(filters?.assignedTo
            ? { tasks: { some: { assignedTo: filters.assignedTo, deletedAt: null } } }
            : {}),
        },
        include: {
          company: { select: { id: true, name: true } },
          empreendimento: { select: { id: true, name: true } },
          tasks: {
            where: { deletedAt: null },
            select: { status: true, completedAt: true, dueDate: true },
          },
        },
      }),
    ]);

    // Em risco: nenhuma ação concluída desde o corte (ou nunca concluiu nada) —
    // sinaliza estagnação no roadmap.
    const atRisk = activeRoadmaps
      .map((r) => {
        const completed = r.tasks.filter((t) => t.completedAt).map((t) => t.completedAt!.getTime());
        const lastActivityAt = completed.length ? new Date(Math.max(...completed)) : null;
        const overdueCount = r.tasks.filter(
          (t) =>
            t.status !== TaskStatus.COMPLETED &&
            t.status !== TaskStatus.CANCELLED &&
            t.dueDate &&
            t.dueDate < now
        ).length;
        return {
          id: r.id,
          title: r.title,
          status: r.status,
          company: r.company,
          empreendimento: r.empreendimento,
          lastActivityAt,
          overdueCount,
        };
      })
      .filter((r) => !r.lastActivityAt || r.lastActivityAt < riskCutoff)
      .sort((a, b) => b.overdueCount - a.overdueCount);

    return { upcoming, overdue, atRisk, riskDays };
  },
};
