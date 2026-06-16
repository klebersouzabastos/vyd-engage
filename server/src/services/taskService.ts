import prisma from '../config/database.js';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { dispatchTrigger } from '../jobs/automationEngine.js';

export interface CreateTaskData {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  leadId?: string;
  dueDate?: Date | string;
}

export interface UpdateTaskData extends Partial<CreateTaskData> {
  id: string;
}

export const taskService = {
  async create(tenantId: string, data: CreateTaskData) {
    const task = await prisma.task.create({
      data: {
        tenantId,
        title: data.title,
        description: data.description,
        status: data.status || TaskStatus.PENDING,
        priority: data.priority || TaskPriority.MEDIUM,
        assignedTo: data.assignedTo,
        leadId: data.leadId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });

    return this.findById(tenantId, task.id);
  },

  async findById(tenantId: string, id: string) {
    const task = await prisma.task.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
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

    if (!task) {
      throw createError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    return task;
  },

  async findAll(tenantId: string, filters?: {
    status?: TaskStatus;
    priority?: TaskPriority;
    assignedTo?: string;
    leadId?: string;
    overdue?: boolean;
    dueToday?: boolean;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.priority) {
      where.priority = filters.priority;
    }

    if (filters?.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters?.leadId) {
      where.leadId = filters.leadId;
    }

    if (filters?.startDate && filters?.endDate) {
      where.dueDate = {
        gte: filters.startDate,
        lte: new Date(new Date(filters.endDate).setHours(23, 59, 59, 999)),
      };
    } else if (filters?.overdue) {
      where.dueDate = {
        lt: new Date(),
      };
      where.status = {
        not: TaskStatus.COMPLETED,
      };
    } else if (filters?.dueToday) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      where.dueDate = {
        gte: today,
        lt: tomorrow,
      };
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
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
        orderBy: [
          { priority: 'desc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async update(tenantId: string, data: UpdateTaskData) {
    const existing = await this.findById(tenantId, data.id);

    const updateData: any = {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assignedTo: data.assignedTo,
      leadId: data.leadId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    };

    // If marking as completed, set completedAt
    if (data.status === 'COMPLETED') {
      updateData.completedAt = new Date();
    } else if (data.status) {
      updateData.completedAt = null;
    }

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const task = await prisma.task.update({
      where: { id: data.id },
      data: updateData,
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

    // Dispatch automation trigger on transition to COMPLETED (lead-linked tasks).
    if (
      existing.status !== 'COMPLETED' &&
      task.status === 'COMPLETED' &&
      task.leadId
    ) {
      dispatchTrigger(tenantId, 'task_completed', task.leadId, {
        taskId: task.id,
        title: task.title,
      }).catch(() => {});
    }

    return task;
  },

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async count(tenantId: string) {
    return prisma.task.count({
      where: { tenantId, deletedAt: null },
    });
  },
};








