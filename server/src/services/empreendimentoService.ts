import prisma from '../config/database.js';
import { Prisma } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

export interface CreateEmpreendimentoData {
  companyId: string;
  name: string;
  type?: string;
  location?: string;
  estimatedValue?: number;
  phase?: string;
  expectedDecisionDate?: string;
  status?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export type UpdateEmpreendimentoData = Partial<Omit<CreateEmpreendimentoData, 'companyId'>>;

/** Garante que a empresa existe e pertence ao tenant. */
async function assertCompany(tenantId: string, companyId: string) {
  const company = await prisma.company.findFirst({
    where: { id: companyId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!company) {
    throw createError('Empresa não encontrada para este empreendimento.', 400, 'COMPANY_NOT_FOUND');
  }
}

const include = { company: { select: { id: true, name: true } } } as const;

/** Empreendimentos (obras/projetos do cliente) — sempre vinculados a uma empresa. */
export const empreendimentoService = {
  async create(tenantId: string, createdById: string | undefined, data: CreateEmpreendimentoData) {
    await assertCompany(tenantId, data.companyId);
    return prisma.empreendimento.create({
      data: {
        tenantId,
        createdById: createdById || null,
        companyId: data.companyId,
        name: data.name,
        type: data.type || null,
        location: data.location || null,
        estimatedValue:
          data.estimatedValue != null ? new Prisma.Decimal(data.estimatedValue) : null,
        phase: data.phase || null,
        expectedDecisionDate: data.expectedDecisionDate
          ? new Date(data.expectedDecisionDate)
          : null,
        status: data.status || 'ATIVO',
        notes: data.notes || null,
        customFields: (data.customFields || {}) as Prisma.InputJsonValue,
      },
      include,
    });
  },

  async findAll(
    tenantId: string,
    filters?: {
      companyId?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const where: Prisma.EmpreendimentoWhereInput = { tenantId, deletedAt: null };
    if (filters?.companyId) where.companyId = filters.companyId;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) where.name = { contains: filters.search, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      prisma.empreendimento.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include,
      }),
      prisma.empreendimento.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async findById(tenantId: string, id: string) {
    const item = await prisma.empreendimento.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { contacts: true, roadmaps: true, deals: true } },
      },
    });
    if (!item) throw createError('Empreendimento não encontrado', 404, 'EMPREENDIMENTO_NOT_FOUND');
    return item;
  },

  async update(tenantId: string, id: string, data: UpdateEmpreendimentoData) {
    await this.findById(tenantId, id);
    const updateData: Prisma.EmpreendimentoUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type || null;
    if (data.location !== undefined) updateData.location = data.location || null;
    if (data.estimatedValue !== undefined)
      updateData.estimatedValue =
        data.estimatedValue != null ? new Prisma.Decimal(data.estimatedValue) : null;
    if (data.phase !== undefined) updateData.phase = data.phase || null;
    if (data.expectedDecisionDate !== undefined)
      updateData.expectedDecisionDate = data.expectedDecisionDate
        ? new Date(data.expectedDecisionDate)
        : null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.customFields !== undefined)
      updateData.customFields = data.customFields as Prisma.InputJsonValue;

    await prisma.empreendimento.update({ where: { id }, data: updateData });
    return this.findById(tenantId, id);
  },

  /** Soft delete. Os vínculos (Lead/Deal/Task) usam SetNull; roadmaps são preservados. */
  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.empreendimento.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
