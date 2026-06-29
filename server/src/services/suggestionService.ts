import prisma from '../config/database.js';
import { SuggestionType, SuggestionStatus, NotificationType } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { notificationService } from './notificationService.js';

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

export interface ListSuggestionFilters {
  status?: SuggestionStatus;
  type?: SuggestionType;
  scope?: 'mine' | 'all';
}

const TERMINAL: SuggestionStatus[] = [SuggestionStatus.DONE, SuggestionStatus.REJECTED];
const AUTHOR_SELECT = { user: { select: { id: true, name: true, email: true } } };

export const suggestionService = {
  /**
   * Cria uma sugestão atribuída ao usuário/tenant autenticado e notifica os
   * platform admins (best-effort — falha de notificação não derruba a criação).
   */
  async create(tenantId: string, userId: string, data: CreateSuggestionData) {
    const suggestion = await prisma.suggestion.create({
      data: {
        tenantId,
        userId,
        title: data.title,
        description: data.description,
        route: data.route ?? null,
        type: data.type,
      },
      include: AUTHOR_SELECT,
    });

    await this.notifyPlatformAdmins(suggestion).catch(() => {
      /* notificação é best-effort; criação é a operação primária */
    });

    return suggestion;
  },

  /**
   * Notifica (in-app) todos os platform admins ativos sobre uma nova sugestão.
   * Cada notificação é criada no tenant do próprio admin.
   */
  async notifyPlatformAdmins(suggestion: {
    id: string;
    title: string;
    type: SuggestionType;
    route: string | null;
    user?: { name: string } | null;
  }) {
    const admins = await prisma.user.findMany({
      where: { isPlatformAdmin: true, status: 'ACTIVE' },
      select: { id: true, tenantId: true },
    });
    if (admins.length === 0) return;

    const authorName = suggestion.user?.name || 'Um usuário';
    const kind = suggestion.type === SuggestionType.BUG ? 'um relato de bug' : 'uma sugestão';
    const message =
      `${authorName} enviou ${kind}: "${suggestion.title}"` +
      (suggestion.route ? ` (em ${suggestion.route})` : '');

    await Promise.all(
      admins.map((admin) =>
        notificationService
          .create(admin.tenantId, {
            userId: admin.id,
            type: NotificationType.SYSTEM,
            title: 'Nova sugestão recebida',
            message,
            link: '/app/suggestions',
            metadata: { suggestionId: suggestion.id, type: suggestion.type },
          })
          .catch(() => null)
      )
    );
  },

  /**
   * Lista sugestões. Platform admin vê todas (cross-tenant) por padrão, ou só as
   * próprias com scope='mine'. Usuário comum sempre vê apenas as próprias.
   */
  async findAll(
    tenantId: string,
    userId: string,
    isPlatformAdmin: boolean,
    filters?: ListSuggestionFilters
  ) {
    const seeAll = isPlatformAdmin && filters?.scope !== 'mine';

    const where: Record<string, unknown> = {};
    if (!seeAll) where.userId = userId;
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;

    return prisma.suggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: AUTHOR_SELECT,
    });
  },

  /**
   * Busca uma sugestão por id. Platform admin acessa qualquer uma; usuário comum
   * só a própria (404 mascarado caso contrário).
   */
  async findById(userId: string, isPlatformAdmin: boolean, id: string) {
    const where: Record<string, unknown> = isPlatformAdmin ? { id } : { id, userId };
    const suggestion = await prisma.suggestion.findFirst({ where, include: AUTHOR_SELECT });

    if (!suggestion) {
      throw createError('Suggestion not found', 404, 'SUGGESTION_NOT_FOUND');
    }
    return suggestion;
  },

  /**
   * Atualiza status e/ou adminNotes (somente platform admin — garantido na rota).
   * Mantém resolvedAt coerente com transições de/para estados terminais.
   */
  async update(id: string, data: UpdateSuggestionData) {
    const existing = await prisma.suggestion.findFirst({ where: { id } });
    if (!existing) {
      throw createError('Suggestion not found', 404, 'SUGGESTION_NOT_FOUND');
    }

    let resolvedAt = existing.resolvedAt;
    if (data.status && data.status !== existing.status) {
      const wasTerminal = TERMINAL.includes(existing.status);
      const willBeTerminal = TERMINAL.includes(data.status);
      if (willBeTerminal && !wasTerminal) resolvedAt = new Date();
      else if (!willBeTerminal && wasTerminal) resolvedAt = null;
    }

    return prisma.suggestion.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.adminNotes !== undefined && { adminNotes: data.adminNotes }),
        resolvedAt,
      },
      include: AUTHOR_SELECT,
    });
  },

  /**
   * Deleta uma sugestão. Platform admin: qualquer uma. Usuário comum: apenas a
   * própria e apenas se estiver PENDING (404 mascarado para não-dono).
   */
  async delete(userId: string, isPlatformAdmin: boolean, id: string) {
    const where: Record<string, unknown> = isPlatformAdmin ? { id } : { id, userId };
    const existing = await prisma.suggestion.findFirst({ where });

    if (!existing) {
      throw createError('Suggestion not found', 404, 'SUGGESTION_NOT_FOUND');
    }

    if (!isPlatformAdmin && existing.status !== SuggestionStatus.PENDING) {
      throw createError(
        'Only pending suggestions can be deleted by their author',
        400,
        'SUGGESTION_NOT_DELETABLE'
      );
    }

    await prisma.suggestion.delete({ where: { id } });
    return { deleted: true };
  },
};
