import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Upgrade RD parity — P1 (CF-1a): enforcement nas ROTAS que eu possuo.
 *
 * Prova o contrato FAIL-CLOSED / BYTE-A-BYTE == HOJE no boundary HTTP:
 *  - entities.<x>.create/edit=false → 403 (perfil custom restrito); builtins passam.
 *  - transferOwner=false → assignedTo forçado/strippado em deals/tasks (piso de hoje).
 *  - bulk delete de leads = SOFT-DELETE (deletedAt) + AuditLog (Lixeira, req 16).
 *
 * Monta um mini-app Express com `req.user` injetado e o DB mockado, montando
 * apenas os routers sob teste (sem subir o app inteiro / infra Redis).
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));
// Efeitos colaterais que não interessam ao enforcement.
vi.mock('../../services/socketService.js', () => ({
  emitToTenant: vi.fn(),
  emitToUser: vi.fn(),
}));
vi.mock('../../jobs/automationEngine.js', () => ({ dispatchTrigger: vi.fn(async () => undefined) }));
vi.mock('../../services/googleCalendarService.js', () => ({
  googleCalendarService: {
    syncTaskForUser: vi.fn(async () => undefined),
    deleteEventForUser: vi.fn(async () => undefined),
  },
}));

// getEffective controlado por teste (decide capabilities/entities/visibility).
const { getEffectiveMock } = vi.hoisted(() => ({ getEffectiveMock: vi.fn() }));
vi.mock('../../services/permissionService.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getEffective: getEffectiveMock };
});
// authenticate/tenantScope: pass-through (o mini-app injeta req.user). requirePermission
// permanece REAL (usa `can` → getEffective mockado). requireManagerForWrites idem.
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
import dealsRouter from '../../routes/deals.js';
import tasksRouter from '../../routes/tasks.js';
import leadsRouter from '../../routes/leads.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

// Perfil efetivo padrão (== builtin USER de hoje): tudo permitido nas entidades,
// transferOwner=false (piso do analista), sem exigência de aprovação.
function effective(over: Partial<{
  capabilities: Record<string, boolean>;
  entities: Record<string, Record<string, boolean>>;
  requireApprovalFor: Record<string, boolean>;
  visibility: Record<string, string>;
  hasCustomProfile: boolean;
}> = {}) {
  const entAll = { create: true, edit: true, delete: true };
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
      leads: { ...entAll, ...(over.entities?.leads ?? {}) },
      companies: { ...entAll, ...(over.entities?.companies ?? {}) },
      deals: { ...entAll, ...(over.entities?.deals ?? {}) },
      tasks: { ...entAll, ...(over.entities?.tasks ?? {}) },
    },
    visibility: { deals: 'PROPRIA', companies: 'GERAL', contacts: 'GERAL', ...(over.visibility ?? {}) },
    requireApprovalFor: { export: false, bulk: false, delete: false, ...(over.requireApprovalFor ?? {}) },
    hasCustomProfile: over.hasCustomProfile ?? false,
  };
}

/** Constrói um app com `req.user` injetado (bypassa authenticate/tenantScope). */
function makeApp(user: { userId: string; tenantId: string; role: string; isPlatformAdmin?: boolean }) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = user as never;
    next();
  });
  app.use('/deals', dealsRouter);
  app.use('/tasks', tasksRouter);
  app.use('/leads', leadsRouter);
  // Error handler mínimo (traduz createError → status).
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  });
  return app;
}

const USER = { userId: 'u1', tenantId: 't1', role: 'USER' };

