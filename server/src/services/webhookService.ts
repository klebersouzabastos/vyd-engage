import prisma from '../config/database.js';
import crypto from 'crypto';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

export interface CreateWebhookData {
  url: string;
  events: string[];
}

export interface UpdateWebhookData {
  url?: string;
  events?: string[];
  active?: boolean;
}

// Available webhook event types
export const WEBHOOK_EVENTS = [
  'lead.created',
  'lead.updated',
  'lead.deleted',
  'lead.status_changed',
  'task.created',
  'task.completed',
  'automation.triggered',
  'payment.approved',
  'payment.failed',
] as const;

export const webhookService = {
  async findAll(tenantId: string) {
    return prisma.webhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { logs: true } },
      },
    });
  },

  async findById(tenantId: string, id: string) {
    const webhook = await prisma.webhook.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { logs: true } },
      },
    });
    if (!webhook) {
      throw createError('Webhook not found', 404, 'WEBHOOK_NOT_FOUND');
    }
    return webhook;
  },

  async create(tenantId: string, data: CreateWebhookData) {
    const secret = crypto.randomBytes(32).toString('hex');

    return prisma.webhook.create({
      data: {
        tenantId,
        url: data.url,
        events: data.events,
        secret,
        active: true,
      },
    });
  },

  async update(tenantId: string, id: string, data: UpdateWebhookData) {
    await this.findById(tenantId, id);

    return prisma.webhook.update({
      where: { id },
      data: {
        url: data.url,
        events: data.events,
        active: data.active,
      },
    });
  },

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.webhook.delete({ where: { id } });
  },

  async getLogs(tenantId: string, webhookId: string, limit = 50) {
    await this.findById(tenantId, webhookId);

    return prisma.webhookLog.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async testWebhook(tenantId: string, id: string) {
    const webhook = await this.findById(tenantId, id);

    const payload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook from VYD Engage' },
    };

    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': 'test',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      const statusCode = response.status;
      const responseText = await response.text().catch(() => '');

      await prisma.webhookLog.create({
        data: {
          webhookId: id,
          event: 'test',
          status: statusCode >= 200 && statusCode < 300 ? 'SUCCESS' : 'FAILED',
          statusCode,
          response: responseText.slice(0, 1000),
        },
      });

      if (statusCode >= 200 && statusCode < 300) {
        await prisma.webhook.update({
          where: { id },
          data: { successCount: { increment: 1 }, lastTriggeredAt: new Date() },
        });
      } else {
        await prisma.webhook.update({
          where: { id },
          data: { failureCount: { increment: 1 }, lastTriggeredAt: new Date() },
        });
      }

      return { success: statusCode >= 200 && statusCode < 300, statusCode };
    } catch (error: any) {
      await prisma.webhookLog.create({
        data: {
          webhookId: id,
          event: 'test',
          status: 'FAILED',
          error: error.message,
        },
      });

      await prisma.webhook.update({
        where: { id },
        data: { failureCount: { increment: 1 }, lastTriggeredAt: new Date() },
      });

      return { success: false, error: error.message };
    }
  },
};
