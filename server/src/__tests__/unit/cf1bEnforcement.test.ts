import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Upgrade RD parity — P1 (CF-1b): capabilities GLOBAIS restantes.
 *
 * Prova o contrato FAIL-CLOSED / BYTE-A-BYTE == HOJE nas 3 frentes que possuo:
 *  1. `configure` — requireManagerForWrites nega (403) um GESTOR com perfil CUSTOM
 *     configure=false; builtins ADMIN/GESTOR (configure=true) passam; USER (fora do
 *     piso de papel) segue 403; leitura (GET) permanece livre.
 *  2. `manageAutomations` — rotas MUTADORAS de automações negam (403) só com perfil
 *     CUSTOM manageAutomations=false; builtins passam SEMPRE (hoje não há guarda);
 *     leitura (GET) permanece livre.
 *  3. approvalService — notificações de aprovação linkam para '/app/approvals'.
 *
 * DB mockado + getEffective controlado por teste (sem subir app inteiro / Redis).
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

// getEffective controlado por teste (decide capabilities/hasCustomProfile). `can`
// permanece REAL (usa getEffective mockado) — logo requireManagerForWrites usa a
// decisão do teste.
const { getEffectiveMock } = vi.hoisted(() => ({ getEffectiveMock: vi.fn() }));
vi.mock('../../services/permissionService.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getEffective: getEffectiveMock };
});

// authenticate: pass-through (o mini-app injeta req.user). As guardas de capability
// (requireManagerForWrites/requireCustomProfilePermission) permanecem REAIS.
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
// Socket é efeito colateral do notificationService.create — silencia.
vi.mock('../../services/socketService.js', () => ({
  emitToUser: vi.fn(),
  emitToTenant: vi.fn(),
}));
// notificationService: espia p/ inspecionar o `link` das notificações de aprovação.
const { notifyTenantAdminsMock } = vi.hoisted(() => ({
  notifyTenantAdminsMock: vi.fn(async () => []),
}));
vi.mock('../../services/notificationService.js', () => ({
  notificationService: { notifyTenantAdmins: notifyTenantAdminsMock },
}));

// Dependências pesadas do router de automações — silenciadas (não interessam ao gate).
// vi.hoisted garante que os spies existam antes do factory hoisteado de vi.mock.
const { automationCreate, automationFindAll } = vi.hoisted(() => ({
  automationCreate: vi.fn(async () => ({ id: 'a1', status: 'DRAFT' })),
  automationFindAll: vi.fn(async () => ({ data: [], total: 0 })),
}));
vi.mock('../../services/automationService.js', () => ({
  automationService: {
    findAll: automationFindAll,
    findById: vi.fn(async () => ({
      id: 'a1',
      status: 'ACTIVE',
      runsCount: 0,
      successCount: 0,
      errorCount: 0,
    })),
    create: automationCreate,
    update: vi.fn(async () => ({ id: 'a1' })),
    delete: vi.fn(async () => undefined),
  },
}));
vi.mock('../../services/planLimitsService.js', () => ({
  planLimitsService: { enforceLimit: vi.fn(async () => undefined) },
}));
vi.mock('../../jobs/automationEngine.js', () => ({ dispatchTrigger: vi.fn(async () => true) }));

import prisma from '../../config/database.js';
import { requireManagerForWrites } from '../../middleware/auth.js';
import automationsRouter from '../../routes/automations.js';
import { createApproval, approve, reject } from '../../services/approvalService.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

type Caps = Record<string, boolean>;
function effective(
  over: Partial<{ capabilities: Caps; hasCustomProfile: boolean; baseRole: string }> = {}
) {
  return {
    baseRole: over.baseRole ?? 'USER',
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
      leads: { create: true, edit: true, delete: true },
      companies: { create: true, edit: true, delete: true },
      deals: { create: true, edit: true, delete: true },
      tasks: { create: true, edit: true, delete: true },
    },
    visibility: { deals: 'GERAL', companies: 'GERAL', contacts: 'GERAL' },
    requireApprovalFor: { export: false, bulk: false, delete: false },
    hasCustomProfile: over.hasCustomProfile ?? false,
  };
}

