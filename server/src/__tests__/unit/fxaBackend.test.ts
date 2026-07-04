import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * FX-A backend (Upgrade RD P1 — reqs 13/14/15).
 *
 * Prova FAIL-CLOSED / BYTE-A-BYTE == HOJE nas 3 frentes deste escopo:
 *  1. Visibilidade no KANBAN (req 14): funnelService.findAll/findById aceitam o
 *     escopo de dono como string | {in} | undefined. undefined → SEM filtro
 *     (assignedTo ausente do where); string/{in} → filtro aplicado às contagens
 *     (findAll) e às listas de leads/deals do board (findById).
 *  2. Delete por-entidade (req 13): approvalService.deleteGate rejeita (403
 *     ENTITY_DELETE_DENIED) quando o perfil efetivo tem entities[entity].delete=false;
 *     builtins (delete=true) seguem sem mudança.
 *  3. GET /approvals/mine (req 15): lista SÓ as solicitações do próprio usuário
 *     (requestedById == req.user.userId), tenant-scoped, sem requireRole.
 *
 * DB mockado (prismaMock) + getEffective controlado por teste (sem subir app/Redis).
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

// getEffective controlado por teste (decide entities/capabilities). deleteGate usa
// o getEffective REAL do módulo, então substituímos apenas essa export.
const { getEffectiveMock } = vi.hoisted(() => ({ getEffectiveMock: vi.fn() }));
vi.mock('../../services/permissionService.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getEffective: getEffectiveMock };
});

// notificationService: silenciado (approve/reject e createApproval o disparam).
vi.mock('../../services/notificationService.js', () => ({
  notificationService: { notifyTenantAdmins: vi.fn(async () => []) },
}));
// auditLogger: writeDeleteAudit chama createAuditLog — silencia.
vi.mock('../../utils/auditLogger.js', () => ({ createAuditLog: vi.fn(async () => undefined) }));

// authenticate/tenantScope: pass-through (o mini-app injeta req.user).
vi.mock('../../middleware/auth.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    authenticate: (_req: Request, _res: Response, next: NextFunction) => next(),
  };
});
vi.mock('../../middleware/tenant.js', () => ({
  tenantScope: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import prisma from '../../config/database.js';
import { funnelService } from '../../services/funnelService.js';
import { deleteGate } from '../../services/approvalService.js';
import approvalsRouter from '../../routes/approvals.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

// ── helpers ────────────────────────────────────────────────────────────────

type Ent = Record<'create' | 'edit' | 'delete', boolean>;
function effective(
  over: Partial<{
    entities: Partial<Record<'leads' | 'companies' | 'deals' | 'tasks', Partial<Ent>>>;
    capabilities: Record<string, boolean>;
    requireApprovalFor: Record<string, boolean>;
    hasCustomProfile: boolean;
  }> = {}
) {
  const allEnt = (o?: Partial<Ent>): Ent => ({ create: true, edit: true, delete: true, ...(o ?? {}) });
  return {
    baseRole: 'USER',
    capabilities: {
      exportData: true,
      importData: true,
      bulkActions: true,
      deleteRecords: true,
      configure: false,
      manageAutomations: false,
      transferOwner: false,
      viewReports: true,
      ...(over.capabilities ?? {}),
    },
    entities: {
      leads: allEnt(over.entities?.leads),
      companies: allEnt(over.entities?.companies),
      deals: allEnt(over.entities?.deals),
      tasks: allEnt(over.entities?.tasks),
    },
    visibility: { deals: 'GERAL', companies: 'GERAL', contacts: 'GERAL' },
    requireApprovalFor: { export: false, bulk: false, delete: false, ...(over.requireApprovalFor ?? {}) },
    hasCustomProfile: over.hasCustomProfile ?? false,
  };
}

/** Primeiro argumento da primeira chamada de um mock (tipado como any p/ inspeção). */
function firstArg(mockFn: unknown): any {
  return (mockFn as { mock: { calls: unknown[][] } }).mock.calls[0][0];
}

function makeApp(
  user: { userId: string; tenantId: string; role: string },
  mount: (app: express.Express) => void
) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = user as never;
    next();
  });
  mount(app);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  });
  return app;
}

beforeEach(() => {
  mockReset(prismaMock);
  getEffectiveMock.mockReset();
  getEffectiveMock.mockResolvedValue(effective());
  // writeDeleteAudit (best-effort) grava direto em auditLog p/ entidades não-tipadas
  // (empreendimentos/roadmaps). Devolve promise p/ o .catch() interno não estourar.
  prismaMock.auditLog.create.mockResolvedValue({} as never);
});

// ── 1. Visibilidade no KANBAN (req 14) ──────────────────────────────────────

describe('funnelService.findAll — escopo de dono (req 14)', () => {
  it('undefined → SEM filtro (contagens tenant-wide; assignedTo ausente do where)', async () => {
    prismaMock.funnel.findMany.mockResolvedValue([] as never);
    await funnelService.findAll('t1', undefined, undefined);

    const arg = firstArg(prismaMock.funnel.findMany);
    const leadsWhere = arg.include.columns.include._count.select.leads.where;
    const dealsWhere = arg.include.columns.include._count.select.deals.where;
    expect(leadsWhere).toEqual({});
    expect(dealsWhere).toEqual({});
  });

  it('string (PROPRIA) → filtra contagens por assignedTo = userId (== hoje)', async () => {
    prismaMock.funnel.findMany.mockResolvedValue([] as never);
    await funnelService.findAll('t1', undefined, 'u1');

    const arg = firstArg(prismaMock.funnel.findMany);
    expect(arg.include.columns.include._count.select.leads.where).toEqual({ assignedTo: 'u1' });
    expect(arg.include.columns.include._count.select.deals.where).toEqual({ assignedTo: 'u1' });
  });

  it('{in} (EQUIPE) → filtra contagens por assignedTo IN [membros]', async () => {
    prismaMock.funnel.findMany.mockResolvedValue([] as never);
    await funnelService.findAll('t1', undefined, { in: ['u1', 'u2'] });

    const arg = firstArg(prismaMock.funnel.findMany);
    expect(arg.include.columns.include._count.select.leads.where).toEqual({
      assignedTo: { in: ['u1', 'u2'] },
    });
    expect(arg.include.columns.include._count.select.deals.where).toEqual({
      assignedTo: { in: ['u1', 'u2'] },
    });
  });
});

