import prisma from '../config/database.js';
import { InteractionType, InteractionDirection, ScoreEvent } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { scoringService } from './scoringService.js';
import { getLeadNextActionWithReasoning } from './nextActionService.js';

export interface CreateInteractionData {
  leadId?: string;
  dealId?: string;
  companyId?: string;
  type: InteractionType;
  direction: InteractionDirection;
  subject?: string;
  content: string;
  metadata?: any;
  automationId?: string;
  userId?: string;
}

export const interactionService = {
  async create(tenantId: string, data: CreateInteractionData) {
    const interaction = await prisma.interaction.create({
      data: {
        tenantId,
        leadId: data.leadId || null,
        dealId: data.dealId || null,
        companyId: data.companyId || null,
        type: data.type,
        direction: data.direction,
        subject: data.subject || null,
        content: data.content,
        metadata: data.metadata || null,
        automationId: data.automationId || null,
        userId: data.userId || null,
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Score interaction event
    if (interaction.leadId) {
      scoringService
        .processEvent(tenantId, interaction.leadId, ScoreEvent.INTERACTION_CREATED)
        .catch(() => {});
      // Recalculate the lead's next-action suggestion after a new interaction
      // (spec req 14). Fire-and-forget — must not block interaction creation.
      getLeadNextActionWithReasoning(tenantId, interaction.leadId).catch(() => {});
    }

    return interaction;
  },

  async findAll(
    tenantId: string,
    filters?: {
      leadId?: string;
      dealId?: string;
      type?: string;
      page?: number;
      limit?: number;
    },
    // Escopo de responsável: um dono (string) ou o conjunto da equipe ({in}) — req 14.
    ownerId?: string | { in: string[] }
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
    };

    if (filters?.leadId) {
      where.leadId = filters.leadId;
    }

    if (filters?.dealId) {
      where.dealId = filters.dealId;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    // Escopo do analista (USER): só interações que ele criou ou de negociações/leads
    // dos quais ele é responsável (spec papeis-comerciais, req 4).
    if (ownerId) {
      where.OR = [
        { userId: ownerId },
        { deal: { assignedTo: ownerId } },
        { lead: { assignedTo: ownerId } },
      ];
    }

    const [interactions, total] = await Promise.all([
      prisma.interaction.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.interaction.count({ where }),
    ]);

    return {
      interactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findByLeadId(tenantId: string, leadId: string, ownerId?: string | { in: string[] }) {
    return prisma.interaction.findMany({
      where: {
        tenantId,
        leadId,
        // Analista (USER): só interações que criou ou do lead/negócio do qual é dono (req 4).
        ...(ownerId
          ? {
              OR: [
                { userId: ownerId },
                { lead: { assignedTo: ownerId } },
                { deal: { assignedTo: ownerId } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async deleteInteraction(tenantId: string, id: string) {
    const interaction = await prisma.interaction.findFirst({
      where: { id, tenantId },
    });
    if (!interaction) {
      throw createError('Interaction not found', 404);
    }
    await prisma.interaction.delete({ where: { id } });
  },

  /**
   * Get unified inbox conversations grouped by lead,
   * showing latest message and unread count per conversation.
   */
  async getInboxConversations(
    tenantId: string,
    filters: {
      channel?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    ownerId?: string | { in: string[] }
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 30;

    // Filter by communication channels
    const channelTypes: InteractionType[] = [];
    if (!filters.channel || filters.channel === 'all') {
      channelTypes.push(InteractionType.WHATSAPP, InteractionType.EMAIL);
    } else if (filters.channel === 'whatsapp') {
      channelTypes.push(InteractionType.WHATSAPP);
    } else if (filters.channel === 'email') {
      channelTypes.push(InteractionType.EMAIL);
    }

    // Get leads with communication interactions
    const where: any = {
      tenantId,
      type: { in: channelTypes },
      leadId: { not: null },
    };
    // Analista (USER): só conversas dos próprios leads (ou que ele criou) — req 4/12.
    if (ownerId) {
      where.OR = [{ userId: ownerId }, { lead: { assignedTo: ownerId } }];
    }

    // Get distinct lead IDs that have interactions
    const leadInteractions = await prisma.interaction.groupBy({
      by: ['leadId'],
      where,
      _max: { createdAt: true },
      _count: { id: true },
      orderBy: { _max: { createdAt: 'desc' } },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalLeads = await prisma.interaction.groupBy({
      by: ['leadId'],
      where,
    });

    // Get lead details and latest interaction for each
    const conversations = await Promise.all(
      leadInteractions.map(async (group) => {
        if (!group.leadId) return null;

        const [lead, latestInteraction, messageCount] = await Promise.all([
          prisma.lead.findUnique({
            where: { id: group.leadId },
            select: { id: true, name: true, email: true, phone: true, status: true },
          }),
          prisma.interaction.findFirst({
            where: { tenantId, leadId: group.leadId, type: { in: channelTypes } },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.interaction.count({
            where: { tenantId, leadId: group.leadId, type: { in: channelTypes } },
          }),
        ]);

        if (!lead || !latestInteraction) return null;

        // Filter by search if provided
        if (filters.search) {
          const s = filters.search.toLowerCase();
          if (
            !lead.name?.toLowerCase().includes(s) &&
            !lead.email?.toLowerCase().includes(s) &&
            !lead.phone?.includes(s)
          ) {
            return null;
          }
        }

        return {
          leadId: lead.id,
          leadName: lead.name,
          leadEmail: lead.email,
          leadPhone: lead.phone,
          leadStatus: lead.status,
          lastMessage: {
            id: latestInteraction.id,
            type: latestInteraction.type,
            direction: latestInteraction.direction,
            content: latestInteraction.content,
            createdAt: latestInteraction.createdAt,
          },
          messageCount,
          lastActivityAt: latestInteraction.createdAt,
        };
      })
    );

    const filtered = conversations.filter(Boolean);

    return {
      conversations: filtered,
      pagination: {
        page,
        limit,
        total: totalLeads.length,
        totalPages: Math.ceil(totalLeads.length / limit),
      },
    };
  },
};
