import { describe, it, expect, vi, beforeEach } from 'vitest';
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
vi.mock('../../services/permissionService.js', () => ({
  visibilityScope: vi.fn(async () => undefined),
  getEffective: vi.fn(async () => ({
    entities: { deals: { create: true, edit: true } },
    capabilities: { transferOwner: true },
  })),
}));

const {
  assertAIEnabledMock,
  createMeetingMock,
  listMeetingsMock,
  getMeetingMock,
  applyMeetingMock,
} = vi.hoisted(() => ({
  assertAIEnabledMock: vi.fn(),
  createMeetingMock: vi.fn(),
  listMeetingsMock: vi.fn(),
  getMeetingMock: vi.fn(),
  applyMeetingMock: vi.fn(),
}));
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
});

describe('GET /deals/meetings/:iid — resolve antes do guard /:id', () => {
  it('não é capturado por /:id; chama getMeeting com o iid', async () => {
    getMeetingMock.mockResolvedValue({ id: 'int-9', summary: 's' });
    const res = await request(makeApp()).get('/deals/meetings/int-9');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 'int-9' });
    expect(getMeetingMock).toHaveBeenCalledWith('t1', 'int-9');
  });
});
