import prisma from '../config/database.js';
import { ClientStatus, ContractHolder, NotificationType } from '@prisma/client';
import { notificationService } from '../services/notificationService.js';
import { emitToTenant } from '../services/socketService.js';
import { logger } from '../utils/logger.js';
import {
  FOLLOWUP_TASK_TITLE_PREFIX,
  openFollowUpTaskWhere,
  parseContractAlertDays,
  startOfToday,
} from '../services/companyService.js';

/**
 * Follow-up de clientes ativos + alertas de vencimento de contrato guarda-chuva.
 *
 * Varredura diária por tenant (padrão staleDeals.ts: setInterval, sem BullMQ/Redis):
 *  1. Clientes ativos sem interação além do intervalo efetivo → Task de follow-up
 *     + Notification CLIENT_FOLLOWUP (dedup: tarefa aberta + notificação diária).
 *  2. Contratos com vencimento dentro dos limiares do tenant → Notification
 *     CONTRACT_EXPIRING para dono + admins/gestores (dedup por {companyId, threshold},
 *     menor limiar aplicável no primeiro disparo; vencido = notificação única).
 *
 * Cálculos por data civil (dias, não horas) para não oscilar com fuso/horário.
 */

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DAY_MS = 24 * 60 * 60 * 1000;

// Dias civis entre duas datas (zera as horas de ambas).
function civilDaysBetween(from: Date, to: Date): number {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

// Dedup do vencido usa um "limiar" sentinela próprio.
const EXPIRED_THRESHOLD = 'EXPIRED';

// Admins/gestores do tenant — destino dos alertas quando a empresa não tem dono
// e destinatários adicionais dos alertas de contrato.
async function getTenantManagers(tenantId: string): Promise<string[]> {
  const managers = await prisma.user.findMany({
    where: { tenantId, role: { in: ['ADMIN', 'GESTOR'] } },
    select: { id: true },
  });
  return managers.map((m) => m.id);
}

async function notifyUsers(
  tenantId: string,
  userIds: string[],
  data: {
    type: NotificationType;
    title: string;
    message: string;
    link: string;
    metadata: Record<string, unknown>;
  }
) {
  for (const userId of [...new Set(userIds)]) {
    await notificationService
      .create(tenantId, { userId, ...data })
      .catch((err) => logger.error(`Failed to create ${data.type} notification`, err));
  }
}

// ── Módulo 1 — Follow-up de clientes ativos (reqs 7-9) ────────────────────────

async function checkClientFollowUps(tenant: { id: string; clientFollowUpDays: number }) {
  const today = startOfToday();
  let created = 0;

  const companies = await prisma.company.findMany({
    where: { tenantId: tenant.id, clientStatus: ClientStatus.CLIENTE_ATIVO, deletedAt: null },
    select: { id: true, name: true, assignedTo: true, followUpIntervalDays: true },
  });
  if (companies.length === 0) return 0;

  // Dedup diária das notificações CLIENT_FOLLOWUP (via metadata.companyId).
  const todaysNotifications = await prisma.notification.findMany({
    where: {
      tenantId: tenant.id,
      type: NotificationType.CLIENT_FOLLOWUP,
      createdAt: { gte: today },
    },
    select: { metadata: true },
  });
  const notifiedToday = new Set<string>();
  for (const notif of todaysNotifications) {
    const meta = notif.metadata as Record<string, unknown> | null;
    if (meta?.companyId) notifiedToday.add(meta.companyId as string);
  }

  let managers: string[] | null = null;

  for (const company of companies) {
    const intervalDays = company.followUpIntervalDays ?? tenant.clientFollowUpDays;
    if (!intervalDays || intervalDays <= 0) continue;

    // Última interação da empresa OU de seus leads/deals vinculados (req 8).
    const lastInteraction = await prisma.interaction.findFirst({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [
          { companyId: company.id },
          { lead: { companyId: company.id } },
          { deal: { companyId: company.id } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // Nunca teve interação → inativo desde sempre (caso extremo).
    const daysSince = lastInteraction
      ? civilDaysBetween(lastInteraction.createdAt, today)
      : Infinity;
    if (daysSince <= intervalDays) continue;

    // Dedup por tarefa de follow-up em aberto — evita pilha de tarefas (req 8).
    const openTask = await prisma.task.findFirst({
      where: { tenantId: tenant.id, companyId: company.id, ...openFollowUpTaskWhere },
      select: { id: true },
    });
    if (openTask) continue;

    await prisma.task.create({
      data: {
        tenantId: tenant.id,
        title: `${FOLLOWUP_TASK_TITLE_PREFIX} — ${company.name}`,
        description: lastInteraction
          ? `Cliente ativo sem contato há ${daysSince} dias (intervalo combinado: ${intervalDays} dias).`
          : `Cliente ativo sem nenhum contato registrado (intervalo combinado: ${intervalDays} dias).`,
        companyId: company.id,
        dueDate: new Date(),
        assignedTo: company.assignedTo || null,
      },
    });
    created++;

    if (notifiedToday.has(company.id)) continue;

    // Sem dono → notifica admins/gestores do tenant (caso extremo).
    if (!company.assignedTo && managers === null) {
      managers = await getTenantManagers(tenant.id);
    }
    const recipients = company.assignedTo ? [company.assignedTo] : (managers ?? []);

    await notifyUsers(tenant.id, recipients, {
      type: NotificationType.CLIENT_FOLLOWUP,
      title: 'Follow-up de cliente',
      message: lastInteraction
        ? `O cliente "${company.name}" está sem contato há ${daysSince} dias.`
        : `O cliente "${company.name}" não tem nenhum contato registrado.`,
      link: `/app/companies/${company.id}`,
      metadata: { companyId: company.id },
    });
  }

  return created;
}

// ── Módulo 2 — Alertas de vencimento do contrato guarda-chuva (req 12) ────────

function contractHolderLabel(company: { contractHolder: ContractHolder; contractCompetitor: string | null }) {
  return company.contractHolder === ContractHolder.CONCORRENTE
    ? company.contractCompetitor || 'concorrente'
    : 'nosso';
}

async function checkContractExpirations(tenant: { id: string; contractAlertDays: unknown }) {
  const thresholds = parseContractAlertDays(tenant.contractAlertDays);
  if (thresholds.length === 0) return 0;
  const ascending = [...thresholds].sort((a, b) => a - b);

  const today = startOfToday();
  let created = 0;

  const companies = await prisma.company.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      contractHolder: { not: ContractHolder.NENHUM },
      contractEndDate: { not: null },
    },
    select: {
      id: true,
      name: true,
      assignedTo: true,
      contractHolder: true,
      contractCompetitor: true,
      contractEndDate: true,
    },
  });
  if (companies.length === 0) return 0;

  // Dedup por {companyId, threshold, contractEndDate} em TODO o histórico — sobrevive
  // a reinícios e não renotifica limiares já disparados; incluir a data de vencimento
  // na chave permite que uma renovação (datas atualizadas) reative os alertas.
  const existing = await prisma.notification.findMany({
    where: { tenantId: tenant.id, type: NotificationType.CONTRACT_EXPIRING },
    select: { metadata: true },
  });
  const alreadyNotified = new Set<string>();
  for (const notif of existing) {
    const meta = notif.metadata as Record<string, unknown> | null;
    if (meta?.companyId && meta?.threshold !== undefined) {
      alreadyNotified.add(`${meta.companyId}:${meta.threshold}:${meta.contractEndDate ?? ''}`);
    }
  }

  let managers: string[] | null = null;

  for (const company of companies) {
    if (!company.contractEndDate) continue;
    const daysLeft = civilDaysBetween(today, company.contractEndDate);
    const endDateKey = company.contractEndDate.toISOString().slice(0, 10);
    const endDateLabel = company.contractEndDate.toLocaleDateString('pt-BR');
    const holderLabel = contractHolderLabel(company);

    let threshold: number | typeof EXPIRED_THRESHOLD;
    let title: string;
    let message: string;

    if (daysLeft < 0) {
      // Contrato já vencido ao ser varrido → uma única notificação (caso extremo).
      threshold = EXPIRED_THRESHOLD;
      title = `Contrato ${company.name} (${holderLabel}) vencido`;
      message = `O contrato guarda-chuva de "${company.name}" venceu em ${endDateLabel}.`;
    } else {
      // Menor limiar aplicável no primeiro disparo (ex.: faltam 20 dias → só o de 30).
      const applicable = ascending.find((t) => daysLeft <= t);
      if (applicable === undefined) continue;
      threshold = applicable;
      title = `Contrato ${company.name} (${holderLabel}) vence em ${daysLeft} dias`;
      message = `O contrato guarda-chuva de "${company.name}" vence em ${daysLeft} dias (${endDateLabel}). Hora de iniciar o aquecimento.`;
    }

    const dedupKey = `${company.id}:${threshold}:${endDateKey}`;
    if (alreadyNotified.has(dedupKey)) continue;

    // Dono da conta + admins/gestores (req 12).
    if (managers === null) {
      managers = await getTenantManagers(tenant.id);
    }
    const recipients = company.assignedTo ? [company.assignedTo, ...managers] : managers;

    await notifyUsers(tenant.id, recipients, {
      type: NotificationType.CONTRACT_EXPIRING,
      title,
      message,
      link: `/app/companies/${company.id}`,
      metadata: { companyId: company.id, threshold, contractEndDate: endDateKey },
    });

    emitToTenant(tenant.id, 'contract:expiring', {
      companyId: company.id,
      companyName: company.name,
      contractHolder: company.contractHolder,
      contractCompetitor: company.contractCompetitor,
      daysLeft,
      threshold,
    });

    created++;
  }

  return created;
}

// ── Varredura principal ───────────────────────────────────────────────────────

// Exportada para permitir disparo manual em verificação (além do setInterval).
export async function checkClientFollowUpsAndContracts() {
  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, clientFollowUpDays: true, contractAlertDays: true },
    });

    let followUps = 0;
    let contractAlerts = 0;

    for (const tenant of tenants) {
      followUps += await checkClientFollowUps(tenant);
      contractAlerts += await checkContractExpirations(tenant);
    }

    if (followUps > 0 || contractAlerts > 0) {
      logger.info(
        `Client follow-up checker: created ${followUps} follow-up tasks and ${contractAlerts} contract alerts`
      );
    }
  } catch (error) {
    logger.error('Client follow-up checker failed', error);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function initializeClientFollowUpChecker() {
  // Run immediately on startup
  checkClientFollowUpsAndContracts();

  // Then run every 24 hours
  intervalId = setInterval(checkClientFollowUpsAndContracts, CHECK_INTERVAL_MS);

  logger.info('Client follow-up & contract checker initialized (interval: 24h)');
}

export function stopClientFollowUpChecker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
