import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Upgrade RD parity — P2 (CF-B, req 22): rota /attachments — gate + visibilidade.
 *
 * Prova no boundary HTTP (mini-app Express, DB mockado):
 *  - DELETE: requirePermission('deleteRecords') — perfil custom que desligou → 403;
 *    builtin (default) → 200 (sem regressão).
 *  - GET /:id/download: nega (404) bytes de anexo cujo pai (deal) está fora do escopo
 *    de visibilidade do usuário; entrega quando dentro.
 *  - GET /: filtra por visibilidade e inclui o autor (uploadedBy) no DTO.
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

// storageService: get/remove mockados (sem bytes reais).
const storageMock = vi.hoisted(() => ({
  get: vi.fn(),
  remove: vi.fn(),
  usage: vi.fn(),
  put: vi.fn(),
}));
vi.mock('../../services/storageService.js', () => ({ storageService: storageMock }));

// permissionService: `can` (usado por requirePermission) + `visibilityScope`
// controlados. `requirePermission` chama `can`, que fecha sobre o getEffective
// interno do módulo — então mockamos `can` diretamente (não só getEffective).
const { canMock, visibilityScopeMock } = vi.hoisted(() => ({
  canMock: vi.fn(),
  visibilityScopeMock: vi.fn(),
}));
vi.mock('../../services/permissionService.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, can: canMock, visibilityScope: visibilityScopeMock };
});

// authenticate/tenantScope pass-through; requirePermission permanece REAL.
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
import attachmentsRouter from '../../routes/attachments.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function makeApp(user: { userId: string; tenantId: string; role: string }) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = user as never;
    next();
  });
  app.use('/attachments', attachmentsRouter);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  });
  return app;
}

const USER = { userId: 'u1', tenantId: 't1', role: 'USER' };

beforeEach(() => {
  mockReset(prismaMock);
  canMock.mockReset();
  visibilityScopeMock.mockReset();
  storageMock.get.mockReset();
  storageMock.remove.mockReset();
  // Default: capability concedida (builtin de hoje) → gate passa.
  canMock.mockResolvedValue(true);
  // GERAL por padrão → sem filtro por dono (undefined).
  visibilityScopeMock.mockResolvedValue(undefined);
});

// ── DELETE — gate de permissão (req 22 + P1) ───────────────────────────────────

describe('DELETE /attachments/:id — gate deleteRecords', () => {
  it('deleteRecords=false (perfil custom) → 403 (não remove)', async () => {
    canMock.mockResolvedValue(false); // capability desligada por perfil custom
    const app = makeApp(USER);
    const res = await request(app).delete('/attachments/a1');
    expect(res.status).toBe(403);
    expect(storageMock.remove).not.toHaveBeenCalled();
  });

  it('builtin (deleteRecords=true, default) → 200 (soft-delete)', async () => {
    prismaMock.attachment.findFirst.mockResolvedValue({
      id: 'a1',
      dealId: null,
      companyId: null,
    } as never);
    storageMock.remove.mockResolvedValue(undefined);
    const app = makeApp(USER);
    const res = await request(app).delete('/attachments/a1');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ deleted: true });
    expect(storageMock.remove).toHaveBeenCalledWith('t1', 'a1');
  });
});

// ── GET /:id/download — visibilidade do pai (req 22) ───────────────────────────

describe('GET /attachments/:id/download — visibilidade P1', () => {
  it('nega (404) bytes de anexo cujo deal está fora do escopo', async () => {
    prismaMock.attachment.findFirst.mockResolvedValue({
      id: 'a1',
      mimeType: 'application/pdf',
      name: 'x.pdf',
      dealId: 'd-secret',
      companyId: null,
      storageProvider: 'db',
      storageKey: 'b1',
      deletedAt: null,
    } as never);
    // Escopo PROPRIA (userId) → o deal do anexo NÃO é do usuário.
    visibilityScopeMock.mockResolvedValue('u1');
    prismaMock.deal.findFirst.mockResolvedValue(null as never); // deal não visível

    const app = makeApp(USER);
    const res = await request(app).get('/attachments/a1/download');

    expect(res.status).toBe(404);
    expect(storageMock.get).not.toHaveBeenCalled();
  });

  it('entrega os bytes quando o deal está no escopo', async () => {
    prismaMock.attachment.findFirst.mockResolvedValue({
      id: 'a1',
      mimeType: 'text/plain',
      name: 'ok.txt',
      dealId: 'd1',
      companyId: null,
      storageProvider: 'db',
      storageKey: 'b1',
      deletedAt: null,
    } as never);
    visibilityScopeMock.mockResolvedValue('u1');
    prismaMock.deal.findFirst.mockResolvedValue({ id: 'd1' } as never); // visível
    storageMock.get.mockResolvedValue(Buffer.from('conteudo'));

    const app = makeApp(USER);
    const res = await request(app).get('/attachments/a1/download');

    expect(res.status).toBe(200);
    expect(storageMock.get).toHaveBeenCalled();
    expect(res.headers['content-disposition']).toContain('attachment;');
  });
});

// ── GET / — visibilidade + autor no DTO (req 22) ───────────────────────────────

describe('GET /attachments — visibilidade + autor', () => {
  it('filtra anexos fora do escopo e inclui uploadedBy no DTO', async () => {
    prismaMock.attachment.findMany.mockResolvedValue([
      { id: 'a1', tenantId: 't1', name: 'meu.pdf', mimeType: 'application/pdf', size: 1, storageProvider: 'db', dealId: 'd1', companyId: null, source: 'UPLOAD', uploadedById: 'u1', createdAt: new Date() },
      { id: 'a2', tenantId: 't1', name: 'alheio.pdf', mimeType: 'application/pdf', size: 1, storageProvider: 'db', dealId: 'd2', companyId: null, source: 'UPLOAD', uploadedById: 'u9', createdAt: new Date() },
    ] as never);
    // Escopo PROPRIA: d1 é do usuário (visível), d2 não.
    visibilityScopeMock.mockResolvedValue('u1');
    (prismaMock.deal.findFirst as unknown as { mockImplementation: (fn: (args: any) => unknown) => void })
      .mockImplementation((args: any) =>
        Promise.resolve(args?.where?.id === 'd1' ? { id: 'd1' } : null)
      );
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Ana' }] as never);

    const app = makeApp(USER);
    const res = await request(app).get('/attachments');

    expect(res.status).toBe(200);
    const data = res.body.data as Array<{ id: string; uploadedBy: { name: string } | null }>;
    // Só o anexo do deal visível.
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('a1');
    expect(data[0].uploadedBy).toMatchObject({ id: 'u1', name: 'Ana' });
  });
});
