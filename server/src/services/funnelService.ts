import prisma from '../config/database.js';
import { LeadStatus } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

const DEFAULT_COLUMNS = [
  { title: 'Novo', color: '#3B82F6', order: 0, isDefault: true, mappedStatus: LeadStatus.NEW },
  { title: 'Em Contato', color: '#F59E0B', order: 1, isDefault: false, mappedStatus: LeadStatus.CONTACTED },
  { title: 'Qualificado', color: '#8B5CF6', order: 2, isDefault: false, mappedStatus: LeadStatus.QUALIFIED },
  { title: 'Proposta', color: '#EC4899', order: 3, isDefault: false, mappedStatus: LeadStatus.PROPOSAL },
  { title: 'Negociação', color: '#F97316', order: 4, isDefault: false, mappedStatus: LeadStatus.NEGOTIATION },
  { title: 'Fechado', color: '#10B981', order: 5, isDefault: false, mappedStatus: LeadStatus.WON },
  { title: 'Perdido', color: '#EF4444', order: 6, isDefault: false, mappedStatus: LeadStatus.LOST },
];

export const funnelService = {
  /**
   * Get all funnels for a tenant, including columns and lead counts
   */
  async findAll(tenantId: string) {
    const funnels = await prisma.funnel.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { order: 'asc' }],
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { leads: true } },
          },
        },
      },
    });

    return funnels;
  },

  /**
   * Get a single funnel with columns and leads
   */
  async findById(tenantId: string, funnelId: string) {
    const funnel = await prisma.funnel.findFirst({
      where: { id: funnelId, tenantId },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            leads: {
              orderBy: { positionInColumn: 'asc' },
              include: {
                tags: { include: { tag: true } },
              },
            },
          },
        },
      },
    });

    if (!funnel) {
      throw createError('Funnel not found', 404);
    }

    return funnel;
  },

  /**
   * Create a new funnel with default columns
   */
  async create(tenantId: string, data: { name: string; columns?: Array<{ title: string; color?: string; mappedStatus?: LeadStatus }> }) {
    const existingCount = await prisma.funnel.count({ where: { tenantId } });

    const funnel = await prisma.funnel.create({
      data: {
        tenantId,
        name: data.name,
        isDefault: existingCount === 0,
        order: existingCount,
        columns: {
          create: (data.columns || DEFAULT_COLUMNS).map((col, index) => ({
            title: col.title,
            color: col.color || '#3B82F6',
            order: index,
            isDefault: index === 0,
            mappedStatus: col.mappedStatus || null,
          })),
        },
      },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { leads: true } },
          },
        },
      },
    });

    return funnel;
  },

  /**
   * Update funnel name or order
   */
  async update(tenantId: string, funnelId: string, data: { name?: string; order?: number }) {
    const funnel = await prisma.funnel.findFirst({
      where: { id: funnelId, tenantId },
    });

    if (!funnel) {
      throw createError('Funnel not found', 404);
    }

    return prisma.funnel.update({
      where: { id: funnelId },
      data: {
        name: data.name ?? funnel.name,
        order: data.order ?? funnel.order,
      },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { leads: true } },
          },
        },
      },
    });
  },

  /**
   * Delete a funnel (cannot delete default)
   */
  async delete(tenantId: string, funnelId: string) {
    const funnel = await prisma.funnel.findFirst({
      where: { id: funnelId, tenantId },
      include: { columns: { include: { _count: { select: { leads: true } } } } },
    });

    if (!funnel) {
      throw createError('Funnel not found', 404);
    }

    if (funnel.isDefault) {
      throw createError('Cannot delete the default funnel', 400);
    }

    const totalLeads = funnel.columns.reduce((sum, col) => sum + col._count.leads, 0);
    if (totalLeads > 0) {
      throw createError('Cannot delete funnel with leads. Move leads first.', 400);
    }

    await prisma.funnel.delete({ where: { id: funnelId } });
    return { success: true };
  },

  /**
   * Ensure default funnel exists for tenant, create if not
   */
  async ensureDefaultFunnel(tenantId: string) {
    const existing = await prisma.funnel.findFirst({
      where: { tenantId, isDefault: true },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { leads: true } },
          },
        },
      },
    });

    if (existing) return existing;

    return this.create(tenantId, { name: 'Funil de Venda' });
  },

  // ========================
  // Column operations
  // ========================

  /**
   * Add column to funnel
   */
  async addColumn(tenantId: string, funnelId: string, data: { title: string; color?: string; mappedStatus?: LeadStatus }) {
    const funnel = await prisma.funnel.findFirst({
      where: { id: funnelId, tenantId },
      include: { columns: true },
    });

    if (!funnel) {
      throw createError('Funnel not found', 404);
    }

    const maxOrder = funnel.columns.reduce((max, col) => Math.max(max, col.order), -1);

    return prisma.funnelColumn.create({
      data: {
        funnelId,
        title: data.title,
        color: data.color || '#3B82F6',
        order: maxOrder + 1,
        isDefault: false,
        mappedStatus: data.mappedStatus || null,
      },
      include: {
        _count: { select: { leads: true } },
      },
    });
  },

  /**
   * Update column (title, color, order)
   */
  async updateColumn(tenantId: string, columnId: string, data: { title?: string; color?: string; order?: number }) {
    const column = await prisma.funnelColumn.findFirst({
      where: { id: columnId, funnel: { tenantId } },
    });

    if (!column) {
      throw createError('Column not found', 404);
    }

    return prisma.funnelColumn.update({
      where: { id: columnId },
      data: {
        title: data.title ?? column.title,
        color: data.color ?? column.color,
        order: data.order ?? column.order,
      },
      include: {
        _count: { select: { leads: true } },
      },
    });
  },

  /**
   * Reorder columns within a funnel
   */
  async reorderColumns(tenantId: string, funnelId: string, columnIds: string[]) {
    const funnel = await prisma.funnel.findFirst({
      where: { id: funnelId, tenantId },
    });

    if (!funnel) {
      throw createError('Funnel not found', 404);
    }

    // Verify all columns belong to this funnel before reordering
    const columns = await prisma.funnelColumn.findMany({
      where: { funnelId },
      select: { id: true },
    });
    const validColumnIds = new Set(columns.map(c => c.id));
    const invalidIds = columnIds.filter(id => !validColumnIds.has(id));
    if (invalidIds.length > 0) {
      throw createError('One or more column IDs do not belong to this funnel', 400);
    }

    await prisma.$transaction(
      columnIds.map((id, index) =>
        prisma.funnelColumn.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    return this.findById(tenantId, funnelId);
  },

  /**
   * Delete column (cannot delete default, cannot delete if has leads)
   */
  async deleteColumn(tenantId: string, columnId: string) {
    const column = await prisma.funnelColumn.findFirst({
      where: { id: columnId, funnel: { tenantId } },
      include: { _count: { select: { leads: true } } },
    });

    if (!column) {
      throw createError('Column not found', 404);
    }

    if (column.isDefault) {
      throw createError('Cannot delete the default column', 400);
    }

    if (column._count.leads > 0) {
      throw createError('Cannot delete column with leads. Move leads first.', 400);
    }

    await prisma.funnelColumn.delete({ where: { id: columnId } });
    return { success: true };
  },

  /**
   * Move a lead to a different column (drag-and-drop)
   */
  async moveLead(tenantId: string, leadId: string, targetColumnId: string, position: number) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!lead) {
      throw createError('Lead not found', 404);
    }

    const targetColumn = await prisma.funnelColumn.findFirst({
      where: { id: targetColumnId, funnel: { tenantId } },
    });

    if (!targetColumn) {
      throw createError('Target column not found', 404);
    }

    // Update lead's column position and status
    const updateData: Record<string, unknown> = {
      funnelColumnId: targetColumnId,
      positionInColumn: position,
    };

    // If column has a mapped status, update lead status too
    if (targetColumn.mappedStatus) {
      updateData.status = targetColumn.mappedStatus;
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
      include: {
        tags: { include: { tag: true } },
      },
    });

    // Reorder other leads in target column
    const leadsInColumn = await prisma.lead.findMany({
      where: { funnelColumnId: targetColumnId, id: { not: leadId } },
      orderBy: { positionInColumn: 'asc' },
    });

    await prisma.$transaction(
      leadsInColumn.map((l, index) => {
        const newPosition = index >= position ? index + 1 : index;
        return prisma.lead.update({
          where: { id: l.id },
          data: { positionInColumn: newPosition },
        });
      })
    );

    return updatedLead;
  },
};
