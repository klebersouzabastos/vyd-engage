import crypto from 'crypto';
import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';
import {
  buildWebhookPayload,
  flattenLeadData,
  flattenDealData,
  flattenTaskData,
} from '../utils/webhookPayloads.js';

/**
 * Webhook Dispatcher — intercepts business events and fires outgoing webhooks.
 *
 * Called from service layer (not routes) so every mutation path is covered.
 * Dispatch is fully async (fire-and-forget) and never blocks the caller.
 */

interface DispatchOptions {
  tenantId: string;
  event: string;
  data: Record<string, unknown>;
}

/**
 * Core dispatch: find active webhooks matching the event for the tenant,
 * then POST the payload to each webhook URL with HMAC-SHA256 signature.
 */
async function dispatch({ tenantId, event, data }: DispatchOptions): Promise<void> {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        tenantId,
        active: true,
        events: { has: event },
      },
    });

    if (webhooks.length === 0) return;

    const payload = buildWebhookPayload(event, data);

    const promises = webhooks.map(async (webhook) => {
      const body = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(body)
        .digest('hex');

      const startTime = Date.now();
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
            'X-Webhook-Signature': signature,
            'X-Webhook-Delivery-Id': payload.id,
          },
          body,
          signal: AbortSignal.timeout(10000),
        });

        const statusCode = response.status;
        const responseText = await response.text().catch(() => '');
        const responseTime = Date.now() - startTime;

        const success = statusCode >= 200 && statusCode < 300;

        // Log
        await prisma.webhookLog.create({
          data: {
            webhookId: webhook.id,
            event,
            status: success ? 'SUCCESS' : 'FAILED',
            statusCode,
            response: responseText.slice(0, 1000),
          },
        });

        // Update stats
        await prisma.webhook.update({
          where: { id: webhook.id },
          data: {
            ...(success
              ? { successCount: { increment: 1 } }
              : { failureCount: { increment: 1 } }),
            lastTriggeredAt: new Date(),
          },
        });

        if (!success) {
          logger.warn('Webhook delivery failed', {
            webhookId: webhook.id,
            event,
            statusCode,
            responseTime,
          });
        }
      } catch (error: any) {
        const responseTime = Date.now() - startTime;

        await prisma.webhookLog.create({
          data: {
            webhookId: webhook.id,
            event,
            status: 'FAILED',
            error: error.message,
          },
        });

        await prisma.webhook.update({
          where: { id: webhook.id },
          data: {
            failureCount: { increment: 1 },
            lastTriggeredAt: new Date(),
          },
        });

        logger.error('Webhook delivery error', {
          webhookId: webhook.id,
          event,
          error: error.message,
          responseTime,
        });
      }
    });

    await Promise.allSettled(promises);
  } catch (error: any) {
    // Never let dispatcher errors propagate to callers
    logger.error('Webhook dispatcher error', { tenantId, event, error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Public API — fire-and-forget helpers for each entity type
// ---------------------------------------------------------------------------

export const webhookDispatcher = {
  /**
   * Emit a lead event. Flattens lead data to Zapier-friendly format.
   */
  emitLeadEvent(tenantId: string, event: string, lead: Record<string, any>): void {
    const data = flattenLeadData(lead);
    dispatch({ tenantId, event, data }).catch(() => {});
  },

  /**
   * Emit a deal event. Flattens deal data to Zapier-friendly format.
   * `extra` allows adding fields like previous_stage.
   */
  emitDealEvent(
    tenantId: string,
    event: string,
    deal: Record<string, any>,
    extra?: Record<string, unknown>,
  ): void {
    const data = flattenDealData(deal, extra);
    dispatch({ tenantId, event, data }).catch(() => {});
  },

  /**
   * Emit a task event. Flattens task data to Zapier-friendly format.
   */
  emitTaskEvent(tenantId: string, event: string, task: Record<string, any>): void {
    const data = flattenTaskData(task);
    dispatch({ tenantId, event, data }).catch(() => {});
  },

  /**
   * Emit a generic event with arbitrary data.
   */
  emit(tenantId: string, event: string, data: Record<string, unknown>): void {
    dispatch({ tenantId, event, data }).catch(() => {});
  },
};
