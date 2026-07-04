import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalStatus, ApprovalType, NotificationType } from '@prisma/client';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Upgrade RD parity — P1 (B3): Aprovações / Lixeira / Enforcement.
 *
 * Cobre o núcleo de governança com prismaMock (sem DB):
 *  - deleteGate: sem permissão OU requireApprovalFor.delete → cria ApprovalRequest
 *    (NÃO deleta); com permissão e sem exigência → não enfileira (== hoje).
 *  - export gate: getEffective.requireApprovalFor.export decide (testado via createApproval).
 *  - approve: executa a ação embutida (BULK aplica; DELETE efetiva soft-delete) → EXECUTED.
 *  - reject: REJECTED + motivo + notifica.
 *  - trash: restore (deletedAt=null; bloqueia se pai excluído); purge só itens na lixeira.
 *  - governanceJobs: expira PENDING vencidos; purga só > 30 dias.
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mocka o getEffective para controlar as decisões de gate deterministicamente.
// vi.hoisted garante que o mock exista antes do factory hoisteado de vi.mock.
const { getEffectiveMock } = vi.hoisted(() => ({ getEffectiveMock: vi.fn() }));
vi.mock('../../services/permissionService.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getEffective: getEffectiveMock };
});

// Notificações e socket são efeitos colaterais — silencia.
vi.mock('../../services/socketService.js', () => ({
  emitToUser: vi.fn(),
  emitToTenant: vi.fn(),
}));

import {
  createApproval,
  deleteGate,
  approve,
  reject,
} from '../../services/approvalService.js';
import { restoreItem, purgeItem, purgeExpiredForEntity } from '../../services/trashService.js';
import { runExpireApprovals } from '../../jobs/governanceJobs.js';

const tenantId = 't1';
const userId = 'u1';