describe('funnelService.findById — escopo de dono no BOARD (req 14)', () => {
  it('undefined → board completo (leads/deals sem filtro assignedTo)', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({ id: 'f1' } as never);
    await funnelService.findById('t1', 'f1', undefined);

    const arg = firstArg(prismaMock.funnel.findFirst);
    expect(arg.include.columns.include.leads.where).toEqual({});
    expect(arg.include.columns.include.deals.where).toEqual({});
  });

  it('string (PROPRIA) → board só do próprio (== ownerScope de hoje)', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({ id: 'f1' } as never);
    await funnelService.findById('t1', 'f1', 'u1');

    const arg = firstArg(prismaMock.funnel.findFirst);
    expect(arg.include.columns.include.leads.where).toEqual({ assignedTo: 'u1' });
    expect(arg.include.columns.include.deals.where).toEqual({ assignedTo: 'u1' });
  });

  it('{in} (EQUIPE) → board da equipe', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({ id: 'f1' } as never);
    await funnelService.findById('t1', 'f1', { in: ['u1', 'u2'] });

    const arg = firstArg(prismaMock.funnel.findFirst);
    expect(arg.include.columns.include.leads.where).toEqual({ assignedTo: { in: ['u1', 'u2'] } });
    expect(arg.include.columns.include.deals.where).toEqual({ assignedTo: { in: ['u1', 'u2'] } });
  });
});

// ── 2. Delete por-entidade (req 13) ─────────────────────────────────────────

describe('approvalService.deleteGate — delete por-entidade (req 13)', () => {
  const USER = { userId: 'u1', tenantId: 't1', role: 'USER' };

  it('perfil CUSTOM entities.deals.delete=false → 403 ENTITY_DELETE_DENIED (não deleta)', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ entities: { deals: { delete: false } }, hasCustomProfile: true })
    );
    await expect(deleteGate(USER, 'deals', 'd1', 'negócio X')).rejects.toMatchObject({
      statusCode: 403,
      code: 'ENTITY_DELETE_DENIED',
    });
    // Nenhuma solicitação de aprovação criada (rejeitou antes).
    expect(prismaMock.approvalRequest.create).not.toHaveBeenCalled();
  });

  it('builtin (entities.deals.delete=true) → NÃO queued (comportamento == hoje)', async () => {
    getEffectiveMock.mockResolvedValue(effective()); // builtin: tudo true, sem custom
    const res = await deleteGate(USER, 'deals', 'd1', 'negócio X');
    expect(res).toEqual({ queued: false });
    expect(prismaMock.approvalRequest.create).not.toHaveBeenCalled();
  });

  it('delete negado só afeta a entidade em questão (leads.delete=false não bloqueia deals)', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ entities: { leads: { delete: false } }, hasCustomProfile: true })
    );
    const res = await deleteGate(USER, 'deals', 'd1', 'negócio X');
    expect(res).toEqual({ queued: false });
  });

  it('empreendimentos (sem eixo por-entidade) → check ignorado, segue fluxo normal', async () => {
    getEffectiveMock.mockResolvedValue(effective()); // builtin
    const res = await deleteGate(USER, 'empreendimentos', 'e1', 'empreendimento X');
    expect(res).toEqual({ queued: false });
  });
});

// ── 3. GET /approvals/mine (req 15) ─────────────────────────────────────────

describe('GET /approvals/mine (req 15)', () => {
  function app(user: { userId: string; tenantId: string; role: string }) {
    return makeApp(user, (a) => a.use('/approvals', approvalsRouter));
  }

  it('lista SÓ as solicitações do próprio (requestedById == userId), tenant-scoped', async () => {
    prismaMock.approvalRequest.findMany.mockResolvedValue([
      { id: 'ap1', requestedById: 'u1', tenantId: 't1', status: 'PENDING' },
    ] as never);

    const res = await request(app({ userId: 'u1', tenantId: 't1', role: 'USER' })).get(
      '/approvals/mine'
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const where = firstArg(prismaMock.approvalRequest.findMany).where;
    expect(where).toMatchObject({ tenantId: 't1', requestedById: 'u1' });
    // Sem filtro de status quando não pedido.
    expect(where.status).toBeUndefined();
  });

  it('?status=PENDING → propaga o filtro de status', async () => {
    prismaMock.approvalRequest.findMany.mockResolvedValue([] as never);

    await request(app({ userId: 'u1', tenantId: 't1', role: 'USER' })).get(
      '/approvals/mine?status=PENDING'
    );

    const where = firstArg(prismaMock.approvalRequest.findMany).where;
    expect(where).toMatchObject({ tenantId: 't1', requestedById: 'u1', status: 'PENDING' });
  });

  it('USER restrito (sem papel de gestor) tem acesso à rota (sem requireRole)', async () => {
    prismaMock.approvalRequest.findMany.mockResolvedValue([] as never);
    const res = await request(app({ userId: 'u1', tenantId: 't1', role: 'USER' })).get(
      '/approvals/mine'
    );
    expect(res.status).toBe(200);
  });
});
