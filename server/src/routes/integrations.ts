/**
 * /integrations — Integrações plugáveis por tenant, GATED (Upgrade RD P2, reqs 19 e 21).
 *
 * Credencial por tenant via IntegrationConfig (encrypted); os segredos NUNCA
 * saem em claro — só o status `{ configured, provider, active }`. Escrita é
 * ADMIN. Gating gracioso: sem credencial, `status` responde `{ configured:false }`.
 *
 * NOTA de montagem: `/integrations` também é usado por `calendarRoutes`
 * (Google Calendar, subcaminhos `/google/*`). Este router define subcaminhos
 * próprios (`/signature/*`, `/phone/*`) que não colidem — Express tenta ambos.
 *
 *   GET    /integrations/signature/status   → { configured, provider?, active? }
 *   PUT    /integrations/signature           (ADMIN) { provider:'zapsign', apiKey, webhookSecret }
 *   DELETE /integrations/signature           (ADMIN) → { deleted }
 *   GET    /integrations/phone/status        → { configured, provider?, active? }
 *   PUT    /integrations/phone               (ADMIN) { provider:'twilio', accountSid, authToken, twimlAppSid? }
 *   DELETE /integrations/phone               (ADMIN) → { deleted }
 */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { integrationService } from '../services/integrationService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const signatureConfigSchema = z.object({
  provider: z.literal('zapsign'),
  apiKey: z.string().min(1),
  webhookSecret: z.string().min(1),
});

const phoneConfigSchema = z.object({
  provider: z.literal('twilio'),
  accountSid: z.string().min(1),
  authToken: z.string().min(1),
  twimlAppSid: z.string().optional(),
});

// ── Assinatura (SIGNATURE) ───────────────────────────

router.get('/signature/status', async (req, res, next) => {
  try {
    const status = await integrationService.getStatus(req.user!.tenantId, 'SIGNATURE');
    res.json({ status: 200, data: status });
  } catch (error) {
    next(error);
  }
});

router.put('/signature', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = signatureConfigSchema.parse(req.body);
    const status = await integrationService.setConfig(
      req.user!.tenantId,
      'SIGNATURE',
      data.provider,
      { apiKey: data.apiKey, webhookSecret: data.webhookSecret, provider: data.provider }
    );
    res.json({ status: 200, data: status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/signature', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const result = await integrationService.deleteConfig(req.user!.tenantId, 'SIGNATURE');
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// ── Telefonia (PHONE) ────────────────────────────────

router.get('/phone/status', async (req, res, next) => {
  try {
    const status = await integrationService.getStatus(req.user!.tenantId, 'PHONE');
    res.json({ status: 200, data: status });
  } catch (error) {
    next(error);
  }
});

router.put('/phone', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = phoneConfigSchema.parse(req.body);
    const status = await integrationService.setConfig(req.user!.tenantId, 'PHONE', data.provider, {
      accountSid: data.accountSid,
      authToken: data.authToken,
      twimlAppSid: data.twimlAppSid ?? null,
      provider: data.provider,
    });
    res.json({ status: 200, data: status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/phone', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const result = await integrationService.deleteConfig(req.user!.tenantId, 'PHONE');
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
