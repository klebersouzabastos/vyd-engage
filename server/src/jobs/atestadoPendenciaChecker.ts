// Job leve (setInterval, sem Redis) que cuida das pendências de atestação (req 33):
//   - notifica in-app pendências com prazo próximo (DUE) e vencidas (OVERDUE);
//   - envia um resumo periódico (digest) por e-mail ao responsável;
//   - cria automaticamente pendências a partir de deals ganhos (gated por env).
// Dedup diária via Notification.metadata. Nunca lança para fora (job resiliente).

import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';
import { notificationService } from '../services/notificationService.js';
import { pendenciaService } from '../services/atestados/pendenciaService.js';
import { NotificationType } from '@prisma/client';

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h
const INITIAL_DELAY_MS = 45 * 1000;
const DUE_ALERT_DAYS = 7; // avisa quando faltam <= 7 dias

let intervalId: ReturnType<typeof setInterval> | null = null;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function appUrl(path: string): string {
  const base = process.env.FRONTEND_URL || 'https://engage.vydhub.com';
  return `${base.replace(/\/$/, '')}${path}`;
}

/** Notifica pendências DUE/OVERDUE e envia o digest por e-mail (por tenant). */
async function checkTenant(tenantId: string, alertDays: number): Promise<void> {
  const now = new Date();
  const dueLimit = new Date(now.getTime() + alertDays * 24 * 60 * 60 * 1000);

  // Pendências não finais com prazo definido.
  const pendencias = await prisma.pendencia.findMany({
    where: {
      tenantId,
      deletedAt: null,
      prazo: { not: null, lte: dueLimit },
      status: { isFinal: false },
    },
    include: { status: true },
  });
  if (pendencias.length === 0) return;

  // Dedup diária: notificações já criadas hoje para estas pendências.
  const today = startOfToday();
  const todays = await prisma.notification.findMany({
    where: {
      tenantId,
      type: { in: [NotificationType.ATESTADO_PENDENCIA_DUE, NotificationType.ATESTADO_PENDENCIA_OVERDUE] },
      createdAt: { gte: today },
    },
    select: { type: true, metadata: true },
  });
  const notified = new Set<string>();
  for (const n of todays) {
    const meta = n.metadata as Record<string, unknown> | null;
    if (meta?.pendenciaId) notified.add(`${n.type}:${meta.pendenciaId}`);
  }

  const adminIds = await notificationService.getTenantAdminIds(tenantId);
  const digestByUser = new Map<string, Array<{ titulo: string; etapa: string; prazo: string | null; atrasada: boolean }>>();

  for (const p of pendencias) {
    const overdue = p.prazo ? p.prazo.getTime() < now.getTime() : false;
    const type = overdue ? NotificationType.ATESTADO_PENDENCIA_OVERDUE : NotificationType.ATESTADO_PENDENCIA_DUE;
    const targets = p.responsavelId ? [p.responsavelId] : adminIds;

    for (const userId of [...new Set(targets)]) {
      if (notified.has(`${type}:${p.id}`)) continue;
      await notificationService
        .create(tenantId, {
          userId,
          type,
          title: overdue ? 'Atestado pendente atrasado' : 'Atestado pendente próximo do prazo',
          message: `${p.titulo} — etapa "${p.status.nome}".`,
          link: `/app/atestados/pendencias`,
          metadata: { pendenciaId: p.id, statusId: p.statusId },
        })
        .catch((err) => logger.error('Falha ao notificar pendência', err));

      const list = digestByUser.get(userId) ?? [];
      list.push({
        titulo: p.titulo,
        etapa: p.status.nome,
        prazo: p.prazo ? p.prazo.toLocaleDateString('pt-BR') : null,
        atrasada: overdue,
      });
      digestByUser.set(userId, list);
    }
  }

  // Digest por e-mail (uma vez/dia por usuário, deduped por marcador SYSTEM).
  await sendDigests(tenantId, digestByUser, today);
}

