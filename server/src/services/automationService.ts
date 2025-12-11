import prisma from '../config/database.js';
import { AutomationStatus } from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';

export interface CreateAutomationData {
  name: string;
  description?: string;
  trigger: any; // JSON
  steps: any[]; // JSON array
  conditions?: any; // JSON
}

export interface UpdateAutomationData extends Partial<CreateAutomationData> {
  id: string;
  status?: AutomationStatus;
}

export const automationService = {
  async create(tenantId: string, data: CreateAutomationData) {
    const automation = await prisma.automation.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        status: AutomationStatus.DRAFT,
        trigger: data.trigger,
        steps: data.steps,
        conditions: data.conditions || null,
      },
    });

    return this.findById(tenantId, automation.id);
  },

  async findById(tenantId: string, id: string) {
    const automation = await prisma.automation.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!automation) {
      throw createError('Automation not found', 404, 'AUTOMATION_NOT_FOUND');
    }

    return automation;
  },

  async findAll(tenantId: string, filters?: {
    status?: AutomationStatus;
    search?: string;
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

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [automations, total] = await Promise.all([
      prisma.automation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.automation.count({ where }),
    ]);

    return {
      automations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async update(tenantId: string, data: UpdateAutomationData) {
    await this.findById(tenantId, data.id);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.trigger !== undefined) updateData.trigger = data.trigger;
    if (data.steps !== undefined) updateData.steps = data.steps;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;

    const automation = await prisma.automation.update({
      where: { id: data.id },
      data: updateData,
    });

    return this.findById(tenantId, data.id);
  },

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.automation.delete({
      where: { id },
    });
  },

  async getLogs(tenantId: string, automationId: string, limit: number = 50) {
    await this.findById(tenantId, automationId);

    return prisma.automationLog.findMany({
      where: { automationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async addLog(automationId: string, status: string, message?: string, data?: any, error?: string) {
    return prisma.automationLog.create({
      data: {
        automationId,
        status,
        message,
        data: data || null,
        error: error || null,
      },
    });
  },

  async updateStats(automationId: string, success: boolean) {
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation) return;

    await prisma.automation.update({
      where: { id: automationId },
      data: {
        runsCount: automation.runsCount + 1,
        successCount: success ? automation.successCount + 1 : automation.successCount,
        errorCount: success ? automation.errorCount : automation.errorCount + 1,
        lastRunAt: new Date(),
      },
    });
  },
};