/** App com req.user injetado (bypassa authenticate). */
function makeApp(
  user: { userId: string; tenantId: string; role: string; isPlatformAdmin?: boolean },
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

const ADMIN = { userId: 'a1', tenantId: 't1', role: 'ADMIN' };
const GESTOR = { userId: 'g1', tenantId: 't1', role: 'GESTOR' };
const USER = { userId: 'u1', tenantId: 't1', role: 'USER' };

/** Lista os `data.link` de todas as chamadas de um mock de notification.create. */
function linksFrom(mockFn: unknown): (string | undefined)[] {
  const calls = (mockFn as { mock: { calls: unknown[][] } }).mock.calls;
  return calls.map((c) => (c[0] as { data?: { link?: string } })?.data?.link);
}

beforeEach(() => {
  mockReset(prismaMock);
  getEffectiveMock.mockReset();
  getEffectiveMock.mockResolvedValue(effective());
  automationCreate.mockClear();
  automationFindAll.mockClear();
});

// ── 1. configure (requireManagerForWrites) ─────────────────────────────────────

describe('requireManagerForWrites + capability configure (req 13)', () => {
  function settingsApp(user: typeof ADMIN) {
    return makeApp(user, (app) => {
      app.get('/settings', requireManagerForWrites, (_req, res) => res.json({ ok: true }));
      app.post('/settings', requireManagerForWrites, (_req, res) => res.json({ ok: true }));
    });
  }

  it('GET é livre mesmo com configure=false (leitura não afetada)', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ baseRole: 'GESTOR', capabilities: { configure: false }, hasCustomProfile: true })
    );
    const res = await request(settingsApp(GESTOR)).get('/settings');
    expect(res.status).toBe(200);
  });

  it('GESTOR builtin (configure=true) → escreve normalmente (== hoje)', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ baseRole: 'GESTOR', capabilities: { configure: true }, hasCustomProfile: false })
    );
    const res = await request(settingsApp(GESTOR)).post('/settings').send({});
    expect(res.status).toBe(200);
  });

  it('ADMIN builtin (configure=true) → escreve normalmente (== hoje)', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ baseRole: 'ADMIN', capabilities: { configure: true } })
    );
    const res = await request(settingsApp(ADMIN)).post('/settings').send({});
    expect(res.status).toBe(200);
  });

  it('GESTOR com perfil custom configure=false → 403 (restrição explícita)', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ baseRole: 'GESTOR', capabilities: { configure: false }, hasCustomProfile: true })
    );
    const res = await request(settingsApp(GESTOR)).post('/settings').send({});
    expect(res.status).toBe(403);
  });

  it('USER (fora do piso de papel) → 403 antes mesmo de checar configure', async () => {
    const res = await request(settingsApp(USER)).post('/settings').send({});
    expect(res.status).toBe(403);
    // Piso de papel curto-circuita: configure nem é consultado.
    expect(getEffectiveMock).not.toHaveBeenCalled();
  });
});

// ── 2. manageAutomations (router real de automações) ───────────────────────────