async function sendDigests(
  tenantId: string,
  digestByUser: Map<string, Array<{ titulo: string; etapa: string; prazo: string | null; atrasada: boolean }>>,
  today: Date
): Promise<void> {
  if (digestByUser.size === 0) return;
  const sentToday = await prisma.notification.findMany({
    where: { tenantId, type: NotificationType.SYSTEM, createdAt: { gte: today } },
    select: { metadata: true },
  });
  const alreadySent = new Set<string>();
  for (const n of sentToday) {
    const meta = n.metadata as Record<string, unknown> | null;
    if (meta?.atestadoDigest && meta?.userId) alreadySent.add(String(meta.userId));
  }

  for (const [userId, pendencias] of digestByUser) {
    if (alreadySent.has(userId)) continue;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) continue;
    try {
      const { sendEmail, emailTemplates } = await import('../services/emailService.js');
      await sendEmail({ to: user.email, ...(await emailTemplates.atestadoPendencias(pendencias, appUrl('/app/atestados/pendencias'))) });
      // Marca que o digest já foi enviado hoje (não gera ruído in-app — é só marcador).
      await prisma.notification.create({
        data: {
          tenantId,
          userId,
          type: NotificationType.SYSTEM,
          title: 'Resumo de atestados pendentes enviado',
          message: `${pendencias.length} pendência(s) no resumo diário.`,
          metadata: { atestadoDigest: true, userId },
        },
      });
    } catch (err) {
      logger.warn('Falha ao enviar digest de pendências por e-mail', err as Error);
    }
  }
}

/** Cria pendências a partir de deals ganhos recentemente (gated por env; idempotente). */
async function autoCreateFromWonDeals(tenantId: string): Promise<void> {
  if (process.env.ATESTADO_AUTO_PENDENCIA === 'false') return;
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const deals = await prisma.deal.findMany({
    where: { tenantId, status: 'WON', deletedAt: null, updatedAt: { gte: since } },
    select: { id: true, name: true, companyId: true },
    take: 200,
  });
  for (const deal of deals) {
    await pendenciaService
      .createFromTrigger(tenantId, {
        origem: 'DEAL',
        titulo: `Atestar serviço: ${deal.name}`,
        dealId: deal.id,
        companyId: deal.companyId ?? undefined,
      })
      .catch((err) => logger.error('Falha ao auto-criar pendência de deal', err));
  }
}

/** Cria pendências a partir de contratos registrados na Company (gated; idempotente). */
async function autoCreateFromContracts(tenantId: string): Promise<void> {
  if (process.env.ATESTADO_AUTO_PENDENCIA === 'false') return;
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const companies = await prisma.company.findMany({
    where: {
      tenantId,
      deletedAt: null,
      contractHolder: 'NOS',
      updatedAt: { gte: since },
      OR: [{ contractStartDate: { not: null } }, { contractEndDate: { not: null } }],
    },
    select: { id: true, name: true },
    take: 200,
  });
  for (const company of companies) {
    await pendenciaService
      .createFromTrigger(tenantId, {
        origem: 'CONTRATO',
        titulo: `Atestar contrato: ${company.name}`,
        companyId: company.id,
      })
      .catch((err) => logger.error('Falha ao auto-criar pendência de contrato', err));
  }
}

async function run(): Promise<void> {
  try {
    const tenants = await prisma.tenant.findMany({ select: { id: true, atestadoAlertDays: true } });
    for (const tenant of tenants) {
      try {
        await autoCreateFromWonDeals(tenant.id);
        await autoCreateFromContracts(tenant.id);
        await checkTenant(tenant.id, tenant.atestadoAlertDays ?? DUE_ALERT_DAYS);
      } catch (err) {
        logger.error(`Falha no checker de pendências (tenant ${tenant.id})`, err as Error);
      }
    }
  } catch (err) {
    logger.error('Falha geral no checker de pendências de atestados', err as Error);
  }
}

export function initializeAtestadoPendenciaChecker(): void {
  setTimeout(() => {
    run().catch((err) => logger.error('Erro inicial no checker de pendências', err));
  }, INITIAL_DELAY_MS);
  intervalId = setInterval(() => {
    run().catch((err) => logger.error('Erro no checker de pendências', err));
  }, CHECK_INTERVAL_MS);
  logger.info('Atestado pendência checker initialized');
}

export function stopAtestadoPendenciaChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
