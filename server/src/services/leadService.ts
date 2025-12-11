import prisma from '../config/database.js';
import { LeadStatus, LeadSource } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

export interface CreateLeadData {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  status?: LeadStatus;
  source?: LeadSource;
  score?: number;
  customFields?: Record<string, any>;
  notes?: string;
  assignedTo?: string;
  tagIds?: string[];
}

export interface UpdateLeadData extends Partial<CreateLeadData> {
  id: string;
}

export const leadService = {
  async create(tenantId: string, data: CreateLeadData) {
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        position: data.position,
        status: data.status || LeadStatus.NEW,
        source: data.source || LeadSource.WEBSITE,
        score: data.score || 0,
        customFields: data.customFields || {},
        notes: data.notes,
        assignedTo: data.assignedTo,
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Add tags if provided
    if (data.tagIds && data.tagIds.length > 0) {
      await Promise.all(
        data.tagIds.map((tagId) =>
          prisma.leadTag.create({
            data: {
              leadId: lead.id,
              tagId,
            },
          })
        )
      );
    }

    return this.findById(tenantId, lead.id);
  },

  async findById(tenantId: string, id: string) {
    const lead = await prisma.lead.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!lead) {
      throw createError('Lead not found', 404, 'LEAD_NOT_FOUND');
    }

    return lead;
  },

  async findAll(tenantId: string, filters?: {
    status?: LeadStatus;
    source?: LeadSource;
    search?: string;
    tagId?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.source) {
      where.source = filters.source;
    }

    if (filters?.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { company: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.tagId) {
      where.tags = {
        some: {
          tagId: filters.tagId,
        },
      };
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async update(tenantId: string, data: UpdateLeadData) {
    // Verify lead exists and belongs to tenant
    await this.findById(tenantId, data.id);

    const updateData: any = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      position: data.position,
      status: data.status,
      source: data.source,
      score: data.score,
      customFields: data.customFields,
      notes: data.notes,
      assignedTo: data.assignedTo,
    };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const lead = await prisma.lead.update({
      where: { id: data.id },
      data: updateData,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Update tags if provided
    if (data.tagIds !== undefined) {
      // Remove all existing tags
      await prisma.leadTag.deleteMany({
        where: { leadId: data.id },
      });

      // Add new tags
      if (data.tagIds.length > 0) {
        await Promise.all(
          data.tagIds.map((tagId) =>
            prisma.leadTag.create({
              data: {
                leadId: data.id,
                tagId,
              },
            })
          )
        );
      }
    }

    return this.findById(tenantId, data.id);
  },

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.lead.delete({
      where: { id },
    });
  },

  async count(tenantId: string) {
    return prisma.lead.count({
      where: { tenantId },
    });
  },
};