/** Extrai o primeiro argumento da N-ésima chamada de um mock (tipagem relaxada). */
function callArg(mockFn: unknown, callIndex = 0): any {
  const calls = (mockFn as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[callIndex]?.[0];
}
/** Lista os `data.status` de todas as chamadas de um mock de updateMany. */
function statusesOf(mockFn: unknown): (string | undefined)[] {
  const calls = (mockFn as { mock: { calls: unknown[][] } }).mock.calls;
  return calls.map((c) => (c[0] as { data?: { status?: string } })?.data?.status);
}

function effective(over: Partial<{
  capabilities: Record<string, boolean>;
  requireApprovalFor: Record<string, boolean>;
  entities: Record<string, Record<string, boolean>>;
}> = {}) {
  // Eixo por-entidade (req 13): default == HOJE (USER cria/edita/exclui as 4
  // entidades). getEffective SEMPRE popula `entities`; espelhar o contrato aqui
  // para o deleteGate poder ler effective.entities[kind].delete.
  const allowAll = { create: true, edit: true, delete: true };
  return {
    baseRole: 'USER',
    capabilities: {
      exportData: true,
      importData: false,
      bulkActions: true,
      deleteRecords: true,
      configure: false,
      manageAutomations: false,
      transferOwner: false,
      viewReports: true,
      ...(over.capabilities ?? {}),
    },
    entities: {
      leads: { ...allowAll },
      companies: { ...allowAll },
      deals: { ...allowAll },
      tasks: { ...allowAll },
      ...(over.entities ?? {}),
    },
    visibility: { deals: 'PROPRIA', companies: 'GERAL', contacts: 'GERAL' },
    requireApprovalFor: { export: false, bulk: false, delete: false, ...(over.requireApprovalFor ?? {}) },
    hasCustomProfile: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Admins notificados por padrão (best-effort).
  prismaMock.user.findMany.mockResolvedValue([{ id: 'admin1' }] as never);
  prismaMock.notification.create.mockResolvedValue({} as never);
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

// ── deleteGate ────────────────────────────────────────────────────────────────

describe('deleteGate — decisão de exclusão (req 16, FAIL-CLOSED)', () => {
  it('sem perfil custom (deleteRecords=true, sem exigência) → NÃO enfileira (== hoje)', async () => {
    getEffectiveMock.mockResolvedValue(effective());
    const result = await deleteGate({ userId, tenantId, role: 'USER' }, 'leads', 'lead1', 'lead');
    expect(result.queued).toBe(false);
    // Nenhuma solicitação criada.
    expect(prismaMock.approvalRequest.create).not.toHaveBeenCalled();
    // Auditou o intento de exclusão.
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });

  it('SEM permissão de exclusão (deleteRecords=false) → cria ApprovalRequest DELETE e NÃO deleta', async () => {
    getEffectiveMock.mockResolvedValue(effective({ capabilities: { deleteRecords: false } }));
    prismaMock.approvalRequest.create.mockResolvedValue({ id: 'appr1' } as never);

    const result = await deleteGate({ userId, tenantId, role: 'USER' }, 'deals', 'deal1', 'negociação');

    expect(result.queued).toBe(true);
    if (result.queued) expect(result.approvalId).toBe('appr1');
    const createArg = callArg(prismaMock.approvalRequest.create) as { data: Record<string, unknown> };
    expect(createArg.data.type).toBe(ApprovalType.DELETE);
    expect(createArg.data.status).toBe(ApprovalStatus.PENDING);
    expect(createArg.data.payload).toEqual({ entity: 'deals', id: 'deal1' });
  });

  it('COM requireApprovalFor.delete=true (mesmo com permissão) → cria solicitação', async () => {
    getEffectiveMock.mockResolvedValue(effective({ requireApprovalFor: { delete: true } }));
    prismaMock.approvalRequest.create.mockResolvedValue({ id: 'appr2' } as never);

    const result = await deleteGate({ userId, tenantId, role: 'USER' }, 'tasks', 'task1', 'tarefa');
    expect(result.queued).toBe(true);
  });
});

// ── export gate (createApproval) ────────────────────────────────────────────────

describe('createApproval — export enfileirado (req 15)', () => {
  it('cria ApprovalRequest EXPORT com payload e notifica admins', async () => {
    prismaMock.approvalRequest.create.mockResolvedValue({ id: 'exp1' } as never);

    const res = await createApproval({
      tenantId,
      requestedById: userId,
      type: ApprovalType.EXPORT,
      payload: { entity: 'leads', format: 'csv', filters: { status: 'NEW' } },
      summary: 'Exportar leads (CSV)',
    });

    expect(res).toEqual({ approvalId: 'exp1', pending: true });
    const arg = callArg(prismaMock.approvalRequest.create) as { data: Record<string, unknown> };
    expect(arg.data.type).toBe(ApprovalType.EXPORT);
    expect((arg.data.payload as { entity: string }).entity).toBe('leads');
    // expiresAt ~ +7 dias.
    const expiresAt = arg.data.expiresAt as Date;
    const days = (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });
});

// ── approve (executa a ação embutida) ────────────────────────────────────────────

describe('approve — executa a ação embutida → EXECUTED (req 15/16)', () => {
  it('BULK change_status: aplica updateMany e marca EXECUTED', async () => {
    const approval = {
      id: 'a1',
      tenantId,
      type: ApprovalType.BULK,
      status: ApprovalStatus.PENDING,
      requestedById: userId,
      summary: 'Ação em massa "change_status" em 2 lead(s)',
      payload: { entity: 'leads', ids: ['l1', 'l2'], action: 'change_status', params: { status: 'QUALIFIED' } },
    };
    prismaMock.approvalRequest.findFirst.mockResolvedValue(approval as never);
    prismaMock.approvalRequest.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.lead.count.mockResolvedValue(2 as never);
    prismaMock.lead.updateMany.mockResolvedValue({ count: 2 } as never);

    await approve(tenantId, 'a1', 'admin1');

    // Aplicou a ação em massa.
    expect(prismaMock.lead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['l1', 'l2'] }, tenantId }, data: { status: 'QUALIFIED' } })
    );
    // Transição APPROVED → EXECUTED (segunda chamada de updateMany do approvalRequest).
    const statuses = statusesOf(prismaMock.approvalRequest.updateMany);
    expect(statuses).toContain(ApprovalStatus.APPROVED);
    expect(statuses).toContain(ApprovalStatus.EXECUTED);
    // Notificou o solicitante.
    expect(prismaMock.notification.create).toHaveBeenCalled();
  });

  it('recusa aprovar solicitação já decidida (não-PENDING)', async () => {
    prismaMock.approvalRequest.findFirst.mockResolvedValue({
      id: 'a2',
      tenantId,
      status: ApprovalStatus.REJECTED,
      type: ApprovalType.EXPORT,
      requestedById: userId,
      summary: 'x',
      payload: {},
    } as never);

    await expect(approve(tenantId, 'a2', 'admin1')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

// ── reject ────────────────────────────────────────────────────────────────────

describe('reject — REJECTED + motivo + notifica (req 15)', () => {
  it('marca REJECTED com motivo e notifica o solicitante', async () => {
    prismaMock.approvalRequest.findFirst.mockResolvedValue({
      id: 'r1',
      tenantId,
      status: ApprovalStatus.PENDING,
      type: ApprovalType.EXPORT,
      requestedById: userId,
      summary: 'Exportar leads (CSV)',
      payload: {},
    } as never);
    prismaMock.approvalRequest.updateMany.mockResolvedValue({ count: 1 } as never);

    await reject(tenantId, 'r1', 'admin1', 'Fora de política');

    const arg = callArg(prismaMock.approvalRequest.updateMany) as { data: Record<string, unknown> };
    expect(arg.data.status).toBe(ApprovalStatus.REJECTED);
    expect(arg.data.reason).toBe('Fora de política');
    const notif = callArg(prismaMock.notification.create) as { data: { type: string } };
    expect(notif.data.type).toBe(NotificationType.APPROVAL_DECIDED);
  });
});

// ── trash: restore / purge ──────────────────────────────────────────────────────

describe('trashService.restoreItem (req 16)', () => {
  it('restaura registro na lixeira (deletedAt=null)', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({ id: 'd1', tenantId, leadId: null, companyId: null } as never);
    prismaMock.deal.update.mockResolvedValue({} as never);

    await restoreItem(tenantId, 'deals', 'd1');

    expect(prismaMock.deal.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { deletedAt: null } });
  });

  it('BLOQUEIA restauração quando o pai (empresa) está na lixeira → 400', async () => {
    // deal com companyId cujo company está deletado.
    prismaMock.deal.findFirst.mockResolvedValue({ id: 'd2', tenantId, leadId: null, companyId: 'c1' } as never);
    prismaMock.company.findFirst.mockResolvedValue({ deletedAt: new Date(), name: 'ACME' } as never);

    await expect(restoreItem(tenantId, 'deals', 'd2')).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.deal.update).not.toHaveBeenCalled();
  });

  it('restore de item inexistente na lixeira → 404', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null as never);
    await expect(restoreItem(tenantId, 'leads', 'nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('trashService.purgeItem (req 16)', () => {
  it('expurga item que está na lixeira (hard-delete)', async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: 'tk1' } as never);
    prismaMock.task.delete.mockResolvedValue({} as never);

    await purgeItem(tenantId, 'tasks', 'tk1');
    expect(prismaMock.task.delete).toHaveBeenCalledWith({ where: { id: 'tk1' } });
  });

  it('recusa expurgar item que NÃO está na lixeira → 404', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null as never);
    await expect(purgeItem(tenantId, 'tasks', 'tk2')).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.task.delete).not.toHaveBeenCalled();
  });
});

