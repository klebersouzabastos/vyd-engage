import prisma from '../config/database.js';
import {
  DealStage,
  DealStatus,
  NotificationType,
  ScheduledDealStatus,
  TriggerConditionType,
  type Prisma,
  type ManagerTrigger,
} from '@prisma/client';
import { emitToTenant } from '../services/socketService.js';
import { logger } from '../utils/logger.js';
import { dealService } from '../services/dealService.js';
import { SCHEDULED_DEAL_TYPE_LABELS } from '../services/scheduledDealService.js';
import { escapeHtml } from '../services/campaignService.js';

/**
 * Sales ops job (Upgrade RD P0) — multi-vendas agendadas + gatilhos gerenciais.
 *
 * Substitui o boot do staleDeals antigo (o arquivo staleDeals.ts permanece como
 * referência, mas sem interval). Padrão sempre-ativo sem BullMQ/Redis, como
 * taskNotificationChecker/clientFollowUpChecker.
 *
 * Intervalo: 6h, com atraso inicial de 30s.
 *
 * Varreduras (exportadas para teste):
 *  1. runScheduledDeals  — agendamentos PENDING vencidos → cria Deal (se o tenant
 *     mantém multiSalesEnabled), marca CREATED, Notification MULTI_SALE_CREATED.
 *  2. runManagerTriggers — gatilhos gerenciais ativos (NO_INTERACTION /
 *     STUCK_IN_STAGE / DEAL_LOST / BIG_SALE) com dedup por Notification.metadata.
 *     O gatilho DEFAULT ("Negociações esfriando") preserva a semântica EXATA do
 *     staleDeals: tipo DEAL_AT_RISK, metadata { dealId } e
 *     emitToTenant('deal:at-risk') — zero regressão no badge "Em risco".
 */

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 horas
const INITIAL_DELAY_MS = 30 * 1000; // 30 segundos
const DAY_MS = 24 * 60 * 60 * 1000;

const OPEN_DEAL_WHERE = {
  stage: { notIn: [DealStage.WON, DealStage.LOST] },
  status: { not: DealStatus.PAUSED },
  deletedAt: null,
};

