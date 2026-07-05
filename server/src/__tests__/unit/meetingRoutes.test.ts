import { describe, it, expect, vi, beforeEach } from 'vitest';
import { visibilityScope } from '../../services/permissionService.js';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Upgrade RD parity — P3 (B2, req 26): rotas de reuniões IA no boundary HTTP (deals.ts).
 *
 * Prova:
 *  - GATING: sem IA (isAIEnabled=false) → 503 AI_NOT_CONFIGURED em POST/GET meetings.
 *  - POST /deals/:id/meetings { transcript } → 201 com a reunião (meetingService mockado).
 *  - POST sem áudio nem transcript → 400 MEETING_INPUT_REQUIRED.
 *  - POST /deals/:id/meetings/:iid/apply → 200 com o resultado.
 *  - GET /deals/meetings/:iid resolve ANTES do guard /:id (não é capturado por /:id).
 *
 * meetingService é mockado; DB mockado; auth/tenant no-op.
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));
vi.mock('../../middleware/auth.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, authenticate: (_r: Request, _s: Response, next: NextFunction) => next() };
});
vi.mock('../../middleware/tenant.js', () => ({
  tenantScope: (_r: Request, _s: Response, next: NextFunction) => next(),
}));
// Evita side-effects de módulos pesados importados por deals.ts.
vi.mock('../../jobs/automationEngine.js', () => ({ dispatchTrigger: vi.fn(async () => {}) }));
// Visibilidade P1: GERAL (undefined) → guard de posse passa direto.
// getEffective: builtins dão entitiesAll(true) — default aqui é tudo liberado; testes
// de capability (deals.edit/tasks.create=false) sobrescrevem via mockResolvedValueOnce.
vi.mock('../../services/permissionService.js', () => ({
  visibilityScope: vi.fn(async () => undefined),
  getEffective: getEffectiveMock,
}));

const {
  assertAIEnabledMock,
  createMeetingMock,
  listMeetingsMock,
  getMeetingMock,
  applyMeetingMock,
  getEffectiveMock,
} = vi.hoisted(() => ({
  assertAIEnabledMock: vi.fn(),
  createMeetingMock: vi.fn(),
  listMeetingsMock: vi.fn(),
  getMeetingMock: vi.fn(),
  applyMeetingMock: vi.fn(),
  getEffectiveMock: vi.fn(),
}));

// entitiesAll(true): espelha o piso dos builtins (getEffective devolve tudo liberado).
function effAll() {
  return {
    entities: {
      deals: { create: true, edit: true, delete: true, view: true },
      tasks: { create: true, edit: true, delete: true, view: true },
    },
    capabilities: { transferOwner: true },
  };
}
vi.mock('../../services/meetingService.js', () => ({
  meetingService: {
    assertAIEnabled: assertAIEnabledMock,
    createMeeting: createMeetingMock,
    listMeetings: listMeetingsMock,
    getMeeting: getMeetingMock,
    applyMeeting: applyMeetingMock,
  },
}));

import prisma from '../../config/database.js';
import dealsRouter from '../../routes/deals.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: 'u1', tenantId: 't1', role: 'ADMIN' } as never;
    next();
  });
  app.use('/deals', dealsRouter);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  });
  return app;
}

function aiOff() {
  assertAIEnabledMock.mockImplementation(() => {
    const e: any = new Error('IA não configurada');
    e.statusCode = 503;
    e.code = 'AI_NOT_CONFIGURED';
    throw e;
  });
}

beforeEach(() => {
  mockReset(prismaMock);
  assertAIEnabledMock.mockReset().mockImplementation(() => {});
  createMeetingMock.mockReset();
  listMeetingsMock.mockReset();
  getMeetingMock.mockReset();
  applyMeetingMock.mockReset();
  getEffectiveMock.mockReset().mockResolvedValue(effAll());
  // Guard de posse (/:id) e existência do deal.
  prismaMock.deal.findFirst.mockResolvedValue({ id: 'deal-1' } as never);
});