/** Primeiro argumento da primeira chamada de um mock (tipagem relaxada via unknown). */
function firstCallArg(mockFn: unknown): any {
  const calls = (mockFn as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[0]?.[0] ?? {};
}

beforeEach(() => {
  mockReset(prismaMock);
  getEffectiveMock.mockReset();
  getEffectiveMock.mockResolvedValue(effective());
});

// ── entities.<x>.create/edit → 403 quando restrito ─────────────────────────────

describe('deals POST/PUT — entities gate (req 13)', () => {
  it('entities.deals.create=false → 403 (não cria)', async () => {
    getEffectiveMock.mockResolvedValue(effective({ entities: { deals: { create: false } } }));
    const app = makeApp(USER);
    const res = await request(app)
      .post('/deals')
      .send({ name: 'X', value: 100 });
    expect(res.status).toBe(403);
    expect(prismaMock.deal.create).not.toHaveBeenCalled();
  });

  it('entities.deals.edit=false → 403 (não edita)', async () => {
    // guarda de posse: analista dono passa. deal existe e é do u1.
    prismaMock.deal.findFirst.mockResolvedValue({ id: 'd1', assignedTo: 'u1' } as never);
    getEffectiveMock.mockResolvedValue(effective({ entities: { deals: { edit: false } } }));
    const app = makeApp(USER);
    const res = await request(app)
      .put('/deals/d1')
      .send({ value: 200 });
    expect(res.status).toBe(403);
  });
});

describe('tasks POST — entities gate (req 13)', () => {
  it('entities.tasks.create=false → 403 (não cria)', async () => {
    getEffectiveMock.mockResolvedValue(effective({ entities: { tasks: { create: false } } }));
    const app = makeApp(USER);
    const res = await request(app).post('/tasks').send({ title: 'T' });
    expect(res.status).toBe(403);
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });
});

describe('leads POST — entities gate (req 13)', () => {
  it('entities.leads.create=false → 403 (não cria)', async () => {
    getEffectiveMock.mockResolvedValue(effective({ entities: { leads: { create: false } } }));
    const app = makeApp(USER);
    const res = await request(app).post('/leads').send({ name: 'L' });
    expect(res.status).toBe(403);
  });
});

// ── transferOwner: força/strippa assignedTo (piso de hoje) ──────────────────────

describe('deals POST — transferOwner=false força assignedTo=self (== hoje)', () => {
  it('USER builtin (transferOwner=false): assignedTo é forçado para o próprio', async () => {
    getEffectiveMock.mockResolvedValue(effective()); // transferOwner=false
    prismaMock.deal.create.mockResolvedValue({ id: 'd9', name: 'X', stage: 'QUALIFICATION' } as never);
    // dealService.create → precisa de findUnique do created (findById). Simplifica:
    prismaMock.deal.findFirst.mockResolvedValue({ id: 'd9' } as never);
    const app = makeApp(USER);
    await request(app)
      .post('/deals')
      .send({ name: 'X', value: 100, assignedTo: '00000000-0000-0000-0000-000000000000' });
    // dealService.create foi chamado com assignedTo forçado ao próprio userId.
    const createCall = firstCallArg(prismaMock.deal.create);
    expect(createCall.data?.assignedTo).toBe('u1');
  });

  it('perfil com transferOwner=true: assignedTo informado é preservado', async () => {
    getEffectiveMock.mockResolvedValue(effective({ capabilities: { transferOwner: true } }));
    prismaMock.deal.create.mockResolvedValue({ id: 'd10', name: 'X', stage: 'QUALIFICATION' } as never);
    prismaMock.deal.findFirst.mockResolvedValue({ id: 'd10' } as never);
    const app = makeApp(USER);
    const other = '11111111-1111-1111-1111-111111111111';
    await request(app).post('/deals').send({ name: 'X', value: 100, assignedTo: other });
    const createCall = firstCallArg(prismaMock.deal.create);
    expect(createCall.data?.assignedTo).toBe(other);
  });
});

// ── bulk delete de leads = SOFT-DELETE (req 16) ─────────────────────────────────

describe('leads PATCH /bulk delete — soft-delete + AuditLog (req 16)', () => {
  it('action=delete usa updateMany(deletedAt) — NUNCA deleteMany', async () => {
    getEffectiveMock.mockResolvedValue(effective()); // bulkActions=true, sem approval
    prismaMock.lead.count.mockResolvedValue(2 as never);
    prismaMock.lead.updateMany.mockResolvedValue({ count: 2 } as never);
    prismaMock.auditLog.create.mockResolvedValue({} as never);

    const app = makeApp(USER);
    const ids = [
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
    ];
    const res = await request(app).patch('/leads/bulk').send({ ids, action: 'delete' });

    expect(res.status).toBe(200);
    // Soft-delete: updateMany com deletedAt setado; deleteMany NÃO é chamado.
    expect(prismaMock.lead.deleteMany).not.toHaveBeenCalled();
    const upd = firstCallArg(prismaMock.lead.updateMany);
    expect(upd.where).toMatchObject({ id: { in: ids }, tenantId: 't1' });
    expect(upd.data?.deletedAt).toBeInstanceOf(Date);
    // AuditLog 'delete' por lead (Lixeira rastreável).
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it('bulk assign_user com hasCustomProfile e transferOwner=false → 403', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ hasCustomProfile: true, capabilities: { transferOwner: false } })
    );
    prismaMock.lead.count.mockResolvedValue(1 as never);
    const app = makeApp(USER);
    const res = await request(app)
      .patch('/leads/bulk')
      .send({
        ids: ['44444444-4444-4444-4444-444444444444'],
        action: 'assign_user',
        payload: { userId: '55555555-5555-5555-5555-555555555555' },
      });
    expect(res.status).toBe(403);
    expect(prismaMock.lead.updateMany).not.toHaveBeenCalled();
  });

  it('bulk assign_user SEM perfil custom (builtin) → aplica normalmente (== hoje)', async () => {
    getEffectiveMock.mockResolvedValue(effective({ hasCustomProfile: false }));
    prismaMock.lead.count.mockResolvedValue(1 as never);
    prismaMock.lead.updateMany.mockResolvedValue({ count: 1 } as never);
    const app = makeApp(USER);
    const res = await request(app)
      .patch('/leads/bulk')
      .send({
        ids: ['44444444-4444-4444-4444-444444444444'],
        action: 'assign_user',
        payload: { userId: '55555555-5555-5555-5555-555555555555' },
      });
    expect(res.status).toBe(200);
    expect(prismaMock.lead.updateMany).toHaveBeenCalled();
  });
});