describe('trashService.purgeExpiredForEntity (job de expurgo, >30d)', () => {
  it('só expurga registros com deletedAt < cutoff (query filtra por lt cutoff)', async () => {
    const cutoff = new Date('2026-06-01T00:00:00Z');
    prismaMock.lead.findMany.mockResolvedValue([{ id: 'old1' }, { id: 'old2' }] as never);
    prismaMock.lead.delete.mockResolvedValue({} as never);

    const purged = await purgeExpiredForEntity(tenantId, 'leads', cutoff);

    expect(purged).toBe(2);
    const findArg = callArg(prismaMock.lead.findMany) as { where: Record<string, unknown> };
    expect(findArg.where).toMatchObject({ tenantId, deletedAt: { lt: cutoff } });
    expect(prismaMock.lead.delete).toHaveBeenCalledTimes(2);
  });
});

// ── governanceJobs: expiração ────────────────────────────────────────────────────

describe('governanceJobs.runExpireApprovals (req 15)', () => {
  it('marca EXPIRED as PENDING vencidas e notifica o solicitante', async () => {
    prismaMock.approvalRequest.findMany.mockResolvedValue([
      { id: 'e1', tenantId, requestedById: userId, summary: 'Exportar leads (CSV)' },
    ] as never);
    prismaMock.approvalRequest.updateMany.mockResolvedValue({ count: 1 } as never);

    const expired = await runExpireApprovals(new Date());

    expect(expired).toBe(1);
    const arg = callArg(prismaMock.approvalRequest.updateMany) as {
      where: { status: string };
      data: { status: string };
    };
    // Só toca linhas ainda PENDING; marca EXPIRED.
    expect(arg.where.status).toBe(ApprovalStatus.PENDING);
    expect(arg.data.status).toBe(ApprovalStatus.EXPIRED);
    expect(prismaMock.notification.create).toHaveBeenCalled();
  });

  it('nada a fazer quando não há vencidas → 0', async () => {
    prismaMock.approvalRequest.findMany.mockResolvedValue([] as never);
    const expired = await runExpireApprovals(new Date());
    expect(expired).toBe(0);
    expect(prismaMock.approvalRequest.updateMany).not.toHaveBeenCalled();
  });
});
