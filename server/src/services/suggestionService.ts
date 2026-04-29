import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import type { SuggestionStatus, SuggestionType } from '@prisma/client';

export interface CreateSuggestionData {
  title: string;
  description: string;
  route?: string | null;
  type: SuggestionType;
}

export interface UpdateSuggestionData {
  status?: SuggestionStatus;
  adminNotes?: string | null;
}

export interface ListSuggestionsFilters {
  status?: SuggestionStatus;
  type?: SuggestionType;
  scope?: 'mine' | 'all';
}

export const suggestionService = {
  async create(tenantId: string, userId: string, data: CreateSuggestionData) {
    return prisma.suggestion.create({
      data: {
        tenantId,
        userId,
        title: data.title,
        description: data.description,
        route: data.route || null,
        type: data.type,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async findAll(
    tenantId: string,
    userId: string,
    isAdmin: boolean,
    filters: ListSuggestionsFilters = {},
  ) {
    const where: Record<string, unknown> = { tenantId };

    // Non-admins always see only their own suggestions.
    // Admins can request scope=mine to filter to their own.
    if (!isAdmin || filters.scope === 'mine') {
      where.userId = userId;
    }

    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;

    return prisma.suggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async findById(tenantId: string, userId: string, isAdmin: boolean, id: string) {
    const suggestion = await prisma.suggestion.findFirst({
      where: { id, tenantId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!suggestion) {
      throw createError('Suggestion not found', 404, 'SUGGESTION_NOT_FOUND');
    }

    if (!isAdmin && suggestion.userId !== userId) {
      throw createError('Suggestion not found', 404, 'SUGGESTION_NOT_FOUND');
    }

    return suggestion;
  },

  async update(tenantId: string, id: string, data: UpdateSuggestionData) {
    const existing = await prisma.suggestion.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw createError('Suggestion not found', 404, 'SUGGESTION_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) {
      updateData.status = data.status;
      const isTerminal = data.status === 'DONE' || data.status === 'REJECTED';
      const wasTerminal = existing.status === 'DONE' || existing.status === 'REJECTED';
      if (isTerminal && !wasTerminal) {
        updateData.resolvedAt = new Date();
      } else if (!isTerminal && wasTerminal) {
        updateData.resolvedAt = null;
      }
    }
    if (data.adminNotes !== undefined) {
      updateData.adminNotes = data.adminNotes;
    }

    return prisma.suggestion.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async delete(tenantId: string, userId: string, isAdmin: boolean, id: string) {
    const existing = await prisma.suggestion.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw createError('Suggestion not found', 404, 'SUGGESTION_NOT_FOUND');
    }

    if (!isAdmin) {
      if (existing.userId !== userId) {
        throw createError('Suggestion not found', 404, 'SUGGESTION_NOT_FOUND');
      }
      if (existing.status !== 'PENDING') {
        throw createError(
          'Only pending suggestions can be deleted by their author',
          400,
          'SUGGESTION_NOT_DELETABLE',
        );
      }
    }

    await prisma.suggestion.delete({ where: { id } });
    return { deleted: true };
  },
};