function formatBRL(value: unknown): string {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ============================================================
// 1. Multi-vendas — agendamentos vencidos
// ============================================================

/** Nome da fonte estruturada atribuída aos deals criados por multi-venda (req 4). */
const MULTI_SALE_SOURCE_NAME = 'Multi-venda';

/**
 * Garante a DealSource "Multi-venda" do tenant e devolve seu id (req 4).
 * findFirst por {tenantId, name}; cria se ausente. Resolvido uma vez por tenant
 * na varredura. Falha de criação (ex.: corrida no unique [tenantId,name]) faz
 * fallback para re-leitura; se ainda assim falhar, devolve null (o deal é criado
 * sem sourceId — origem fica só nas notes, sem quebrar o job).
 */
async function ensureMultiSaleSource(tenantId: string): Promise<string | null> {
  const existing = await prisma.dealSource.findFirst({
    where: { tenantId, name: MULTI_SALE_SOURCE_NAME },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.dealSource.create({
      data: { tenantId, name: MULTI_SALE_SOURCE_NAME },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    // Corrida no unique [tenantId, name] → re-lê.
    const retry = await prisma.dealSource.findFirst({
      where: { tenantId, name: MULTI_SALE_SOURCE_NAME },
      select: { id: true },
    });
    if (retry) return retry.id;
    logger.error(`Failed to ensure Multi-venda DealSource for tenant ${tenantId}`, err);
    return null;
  }
}

/**
 * Cria os deals dos agendamentos PENDING com scheduledFor <= now.
 * Só cria se Tenant.settings.multiSalesEnabled === true (senão mantém PENDING,
 * conforme o design — o tenant pode religar o toggle depois).
 * Retorna o número de deals criados.
 */
export async function runScheduledDeals(now: Date = new Date()): Promise<number> {
  const due = await prisma.scheduledDeal.findMany({
    where: { status: ScheduledDealStatus.PENDING, scheduledFor: { lte: now } },
    orderBy: { scheduledFor: 'asc' },
  });
  if (due.length === 0) return 0;

  // Agrupa por tenant para checar o toggle uma única vez.
  const byTenant = new Map<string, typeof due>();
  for (const sd of due) {
    const list = byTenant.get(sd.tenantId) ?? [];
    list.push(sd);
    byTenant.set(sd.tenantId, list);
  }

  let created = 0;
  for (const [tenantId, items] of byTenant) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
    if (settings.multiSalesEnabled !== true) continue; // mantém PENDING

    // Origem estruturada (req 4): deals de multi-venda recebem a fonte
    // "Multi-venda". Resolvido uma vez por tenant (findFirst → create se
    // ausente) e reusado para todos os agendamentos deste tenant.
    const multiSaleSourceId = await ensureMultiSaleSource(tenantId);

    for (const sd of items) {
      try {
        // Nome: "[tipo] — <empresa/lead>" (fallback: deal de origem / notas)
        let counterpartName: string | null = null;
        if (sd.companyId) {
          const company = await prisma.company.findFirst({
            where: { id: sd.companyId, tenantId },
            select: { name: true },
          });
          counterpartName = company?.name ?? null;
        }
        if (!counterpartName && sd.leadId) {
          const lead = await prisma.lead.findFirst({
            where: { id: sd.leadId, tenantId },
            select: { name: true },
          });
          counterpartName = lead?.name ?? null;
        }
        if (!counterpartName) {
          const origin = await prisma.deal.findFirst({
            where: { id: sd.originDealId, tenantId },
            select: { name: true },
          });
          counterpartName = origin?.name ?? null;
        }

        const label = SCHEDULED_DEAL_TYPE_LABELS[sd.type];
        const name = counterpartName ? `${label} — ${counterpartName}` : sd.notes || label;

        const noteParts = [
          `Multi-venda (${label}) criada automaticamente a partir da negociação ${sd.originDealId}.`,
        ];
        if (sd.notes) noteParts.push(sd.notes);

        // dealService.create já emite emitToTenant('deal:created', { deal })
        // e o webhook deal.created — mesmo caminho da criação manual.
        const deal = await dealService.create(tenantId, {
          name,
          value: sd.estimatedValue !== null ? Number(sd.estimatedValue) : 0,
          leadId: sd.leadId,
          companyId: sd.companyId,
          assignedTo: sd.assignedTo,
          funnelId: sd.funnelId,
          funnelColumnId: sd.funnelColumnId,
          // Origem estruturada "Multi-venda" (req 4). notes mantém o contexto.
          sourceId: multiSaleSourceId,
          notes: noteParts.join('\n'),
        });

        await prisma.scheduledDeal.update({
          where: { id: sd.id },
          data: { status: ScheduledDealStatus.CREATED, createdDealId: deal.id },
        });

        if (sd.assignedTo) {
          await prisma.notification
            .create({
              data: {
                tenantId,
                userId: sd.assignedTo,
                type: NotificationType.MULTI_SALE_CREATED,
                title: 'Multi-venda criada',
                message: `A negociação "${deal.name}" foi criada a partir de um agendamento de multi-venda.`,
                link: `/app/deals/${deal.id}`,
                metadata: {
                  scheduledDealId: sd.id,
                  dealId: deal.id,
                  originDealId: sd.originDealId,
                },
              },
            })
            .catch((err) => {
              logger.error(
                `Failed to create MULTI_SALE_CREATED notification for scheduled deal ${sd.id}`,
                err
              );
            });
        }

        created++;
      } catch (err) {
        logger.error(`Failed to create deal from scheduled deal ${sd.id}`, err);
      }
    }
  }

  if (created > 0) {
    logger.info(`Sales ops: created ${created} deals from scheduled multi-sales`);
  }
  return created;
}

// ============================================================
// 2. Gatilhos gerenciais
// ============================================================

interface TriggerContext {
  tenantId: string;
  staleDays: number;
  now: Date;
  /** Cache de gestores (ADMIN/GESTOR ativos) por varredura de tenant. */
  managers: { id: string }[] | null;
}

interface TriggerNotificationPayload {
  title: string;
  message: string;
  link: string;
  metadata: Record<string, unknown>;
}

async function getManagers(ctx: TriggerContext): Promise<{ id: string }[]> {
  if (!ctx.managers) {
    ctx.managers = await prisma.user.findMany({
      where: { tenantId: ctx.tenantId, role: { in: ['ADMIN', 'GESTOR'] }, status: 'ACTIVE' },
      select: { id: true },
    });
  }
  return ctx.managers;
}

/** Ids de deals já notificados (dedup por Notification.metadata) na janela. */
async function fetchNotifiedDealIds(
  tenantId: string,
  type: NotificationType,
  windowStart: Date,
  managerTriggerId?: string
): Promise<Set<string>> {
  const notifications = await prisma.notification.findMany({
    where: { tenantId, type, createdAt: { gte: windowStart } },
    select: { metadata: true },
  });
  const notified = new Set<string>();
  for (const notif of notifications) {
    const meta = notif.metadata as Record<string, unknown> | null;
    if (!meta?.dealId) continue;
    if (managerTriggerId && meta.managerTriggerId !== managerTriggerId) continue;
    notified.add(meta.dealId as string);
  }
  return notified;
}

/** Envia e-mails do gatilho (fire-and-forget; só se o tenant tem config verificada). */
async function sendTriggerEmails(
  ctx: TriggerContext,
  userIds: string[],
  payload: TriggerNotificationPayload
): Promise<void> {
  try {
    const emailConfig = await prisma.emailConfig.findFirst({
      where: { tenantId: ctx.tenantId, verified: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!emailConfig) return; // sem config de e-mail → apenas in-app

    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, tenantId: ctx.tenantId },
      select: { email: true },
    });
    const { emailMessagingService } = await import('../services/emailMessagingService.js');
    for (const user of users) {
      if (!user.email) continue;
      await emailMessagingService
        .sendEmail(ctx.tenantId, {
          configId: emailConfig.id,
          to: user.email,
          // payload.message contém nome do deal/motivo (dado do usuário) —
          // escapa antes de montar o HTML (req 15, anti-XSS).
          subject: payload.title,
          html: `<p>${escapeHtml(payload.message)}</p>`,
        })
        .catch(() => {});
    }
  } catch (err) {
    logger.error('Manager trigger email dispatch failed', err);
  }
}

/**
 * Notifica os destinatários configurados do gatilho (in-app MANAGER_TRIGGER +
 * e-mail opcional). Usado pelos gatilhos NÃO-default.
 */
async function notifyTriggerRecipients(
  ctx: TriggerContext,
  trigger: ManagerTrigger,
  ownerId: string | null,
  payload: TriggerNotificationPayload
): Promise<number> {
  const recipients = new Set<string>();
  if (trigger.notifyOwner && ownerId) recipients.add(ownerId);
  if (trigger.notifyManagers) {
    for (const manager of await getManagers(ctx)) recipients.add(manager.id);
  }
  const extraIds = Array.isArray(trigger.notifyUserIds)
    ? (trigger.notifyUserIds as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];
  for (const id of extraIds) recipients.add(id);
  if (recipients.size === 0) return 0;

  let createdCount = 0;
  for (const userId of recipients) {
    await prisma.notification
      .create({
        data: {
          tenantId: ctx.tenantId,
          userId,
          type: NotificationType.MANAGER_TRIGGER,
          title: payload.title,
          message: payload.message,
          link: payload.link,
          metadata: payload.metadata as Prisma.InputJsonValue,
        },
      })
      .then(() => {
        createdCount++;
      })
      .catch((err) => {
        logger.error(`Failed to create MANAGER_TRIGGER notification (trigger ${trigger.id})`, err);
      });
  }

  if (trigger.emailEnabled) {
    // Fire-and-forget — nunca bloqueia a varredura.
    sendTriggerEmails(ctx, [...recipients], payload).catch(() => {});
  }
  return createdCount;
}

/**
 * NO_INTERACTION — deals abertos (não pausados) sem interação há N dias.
 * Gatilho DEFAULT preserva a semântica EXATA do staleDeals.ts (DEAL_AT_RISK,
 * metadata { dealId }, socket 'deal:at-risk'); demais usam MANAGER_TRIGGER.
 */
async function runNoInteractionTrigger(
  ctx: TriggerContext,
  trigger: ManagerTrigger
): Promise<number> {
  const config = (trigger.conditionConfig ?? {}) as {
    days?: number;
    funnelColumnId?: string;
    useCoolingDays?: boolean;
  };
  const useCooling = config.useCoolingDays === true;
  const fixedDays = typeof config.days === 'number' && config.days > 0 ? config.days : null;

  const openDeals = await prisma.deal.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...OPEN_DEAL_WHERE,
      ...(config.funnelColumnId ? { funnelColumnId: config.funnelColumnId } : {}),
    },
    select: {
      id: true,
      name: true,
      assignedTo: true,
      funnelColumn: { select: { coolingEnabled: true, coolingDays: true } },
    },
  });
  if (openDeals.length === 0) return 0;

  // Limite por deal: coolingDays da etapa (quando useCoolingDays) com fallback
  // no staleDays do tenant — MESMA regra do staleDeals.ts.
  const dealDays = (deal: (typeof openDeals)[number]): number | null => {
    if (useCooling) {
      const col = deal.funnelColumn;
      if (col?.coolingEnabled && col.coolingDays && col.coolingDays > 0) return col.coolingDays;
      return ctx.staleDays > 0 ? ctx.staleDays : null;
    }
    return fixedDays ?? (ctx.staleDays > 0 ? ctx.staleDays : null);
  };

  const dealIds = openDeals.map((d) => d.id);
  const latestInteractions = await prisma.interaction.findMany({
    where: { dealId: { in: dealIds } },
    orderBy: { createdAt: 'desc' },
    distinct: ['dealId'],
    select: { dealId: true, createdAt: true },
  });
  const lastActivityByDeal = new Map<string, Date>();
  for (const interaction of latestInteractions) {
    if (interaction.dealId) lastActivityByDeal.set(interaction.dealId, interaction.createdAt);
  }

  const staleDeals = openDeals.filter((deal) => {
    const days = dealDays(deal);
    if (!days) return false;
    const threshold = new Date(ctx.now.getTime() - days * DAY_MS);
    const lastActivity = lastActivityByDeal.get(deal.id);
    return !lastActivity || lastActivity < threshold;
  });
  if (staleDeals.length === 0) return 0;

  const daysSince = (deal: (typeof openDeals)[number]): number => {
    const lastActivity = lastActivityByDeal.get(deal.id);
    return lastActivity
      ? Math.floor((ctx.now.getTime() - lastActivity.getTime()) / DAY_MS)
      : (dealDays(deal) ?? ctx.staleDays);
  };

  let created = 0;

  if (trigger.isDefault) {
    // ── Semântica staleDeals EXATA (zero regressão no badge "Em risco") ──
    const dedupeWindowStart = new Date(ctx.now.getTime() - ctx.staleDays * DAY_MS);
    const alreadyNotified = await fetchNotifiedDealIds(
      ctx.tenantId,
      NotificationType.DEAL_AT_RISK,
      dedupeWindowStart
    );

    for (const deal of staleDeals) {
      if (alreadyNotified.has(deal.id)) continue;
      if (!deal.assignedTo) continue;

      const daysSinceActivity = daysSince(deal);

      await prisma.notification
        .create({
          data: {
            tenantId: ctx.tenantId,
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

      emitToTenant(ctx.tenantId, 'deal:at-risk', {
        dealId: deal.id,
        dealName: deal.name,
        daysSinceActivity,
      });

      created++;
    }
    return created;
  }

  // ── Gatilhos NO_INTERACTION personalizados → MANAGER_TRIGGER ──
  const windowDays = fixedDays ?? (ctx.staleDays > 0 ? ctx.staleDays : 5);
  const windowStart = new Date(ctx.now.getTime() - windowDays * DAY_MS);
  const alreadyNotified = await fetchNotifiedDealIds(
    ctx.tenantId,
    NotificationType.MANAGER_TRIGGER,
    windowStart,
    trigger.id
  );

  for (const deal of staleDeals) {
    if (alreadyNotified.has(deal.id)) continue;
    created += await notifyTriggerRecipients(ctx, trigger, deal.assignedTo, {
      title: trigger.name,
      message: `A negociação "${deal.name}" está sem interação há ${daysSince(deal)} dias.`,
      link: `/app/deals/${deal.id}`,
      metadata: { managerTriggerId: trigger.id, dealId: deal.id },
    });
  }
  return created;
}

/** STUCK_IN_STAGE — deal parado na mesma etapa há N dias (DealStageHistory). */
async function runStuckInStageTrigger(
  ctx: TriggerContext,
  trigger: ManagerTrigger
): Promise<number> {
  const config = (trigger.conditionConfig ?? {}) as { days?: number; funnelColumnId?: string };
  const days = typeof config.days === 'number' && config.days > 0 ? config.days : null;
  if (!days) return 0; // gatilho mal configurado — validação da rota impede novos casos

  const deals = await prisma.deal.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...OPEN_DEAL_WHERE,
      ...(config.funnelColumnId ? { funnelColumnId: config.funnelColumnId } : {}),
    },
    select: { id: true, name: true, assignedTo: true, createdAt: true },
  });
  if (deals.length === 0) return 0;

  const dealIds = deals.map((d) => d.id);
  const openStageEntries = await prisma.dealStageHistory.findMany({
    where: { dealId: { in: dealIds }, exitedAt: null },
    orderBy: { enteredAt: 'desc' },
    distinct: ['dealId'],
    select: { dealId: true, enteredAt: true },
  });
  const enteredAtByDeal = new Map<string, Date>();
  for (const entry of openStageEntries) enteredAtByDeal.set(entry.dealId, entry.enteredAt);

  const threshold = new Date(ctx.now.getTime() - days * DAY_MS);
  const stuck = deals.filter((deal) => {
    // Sem histórico (deal nunca mudou de etapa) → usa a criação do deal.
    const enteredAt = enteredAtByDeal.get(deal.id) ?? deal.createdAt;
    return enteredAt <= threshold;
  });
  if (stuck.length === 0) return 0;

  const windowStart = new Date(ctx.now.getTime() - days * DAY_MS);
  const alreadyNotified = await fetchNotifiedDealIds(
    ctx.tenantId,
    NotificationType.MANAGER_TRIGGER,
    windowStart,
    trigger.id
  );

  let created = 0;
  for (const deal of stuck) {
    if (alreadyNotified.has(deal.id)) continue;
    const enteredAt = enteredAtByDeal.get(deal.id) ?? deal.createdAt;
    const daysInStage = Math.floor((ctx.now.getTime() - enteredAt.getTime()) / DAY_MS);
    created += await notifyTriggerRecipients(ctx, trigger, deal.assignedTo, {
      title: trigger.name,
      message: `A negociação "${deal.name}" está parada na mesma etapa há ${daysInStage} dias.`,
      link: `/app/deals/${deal.id}`,
      metadata: { managerTriggerId: trigger.id, dealId: deal.id },
    });
  }
  return created;
}

