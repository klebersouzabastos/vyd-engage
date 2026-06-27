import prisma from '../config/database.js';
import { NotificationType, NotificationStatus } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { emitToUser } from './socketService.js';

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: any;
}

export const notificationService = {
  /**
   * Get all active ADMIN user IDs for a tenant.
   * Used for system notifications (public lead capture, automation errors, etc.)
   */
  async getTenantAdminIds(tenantId: string): Promise<string[]> {
    const admins = await prisma.user.findMany({
      where: { tenantId, role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  },

  /**
   * Notify all admins of a tenant. Creates one notification per admin.
   */
  async notifyTenantAdmins(tenantId: string, data: Omit<CreateNotificationData, 'userId'>) {
    const adminIds = await this.getTenantAdminIds(tenantId);
    const results = await Promise.all(
      adminIds.map((adminId) =>
        this.create(tenantId, { ...data, userId: adminId }).catch(() => null)
      )
    );
    return results.filter(Boolean);
  },

  async create(tenantId: string, data: CreateNotificationData) {
    const notification = await prisma.notification.create({
      data: {
        tenantId,
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link || null,
        metadata: data.metadata || null,
        status: NotificationStatus.UNREAD,
      },
    });

    // Emit real-time notification via WebSocket
    emitToUser(data.userId, 'notification:new', notification);

    return notification;
  },

  async findAll(
    tenantId: string,
    userId: string,
    filters?: {
      status?: NotificationStatus;
      type?: NotificationType;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      userId,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async markAsRead(tenantId: string, userId: string, id: string) {
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        tenantId,
        userId,
      },
    });

    if (!notification) {
      throw createError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    return prisma.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
  },

  async markAllAsRead(tenantId: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        tenantId,
        userId,
        status: NotificationStatus.UNREAD,
      },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
  },

  async getUnreadCount(tenantId: string, userId: string) {
    return prisma.notification.count({
      where: {
        tenantId,
        userId,
        status: NotificationStatus.UNREAD,
      },
    });
  },

  async delete(tenantId: string, userId: string, id: string) {
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        tenantId,
        userId,
      },
    });

    if (!notification) {
      throw createError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    await prisma.notification.delete({
      where: { id },
    });
  },
};