describe('automationsRouter + capability manageAutomations (req 13)', () => {
  function automationsApp(user: typeof USER) {
    return makeApp(user, (app) => {
      app.use('/automations', automationsRouter);
    });
  }

  it('GET / é livre com perfil custom manageAutomations=false (leitura não afetada)', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ capabilities: { manageAutomations: false }, hasCustomProfile: true })
    );
    const res = await request(automationsApp(USER)).get('/automations');
    expect(res.status).toBe(200);
  });

  it('POST / builtin USER (manageAutomations=false, sem custom) → cria (== hoje)', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ capabilities: { manageAutomations: false }, hasCustomProfile: false })
    );
    const res = await request(automationsApp(USER))
      .post('/automations')
      .send({ name: 'A', trigger: {}, steps: [] });
    expect(res.status).toBe(201);
    expect(automationCreate).toHaveBeenCalled();
  });

  it('POST / com perfil CUSTOM manageAutomations=false → 403 (não cria)', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ capabilities: { manageAutomations: false }, hasCustomProfile: true })
    );
    const res = await request(automationsApp(USER))
      .post('/automations')
      .send({ name: 'A', trigger: {}, steps: [] });
    expect(res.status).toBe(403);
    expect(automationCreate).not.toHaveBeenCalled();
  });

  it('POST / com perfil CUSTOM manageAutomations=true → cria (expansão explícita)', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ capabilities: { manageAutomations: true }, hasCustomProfile: true })
    );
    const res = await request(automationsApp(USER))
      .post('/automations')
      .send({ name: 'A', trigger: {}, steps: [] });
    expect(res.status).toBe(201);
  });

  it('DELETE /:id com perfil CUSTOM manageAutomations=false → 403', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ capabilities: { manageAutomations: false }, hasCustomProfile: true })
    );
    const res = await request(automationsApp(USER)).delete('/automations/a1');
    expect(res.status).toBe(403);
  });

  it('POST /:id/execute com perfil CUSTOM manageAutomations=false → 403 (é mutador)', async () => {
    getEffectiveMock.mockResolvedValue(
      effective({ capabilities: { manageAutomations: false }, hasCustomProfile: true })
    );
    const res = await request(automationsApp(USER))
      .post('/automations/a1/execute')
      .send({ leadId: 'l1' });
    expect(res.status).toBe(403);
  });
});

// ── 3. approvalService: link '/app/approvals' ──────────────────────────────────

describe('approvalService — notificações linkam para /app/approvals (item 3)', () => {
  it('APPROVAL_REQUEST (createApproval) notifica admins com link /app/approvals', async () => {
    prismaMock.approvalRequest.create.mockResolvedValue({ id: 'ap1' } as never);

    await createApproval({
      tenantId: 't1',
      requestedById: 'u1',
      type: 'EXPORT' as never,
      payload: { entity: 'leads', format: 'csv', filters: {} } as never,
      summary: 'Exportar 10 leads',
    });

    // notifyTenantAdmins é fire-and-forget (.catch) — flush das microtasks.
    await new Promise((r) => setImmediate(r));
    expect(notifyTenantAdminsMock).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ link: '/app/approvals' })
    );
  });

  it('APPROVAL_DECIDED (approve) notifica o solicitante com link /app/approvals', async () => {
    const ap = {
      id: 'ap2',
      tenantId: 't1',
      requestedById: 'u1',
      type: 'EXPORT',
      status: 'PENDING',
      summary: 'Exportar 10 leads',
    };
    prismaMock.approvalRequest.findFirst.mockResolvedValue(ap as never);
    prismaMock.approvalRequest.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);

    await approve('t1', 'ap2', 'admin1');
    const links = linksFrom(prismaMock.notification.create);
    expect(links).toContain('/app/approvals');
    expect(links).not.toContain('/app/settings');
  });

  it('APPROVAL_DECIDED (reject) notifica o solicitante com link /app/approvals', async () => {
    const ap = {
      id: 'ap3',
      tenantId: 't1',
      requestedById: 'u1',
      type: 'EXPORT',
      status: 'PENDING',
      summary: 'Exportar 10 leads',
    };
    prismaMock.approvalRequest.findFirst.mockResolvedValue(ap as never);
    prismaMock.approvalRequest.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.notification.create.mockResolvedValue({} as never);

    await reject('t1', 'ap3', 'admin1', 'Fora de política');
    const links = linksFrom(prismaMock.notification.create);
    expect(links).toContain('/app/approvals');
    expect(links).not.toContain('/app/settings');
  });
});