/** DEAL_LOST — negociações perdidas nas últimas 24h (1 notificação por deal). */
async function runDealLostTrigger(ctx: TriggerContext, trigger: ManagerTrigger): Promise<number> {
  const since = new Date(ctx.now.getTime() - DAY_MS);
  const deals = await prisma.deal.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null, lostAt: { gte: since } },
    select: { id: true, name: true, assignedTo: true, lostReason: true },
  });
  if (deals.length === 0) return 0;

  // Janela de dedup de 48h cobre integralmente a janela de evento de 24h.
  const windowStart = new Date(ctx.now.getTime() - 2 * DAY_MS);
  const alreadyNotified = await fetchNotifiedDealIds(
    ctx.tenantId,
    NotificationType.MANAGER_TRIGGER,
    windowStart,
    trigger.id
  );

  let created = 0;
  for (const deal of deals) {
    if (alreadyNotified.has(deal.id)) continue;
    const reason = deal.lostReason ? ` Motivo: ${deal.lostReason}.` : '';
    created += await notifyTriggerRecipients(ctx, trigger, deal.assignedTo, {
      title: trigger.name,
      message: `A negociação "${deal.name}" foi marcada como perdida.${reason}`,
      link: `/app/deals/${deal.id}`,
      metadata: { managerTriggerId: trigger.id, dealId: deal.id },
    });
  }
  return created;
}