describe('POST /deals/:id/meetings — gating', () => {
  it('sem IA → 503 AI_NOT_CONFIGURED', async () => {
    aiOff();
    const res = await request(makeApp())
      .post('/deals/deal-1/meetings')
      .send({ transcript: 'x' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_NOT_CONFIGURED');
    expect(createMeetingMock).not.toHaveBeenCalled();
  });
});

describe('POST /deals/:id/meetings — transcrição colada', () => {
  it('com transcript → 201 e chama createMeeting', async () => {
    createMeetingMock.mockResolvedValue({ id: 'int-1', summary: 'ok', suggestedTasks: [] });
    const res = await request(makeApp())
      .post('/deals/deal-1/meetings')
      .send({ transcript: 'Reunião com o cliente.' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 'int-1' });
    expect(createMeetingMock).toHaveBeenCalledOnce();
    const [, dealArg, input] = createMeetingMock.mock.calls[0];
    expect(dealArg).toBe('deal-1');
    expect(input.transcript).toBe('Reunião com o cliente.');
    expect(input.audio).toBeNull();
  });

  it('sem áudio nem transcript → 400 MEETING_INPUT_REQUIRED', async () => {
    const res = await request(makeApp()).post('/deals/deal-1/meetings').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MEETING_INPUT_REQUIRED');
    expect(createMeetingMock).not.toHaveBeenCalled();
  });
});

describe('GET /deals/:id/meetings — lista', () => {
  it('devolve as reuniões', async () => {
    listMeetingsMock.mockResolvedValue([{ id: 'int-1' }]);
    const res = await request(makeApp()).get('/deals/deal-1/meetings');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('POST /deals/:id/meetings/:iid/apply', () => {
  it('devolve o resultado do apply', async () => {
    applyMeetingMock.mockResolvedValue({ createdTaskIds: ['task-1'], updatedFields: ['value'] });
    const res = await request(makeApp())
      .post('/deals/deal-1/meetings/int-1/apply')
      .send({ taskIds: ['t0'], fieldUpdates: { value: '2000' } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ createdTaskIds: ['task-1'], updatedFields: ['value'] });
    const [, dealArg, iidArg, body] = applyMeetingMock.mock.calls[0];
    expect(dealArg).toBe('deal-1');
    expect(iidArg).toBe('int-1');
    expect(body.taskIds).toEqual(['t0']);
  });

  // LACUNA #2: o apply muta o deal / cria tarefas — precisa dos MESMOS gates de
  // PUT /deals/:id (deals.edit) e POST /tasks (tasks.create). Perfil custom restrito
  // não pode contornar via apply.
  it('perfil com deals.edit=false + fieldUpdates → 403 (não aplica)', async () => {
    getEffectiveMock.mockResolvedValueOnce({
      entities: {
        deals: { create: true, edit: false, delete: true, view: true },
        tasks: { create: true, edit: true, delete: true, view: true },
      },
      capabilities: { transferOwner: true },
    });
    const res = await request(makeApp())
      .post('/deals/deal-1/meetings/int-1/apply')
      .send({ taskIds: [], fieldUpdates: { value: '2000' } });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect(applyMeetingMock).not.toHaveBeenCalled();
  });

  it('perfil com tasks.create=false + taskIds → 403 (não aplica)', async () => {
    getEffectiveMock.mockResolvedValueOnce({
      entities: {
        deals: { create: true, edit: true, delete: true, view: true },
        tasks: { create: false, edit: true, delete: true, view: true },
      },
      capabilities: { transferOwner: true },
    });
    const res = await request(makeApp())
      .post('/deals/deal-1/meetings/int-1/apply')
      .send({ taskIds: ['t0'], fieldUpdates: {} });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect(applyMeetingMock).not.toHaveBeenCalled();
  });
});

describe('GET /deals/meetings/:iid — resolve antes do guard /:id', () => {
  it('não é capturado por /:id; chama getMeeting com o iid', async () => {
    // getMeeting devolve o dealId no DTO — a rota usa isso para aplicar o escopo.
    getMeetingMock.mockResolvedValue({ id: 'int-9', summary: 's', dealId: 'deal-1' });
    // Escopo GERAL (undefined): o deal.findFirst confirma o deal do tenant sem filtro por dono.
    (visibilityScope as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    prismaMock.deal.findFirst.mockResolvedValueOnce({ id: 'deal-1' } as never);
    const res = await request(makeApp()).get('/deals/meetings/int-9');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 'int-9' });
    expect(getMeetingMock).toHaveBeenCalledWith('t1', 'int-9');
  });

  // LACUNA #2/#3/#12/#14: a rota está ANTES do guard /:id, então precisa aplicar a
  // visibilidade P1 à mão. Um analista USER (deals=PROPRIA) que adivinhe o UUID de
  // uma reunião de OUTRO dono deve receber 404 — nunca a transcrição/valor/notas.
  it('analista PROPRIA fora do escopo → 404 MEETING_NOT_FOUND (não vaza a reunião)', async () => {
    getMeetingMock.mockResolvedValue({
      id: 'int-x',
      summary: 'confidencial',
      dealId: 'deal-de-outro',
    });
    // Escopo PROPRIA → visibilityScope devolve o userId (string). Como o deal é de
    // OUTRO dono, o deal.findFirst com `assignedTo: 'outro-user'` não acha nada.
    (visibilityScope as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce('outro-user');
    prismaMock.deal.findFirst.mockResolvedValueOnce(null as never);
    const res = await request(makeApp()).get('/deals/meetings/int-x');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('MEETING_NOT_FOUND');
    // Não vaza nada do conteúdo da reunião.
    expect(res.body.data).toBeUndefined();
  });
});
