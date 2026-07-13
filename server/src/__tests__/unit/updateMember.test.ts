import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Edição de membro por ADMIN/GESTOR — PUT /users/:id (nome + e-mail).
 * Prova: nome=e-mail → 400; e-mail duplicado → 409; não-ADMIN não altera e-mail;
 * ADMIN altera nome+e-mail livres → 200.
 *
 * Header de teste "x-actor: <role>|<tenantId>|<userId>" injeta o req.user.
 */
vi.mock('../../config/database.js', () => ({ __esModule: true, default: mockDeep<PrismaClient>() }));

vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const [role, tenantId, userId] = String(req.headers['x-actor'] || 'ADMIN|t1|admin-1').split('|');
    (req as unknown as { user: unknown }).user = { role, tenantId, userId };
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: Request, res: Response, next: NextFunction) => {
      const role = (req as unknown as { user?: { role?: string } }).user?.role;
      if (!role || !roles.includes(role)) return res.status(403).json({ error: 'forbidden' });
      next();
    },
}));
vi.mock('../../middleware/tenant.js', () => ({
  tenantScope: (_req: Request, _res: Response, next: NextFunction) => next(),
  requireTenantAccess: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import prisma from '../../config/database.js';
import usersRouter from '../../routes/users.js';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function app() {
  const a = express();
  a.use(express.json());
  a.use('/users', usersRouter);
  a.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  });
  return a;
}

const target = { id: 'u9', tenantId: 't1', email: 'antigo@k2.com', name: 'Antigo' };

beforeEach(() => {
  mockReset(prismaMock);
  prismaMock.user.findFirst.mockResolvedValue(target as never);
  prismaMock.user.update.mockResolvedValue({ id: 'u9', email: 'antigo@k2.com', name: 'Novo Nome' } as never);
});

describe('PUT /users/:id — edição de nome/e-mail', () => {
  it('rejeita nome = e-mail (400 VALIDATION_ERROR)', async () => {
    const res = await request(app()).put('/users/u9').set('x-actor', 'ADMIN|t1|a1').send({ name: 'fulano@x.com' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('ADMIN: e-mail já usado por outro → 409 EMAIL_TAKEN', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'outro' } as never);
    const res = await request(app()).put('/users/u9').set('x-actor', 'ADMIN|t1|a1').send({ email: 'ocupado@x.com' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('GESTOR: e-mail é IGNORADO (só ADMIN altera), nome aplicado', async () => {
    const res = await request(app()).put('/users/u9').set('x-actor', 'GESTOR|t1|g1').send({ name: 'Novo Nome', email: 'tentativa@x.com' });
    expect(res.status).toBe(200);
    const data = (prismaMock.user.update.mock.calls as any)[0][0].data as Record<string, unknown>;
    expect(data.name).toBe('Novo Nome');
    expect(data.email).toBeUndefined();
  });

  it('ADMIN: nome + e-mail livres → 200 e ambos aplicados', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null as never);
    const res = await request(app()).put('/users/u9').set('x-actor', 'ADMIN|t1|a1').send({ name: 'Leandro Hara', email: 'leandro@k2.com' });
    expect(res.status).toBe(200);
    const data = (prismaMock.user.update.mock.calls as any)[0][0].data as Record<string, unknown>;
    expect(data.name).toBe('Leandro Hara');
    expect(data.email).toBe('leandro@k2.com');
  });
});
