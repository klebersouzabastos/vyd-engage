/**
 * /phone — Telefone virtual, GATED (Upgrade RD P2, req 21).
 *
 *   POST /phone/token     → gera um Access Token do provedor (Twilio Voice) para
 *                           o webphone. Sem credencial → 400 PHONE_NOT_CONFIGURED.
 *   POST /phone/log-call  → registra o desfecho de uma ligação como Interaction
 *                           CALL OUTBOUND (leadId?/dealId?/companyId?, toNumber,
 *                           durationSec, recordingUrl?). NÃO exige credencial
 *                           (permite registro manual mesmo sem webphone).
 *
 * Sem credencial: `tel:`/`wa.me` seguem como hoje; o webphone fica oculto na UI.
 * Access Token do Twilio é um JWT HS256 (assinado com authToken, kid=apiKeySid
 * OU accountSid) com o claim `grants` — gerado sem o SDK (jsonwebtoken já é dep).
 */
import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { integrationService, type PhoneConfig } from '../services/integrationService.js';
import prisma from '../config/database.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const TOKEN_TTL_SEC = 3600;

/**
 * Constrói um Twilio Voice Access Token (JWT). Sem API Key/Secret dedicados,
 * usamos accountSid como issuer e authToken como chave de assinatura — suficiente
 * para o gating/plumbing; um deploy real trocaria por API Key SID/Secret.
 */
function buildTwilioAccessToken(config: PhoneConfig, identity: string): { token: string; expiresAt: string } {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_TTL_SEC;
  const payload: Record<string, unknown> = {
    jti: `${config.accountSid}-${now}`,
    grants: {
      identity,
      voice: {
        outgoing: config.twimlAppSid ? { application_sid: config.twimlAppSid } : undefined,
        incoming: { allow: true },
      },
    },
  };
  const token = jwt.sign(payload, config.authToken, {
    algorithm: 'HS256',
    issuer: config.accountSid,
    subject: config.accountSid,
    expiresIn: TOKEN_TTL_SEC,
    header: { cty: 'twilio-fpa;v=1', typ: 'JWT', alg: 'HS256' },
  });
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

// POST /phone/token — access token do provedor p/ o webphone.
router.post('/token', async (req, res, next) => {
  try {
    const config = await integrationService.getConfig<PhoneConfig>(req.user!.tenantId, 'PHONE');
    if (!config) {
      return next(createError('Telefonia não configurada para este tenant.', 400, 'PHONE_NOT_CONFIGURED'));
    }
    const identity = `user_${req.user!.userId}`;
    const { token, expiresAt } = buildTwilioAccessToken(config, identity);
    res.json({ status: 200, data: { token, identity, expiresAt } });
  } catch (error) {
    next(error);
  }
});

const logCallSchema = z
  .object({
    leadId: z.string().uuid().optional(),
    dealId: z.string().uuid().optional(),
    companyId: z.string().uuid().optional(),
    toNumber: z.string().min(1),
    durationSec: z.coerce.number().int().nonnegative(),
    recordingUrl: z.string().url().optional(),
  })
  .refine((d) => d.leadId || d.dealId || d.companyId, {
    message: 'Informe ao menos um vínculo (leadId, dealId ou companyId).',
    path: ['leadId'],
  });

// POST /phone/log-call — registra a ligação como Interaction CALL OUTBOUND.
router.post('/log-call', async (req, res, next) => {
  try {
    const data = logCallSchema.parse(req.body);
    const tenantId = req.user!.tenantId;

    // Valida que os vínculos pertencem ao tenant (evita cross-tenant via id forjado).
    if (data.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: data.leadId, tenantId }, select: { id: true } });
      if (!lead) return next(createError('Lead não encontrado.', 404, 'LEAD_NOT_FOUND'));
    }
    if (data.dealId) {
      const deal = await prisma.deal.findFirst({ where: { id: data.dealId, tenantId }, select: { id: true } });
      if (!deal) return next(createError('Negociação não encontrada.', 404, 'DEAL_NOT_FOUND'));
    }
    if (data.companyId) {
      const company = await prisma.company.findFirst({
        where: { id: data.companyId, tenantId },
        select: { id: true },
      });
      if (!company) return next(createError('Empresa não encontrada.', 404, 'COMPANY_NOT_FOUND'));
    }

    const interaction = await prisma.interaction.create({
      data: {
        tenantId,
        leadId: data.leadId ?? null,
        dealId: data.dealId ?? null,
        companyId: data.companyId ?? null,
        userId: req.user!.userId,
        type: 'CALL',
        direction: 'OUTBOUND',
        content: `Ligação para ${data.toNumber} (${data.durationSec}s).`,
        metadata: {
          toNumber: data.toNumber,
          durationSec: data.durationSec,
          recordingUrl: data.recordingUrl ?? null,
          phoneProvider: 'twilio',
        },
      },
    });

    res.status(201).json({ status: 201, data: interaction });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

export default router;