/** BIG_SALE — vendas ganhas nas últimas 24h com valor >= minValue. */
async function runBigSaleTrigger(ctx: TriggerContext, trigger: ManagerTrigger): Promise<number> {
  const config = (trigger.conditionConfig ?? {}) as { minValue?: number };
  const minValue = typeof config.minValue === 'number' && config.minValue > 0 ? config.minValue : null;
  if (!minValue) return 0; // gatilho mal configurado

  const since = new Date(ctx.now.getTime() - DAY_MS);
  const deals = await prisma.deal.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      wonAt: { gte: since },
      value: { gte: minValue },
    },
    select: { id: true, name: true, assignedTo: true, value: true },
  });
  if (deals.length === 0) return 0;

  const windowStart = new Date(ctx.now.getTime() - 2 * DAY_MS);
  const alreadyNotified = await fetchNotifiedDealIds(
    ctx.tenantId,
    NotificationType.MANAGER_TRIGGER,
    windowStart,
    trigger.id
  );

  let created = 0;
  for (const deal of deals) {
    if (alreadyNotified.has(deal.id)) continue;
    created += await notifyTriggerRecipients(ctx, trigger, deal.assignedTo, {
      title: trigger.name,
      message: `A negociação "${deal.name}" foi ganha por ${formatBRL(deal.value)}.`,
      link: `/app/deals/${deal.id}`,
      metadata: { managerTriggerId: trigger.id, dealId: deal.id },
    });
  }
  return created;
}

