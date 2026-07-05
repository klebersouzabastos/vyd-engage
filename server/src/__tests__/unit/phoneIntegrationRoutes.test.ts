import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Upgrade RD parity — P2 (B3): rotas de telefonia (req 21) e integrações (reqs 19/21).
 *
 * Prova no boundary HTTP:
 *  - POST /phone/token sem credencial → 400 PHONE_NOT_CONFIGURED (gating).
 *  - POST /phone/token com credencial → 200 { token, identity, expiresAt }.
 *  - POST /phone/log-call cria Interaction CALL OUTBOUND (metadata).
 *  - log-call sem vínculo → 400 (validação).
 *  - GET /integrations/{signature,phone}/status → { configured } (gating).
 *  - PUT /integrations/signature exige ADMIN (403 p/ USER).
 *
 * Mini-app Express com `req.user` injetado; DB e integrationService mockados.
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
  return {
    ...actual,
    authenticate: (_req: Request, _res: Response, next: NextFunction) => next(),
  };
});
vi.mock('../../middleware/tenant.js', () => ({
  tenantScope: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const { getConfigMock, getStatusMock, setConfigMock, deleteConfigMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
  getStatusMock: vi.fn(),
  setConfigMock: vi.fn(),
  deleteConfigMock: vi.fn(),
}));
vi.mock('../../services/integrationService.js', () => ({
  integrationService: {
    getConfig: getConfigMock,
    getStatus: getStatusMock,
    setConfig: setConfigMock,
    deleteConfig: deleteConfigMock,
  },
}));

import prisma from '../../config/database.js';
import phoneRouter from '../../routes/phone.js';
import integrationRouter from '../../routes/integrations.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function makeApp(user: { userId: string; tenantId: string; role: string }) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = user as never;
    next();
  });
  app.use('/phone', phoneRouter);
  app.use('/integrations', integrationRouter);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  });
  return app;
}

function firstCallArg(mockFn: unknown): any {
  const calls = (mockFn as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[0]?.[0] ?? {};
}

const USER = { userId: 'u1', tenantId: 't1', role: 'USER' };
const ADMIN = { userId: 'a1', tenantId: 't1', role: 'ADMIN' };

beforeEach(() => {
  mockReset(prismaMock);
  getConfigMock.mockReset();
  getStatusMock.mockReset();
  setConfigMock.mockReset();
  deleteConfigMock.mockReset();
});

describe('POST /phone/token — gating', () => {
  it('sem credencial → 400 PHONE_NOT_CONFIGURED', async () => {
    getConfigMock.mockResolvedValue(null);
    const res = await request(makeApp(USER)).post('/phone/token').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PHONE_NOT_CONFIGURED');
  });

  it('com credencial → 200 { token, identity, expiresAt }', async () => {
    getConfigMock.mockResolvedValue({
      provider: 'twilio',
      accountSid: 'ACxxxx',
      authToken: 'secret-token',
      twimlAppSid: 'APxxxx',
    });
    const res = await request(makeApp(USER)).post('/phone/token').send({});
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.identity).toBe('user_u1');
    expect(res.body.data.expiresAt).toEqual(expect.any(String));
  });
});

describe('POST /phone/log-call — registra Interaction CALL', () => {
  it('cria Interaction CALL OUTBOUND com metadata', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({ id: 'deal-1' } as never);
    prismaMock.interaction.create.mockResolvedValue({ id: 'int-1' } as never);

    const res = await request(makeApp(USER))
      .post('/phone/log-call')
      .send({ dealId: '11111111-1111-1111-1111-111111111111', toNumber: '+5511999999999', durationSec: 42 });

    expect(res.status).toBe(201);
    const arg = firstCallArg(prismaMock.interaction.create).data;
    expect(arg).toMatchObject({
      tenantId: 't1',
      dealId: '11111111-1111-1111-1111-111111111111',
      userId: 'u1',
      type: 'CALL',
      direction: 'OUTBOUND',
    });
    expect(arg.metadata).toMatchObject({ toNumber: '+5511999999999', durationSec: 42 });
  });

  it('sem vínculo (lead/deal/company) → 400', async () => {
    const res = await request(makeApp(USER))
      .post('/phone/log-call')
      .send({ toNumber: '+5511999999999', durationSec: 10 });
    expect(res.status).toBe(400);
    expect(prismaMock.interaction.create).not.toHaveBeenCalled();
  });

  it('dealId de outro tenant → 404 (não cria)', async () => {
    prismaMock.deal.findFirst.mockResolvedValue(null as never);
    const res = await request(makeApp(USER))
      .post('/phone/log-call')
      .send({ dealId: '22222222-2222-2222-2222-222222222222', toNumber: '+55', durationSec: 5 });
    expect(res.status).toBe(404);
    expect(prismaMock.interaction.create).not.toHaveBeenCalled();
  });
});

describe('GET /integrations/*/status — gating', () => {
  it('signature/status devolve { configured }', async () => {
    getStatusMock.mockResolvedValue({ configured: false });
    const res = await request(makeApp(USER)).get('/integrations/signature/status');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ configured: false });
  });

  it('phone/status devolve { configured, provider }', async () => {
    getStatusMock.mockResolvedValue({ configured: true, provider: 'twilio', active: true });
    const res = await request(makeApp(USER)).get('/integrations/phone/status');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ configured: true, provider: 'twilio' });
  });
});

describe('PUT /integrations/signature — ADMIN-only', () => {
  it('USER → 403', async () => {
    const res = await request(makeApp(USER))
      .put('/integrations/signature')
      .send({ provider: 'zapsign', apiKey: 'k', webhookSecret: 's' });
    expect(res.status).toBe(403);
    expect(setConfigMock).not.toHaveBeenCalled();
  });

  it('ADMIN → 200 e persiste config (encrypted no service)', async () => {
    setConfigMock.mockResolvedValue({ configured: true, provider: 'zapsign', active: true });
    const res = await request(makeApp(ADMIN))
      .put('/integrations/signature')
      .send({ provider: 'zapsign', apiKey: 'k', webhookSecret: 's' });
    expect(res.status).toBe(200);
    expect(setConfigMock).toHaveBeenCalledOnce();
    const [tenantId, kind, provider] = (setConfigMock.mock.calls[0] as unknown[]);
    expect(tenantId).toBe('t1');
    expect(kind).toBe('SIGNATURE');
    expect(provider).toBe('zapsign');
  });

  it('ADMIN com corpo inválido → 400', async () => {
    const res = await request(makeApp(ADMIN))
      .put('/integrations/signature')
      .send({ provider: 'zapsign' });
    expect(res.status).toBe(400);
  });
});
