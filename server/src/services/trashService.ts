/**
 * trashService — Lixeira (soft-delete) por entidade (Upgrade RD P1, req 16).
 *
 * Consolida o soft-delete existente (`deletedAt`) num registro de "lixeira" por
 * entidade, com restauração (≤ 30 dias) e expurgo definitivo (hard-delete). Tudo
 * é tenant-scoped (tenantId em TODA query, inclusive lookups por id).
 *
 * ENTIDADES suportadas (as que já têm soft-delete e DELETE /:id gateado):
 *   leads, deals, tasks, companies, empreendimentos, roadmaps.
 *
 * PRESERVA as guardas existentes: a EXCLUSÃO em si continua nos *Service.delete
 * (que aplicam COMPANY_HAS_RELATIONS, enforceTaskOwnership etc.). Este serviço só
 * lida com o PÓS-exclusão: listar, restaurar (deletedAt=null) e expurgar.
 */
import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

// ── Registry de entidades da lixeira ─────────────────────────────────────────

export type TrashEntity =
  | 'leads'
  | 'deals'
  | 'tasks'
  | 'companies'
  | 'empreendimentos'
  | 'roadmaps';

/** Chave do AuditLog.entityType correspondente (para "quem/quando" excluiu). */
type AuditEntityType = 'lead' | 'deal' | 'task' | 'company' | 'empreendimento' | 'roadmap';

interface EntityConfig {
  /** Delegate do Prisma (typed as any: as delegates diferem em shape). */
  delegate: () => {
    findFirst: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    count: (args: unknown) => Promise<number>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
  auditType: AuditEntityType;
  /** Rótulo legível em pt-BR (para mensagens). */
  label: string;
  /**
   * Verifica se o "pai" do registro está excluído. Retorna uma mensagem clara
   * quando a restauração deve ser BLOQUEADA (pai na lixeira), ou null quando ok.
   * Ex.: deal cujo lead/empresa está soft-deletado.
   */
  parentDeleted?: (tenantId: string, record: Record<string, unknown>) => Promise<string | null>;
}

const ENTITIES: Record<TrashEntity, EntityConfig> = {
  leads: {
    delegate: () => prisma.lead as never,
    auditType: 'lead',
    label: 'lead',
    parentDeleted: async (tenantId, record) => {
      const companyId = record.companyId as string | null | undefined;
      if (!companyId) return null;
      const company = await prisma.company.findFirst({
        where: { id: companyId, tenantId },
        select: { deletedAt: true, name: true },
      });
      if (company?.deletedAt) {
        return `A empresa "${company.name}" vinculada está na lixeira. Restaure-a primeiro.`;
      }
      return null;
    },
  },
  deals: {
    delegate: () => prisma.deal as never,
    auditType: 'deal',
    label: 'negociação',
    parentDeleted: async (tenantId, record) => {
      const leadId = record.leadId as string | null | undefined;
      if (leadId) {
        const lead = await prisma.lead.findFirst({
          where: { id: leadId, tenantId },
          select: { deletedAt: true, name: true },
        });
        if (lead?.deletedAt) {
          return `O lead "${lead.name}" vinculado está na lixeira. Restaure-o primeiro.`;
        }
      }
      const companyId = record.companyId as string | null | undefined;
      if (companyId) {
        const company = await prisma.company.findFirst({
          where: { id: companyId, tenantId },
          select: { deletedAt: true, name: true },
        });
        if (company?.deletedAt) {
          return `A empresa "${company.name}" vinculada está na lixeira. Restaure-a primeiro.`;
        }
      }
      return null;
    },
  },
  tasks: {
    delegate: () => prisma.task as never,
    auditType: 'task',
    label: 'tarefa',
  },
  companies: {
    delegate: () => prisma.company as never,
    auditType: 'company',
    label: 'empresa',
  },
  empreendimentos: {
    delegate: () => prisma.empreendimento as never,
    auditType: 'empreendimento',
    label: 'empreendimento',
    parentDeleted: async (tenantId, record) => {
      const companyId = record.companyId as string | null | undefined;
      if (!companyId) return null;
      const company = await prisma.company.findFirst({
        where: { id: companyId, tenantId },
        select: { deletedAt: true, name: true },
      });
      if (company?.deletedAt) {
        return `A empresa "${company.name}" vinculada está na lixeira. Restaure-a primeiro.`;
      }
      return null;
    },
  },
  roadmaps: {
    delegate: () => prisma.commercialRoadmap as never,
    auditType: 'roadmap',
    label: 'desdobramento',
    parentDeleted: async (tenantId, record) => {
      const companyId = record.companyId as string | null | undefined;
      if (!companyId) return null;
      const company = await prisma.company.findFirst({
        where: { id: companyId, tenantId },
        select: { deletedAt: true, name: true },
      });
      if (company?.deletedAt) {
        return `A empresa "${company.name}" vinculada está na lixeira. Restaure-a primeiro.`;
      }
      return null;
    },
  },
};

export const TRASH_ENTITIES = Object.keys(ENTITIES) as TrashEntity[];

export function isTrashEntity(value: unknown): value is TrashEntity {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ENTITIES, value);
}

function getConfig(entity: TrashEntity): EntityConfig {
  return ENTITIES[entity];
}

// ── Listagem da lixeira ──────────────────────────────────────────────────────

export interface TrashItem {
  id: string;
  entity: TrashEntity;
  label: string; // nome/título do registro
  deletedAt: Date;
  deletedBy?: { id: string; name: string | null; email: string } | null;
  deletedByAt?: Date | null;
}

const PAGE_SIZE = 25;

