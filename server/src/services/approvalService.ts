/**
 * approvalService — fila de aprovações de export / ação em massa / exclusão
 * (Upgrade RD P1, reqs 15 e 16).
 *
 * NASCE dentro dos gates de export/bulk/delete: quando o perfil efetivo do usuário
 * exige aprovação (requireApprovalFor.{export|bulk|delete}) OU não tem permissão de
 * exclusão, em vez de executar a ação criamos um ApprovalRequest PENDING, notificamos
 * os admins e o chamador responde 202 {approvalId, pending:true}.
 *
 * Ao APROVAR, executamos a ação embutida no `payload`:
 *   - BULK   → aplica a operação em massa (mesma lógica do PATCH /leads/bulk).
 *   - DELETE → efetiva o soft-delete via o *Service.delete correspondente.
 *   - EXPORT → marca EXECUTED (o solicitante baixa via GET /approvals/:id/download).
 * Sempre notifica o solicitante (APPROVAL_DECIDED). Rejeitar → REJECTED + motivo.
 *
 * Tudo tenant-scoped (tenantId em TODA query, inclusive lookups por id).
 * Expiração (+7 dias) é aplicada pelo governanceJobs.
 */
import prisma from '../config/database.js';
import {
  ApprovalType,
  ApprovalStatus,
  NotificationType,
  type Prisma,
  LeadStatus,
} from '@prisma/client';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { getEffective, type PermissionUser } from './permissionService.js';
import { notificationService } from './notificationService.js';
import { leadService } from './leadService.js';
import { dealService } from './dealService.js';
import { taskService } from './taskService.js';
import { companyService } from './companyService.js';
import { empreendimentoService } from './empreendimentoService.js';
import { roadmapService } from './roadmapService.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { isTrashEntity, type TrashEntity } from './trashService.js';

const APPROVAL_TTL_DAYS = 7;

// ── Tipos de payload ─────────────────────────────────────────────────────────

export interface ExportPayload {
  entity: 'leads' | 'deals' | 'tasks';
  format: 'json' | 'csv' | 'xlsx';
  filters: Record<string, unknown>;
}

export interface BulkPayload {
  entity: 'leads';
  ids: string[];
  action: 'change_status' | 'add_tag' | 'remove_tag' | 'assign_user' | 'delete';
  params?: Record<string, unknown>;
}

export interface DeletePayload {
  entity: TrashEntity;
  id: string;
}

// ── Criação (a partir dos gates) ─────────────────────────────────────────────

interface CreateArgs {
  tenantId: string;
  requestedById: string;
  type: ApprovalType;
  payload: ExportPayload | BulkPayload | DeletePayload;
  summary: string;
}

/**
 * Cria uma solicitação de aprovação PENDING (+7 dias) e notifica os admins do
 * tenant. Retorna { approvalId, pending: true } para o gate responder 202.
 */
export async function createApproval(
  args: CreateArgs
): Promise<{ approvalId: string; pending: true }> {
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_DAYS * 24 * 60 * 60 * 1000);

  const approval = await prisma.approvalRequest.create({
    data: {
      tenantId: args.tenantId,
      requestedById: args.requestedById,
      type: args.type,
      status: ApprovalStatus.PENDING,
      payload: args.payload as unknown as Prisma.InputJsonValue,
      summary: args.summary,
      expiresAt,
    },
  });

  // Notifica os admins do tenant (best-effort; nunca bloqueia o fluxo).
  notificationService
    .notifyTenantAdmins(args.tenantId, {
      type: NotificationType.APPROVAL_REQUEST,
      title: 'Nova solicitação de aprovação',
      message: `${args.summary} — aguardando sua aprovação.`,
      link: '/app/settings',
      metadata: { approvalId: approval.id, type: args.type },
    })
    .catch(() => {});

  return { approvalId: approval.id, pending: true };
}

