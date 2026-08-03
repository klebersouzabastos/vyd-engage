import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import express from 'express';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * VYD ID G.33 / Onda 4 — webhook POST /auth/ban-sync.
 *
 * Prova no boundary HTTP (mini-app Express, DB mockado) o contrato que os
 * outros 13 spokes já cumprem: HMAC sobre o corpo CRU, janela de tempo,
 * anti-replay por nonce, e os TRÊS verbos fazendo coisas diferentes.
 *
 * O caso que mais importa é `ban` de e-mail SEM conta local: é o único que
 * impede o primeiro SSO de quem foi banido antes de entrar aqui. Se ele
 * quebrar, o ban vira no-op silencioso — foi exatamente o bug que o Finance
 * teve em 18/07 e que esta suite existe para não deixar repetir.
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

const SEGREDO = 'segredo-de-teste-do-ban-sync';

function assinar(corpo: string, segredo = SEGREDO): string {
  return 'sha256=' + crypto.createHmac('sha256', segredo).update(corpo).digest('hex');
}

function corpoDe(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    email: 'alvo@example.com',
    action: 'ban',
    ts: new Date().toISOString(),
    nonce: crypto.randomUUID(),
    ...over,
  });
}

async function montarApp() {
  const { default: banSyncRoutes } = await import('../../routes/banSync.js');
  const { errorHandler } = await import('../../middleware/errorHandler.js');
  const app = express();
  // Espelha o index.ts: o express.json global guarda os bytes CRUS em rawBody,
  // que e o que a assinatura cobre.
  app.use(
    express.json({
      verify: (req: express.Request & { rawBody?: string }, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );
  app.use('/auth/ban-sync', banSyncRoutes);
  app.use(errorHandler);
  return app;
}

describe('POST /auth/ban-sync', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let app: express.Express;

  beforeEach(async () => {
    const mod = await import('../../config/database.js');
    prisma = mod.default as unknown as DeepMockProxy<PrismaClient>;
    mockReset(prisma);
    process.env.VYD_BAN_HMAC_SECRET = SEGREDO;
    app = await montarApp();

    // Nonce inédito por padrão; os testes que exercitam replay sobrescrevem.
    prisma.vydBanNonce.create.mockResolvedValue({} as never);
    prisma.user.findUnique.mockResolvedValue(null as never);
    prisma.vydBan.upsert.mockResolvedValue({} as never);
    prisma.vydBan.deleteMany.mockResolvedValue({ count: 0 } as never);
    prisma.$transaction.mockResolvedValue([] as never);
  });

  // ---- autenticidade -------------------------------------------------------

  it('sem segredo configurado responde 503', async () => {
    delete process.env.VYD_BAN_HMAC_SECRET;
    const corpo = corpoDe();
    const r = await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .set('x-vyd-ban-signature', assinar(corpo))
      .send(corpo);
    expect(r.status).toBe(503);
  });

  it('sem header de assinatura responde 401', async () => {
    const corpo = corpoDe();
    const r = await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .send(corpo);
    expect(r.status).toBe(401);
  });

  it('assinatura de outro segredo responde 401', async () => {
    const corpo = corpoDe();
    const r = await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .set('x-vyd-ban-signature', assinar(corpo, 'segredo-errado'))
      .send(corpo);
    expect(r.status).toBe(401);
  });

  it('corpo adulterado depois de assinado responde 401', async () => {
    const original = corpoDe({ email: 'original@example.com' });
    const assinatura = assinar(original);
    const adulterado = corpoDe({ email: 'outro@example.com' });
    const r = await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .set('x-vyd-ban-signature', assinatura)
      .send(adulterado);
    expect(r.status).toBe(401);
  });

  it('ts fora da janela de 5min responde 401', async () => {
    const corpo = corpoDe({ ts: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
    const r = await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .set('x-vyd-ban-signature', assinar(corpo))
      .send(corpo);
    expect(r.status).toBe(401);
  });

  it('nonce repetido responde 401 (anti-replay)', async () => {
    prisma.vydBanNonce.create.mockRejectedValue(new Error('unique violation') as never);
    const corpo = corpoDe();
    const r = await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .set('x-vyd-ban-signature', assinar(corpo))
      .send(corpo);
    expect(r.status).toBe(401);
  });

  it('action fora do contrato responde 400', async () => {
    const corpo = corpoDe({ action: 'explodir' });
    const r = await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .set('x-vyd-ban-signature', assinar(corpo))
      .send(corpo);
    expect(r.status).toBe(400);
  });

  // ---- os tres verbos ------------------------------------------------------

  it('ban de e-mail SEM conta local grava o espelho mesmo assim', async () => {
    prisma.user.findUnique.mockResolvedValue(null as never);
    const corpo = corpoDe({ action: 'ban', email: 'nunca-entrou@example.com' });

    const r = await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .set('x-vyd-ban-signature', assinar(corpo))
      .send(corpo);

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, found: false, applied: 'ban' });
    // O espelho e o que barra o PRIMEIRO SSO dessa pessoa.
    expect(prisma.vydBan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'nunca-entrou@example.com' } })
    );
  });

  it('ban de quem existe desativa a conta E grava o espelho', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'alvo@example.com' } as never);
    prisma.user.update.mockResolvedValue({} as never);
    const corpo = corpoDe({ action: 'ban' });

    const r = await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .set('x-vyd-ban-signature', assinar(corpo))
      .send(corpo);

    expect(r.status).toBe(200);
    expect(r.body.found).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'INACTIVE' } })
    );
    expect(prisma.vydBan.upsert).toHaveBeenCalled();
    // E derruba as sessoes (transacao: deleta refresh + carimba a marca).
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('unban reativa a conta e limpa o espelho', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'alvo@example.com' } as never);
    prisma.user.update.mockResolvedValue({} as never);
    const corpo = corpoDe({ action: 'unban' });

    const r = await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .set('x-vyd-ban-signature', assinar(corpo))
      .send(corpo);

    expect(r.status).toBe(200);
    expect(r.body.applied).toBe('unban');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE' } })
    );
    expect(prisma.vydBan.deleteMany).toHaveBeenCalled();
  });

  it('logout derruba sessoes mas NAO bane', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'alvo@example.com' } as never);
    const corpo = corpoDe({ action: 'logout' });

    const r = await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .set('x-vyd-ban-signature', assinar(corpo))
      .send(corpo);

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, found: true, applied: 'logout' });
    // Sessoes caem...
    expect(prisma.$transaction).toHaveBeenCalled();
    // ...mas a diferenca com o ban: nenhum toque em `status` e nenhum espelho.
    // E "saia agora", nao "nao volte mais".
    //
    // `user.update` E chamado — dentro da transacao, para carimbar a marca
    // d'agua. O que nao pode e mudar o status; a assercao precisa ser sobre
    // ISSO, nao sobre a funcao ter sido invocada.
    const chamadas = (prisma.user.update as unknown as {
      mock: { calls: Array<[{ data?: Record<string, unknown> }]> };
    }).mock.calls;
    for (const [args] of chamadas) {
      expect(args?.data ?? {}).not.toHaveProperty('status');
    }
    expect(prisma.vydBan.upsert).not.toHaveBeenCalled();
  });

  it('logout de e-mail sem conta e no-op entregue', async () => {
    prisma.user.findUnique.mockResolvedValue(null as never);
    const corpo = corpoDe({ action: 'logout', email: 'fantasma@example.com' });

    const r = await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .set('x-vyd-ban-signature', assinar(corpo))
      .send(corpo);

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, found: false, applied: 'logout' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('normaliza o e-mail para minusculas antes de casar', async () => {
    prisma.user.findUnique.mockResolvedValue(null as never);
    const corpo = corpoDe({ action: 'ban', email: 'Maiuscula@Example.COM' });

    await request(app)
      .post('/auth/ban-sync')
      .set('Content-Type', 'application/json')
      .set('x-vyd-ban-signature', assinar(corpo))
      .send(corpo);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'maiuscula@example.com' },
    });
  });
});
