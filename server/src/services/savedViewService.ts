import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';

export interface CreateSavedViewData {
  name: string;
  page: string;
  filters: Record<string, unknown>;
  columns?: Record<string, unknown> | null;
  isDefault?: boolean;
  isShared?: boolean;
  sortBy?: string | null;
  sortOrder?: string | null;
}

export interface UpdateSavedViewData {
  name?: string;
  filters?: Record<string, unknown>;
  columns?: Record<string, unknown> | null;
  isDefault?: boolean;
  isShared?: boolean;
  sortBy?: string | null;
  sortOrder?: string | null;
}

export const savedViewService = {
  /**
   * Find all saved views for a user on a given page.
   * Returns user's own views + shared views from other users in the same tenant.
   */
  async findAll(tenantId: string, userId: string, page?: string) {
    const where: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
      OR: [
        { userId },
        { isShared: true },
      ],
    };

    if (page) {
      where.page = page;
    }

    const views = await prisma.savedView.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    return views;
  },

  /**
   * Find a single saved view by ID, scoped to tenant.
   */
  async findById(tenantId: string, id: string) {
    const view = await prisma.savedView.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    if (!view) {
      throw createError('Saved view not found', 404, 'SAVED_VIEW_NOT_FOUND');
    }

    return view;
  },

  /**
   * Create a new saved view.
   * If isDefault is true, unset default on all other views for this user+page.
   */
  async create(tenantId: string, userId: string, data: CreateSavedViewData) {
    // Validate page value
    const validPages = ['leads', 'deals', 'tasks', 'companies'];
    if (!validPages.includes(data.page)) {
      throw createError(`Invalid page: ${data.page}. Must be one of: ${validPages.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    // If setting as default, unset other defaults for this user+page
    if (data.isDefault) {
      await prisma.savedView.updateMany({
        where: { tenantId, userId, page: data.page, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const view = await prisma.savedView.create({
      data: {
        tenantId,
        userId,
        name: data.name,
        page: data.page,
        filters: data.filters as any,
        columns: data.columns as any || undefined,
        isDefault: data.isDefault ?? false,
        isShared: data.isShared ?? false,
        sortBy: data.sortBy || null,
        sortOrder: data.sortOrder || null,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    return view;
  },

  /**
   * Update a saved view. Only the owner can update.
   */
  async update(tenantId: string, userId: string, id: string, data: UpdateSavedViewData) {
    const existing = await prisma.savedView.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw createError('Saved view not found', 404, 'SAVED_VIEW_NOT_FOUND');
    }

    if (existing.userId !== userId) {
      throw createError('Only the owner can update this view', 403, 'FORBIDDEN');
    }

    // If setting as default, unset other defaults for this user+page
    if (data.isDefault) {
      await prisma.savedView.updateMany({
        where: { tenantId, userId, page: existing.page, isDefault: true, deletedAt: null, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const view = await prisma.savedView.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.filters !== undefined && { filters: data.filters as any }),
        ...(data.columns !== undefined && { columns: data.columns as any }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.isShared !== undefined && { isShared: data.isShared }),
        ...(data.sortBy !== undefined && { sortBy: data.sortBy }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    return view;
  },

  /**
   * Soft delete a saved view. Only the owner can delete.
   */
  async delete(tenantId: string, userId: string, id: string) {
    const existing = await prisma.savedView.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw createError('Saved view not found', 404, 'SAVED_VIEW_NOT_FOUND');
    }

    if (existing.userId !== userId) {
      throw createError('Only the owner can delete this view', 403, 'FORBIDDEN');
    }

    await prisma.savedView.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { deleted: true };
  },
};