/**
 * Gate de exclusão reutilizável (req 16) para os 6 DELETE /:id gateados.
 * Decide, ANTES do soft-delete, se a exclusão deve virar uma solicitação:
 *   - Se `!capabilities.deleteRecords` OU `requireApprovalFor.delete` → cria uma
 *     ApprovalRequest(DELETE) e devolve { queued: true, approvalId } (NÃO deleta).
 *   - Caso contrário devolve { queued: false } — o chamador prossegue com o
 *     soft-delete normal (preservando TODAS as guardas do *Service.delete).
 *
 * Em ambos os caminhos, grava um AuditLog 'delete' (quem/quando/snapshot) ANTES:
 * no caminho "queued" o snapshot fica registrado como solicitação; no caminho
 * "execute" fica registrado antes do soft-delete efetivo.
 *
 * FAIL-CLOSED / DEFAULT == HOJE: sem perfil custom, USER tem deleteRecords=true e
 * requireApprovalFor.delete=false → { queued: false } → comportamento idêntico ao
 * de hoje (soft-delete direto).
 */
export async function deleteGate(
  user: PermissionUser,
  entity: TrashEntity,
  id: string,
  summaryLabel: string
): Promise<{ queued: true; approvalId: string } | { queued: false }> {
  const effective = await getEffective(user);
  const needsApproval = !effective.capabilities.deleteRecords || effective.requireApprovalFor.delete;

  // Auditoria do intento de exclusão (best-effort) — sempre, antes de qualquer efeito.
  await writeDeleteAudit(user.tenantId, entity, id, user.userId);

  if (needsApproval) {
    const { approvalId } = await createApproval({
      tenantId: user.tenantId,
      requestedById: user.userId,
      type: ApprovalType.DELETE,
      payload: { entity, id },
      summary: `Excluir ${summaryLabel}`,
    });
    return { queued: true, approvalId };
  }

  return { queued: false };
}

// ── Listagem (fila) ──────────────────────────────────────────────────────────

/**
 * Lista solicitações do tenant, opcionalmente por status. Enriquece com o
 * solicitante (nome/email). Tenant-scoped.
 */
export async function listApprovals(
  tenantId: string,
  status?: ApprovalStatus
): Promise<unknown[]> {
  const requests = await prisma.approvalRequest.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const requesterIds = [...new Set(requests.map((r) => r.requestedById))];
  const users =
    requesterIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: requesterIds }, tenantId },
          select: { id: true, name: true, email: true },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return requests.map((r) => ({
    ...r,
    requestedBy: userMap.get(r.requestedById) ?? null,
  }));
}

/** Busca uma solicitação por id, tenant-scoped (ou null). */
export async function getApproval(tenantId: string, id: string) {
  return prisma.approvalRequest.findFirst({ where: { id, tenantId } });
}

// ── Aprovar ──────────────────────────────────────────────────────────────────

/**
 * Aprova uma solicitação PENDING: executa a ação embutida (BULK/DELETE) e marca
 * EXECUTED; EXPORT vira EXECUTED (baixável). Notifica o solicitante. Idempotente
 * contra corrida via updateMany condicionado a PENDING.
 */
