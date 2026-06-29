import prisma from '../config/database.js';
import { NotificationType } from '@prisma/client';
import { emitToTenant } from '../services/socketService.js';
import { logger } from '../utils/logger.js';

/**
 * Stale deals checker.
 * Periodically scans all tenants for deals with no recent activity,
 * emits DEAL_AT_RISK notifications and socket events with per-tenant deduplication.
 *
 * Lightweight — no BullMQ/Redis required, uses setInterval like taskNotificationChecker.
 */

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function checkStaleDeals() {
  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, staleDays: true },
    });

    let totalCreated = 0;

    for (const tenant of tenants) {
      const tenantStaleDays = tenant.staleDays ?? 5;

      // Open deals (not WON/LOST, not paused, not soft-deleted) — req 23: pausado não esfria
      const openDeals = await prisma.deal.findMany({
        where: {
          tenantId: tenant.id,
          stage: { notIn: ['WON', 'LOST'] },
          status: { not: 'PAUSED' },
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          assignedTo: true,
          funnelColumn: { select: { coolingEnabled: true, coolingDays: true } },
        },
      });

      // Esfriamento por etapa (req 42): usa coolingDays da etapa quando habilitado;
      // fallback no limite global do tenant; se nenhum válido, não destaca.
      const dealCoolingDays = (deal: (typeof openDeals)[number]): number | null => {
        const col = deal.funnelColumn;
        if (col?.coolingEnabled && col.coolingDays && col.coolingDays > 0) return col.coolingDays;
        return tenantStaleDays > 0 ? tenantStaleDays : null;
      };

      if (openDeals.length === 0) continue;

      const dealIds = openDeals.map((d) => d.id);

      // Fetch the most recent interaction per deal in one pass
      const latestInteractions = await prisma.interaction.findMany({
        where: { dealId: { in: dealIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['dealId'],
        select: { dealId: true, createdAt: true },
      });

      const lastActivityByDeal = new Map<string, Date>();
      for (const interaction of latestInteractions) {
        if (interaction.dealId) {
          lastActivityByDeal.set(interaction.dealId, interaction.createdAt);
        }
      }

      // Identify stale deals (limite por etapa)
      const staleDeals = openDeals.filter((deal) => {
        const days = dealCoolingDays(deal);
        if (!days) return false;
        const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const lastActivity = lastActivityByDeal.get(deal.id);
        return !lastActivity || lastActivity < threshold;
      });

      if (staleDeals.length === 0) continue;

      // Deduplication: check DEAL_AT_RISK notifications created within the dedup window
      const dedupeWindowStart = new Date(Date.now() - tenantStaleDays * 24 * 60 * 60 * 1000);
      const existingNotifications = await prisma.notification.findMany({
        where: {
          tenantId: tenant.id,
          type: NotificationType.DEAL_AT_RISK,
          createdAt: { gte: dedupeWindowStart },
        },
        select: { metadata: true },
      });

      const alreadyNotified = new Set<string>();
      for (const notif of existingNotifications) {
        const meta = notif.metadata as Record<string, any> | null;
        if (meta?.dealId) {
          alreadyNotified.add(meta.dealId as string);
        }
      }

      for (const deal of staleDeals) {
        if (alreadyNotified.has(deal.id)) continue;
        if (!deal.assignedTo) continue;

        const lastActivity = lastActivityByDeal.get(deal.id);
        const daysSinceActivity = lastActivity
          ? Math.floor((Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000))
          : (dealCoolingDays(deal) ?? tenantStaleDays);

        await prisma.notification
          .create({
            data: {
              tenantId: tenant.id,
              userId: deal.assignedTo,
              type: NotificationType.DEAL_AT_RISK,
              title: 'Deal em risco',
              message: `O deal "${deal.name}" está sem atividade há ${daysSinceActivity} dias.`,
              link: `/app/deals/${deal.id}`,
              metadata: { dealId: deal.id },
            },
          })
          .catch((err) => {
            logger.error(`Failed to create DEAL_AT_RISK notification for deal ${deal.id}`, err);
          });

        emitToTenant(tenant.id, 'deal:at-risk', {
          dealId: deal.id,
          dealName: deal.name,
          daysSinceActivity,
        });

        totalCreated++;
      }
    }

    if (totalCreated > 0) {
      logger.info(`Stale deals checker: created ${totalCreated} DEAL_AT_RISK notifications`);
    }
  } catch (error) {
    logger.error('Stale deals checker failed', error);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function initializeStaleDealsChecker() {
  // Run immediately on startup
  checkStaleDeals();

  // Then run every 24 hours
  intervalId = setInterval(checkStaleDeals, CHECK_INTERVAL_MS);

  logger.info('Stale deals checker initialized (interval: 24h)');
}

export function stopStaleDealsChecker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
