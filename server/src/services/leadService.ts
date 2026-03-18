import prisma from '../config/database.js';
import { LeadStatus, LeadSource, ScoreEvent } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { scoringService } from './scoringService.js';
import { dispatchTrigger } from '../jobs/automationEngine.js';
import { planLimitsService } from './planLimitsService.js';
import { webhookDispatcher } from './webhookDispatcher.js';

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
      // Score for each tag added
      for (const tagId of data.tagIds) {
        scoringService.processEvent(tenantId, lead.id, ScoreEvent.TAG_ADDED).catch(() => {});
      }
    }

    // Score lead creation event
    scoringService.processEvent(tenantId, lead.id, ScoreEvent.LEAD_CREATED).catch(() => {});

    // Dispatch automation trigger
    dispatchTrigger(tenantId, 'lead_created', lead.id, {
      source: data.source || 'WEBSITE',
      status: data.status || 'NEW',
    }).catch(() => {});

    planLimitsService.invalidateUsage(tenantId).catch(() => {});

    // Dispatch outgoing webhook
    const createdLead = await this.findById(tenantId, lead.id);
    webhookDispatcher.emitLeadEvent(tenantId, 'lead.created', createdLead);

    return createdLead;
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

  async convertToContact(id: string, tenantId: string) {
    const lead = await this.findById(tenantId, id);

    if (lead.isContact) {
      throw createError('Lead is already a contact', 400, 'ALREADY_CONTACT');
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        isContact: true,
        convertedAt: new Date(),
        status: LeadStatus.WON,
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Create interaction for conversion
    await prisma.interaction.create({
      data: {
        tenantId,
        leadId: id,
        type: 'STATUS_CHANGE',
        direction: 'OUTBOUND',
        subject: 'Conversão para Contato',
        content: `Lead convertido para Contato em ${new Date().toLocaleDateString('pt-BR')}`,
        metadata: { action: 'convert_to_contact', previousStatus: lead.status },
      },
    });

    return updated;
  },

  async revertToLead(id: string, tenantId: string) {
    const lead = await this.findById(tenantId, id);

    if (!lead.isContact) {
      throw createError('Lead is not a contact', 400, 'NOT_A_CONTACT');
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        isContact: false,
        convertedAt: null,
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Create interaction for reversion
    await prisma.interaction.create({
      data: {
        tenantId,
        leadId: id,
        type: 'STATUS_CHANGE',
        direction: 'OUTBOUND',
        subject: 'Reversão para Lead',
        content: `Contato revertido para Lead em ${new Date().toLocaleDateString('pt-BR')}`,
        metadata: { action: 'revert_to_lead' },
      },
    });

    return updated;
  },

  async findAll(tenantId: string, filters?: {
    status?: LeadStatus;
    source?: LeadSource;
    search?: string;
    tagId?: string;
    assignedTo?: string;
    isContact?: boolean;
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

    if (filters?.isContact !== undefined) {
      where.isContact = filters.isContact;
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
          [sortField]: sortOrder,
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
    const existingLead = await this.findById(tenantId, data.id);

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

    // Score and trigger status change
    if (data.status && data.status !== existingLead.status) {
      scoringService.processEvent(tenantId, data.id, ScoreEvent.STATUS_CHANGED).catch(() => {});
      dispatchTrigger(tenantId, 'status_changed', data.id, {
        oldStatus: existingLead.status,
        newStatus: data.status,
      }).catch(() => {});
    }

    // Update tags if provided
    if (data.tagIds !== undefined) {
      const existingTagIds = existingLead.tags.map((t: any) => t.tagId);

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

        // Score and trigger newly added tags
        const newTags = data.tagIds.filter(id => !existingTagIds.includes(id));
        for (const tagId of newTags) {
          scoringService.processEvent(tenantId, data.id, ScoreEvent.TAG_ADDED).catch(() => {});
          dispatchTrigger(tenantId, 'tag_added', data.id, { tagId }).catch(() => {});
        }
      }
    }

    const updatedLead = await this.findById(tenantId, data.id);

    // Dispatch outgoing webhook — status_changed has extra context
    if (data.status && data.status !== existingLead.status) {
      webhookDispatcher.emitLeadEvent(tenantId, 'lead.status_changed', {
        ...updatedLead,
        _extra: { previous_status: existingLead.status, new_status: data.status },
      });
    }
    webhookDispatcher.emitLeadEvent(tenantId, 'lead.updated', updatedLead);

    return updatedLead;
  },

  async delete(tenantId: string, id: string) {
    const lead = await this.findById(tenantId, id);
    await prisma.lead.delete({
      where: { id },
    });
    planLimitsService.invalidateUsage(tenantId).catch(() => {});

    // Dispatch outgoing webhook for deletion
    webhookDispatcher.emitLeadEvent(tenantId, 'lead.deleted', lead);
  },

  async count(tenantId: string) {
    return prisma.lead.count({
      where: { tenantId },
    });
  },
};