/**
 * Lista registros na lixeira de uma entidade (deletedAt != null), tenant-scoped,
 * paginado. Enriquece com "quem/quando" a partir do AuditLog (action 'delete')
 * quando houver.
 */
export async function listTrash(
  tenantId: string,
  entity: TrashEntity,
  page = 1
): Promise<{ items: TrashItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const cfg = getConfig(entity);
  const delegate = cfg.delegate();
  const where = { tenantId, deletedAt: { not: null } };
  const skip = (Math.max(1, page) - 1) * PAGE_SIZE;

  const [records, total] = await Promise.all([
    delegate.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }) as Promise<Array<Record<string, unknown>>>,
    delegate.count({ where }),
  ]);

  const ids = records.map((r) => String(r.id));

  // "Quem/quando" excluiu — best-effort a partir do AuditLog.
  const auditByEntity = new Map<string, { userId: string; createdAt: Date }>();
  if (ids.length > 0) {
    const audits = await prisma.auditLog.findMany({
      where: { tenantId, entityType: cfg.auditType, entityId: { in: ids }, action: 'delete' },
      orderBy: { createdAt: 'desc' },
      select: { entityId: true, userId: true, createdAt: true },
    });
    for (const a of audits) {
      if (!auditByEntity.has(a.entityId)) {
        auditByEntity.set(a.entityId, { userId: a.userId, createdAt: a.createdAt });
      }
    }
  }

  const userIds = [...new Set([...auditByEntity.values()].map((v) => v.userId))];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds }, tenantId },
          select: { id: true, name: true, email: true },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const items: TrashItem[] = records.map((r) => {
    const id = String(r.id);
    const audit = auditByEntity.get(id);
    const deletedBy = audit ? userMap.get(audit.userId) ?? null : null;
    return {
      id,
      entity,
      label: labelForRecord(entity, r),
      deletedAt: r.deletedAt as Date,
      deletedBy,
      deletedByAt: audit?.createdAt ?? null,
    };
  });

  return {
    items,
    pagination: {
      page: Math.max(1, page),
      limit: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
  };
}

function labelForRecord(entity: TrashEntity, record: Record<string, unknown>): string {
  if (entity === 'tasks') return String(record.title ?? '(sem título)');
  return String(record.name ?? '(sem nome)');
}

// ── Restauração ──────────────────────────────────────────────────────────────

/**
 * Restaura um registro da lixeira (deletedAt=null). Tenant-scoped. Se o "pai"
 * (empresa/lead) estiver na lixeira, BLOQUEIA com 400 e mensagem clara (req 16 /
 * caso extremo). Só restaura registros que estão de fato na lixeira.
 */
export async function restoreItem(
  tenantId: string,
  entity: TrashEntity,
  id: string
): Promise<void> {
  const cfg = getConfig(entity);
  const delegate = cfg.delegate();

  const record = (await delegate.findFirst({
    where: { id, tenantId, deletedAt: { not: null } },
  })) as Record<string, unknown> | null;

  if (!record) {
    throw createError('Registro não encontrado na lixeira', 404, 'TRASH_ITEM_NOT_FOUND');
  }

  if (cfg.parentDeleted) {
    const blockMsg = await cfg.parentDeleted(tenantId, record);
    if (blockMsg) {
      throw createError(blockMsg, 400, 'TRASH_PARENT_DELETED');
    }
  }

  await delegate.update({ where: { id }, data: { deletedAt: null } });
}

// ── Expurgo (hard-delete) ────────────────────────────────────────────────────

/**
 * Expurga definitivamente (hard-delete) UM item que já está na lixeira.
 * Tenant-scoped; recusa itens que não estão na lixeira (deletedAt=null).
 */
export async function purgeItem(
  tenantId: string,
  entity: TrashEntity,
  id: string
): Promise<void> {
  const cfg = getConfig(entity);
  const delegate = cfg.delegate();

  const record = (await delegate.findFirst({
    where: { id, tenantId, deletedAt: { not: null } },
    // seleção mínima
  })) as Record<string, unknown> | null;

  if (!record) {
    throw createError(
      'Registro não encontrado na lixeira (apenas itens já excluídos podem ser expurgados)',
      404,
      'TRASH_ITEM_NOT_FOUND'
    );
  }

  await delegate.delete({ where: { id } });
}

/**
 * Expurgo em lote por entidade de itens com deletedAt < cutoff (job de governança).
 * Tenant-scoped; hard-delete respeitando FKs (deleta filhos antes quando aplicável).
 * Retorna a contagem expurgada. Best-effort por item (uma falha não aborta o resto).
 */
export async function purgeExpiredForEntity(
  tenantId: string,
  entity: TrashEntity,
  cutoff: Date
): Promise<number> {
  const cfg = getConfig(entity);
  const delegate = cfg.delegate();

  const stale = (await delegate.findMany({
    where: { tenantId, deletedAt: { lt: cutoff } },
    orderBy: { deletedAt: 'asc' },
    // Evita carregar demais de uma vez.
    take: 500,
  })) as Array<Record<string, unknown>>;

  let purged = 0;
  for (const rec of stale) {
    const id = String(rec.id);
    try {
      await delegate.delete({ where: { id } });
      purged++;
    } catch (err) {
      // FK ou corrida — loga e segue; não aborta o lote.
      logger.error(`trashService.purgeExpired: falha ao expurgar ${entity}/${id}`, err);
    }
  }
  return purged;
}

export const trashService = {
  TRASH_ENTITIES,
  isTrashEntity,
  listTrash,
  restoreItem,
  purgeItem,
  purgeExpiredForEntity,
};

export default trashService;
