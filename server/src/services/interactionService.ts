import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';

export interface CreateInteractionData {
  leadId?: string;
  type: 'email' | 'whatsapp' | 'call' | 'meeting' | 'note';
  direction: 'inbound' | 'outbound';
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

    return interaction;
  },

  async findAll(tenantId: string, filters?: {
    leadId?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
    };

    if (filters?.leadId) {
      where.leadId = filters.leadId;
    }

    if (filters?.type) {
      where.type = filters.type;
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

  async findByLeadId(tenantId: string, leadId: string) {
    return prisma.interaction.findMany({
      where: {
        tenantId,
        leadId,
      },
      orderBy: { createdAt: 'desc' },
    });
  },
};


