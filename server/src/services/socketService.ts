import { Server as HttpServer } from 'http';
import type { IncomingMessage } from 'http';
import { Server, Socket } from 'socket.io';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- @ts-ignore (não @ts-expect-error): `cookie` não tem declaração de tipos no CI (sem @types/cookie), mas resolve localmente
// @ts-ignore
import cookie from 'cookie';
import prisma from '../config/database.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

let io: Server | null = null;

/**
 * O handshake do Socket.IO é atendido pelo httpServer cru (index.ts liga o io
 * ANTES dos middlewares do Express), então ele não passa por cors(), helmet,
 * cookieParser nem apiLimiter. Tudo que vale como controle de acesso do canal
 * de tempo real precisa estar NESTE arquivo.
 */

/**
 * Origem permitida no handshake — defesa contra Cross-Site WebSocket Hijacking.
 *
 * Por que isto é obrigatório e o `cors` do io não basta: o pacote `cors` com
 * `origin` em array não REJEITA origem estranha, apenas omite o header
 * Access-Control-Allow-Origin. Para XHR o navegador barra a leitura da resposta
 * e o efeito é equivalente a rejeitar — mas WebSocket NÃO é submetido à same
 * origin policy, então o handshake completa e o header ausente não impede nada.
 * Somando a isso o cookie `accessToken` ser SameSite=None em produção
 * (utils/cookies.ts), qualquer site conseguiria abrir um WebSocket para cá com
 * o cookie do usuário e entrar na sala `tenant:*`, recebendo todo lead, deal e
 * task do tenant em tempo real.
 *
 * REGRA, e ela é sutil: se o header `Origin` VEIO, ele tem que estar na
 * allowlist; se NÃO veio, passa. Não inverta isso "para endurecer" — hoje o
 * handshake é same-origin (o /socket.io é proxiado pelo rewrite do vercel.json)
 * e navegadores NÃO enviam `Origin` em GET same-origin, então exigir o header
 * derrubaria o transporte polling de todos os usuários legítimos. A ausência do
 * header é segura porque o ataque exige um navegador, e navegador sempre envia
 * `Origin` em requisição cross-origin E em todo handshake WebSocket.
 */
export function origemPermitida(
  origem: string | undefined,
  corsOrigins: string[] | false
): boolean {
  // Mesmo fail-closed do getAllowedOrigins() do index.ts: sem allowlist
  // configurada em produção, ninguém entra.
  if (corsOrigins === false) return false;
  if (!origem) return true;
  return corsOrigins.includes(origem);
}

function criarChecagemDeOrigem(corsOrigins: string[] | false) {
  return (req: IncomingMessage, aceitar: (erro: string | null, ok: boolean) => void): void => {
    const origem = req.headers.origin;
    if (!origemPermitida(origem, corsOrigins)) {
      logger.warn('Handshake recusado: origem não permitida', { origem });
      return aceitar('origin_not_allowed', false);
    }
    aceitar(null, true);
  };
}

/**
 * Valida o token do handshake com o MESMO rigor de middleware/auth.ts.
 *
 * Antes, aqui só se conferia a ASSINATURA do JWT, o que deixava o tempo real
 * mais fraco que o HTTP em três pontos — usuário apagado, usuário inativo e, o
 * mais grave, o carimbo `tokensValidAfter` do logout global (Onda 4). Sem a
 * checagem abaixo, "Sair de todas as ferramentas" no VYD ID não derrubaria
 * este canal e o usuário seguiria recebendo eventos do tenant.
 *
 * Devolve null em qualquer recusa — o chamador não deve distinguir os motivos
 * para o cliente.
 */
export async function autenticarHandshake(
  token: string | undefined
): Promise<{ userId: string; tenantId: string } | null> {
  if (!token) return null;

  try {
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, status: true, tenantId: true, tokensValidAfter: true },
    });

    if (!user) return null;
    if (user.status !== 'ACTIVE') return null;

    // Mesma comparação de middleware/auth.ts: `iat` é epoch inteiro (piso do
    // segundo) e a marca tem milissegundos; estrita, para que o empate dentro
    // do mesmo segundo derrube o token — o lado seguro do erro.
    const iatSegundos = (payload as { iat?: number }).iat;
    if (
      user.tokensValidAfter &&
      typeof iatSegundos === 'number' &&
      iatSegundos < Math.floor(user.tokensValidAfter.getTime() / 1000) + 1
    ) {
      return null;
    }

    // tenantId vem do BANCO, não do token: se o usuário mudou de tenant, o
    // token antigo não pode seguir valendo como passe para a sala antiga.
    return { userId: user.id, tenantId: user.tenantId };
  } catch (erro) {
    // Assinatura inválida, token expirado ou banco fora: fail-closed.
    logger.warn('Handshake recusado', {
      motivo: erro instanceof Error ? erro.message : 'desconhecido',
    });
    return null;
  }
}

/**
 * Initialize Socket.IO server attached to the HTTP server.
 */
export function initSocketIO(httpServer: HttpServer, corsOrigins: string[] | false): Server {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
    // Aceita os DOIS transportes de propósito. O bundle antigo pede websocket
    // primeiro e o novo pede polling primeiro (src/hooks/useSocket.ts); enquanto
    // houver aba com bundle antigo em circulação, tirar qualquer um dos dois
    // quebra uma das gerações.
    transports: ['websocket', 'polling'],
    allowRequest: criarChecagemDeOrigem(corsOrigins),
  });

  io.use((socket, next) => {
    void (async () => {
      // Token do handshake (clientes não-navegador) ou do cookie httpOnly.
      let token = socket.handshake.auth?.token;
      if (!token) {
        const cookies = cookie.parse(socket.handshake.headers?.cookie || '');
        token = cookies.accessToken;
      }

      const identidade = await autenticarHandshake(token);
      if (!identidade) {
        return next(new Error('Authentication required'));
      }

      (socket as any).userId = identidade.userId;
      (socket as any).tenantId = identidade.tenantId;
      next();
    })();
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    const tenantId = (socket as any).tenantId;

    // Join user-specific and tenant-specific rooms
    socket.join(`user:${userId}`);
    socket.join(`tenant:${tenantId}`);

    logger.info('WebSocket connected', { userId, tenantId, socketId: socket.id });

    socket.on('disconnect', () => {
      logger.info('WebSocket disconnected', { userId, socketId: socket.id });
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO instance (for emitting events from services).
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Derruba TODAS as conexões de tempo real de um usuário, agora.
 *
 * A checagem do handshake só barra conexão NOVA. Um socket já aberto autentica
 * uma única vez e vive indefinidamente — sem isto, banir ou deslogar alguém
 * pelo VYD ID deixaria a aba que ele já tem aberta recebendo eventos do tenant
 * para sempre. Chamado por routes/banSync.ts nos verbos `ban` e `logout`.
 */
export function disconnectUser(userId: string): void {
  if (!io) return;
  io.in(`user:${userId}`).disconnectSockets(true);
  logger.info('Sockets do usuário derrubados', { userId });
}

/**
 * Emit a notification to a specific user.
 */
export function emitToUser(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Emit an event to all users in a tenant.
 */
export function emitToTenant(tenantId: string, event: string, data: any) {
  if (!io) return;
  io.to(`tenant:${tenantId}`).emit(event, data);
}
