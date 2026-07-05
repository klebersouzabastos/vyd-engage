import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Upgrade RD parity — P3 (req 24): ações rápidas da extensão Chrome no grupo
 * `/contacts` (apiKeyAuth + escopo próprio + CSRF-exempt). Prova:
 *  - POST /contacts/leads exige escopo `leads:write` (403 sem ele) → 201 com escopo.
 *  - POST /contacts/tasks exige `tasks:write`; leadId cross-tenant → 404.
 *  - POST /contacts/notes cria Interaction NOTE (escopo leads:write).
 *  - GET /contacts/resolve resolve por telefone, tenant-scoped pelo apiKey.
 *
 * apiKeyAuth é mockado p/ injetar req.apiKey; requireScope é o real (valida escopos).
 * Header de teste: "x-api-key: <tenant>|<scope,scope>" ('|' separa tenant dos escopos,
 * pois os escopos contêm ':' — ex.: leads:write).
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

// apiKeyAuth injeta req.apiKey a partir do header X-API-Key (formato "tenant:scope,scope").
// requireScope permanece REAL — a validação de escopo é o que estamos provando.
vi.mock('../../middleware/apiKeyAuth.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    apiKeyAuth: (req: Request, _res: Response, next: NextFunction) => {
      const raw = (req.headers['x-api-key'] as string | undefined) || '';
      const [tenantId, scopeCsv] = raw.split('|');
      (req as unknown as { apiKey: unknown }).apiKey = {
        id: 'key-1',
        tenantId: tenantId || 't1',
        scopes: scopeCsv ? scopeCsv.split(',').filter(Boolean) : [],
      };
      next();
    },
    apiKeyRateLimiter: (_r: Request, _s: Response, next: NextFunction) => next(),
  };
});

const { createLeadMock, createTaskMock, createInteractionMock } = vi.hoisted(() => ({
  createLeadMock: vi.fn(),
  createTaskMock: vi.fn(),
  createInteractionMock: vi.fn(),
}));
vi.mock('../../services/leadService.js', () => ({ leadService: { create: createLeadMock } }));
vi.mock('../../services/taskService.js', () => ({ taskService: { create: createTaskMock } }));
vi.mock('../../services/interactionService.js', () => ({
  interactionService: { create: createInteractionMock },
}));

import prisma from '../../config/database.js';
import contactsRouter from '../../routes/contacts.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/contacts', contactsRouter);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  });
  return app;
}

beforeEach(() => {
  mockReset(prismaMock);
  createLeadMock.mockReset();
  createTaskMock.mockReset();
  createInteractionMock.mockReset();
});

describe('POST /contacts/leads — req 24', () => {
  it('sem escopo leads:write → 403', async () => {
    const res = await request(makeApp())
      .post('/contacts/leads')
      .set('x-api-key', 't1|contacts:read') // escopo insuficiente
      .send({ name: 'Fulano', phone: '11999990000' });
    expect(res.status).toBe(403);
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it('com leads:write → 201 e origem OTHER, tenant do apiKey', async () => {
    createLeadMock.mockResolvedValue({ id: 'lead-1', name: 'Fulano' });
    const res = await request(makeApp())
      .post('/contacts/leads')
      .set('x-api-key', 'tenant-x|leads:write')
      .send({ name: 'Fulano', phone: '11999990000' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 'lead-1' });
    const [tenantArg, data] = createLeadMock.mock.calls[0];
    expect(tenantArg).toBe('tenant-x');
    expect(data.source).toBe('OTHER');
    expect(data.name).toBe('Fulano');
  });

  it('sem nome → 400 VALIDATION_ERROR', async () => {
    const res = await request(makeApp())
      .post('/contacts/leads')
      .set('x-api-key', 't1|leads:write')
      .send({ phone: '11999990000' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(createLeadMock).not.toHaveBeenCalled();
  });
});

describe('POST /contacts/tasks — req 24', () => {
  it('leadId de outro tenant → 404 (não vaza cross-tenant)', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null as never);
    const res = await request(makeApp())
      .post('/contacts/tasks')
      .set('x-api-key', 't1|tasks:write')
      .send({ title: 'Ligar', leadId: 'lead-de-outro-tenant' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('LEAD_NOT_FOUND');
    expect(createTaskMock).not.toHaveBeenCalled();
  });

  it('com tasks:write e sem leadId → 201', async () => {
    createTaskMock.mockResolvedValue({ id: 'task-1', title: 'Ligar' });
    const res = await request(makeApp())
      .post('/contacts/tasks')
      .set('x-api-key', 't1|tasks:write')
      .send({ title: 'Ligar' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 'task-1' });
    expect(createTaskMock).toHaveBeenCalledOnce();
  });
});

describe('POST /contacts/notes — req 24', () => {
  it('com leads:write → 201 e Interaction NOTE OUTBOUND', async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ id: 'lead-1' } as never);
    createInteractionMock.mockResolvedValue({ id: 'int-1' });
    const res = await request(makeApp())
      .post('/contacts/notes')
      .set('x-api-key', 't1|leads:write')
      .send({ content: 'Falei com o cliente.', leadId: 'lead-1' });
    expect(res.status).toBe(201);
    const [, data] = createInteractionMock.mock.calls[0];
    expect(data.type).toBe('NOTE');
    expect(data.direction).toBe('OUTBOUND');
    expect(data.content).toBe('Falei com o cliente.');
  });
});

describe('GET /contacts/resolve — req 24', () => {
  it('resolve por telefone, tenant-scoped pelo apiKey', async () => {
    prismaMock.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      name: 'Fulano',
      email: null,
      phone: '11999990000',
      company: null,
      companyId: null,
    } as never);
    prismaMock.deal.findMany.mockResolvedValue([] as never);
    prismaMock.interaction.findMany.mockResolvedValue([] as never);
    const res = await request(makeApp())
      .get('/contacts/resolve?phone=11999990000')
      .set('x-api-key', 'tenant-y|contacts:read');
    expect(res.status).toBe(200);
    expect(res.body.data.lead).toMatchObject({ id: 'lead-1' });
    // O findFirst do lead foi chamado com o tenant do apiKey.
    const call = (prismaMock.lead.findFirst.mock.calls[0] as unknown as unknown[])[0] as {
      where: { tenantId: string };
    };
    expect(call.where.tenantId).toBe('tenant-y');
  });
});
