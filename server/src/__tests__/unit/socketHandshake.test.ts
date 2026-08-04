import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Handshake do Socket.IO — as duas guardas do canal de tempo real.
 *
 * Contexto: o io é atado ao httpServer CRU (index.ts liga o socket antes dos
 * middlewares do Express), então o handshake não passa por cors(), helmet,
 * cookieParser nem apiLimiter. Tudo que vale como controle de acesso do tempo
 * real está em socketService.ts — e é por isso que ele precisa de teste próprio.
 *
 * As duas coisas que esta suite existe para não deixar regredir:
 *
 * 1. ORIGEM. O `cors` do io não REJEITA origem estranha, só omite o header
 *    Access-Control-Allow-Origin — e WebSocket não é submetido à same origin
 *    policy. Com o cookie sendo SameSite=None em produção (utils/cookies.ts),
 *    sem a checagem de origem qualquer site abriria um WebSocket para cá com o
 *    cookie do usuário e entraria na sala do tenant (Cross-Site WebSocket
 *    Hijacking).
 *
 * 2. REVOGAÇÃO. Antes daqui o handshake só conferia a assinatura do JWT, o que
 *    deixava o tempo real mais fraco que o HTTP: usuário apagado, inativo
 *    (banido pelo G.33) ou deslogado globalmente (marca `tokensValidAfter` da
 *    Onda 4) seguia conectado e recebendo eventos do tenant.
 */

const SEGREDO = 'segredo-de-teste-do-socket';
process.env.JWT_SECRET = SEGREDO;

vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

const PERMITIDAS = ['https://engage.vydhub.com'];

async function carregar() {
  return import('../../services/socketService.js');
}

async function prismaMock(): Promise<DeepMockProxy<PrismaClient>> {
  const mod = await import('../../config/database.js');
  return mod.default as unknown as DeepMockProxy<PrismaClient>;
}

async function loggerMock() {
  const mod = await import('../../utils/logger.js');
  return mod.logger as unknown as { warn: ReturnType<typeof vi.fn> };
}

/** Motivo registrado na última chamada de logger.warn('Handshake recusado', …). */
async function ultimoMotivo(): Promise<string | undefined> {
  const { warn } = await loggerMock();
  const chamada = warn.mock.calls.filter((c) => c[0] === 'Handshake recusado').at(-1);
  return (chamada?.[1] as { motivo?: string } | undefined)?.motivo;
}

/** Token assinado agora — `iat` é o piso do segundo corrente. */
function tokenDe(over: Record<string, unknown> = {}, segredo = SEGREDO): string {
  return jwt.sign(
    { userId: 'u1', tenantId: 't1', email: 'a@example.com', role: 'USER', ...over },
    segredo,
    { expiresIn: '15m' }
  );
}

function usuario(over: Record<string, unknown> = {}) {
  return { id: 'u1', status: 'ACTIVE', tenantId: 't1', tokensValidAfter: null, ...over };
}

describe('origemPermitida', () => {
  it('aceita origem da allowlist', async () => {
    const { origemPermitida } = await carregar();
    expect(origemPermitida('https://engage.vydhub.com', PERMITIDAS)).toBe(true);
  });

  it('RECUSA origem de fora — é a defesa contra Cross-Site WebSocket Hijacking', async () => {
    const { origemPermitida } = await carregar();
    expect(origemPermitida('https://site-malicioso.com', PERMITIDAS)).toBe(false);
  });

  it('recusa a origem "null" de iframe sandboxed', async () => {
    const { origemPermitida } = await carregar();
    expect(origemPermitida('null', PERMITIDAS)).toBe(false);
  });

  it('ACEITA requisição sem header Origin — não inverta isto "para endurecer"', async () => {
    // O handshake é same-origin (o /socket.io é proxiado pelo rewrite do
    // vercel.json) e navegadores NÃO mandam Origin em GET same-origin. Exigir o
    // header derrubaria o transporte polling de todos os usuários legítimos.
    // É seguro porque o ataque exige um navegador, e navegador sempre manda
    // Origin em cross-origin E em todo handshake WebSocket.
    const { origemPermitida } = await carregar();
    expect(origemPermitida(undefined, PERMITIDAS)).toBe(true);
  });

  it('fail-closed: sem allowlist configurada, ninguém entra', async () => {
    const { origemPermitida } = await carregar();
    expect(origemPermitida('https://engage.vydhub.com', false)).toBe(false);
    expect(origemPermitida(undefined, false)).toBe(false);
  });
});