export async function approve(tenantId: string, id: string, decidedById: string) {
  const approval = await prisma.approvalRequest.findFirst({ where: { id, tenantId } });
  if (!approval) {
    throw createError('Solicitação não encontrada', 404, 'APPROVAL_NOT_FOUND');
  }
  if (approval.status !== ApprovalStatus.PENDING) {
    throw createError('Solicitação já foi decidida', 400, 'APPROVAL_NOT_PENDING');
  }

  // Trava a decisão (evita dupla execução em corrida).
  const claimed = await prisma.approvalRequest.updateMany({
    where: { id, tenantId, status: ApprovalStatus.PENDING },
    data: { status: ApprovalStatus.APPROVED, decidedById, decidedAt: new Date() },
  });
  if (claimed.count === 0) {
    throw createError('Solicitação já foi decidida', 400, 'APPROVAL_NOT_PENDING');
  }

  // Executa a ação embutida. Falha na execução NÃO reverte a aprovação, mas
  // registra o erro; o item fica APPROVED (não EXECUTED) para reprocessamento.
  let executed = true;
  try {
    if (approval.type === ApprovalType.BULK) {
      await executeBulk(tenantId, approval.payload as unknown as BulkPayload);
    } else if (approval.type === ApprovalType.DELETE) {
      await executeDelete(tenantId, approval.requestedById, approval.payload as unknown as DeletePayload);
    }
    // EXPORT: nada a executar aqui — o solicitante baixa via /approvals/:id/download.
  } catch (err) {
    executed = false;
    logger.error(`approvalService.approve: execução falhou para ${id} (${approval.type})`, err);
  }

  if (executed) {
    await prisma.approvalRequest.updateMany({
      where: { id, tenantId, status: ApprovalStatus.APPROVED },
      data: { status: ApprovalStatus.EXECUTED },
    });
  }

  // Notifica o solicitante.
  await prisma.notification
    .create({
      data: {
        tenantId,
        userId: approval.requestedById,
        type: NotificationType.APPROVAL_DECIDED,
        title: executed ? 'Solicitação aprovada' : 'Solicitação aprovada (com pendência)',
        message: executed
          ? `Sua solicitação "${approval.summary}" foi aprovada e executada.`
          : `Sua solicitação "${approval.summary}" foi aprovada, mas a execução falhou. Tente novamente.`,
        link: '/app/settings',
        metadata: { approvalId: id, decision: executed ? 'EXECUTED' : 'APPROVED' },
      },
    })
    .catch(() => {});

  return prisma.approvalRequest.findFirst({ where: { id, tenantId } });
}

// ── Rejeitar ─────────────────────────────────────────────────────────────────

/** Rejeita uma solicitação PENDING com motivo e notifica o solicitante. */
export async function reject(tenantId: string, id: string, decidedById: string, reason: string) {
  const approval = await prisma.approvalRequest.findFirst({ where: { id, tenantId } });
  if (!approval) {
    throw createError('Solicitação não encontrada', 404, 'APPROVAL_NOT_FOUND');
  }
  if (approval.status !== ApprovalStatus.PENDING) {
    throw createError('Solicitação já foi decidida', 400, 'APPROVAL_NOT_PENDING');
  }

  const claimed = await prisma.approvalRequest.updateMany({
    where: { id, tenantId, status: ApprovalStatus.PENDING },
    data: { status: ApprovalStatus.REJECTED, decidedById, decidedAt: new Date(), reason },
  });
  if (claimed.count === 0) {
    throw createError('Solicitação já foi decidida', 400, 'APPROVAL_NOT_PENDING');
  }

  await prisma.notification
    .create({
      data: {
        tenantId,
        userId: approval.requestedById,
        type: NotificationType.APPROVAL_DECIDED,
        title: 'Solicitação rejeitada',
        message: `Sua solicitação "${approval.summary}" foi rejeitada. Motivo: ${reason}`,
        link: '/app/settings',
        metadata: { approvalId: id, decision: 'REJECTED', reason },
      },
    })
    .catch(() => {});

  return prisma.approvalRequest.findFirst({ where: { id, tenantId } });
}

// ── Executores das ações embutidas ───────────────────────────────────────────

/**
 * Aplica a ação em massa aprovada. Espelha a lógica do PATCH /leads/bulk, mas
 * SEM as guardas de capability (já superadas pela aprovação do admin). Revalida
 * que todos os ids pertencem ao tenant.
 */