/**
 * Garante o gatilho padrão "Negociações esfriando" (isDefault) do tenant —
 * herdeiro direto do staleDeals (NO_INTERACTION + useCoolingDays).
 */
export async function ensureDefaultTriggers(tenantId: string): Promise<string> {
  const existing = await prisma.managerTrigger.findFirst({
    where: { tenantId, isDefault: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.managerTrigger.create({
    data: {
      tenantId,
      name: 'Negociações esfriando',
      conditionType: TriggerConditionType.NO_INTERACTION,
      conditionConfig: { useCoolingDays: true },
      notifyOwner: true,
      notifyManagers: false,
      notifyUserIds: [],
      emailEnabled: false,
      active: true,
      isDefault: true,
    },
  });
  return created.id;
}

/**
 * Avalia os gatilhos gerenciais ativos de todos os tenants.
 * Retorna o total de notificações criadas.
 */
export async function runManagerTriggers(now: Date = new Date()): Promise<number> {
  const tenants = await prisma.tenant.findMany({ select: { id: true, staleDays: true } });

  let totalCreated = 0;
  for (const tenant of tenants) {
    try {
      await ensureDefaultTriggers(tenant.id);

      const triggers = await prisma.managerTrigger.findMany({
        where: { tenantId: tenant.id, active: true },
      });
      if (triggers.length === 0) continue;

      const ctx: TriggerContext = {
        tenantId: tenant.id,
        staleDays: tenant.staleDays ?? 5,
        now,
        managers: null,
      };

      for (const trigger of triggers) {
        try {
          switch (trigger.conditionType) {
            case TriggerConditionType.NO_INTERACTION:
              totalCreated += await runNoInteractionTrigger(ctx, trigger);
              break;
            case TriggerConditionType.STUCK_IN_STAGE:
              totalCreated += await runStuckInStageTrigger(ctx, trigger);
              break;
            case TriggerConditionType.DEAL_LOST:
              totalCreated += await runDealLostTrigger(ctx, trigger);
              break;
            case TriggerConditionType.BIG_SALE:
              totalCreated += await runBigSaleTrigger(ctx, trigger);
              break;
          }
        } catch (err) {
          logger.error(`Manager trigger ${trigger.id} evaluation failed`, err);
        }
      }
    } catch (err) {
      logger.error(`Manager triggers sweep failed for tenant ${tenant.id}`, err);
    }
  }

  if (totalCreated > 0) {
    logger.info(`Sales ops: created ${totalCreated} manager trigger notifications`);
  }
  return totalCreated;
}

// ============================================================
// Boot (sempre-ativo, sem Redis)
// ============================================================

async function runSalesOps() {
  try {
    await runScheduledDeals();
  } catch (error) {
    logger.error('Sales ops: scheduled deals sweep failed', error);
  }
  try {
    await runManagerTriggers();
  } catch (error) {
    logger.error('Sales ops: manager triggers sweep failed', error);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let initialTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function startSalesOpsJob() {
  // Atraso inicial de 30s para não competir com o boot do servidor
  initialTimeoutId = setTimeout(() => {
    runSalesOps();
    intervalId = setInterval(runSalesOps, CHECK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  logger.info('Sales ops job initialized (interval: 6h, initial delay: 30s)');
}

export function stopSalesOpsJob() {
  if (initialTimeoutId) {
    clearTimeout(initialTimeoutId);
    initialTimeoutId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