describe('autenticarHandshake', () => {
  beforeEach(async () => {
    mockReset(await prismaMock());
  });

  it('sem token, recusa', async () => {
    const { autenticarHandshake } = await carregar();
    expect(await autenticarHandshake(undefined)).toBeNull();
  });

  it('assinatura de outro segredo, recusa', async () => {
    const { autenticarHandshake } = await carregar();
    expect(await autenticarHandshake(tokenDe({}, 'outro-segredo'))).toBeNull();
  });

  it('usuário ativo conecta', async () => {
    const prisma = await prismaMock();
    prisma.user.findUnique.mockResolvedValue(usuario() as never);
    const { autenticarHandshake } = await carregar();
    expect(await autenticarHandshake(tokenDe())).toEqual({ userId: 'u1', tenantId: 't1' });
  });

  it('usuário apagado do banco, recusa', async () => {
    const prisma = await prismaMock();
    prisma.user.findUnique.mockResolvedValue(null as never);
    const { autenticarHandshake } = await carregar();
    expect(await autenticarHandshake(tokenDe())).toBeNull();
  });

  it('usuário INACTIVE (banido pelo G.33), recusa', async () => {
    const prisma = await prismaMock();
    prisma.user.findUnique.mockResolvedValue(usuario({ status: 'INACTIVE' }) as never);
    const { autenticarHandshake } = await carregar();
    expect(await autenticarHandshake(tokenDe())).toBeNull();
  });

  it('token anterior ao logout global da Onda 4, recusa', async () => {
    const prisma = await prismaMock();
    // Marca no futuro em relação ao `iat` do token => token nasceu antes do logout.
    prisma.user.findUnique.mockResolvedValue(
      usuario({ tokensValidAfter: new Date(Date.now() + 60_000) }) as never
    );
    const { autenticarHandshake } = await carregar();
    expect(await autenticarHandshake(tokenDe())).toBeNull();
  });

  it('token posterior ao logout global, conecta', async () => {
    const prisma = await prismaMock();
    prisma.user.findUnique.mockResolvedValue(
      usuario({ tokensValidAfter: new Date(Date.now() - 60_000) }) as never
    );
    const { autenticarHandshake } = await carregar();
    expect(await autenticarHandshake(tokenDe())).toEqual({ userId: 'u1', tenantId: 't1' });
  });

  it('o tenant vem do BANCO, não do token', async () => {
    // Se o usuário mudou de tenant, o token antigo não pode servir de passe
    // para a sala antiga — senão ele continuaria ouvindo o tenant anterior.
    const prisma = await prismaMock();
    prisma.user.findUnique.mockResolvedValue(usuario({ tenantId: 'tenant-novo' }) as never);
    const { autenticarHandshake } = await carregar();
    expect(await autenticarHandshake(tokenDe({ tenantId: 'tenant-antigo' }))).toEqual({
      userId: 'u1',
      tenantId: 'tenant-novo',
    });
  });

  it('banco fora do ar, recusa (fail-closed)', async () => {
    const prisma = await prismaMock();
    prisma.user.findUnique.mockRejectedValue(new Error('P1001') as never);
    const { autenticarHandshake } = await carregar();
    expect(await autenticarHandshake(tokenDe())).toBeNull();
  });
});

/**
 * A primeira versão disto só logava no `catch`, então recusa por falta de
 * cookie, conta inativa ou marca d'água saía SEM RASTRO — um socket barrado por
 * ban ficava invisível no log, que é justamente quando alguém vai perguntar
 * "por que fulano não recebe notificação". Cada motivo tem que aparecer.
 */
describe('autenticarHandshake — toda recusa deixa rastro', () => {
  beforeEach(async () => {
    mockReset(await prismaMock());
    (await loggerMock()).warn.mockClear();
  });

  it('sem token → motivo sem_token', async () => {
    const { autenticarHandshake } = await carregar();
    await autenticarHandshake(undefined);
    expect(await ultimoMotivo()).toBe('sem_token');
  });

  it('usuário apagado → motivo usuario_inexistente', async () => {
    (await prismaMock()).user.findUnique.mockResolvedValue(null as never);
    const { autenticarHandshake } = await carregar();
    await autenticarHandshake(tokenDe());
    expect(await ultimoMotivo()).toBe('usuario_inexistente');
  });

  it('banido pelo G.33 → motivo usuario_inativo', async () => {
    (await prismaMock()).user.findUnique.mockResolvedValue(
      usuario({ status: 'INACTIVE' }) as never
    );
    const { autenticarHandshake } = await carregar();
    await autenticarHandshake(tokenDe());
    expect(await ultimoMotivo()).toBe('usuario_inativo');
  });

  it('logout global da Onda 4 → motivo sessao_encerrada', async () => {
    (await prismaMock()).user.findUnique.mockResolvedValue(
      usuario({ tokensValidAfter: new Date(Date.now() + 60_000) }) as never
    );
    const { autenticarHandshake } = await carregar();
    await autenticarHandshake(tokenDe());
    expect(await ultimoMotivo()).toBe('sessao_encerrada');
  });

  it('conexão bem-sucedida NÃO loga recusa', async () => {
    (await prismaMock()).user.findUnique.mockResolvedValue(usuario() as never);
    const { autenticarHandshake } = await carregar();
    await autenticarHandshake(tokenDe());
    expect(await ultimoMotivo()).toBeUndefined();
  });
});