async function executeBulk(tenantId: string, payload: BulkPayload): Promise<void> {
  if (payload.entity !== 'leads') {
    throw new Error(`executeBulk: entidade não suportada: ${payload.entity}`);
  }
  const { ids, action, params } = payload;
  if (!Array.isArray(ids) || ids.length === 0) return;

  const count = await prisma.lead.count({
    where: { id: { in: ids }, tenantId, deletedAt: null },
  });
  if (count !== ids.length) {
    throw new Error('executeBulk: alguns leads não pertencem ao tenant ou foram excluídos');
  }

  switch (action) {
    case 'change_status': {
      const status = params?.status as LeadStatus;
      await prisma.lead.updateMany({ where: { id: { in: ids }, tenantId }, data: { status } });
      break;
    }
    case 'add_tag': {
      const tagId = params?.tagId as string;
      for (const leadId of ids) {
        await prisma.leadTag.create({ data: { leadId, tagId } }).catch(() => {});
      }
      break;
    }
    case 'remove_tag': {
      const tagId = params?.tagId as string;
      await prisma.leadTag.deleteMany({ where: { leadId: { in: ids }, tagId } });
      break;
    }
    case 'assign_user': {
      const userId = (params?.userId as string | undefined) ?? null;
      await prisma.lead.updateMany({ where: { id: { in: ids }, tenantId }, data: { assignedTo: userId } });
      break;
    }
    case 'delete': {
      await prisma.lead.updateMany({
        where: { id: { in: ids }, tenantId },
        data: { deletedAt: new Date() },
      });
      const { planLimitsService } = await import('./planLimitsService.js');
      planLimitsService.invalidateUsage(tenantId).catch(() => {});
      break;
    }
  }
}

/**
 * Efetiva o soft-delete aprovado via o *Service.delete correspondente (preserva
 * TODAS as guardas de integridade: COMPANY_HAS_RELATIONS, cancelamento de
 * automações etc.). Registra AuditLog 'delete' com o solicitante como autor.
 */
async function executeDelete(
  tenantId: string,
  requestedById: string,
  payload: DeletePayload
): Promise<void> {
  const { entity, id } = payload;
  if (!isTrashEntity(entity)) {
    throw new Error(`executeDelete: entidade inválida: ${entity}`);
  }

  // Snapshot para auditoria (best-effort; delete continua mesmo sem snapshot).
  await writeDeleteAudit(tenantId, entity, id, requestedById);

  switch (entity) {
    case 'leads':
      // Espelha a rota DELETE /leads/:id: cancela passos de automação WAITING antes.
      await prisma.automationLog.updateMany({
        where: { leadId: id, status: 'WAITING' },
        data: { status: 'CANCELLED' },
      });
      await leadService.delete(tenantId, id);
      break;
    case 'deals':
      await dealService.delete(tenantId, id);
      break;
    case 'tasks':
      await taskService.delete(tenantId, id);
      break;
    case 'companies':
      await companyService.delete(tenantId, id);
      break;
    case 'empreendimentos':
      await empreendimentoService.delete(tenantId, id);
      break;
    case 'roadmaps':
      await roadmapService.delete(tenantId, id);
      break;
  }
}

const AUDIT_TYPE_BY_ENTITY: Record<TrashEntity, string> = {
  leads: 'lead',
  deals: 'deal',
  tasks: 'task',
  companies: 'company',
  empreendimentos: 'empreendimento',
  roadmaps: 'roadmap',
};

/**
 * Grava um AuditLog 'delete' (quem/quando) para o registro. Usa o createAuditLog
 * tipado quando aplicável (lead/deal); para os demais, grava direto (entityType
 * livre) — o AuditLog aceita string em entityType.
 */
export async function writeDeleteAudit(
  tenantId: string,
  entity: TrashEntity,
  id: string,
  userId: string
): Promise<void> {
  const entityType = AUDIT_TYPE_BY_ENTITY[entity];
  if (entityType === 'lead' || entityType === 'deal') {
    await createAuditLog({
      tenantId,
      entityType,
      entityId: id,
      userId,
      action: 'delete',
    }).catch(() => {});
    return;
  }
  await prisma.auditLog
    .create({
      data: {
        tenantId,
        entityType,
        entityId: id,
        userId,
        action: 'delete',
        changes: [] as unknown as Prisma.InputJsonValue,
      },
    })
    .catch(() => {});
}

export const approvalService = {
  createApproval,
  deleteGate,
  listApprovals,
  getApproval,
  approve,
  reject,
  writeDeleteAudit,
};

export default approvalService;
