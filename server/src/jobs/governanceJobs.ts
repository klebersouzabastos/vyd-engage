/**
 * governanceJobs — job sempre-ativo (setInterval, sem Redis) de Times & Governança
 * (Upgrade RD P1). Segue o padrão de salesOps/clientFollowUpChecker.
 *
 * STUB de fundação (B1) — deixa o esqueleto e as varreduras funcionais mínimas
 * e seguras; o agente de governança preenche a lógica de expurgo por entidade.
 * Varreduras (exportadas para teste):
 *  1. runExpireApprovals  — ApprovalRequest PENDING vencidos (expiresAt < now) →
 *     EXPIRED (+ notifica o solicitante). Já funcional (seguro/idempotente).
 *  2. runPurgeTrash       — hard-delete de registros com deletedAt < now-30d nas
 *     entidades da lixeira. STUB: no-op até o agente de governança implementar
 *     o expurgo por entidade respeitando FKs.
 * Boot: `ensureBuiltinProfiles` para cada tenant (idempotente) + interval de 12h.
 */
import prisma from '../config/database.js';
import { ApprovalStatus, NotificationType } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { ensureBuiltinProfiles } from '../services/permissionService.js';
import { ALL_TRASH_ENTITIES, purgeExpiredForEntity } from '../services/trashService.js';

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 horas
const INITIAL_DELAY_MS = 45 * 1000; // 45 segundos (após salesOps/follow-up)

// ============================================================
// 1. Expiração de solicitações de aprovação pendentes
// ============================================================

/**
 * Marca como EXPIRED as ApprovalRequest PENDING com expiresAt < now e notifica
 * o solicitante (APPROVAL_DECIDED). Idempotente: só toca linhas ainda PENDING.
 * Retorna o número de solicitações expiradas.
 */
export async function runExpireApprovals(now: Date = new Date()): Promise<number> {
  const due = await prisma.approvalRequest.findMany({
    where: { status: ApprovalStatus.PENDING, expiresAt: { lt: now } },
    select: { id: true, tenantId: true, requestedById: true, summary: true },
  });
  if (due.length === 0) return 0;

  let expired = 0;
  for (const req of due) {
    try {
      const updated = await prisma.approvalRequest.updateMany({
        where: { id: req.id, status: ApprovalStatus.PENDING },
        data: { status: ApprovalStatus.EXPIRED },
      });
      if (updated.count === 0) continue; // corrida — já decidida
      expired++;

      // Notifica o solicitante (best-effort; solicitante desativado é tolerado).
      await prisma.notification
        .create({
          data: {
            tenantId: req.tenantId,
            userId: req.requestedById,
            type: NotificationType.APPROVAL_DECIDED,
            title: 'Solicitação expirada',
            message: `Sua solicitação "${req.summary}" expirou sem decisão.`,
            link: '/app/approvals',
            metadata: { approvalId: req.id, decision: 'EXPIRED' },
          },
        })
        .catch(() => {});
    } catch (err) {
      logger.error(`governanceJobs: falha ao expirar approval ${req.id}`, err);
    }
  }

  if (expired > 0) logger.info(`Governance: ${expired} solicitações de aprovação expiradas`);
  return expired;
}

// ============================================================
// 2. Expurgo da Lixeira (>30 dias)
// ============================================================

/** Idade de retenção da lixeira antes do expurgo definitivo (req 16). */
export const TRASH_RETENTION_DAYS = 30;

/**
 * Expurga (hard-delete) registros soft-deletados há mais de 30 dias, por tenant e
 * por entidade da lixeira (lead/deal/task/company/empreendimento/roadmap +
 * attachments), respeitando FKs (best-effort por item). Para `attachments`, apaga
 * TAMBÉM os bytes (AttachmentBlob "db" | objeto S3) — sem isso o blob ficaria órfão
 * (vazamento). Retorna o total expurgado. Idempotente: só toca registros com
 * deletedAt < cutoff. Loga a contagem por tenant.
 */
export async function runPurgeTrash(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  let total = 0;
  for (const tenant of tenants) {
    let tenantTotal = 0;
    for (const entity of ALL_TRASH_ENTITIES) {
      try {
        tenantTotal += await purgeExpiredForEntity(tenant.id, entity, cutoff);
      } catch (err) {
        logger.error(`governanceJobs: falha ao expurgar ${entity} do tenant ${tenant.id}`, err);
      }
    }
    if (tenantTotal > 0) {
      logger.info(`Governance: ${tenantTotal} registros expurgados da lixeira (tenant ${tenant.id})`);
    }
    total += tenantTotal;
  }
  return total;
}

// ============================================================
// Boot (sempre-ativo, sem Redis)
// ============================================================

/** Semeia os 4 builtins de cada tenant (idempotente) no boot. */
async function seedBuiltinProfiles(): Promise<void> {
  try {
    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      await ensureBuiltinProfiles(tenant.id);
    }
  } catch (err) {
    logger.error('governanceJobs: falha ao semear builtins no boot', err);
  }
}

async function runGovernance() {
  try {
    await runExpireApprovals();
  } catch (error) {
    logger.error('Governance: expire approvals sweep failed', error);
  }
  try {
    await runPurgeTrash();
  } catch (error) {
    logger.error('Governance: purge trash sweep failed', error);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let initialTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function startGovernanceJobs(): void {
  // Semeia builtins e roda a primeira varredura após um atraso inicial.
  initialTimeoutId = setTimeout(() => {
    seedBuiltinProfiles()
      .then(() => runGovernance())
      .catch((err) => logger.error('Governance: initial run failed', err));
    intervalId = setInterval(runGovernance, CHECK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  logger.info('Governance jobs initialized (interval: 12h, initial delay: 45s)');
}

export function stopGovernanceJobs(): void {
  if (initialTimeoutId) {
    clearTimeout(initialTimeoutId);
    initialTimeoutId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
