// VYD ID G.33 / Onda 4 — webhook de propagação vindo do dispatcher do IdP.
//
// Montado em /auth/ban-sync, FORA do CSRF e sem `authenticate`: quem chama é
// o dispatcher do id.vydhub.com (integração servidor-a-servidor), não um
// usuário logado. A autenticidade vem só da assinatura HMAC sobre o corpo
// CRU — mesmo padrão do webhook de billing.
//
// Contrato (idêntico nos 14 spokes — não mudar sem mudar o dispatcher):
//   POST { email, action: "ban"|"unban"|"logout", ts: ISO8601, nonce }
//   header  x-vyd-ban-signature: sha256=<hex do HMAC-SHA256 do corpo cru>
//   - `ts` dentro de 5 min (relógio/replay)
//   - `nonce` não pode ter sido visto (tabela vyd_ban_nonces)
//   - casa por e-mail e NUNCA cria usuário; sem conta local o ban ainda é
//     gravado no espelho `vyd_bans`, que o exchange do SSO consulta antes de
//     casar — é isso que impede o primeiro login de quem foi banido antes de
//     entrar aqui pela primeira vez.
//
// Os três verbos, e por que fazem coisas diferentes:
//   ban    → status INACTIVE + espelho + derruba as sessões (não volta mais)
//   unban  → limpa status e espelho (volta a poder entrar)
//   logout → SÓ derruba as sessões. Não toca status nem espelho: é
//            "saia agora", não "não volte mais" — o usuário pode reentrar
//            pelo VYD ID no segundo seguinte.
import crypto from 'crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { disconnectUser } from '../services/socketService.js';
import { logger } from '../utils/logger.js';

const router = Router();

const JANELA_SEGUNDOS = 5 * 60;
const HEADER_ASSINATURA = 'x-vyd-ban-signature';
const PREFIXO = 'sha256=';
const MOTIVO_BAN = 'vyd-id g33';

const payloadSchema = z.object({
  email: z.string().email(),
  action: z.enum(['ban', 'unban', 'logout']),
  ts: z.string().min(1),
  nonce: z.string().min(1),
});

/** Compara em tempo constante, tolerando comprimentos diferentes. */
function assinaturaConfere(segredo: string, corpoCru: string, recebida: string): boolean {
  const esperada = crypto.createHmac('sha256', segredo).update(corpoCru).digest('hex');
  const a = Buffer.from(esperada, 'hex');
  const b = Buffer.from(recebida, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Derruba as sessões do usuário: apaga os refresh tokens (mesma coisa que o
 * /auth/logout-all faz) e carimba a marca d'água, para o access token de 15min
 * que já estava em voo morrer junto em vez de esperar expirar.
 *
 * Ponto único dos verbos `ban` e `logout` — é por isso que a derrubada do tempo
 * real mora aqui e não nos dois ramos separadamente.
 */
async function derrubarSessoes(userId: string, agora: Date): Promise<void> {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { tokensValidAfter: agora } }),
  ]);
  // A marca d'água acima só é lida em handshake/requisição NOVA. Um socket já
  // aberto autentica uma única vez e viveria indefinidamente, então sem esta
  // linha a aba que o usuário já tem aberta seguiria recebendo eventos do
  // tenant depois de banido ou deslogado.
  disconnectUser(userId);
}

router.post('/', async (req, res, next) => {
  try {
    const segredo = process.env.VYD_BAN_HMAC_SECRET;
    if (!segredo) {
      return next(
        createError('Ban sync não está configurado neste servidor', 503, 'BAN_SYNC_NOT_CONFIGURED')
      );
    }

    // O corpo CRU é o que foi assinado — reserializar o JSON já parseado
    // mudaria espaços/ordem e quebraria a assinatura. O `express.json` global
    // já guarda os bytes exatos em `req.rawBody` (posto lá para o HMAC do
    // ZapSign), então não é preciso um parser próprio nesta rota.
    const corpoCru = (req as express.Request & { rawBody?: string }).rawBody ?? '';
    if (!corpoCru) {
      return next(createError('Corpo ausente ou ilegível', 400, 'BAN_SYNC_BAD_BODY'));
    }

    const header = req.get(HEADER_ASSINATURA) ?? '';
    if (!header.startsWith(PREFIXO) || !assinaturaConfere(segredo, corpoCru, header.slice(PREFIXO.length))) {
      return next(createError('Assinatura ausente ou inválida', 401, 'BAN_SYNC_BAD_SIGNATURE'));
    }

    let bruto: unknown;
    try {
      bruto = JSON.parse(corpoCru);
    } catch {
      return next(createError('JSON malformado', 400, 'BAN_SYNC_BAD_JSON'));
    }

    const parsed = payloadSchema.safeParse(bruto);
    if (!parsed.success) {
      return next(
        createError('Payload inválido', 400, 'BAN_SYNC_BAD_PAYLOAD', parsed.error.errors)
      );
    }
    const { email: emailBruto, action, ts, nonce } = parsed.data;

    const quando = new Date(ts);
    if (Number.isNaN(quando.getTime())) {
      return next(createError("'ts' não é uma data ISO-8601", 400, 'BAN_SYNC_BAD_TS'));
    }
    const agora = new Date();
    if (Math.abs(agora.getTime() - quando.getTime()) / 1000 > JANELA_SEGUNDOS) {
      return next(createError('Timestamp fora da janela permitida', 401, 'BAN_SYNC_STALE_TS'));
    }

    // Anti-replay: o create falha na PK se o nonce já foi visto. Usar o
    // próprio INSERT como trava (em vez de checar-depois-inserir) fecha o
    // TOCTOU entre duas entregas concorrentes.
    try {
      await prisma.vydBanNonce.create({ data: { nonce, seenAt: agora } });
    } catch {
      return next(createError('Requisição repetida', 401, 'BAN_SYNC_REPLAY'));
    }

    const email = emailBruto.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    const found = user !== null;

    if (action === 'logout') {
      // Sem espelho e sem status: só as sessões.
      if (user) await derrubarSessoes(user.id, agora);
    } else if (action === 'ban') {
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { status: 'INACTIVE' },
        });
        await derrubarSessoes(user.id, agora);
      }
      // Espelho SEMPRE, mesmo sem conta local — é o que barra o primeiro SSO.
      await prisma.vydBan.upsert({
        where: { email },
        create: { email, bannedAt: agora, reason: MOTIVO_BAN },
        update: { bannedAt: agora, reason: MOTIVO_BAN },
      });
    } else {
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
      }
      await prisma.vydBan.deleteMany({ where: { email } });
    }

    logger.info('ban-sync aplicado', { action, email, found });
    res.json({ ok: true, found, applied: action });
  } catch (error) {
    next(error);
  }
});

export default router;
