import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { paymentService } from '../services/paymentService.js';
import { whatsappMessagingService } from '../services/whatsappMessagingService.js';
import { emailMessagingService } from '../services/emailMessagingService.js';
import { recordBounceByEmail } from '../services/campaignService.js';
import { logger } from '../utils/logger.js';

/**
 * Extract bounced recipient emails from a provider webhook payload and record a
 * campaign BOUNCED event for each (req 24). Does not touch unsubscribe state
 * (edge case: bounce on an already-unsubscribed lead must not duplicate
 * UNSUBSCRIBED). Best-effort: never throws into the webhook handler.
 */
async function recordCampaignBounces(provider: string, payload: any): Promise<void> {
  try {
    const emails = new Set<string>();
    if (provider === 'sendgrid' && Array.isArray(payload)) {
      for (const ev of payload) {
        if ((ev?.event === 'bounce' || ev?.event === 'dropped') && ev?.email) {
          emails.add(String(ev.email));
        }
      }
    } else if (provider === 'resend') {
      if (payload?.type === 'email.bounced') {
        const to = payload?.data?.to;
        const list = Array.isArray(to) ? to : to ? [to] : [];
        for (const e of list) emails.add(String(e));
      }
    }
    for (const email of emails) {
      await recordBounceByEmail(email);
    }
  } catch (err: any) {
    logger.error('Failed to record campaign bounces', { provider, err: err?.message });
  }
}

const router = Router();

// Validate Mercado Pago webhook signature
function validateMercadoPagoSignature(req: Request): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('MERCADO_PAGO_WEBHOOK_SECRET not configured — rejecting webhook');
    return false;
  }

  const xSignature = req.headers['x-signature'] as string | undefined;
  const xRequestId = req.headers['x-request-id'] as string | undefined;

  if (!xSignature || !xRequestId) {
    return false;
  }

  // Parse x-signature header (format: "ts=...,v1=...")
  const parts = Object.fromEntries(
    xSignature.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key.trim(), value.trim()];
    })
  );

  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  // Build the manifest string per MP docs
  const dataId = (req.query['data.id'] || req.body?.data?.id || '') as string;
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  // Validate hex string lengths match before timingSafeEqual to prevent length leak
  if (hmac.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(v1, 'hex'));
}

// POST /api/webhooks/mercadopago - Mercado Pago webhook
router.post('/mercadopago', async (req: Request, res: Response) => {
  try {
    // Validate webhook signature
    if (!validateMercadoPagoSignature(req)) {
      logger.warn('Mercado Pago webhook: invalid signature', {
        ip: req.ip,
        headers: { 'x-signature': req.headers['x-signature'] ? '[present]' : '[missing]' },
      });
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const data = req.body;
    logger.info('Mercado Pago webhook received', { type: data.type });

    await paymentService.handleWebhook(data);

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error processing Mercado Pago webhook', error);
    // Still return 200 to prevent Mercado Pago from retrying
    res
      .status(200)
      .json({ received: true, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ========================
// WhatsApp Webhooks (Meta Business API)
// ========================

// GET /api/webhooks/whatsapp - Meta webhook verification
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn('WhatsApp webhook verification failed', {
      mode,
      tokenMatch: token === verifyToken,
    });
    res.status(403).send('Forbidden');
  }
});

// POST /api/webhooks/whatsapp - Incoming WhatsApp messages & status updates
router.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    // Validate signature if secret is configured
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const signature = req.headers['x-hub-signature-256'] as string | undefined;
      if (!signature) {
        logger.warn('WhatsApp webhook: missing signature');
        res.status(401).json({ error: 'Missing signature' });
        return;
      }

      const expectedSignature =
        'sha256=' +
        crypto.createHmac('sha256', appSecret).update(JSON.stringify(req.body)).digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        logger.warn('WhatsApp webhook: invalid signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    logger.info('WhatsApp webhook received', { object: req.body?.object });

    // Process webhook asynchronously - always return 200 quickly
    whatsappMessagingService.processWebhook(req.body).catch((error) => {
      logger.error('Error processing WhatsApp webhook async', error);
    });

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling WhatsApp webhook', error);
    res.status(200).json({ received: true });
  }
});

// ========================
// Email Webhooks (SendGrid, Resend, etc.)
// ========================

// ========================
// Email Webhook Signature Validators
// ========================

/**
 * SendGrid Event Webhook — ECDSA verification.
 * https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 * Fail-closed: rejects if SENDGRID_WEBHOOK_VERIFICATION_KEY is not configured.
 */
function validateSendGridWebhook(req: Request): boolean {
  const publicKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
  if (!publicKey) {
    logger.warn('SENDGRID_WEBHOOK_VERIFICATION_KEY not configured — rejecting SendGrid webhook');
    return false;
  }

  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string | undefined;
  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string | undefined;
  if (!timestamp || !signature) return false;

  // Verify ECDSA signature over (timestamp + body). Uses JSON.stringify as the
  // payload proxy since Express pre-parses the body — accuracy depends on
  // SendGrid sending canonical JSON. For maximum accuracy, configure raw body
  // capture middleware before express.json() on this route.
  try {
    const payload = timestamp + JSON.stringify(req.body);
    const verify = crypto.createVerify('SHA256');
    verify.update(payload);
    return verify.verify(publicKey, signature, 'base64');
  } catch {
    return false;
  }
}

/**
 * Resend Webhook — Svix HMAC-SHA256 verification.
 * https://resend.com/docs/dashboard/webhooks/introduction
 * Fail-closed: rejects if RESEND_WEBHOOK_SECRET is not configured.
 */
function validateResendWebhook(req: Request): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('RESEND_WEBHOOK_SECRET not configured — rejecting Resend webhook');
    return false;
  }

  const svixId = req.headers['svix-id'] as string | undefined;
  const svixTimestamp = req.headers['svix-timestamp'] as string | undefined;
  const svixSignature = req.headers['svix-signature'] as string | undefined;
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Svix signs over "${svix-id}.${svix-timestamp}.${raw-body}".
  // Using JSON.stringify(body) as proxy (see note in validateSendGridWebhook).
  try {
    const rawSecret = secret.startsWith('whsec_')
      ? Buffer.from(secret.slice(6), 'base64')
      : Buffer.from(secret);
    const toSign = `${svixId}.${svixTimestamp}.${JSON.stringify(req.body)}`;
    const hmac = crypto.createHmac('sha256', rawSecret).update(toSign).digest('base64');
    const expected = `v1,${hmac}`;
    // svix-signature may contain multiple space-separated versions
    return svixSignature.split(' ').some((sig) => {
      if (sig.length !== expected.length) return false;
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    });
  } catch {
    return false;
  }
}

// POST /api/webhooks/email/sendgrid - SendGrid event webhook
router.post('/email/sendgrid', async (req: Request, res: Response) => {
  try {
    if (!validateSendGridWebhook(req)) {
      logger.warn('SendGrid webhook: invalid or missing signature', { ip: req.ip });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    logger.info('SendGrid webhook received');
    emailMessagingService.processWebhook('sendgrid', req.body).catch((error) => {
      logger.error('Error processing SendGrid webhook', error);
    });
    // Campaign bounce tracking (req 24) — best-effort, async.
    recordCampaignBounces('sendgrid', req.body).catch(() => {});
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling SendGrid webhook', error);
    res.status(200).json({ received: true });
  }
});

// POST /api/webhooks/email/resend - Resend event webhook
router.post('/email/resend', async (req: Request, res: Response) => {
  try {
    if (!validateResendWebhook(req)) {
      logger.warn('Resend webhook: invalid or missing signature', { ip: req.ip });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    logger.info('Resend webhook received', { type: req.body?.type });
    emailMessagingService.processWebhook('resend', req.body).catch((error) => {
      logger.error('Error processing Resend webhook', error);
    });
    // Campaign bounce tracking (req 24) — best-effort, async.
    recordCampaignBounces('resend', req.body).catch(() => {});
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling Resend webhook', error);
    res.status(200).json({ received: true });
  }
});

// ========================
// ZapSign Webhook (assinatura eletrônica — Upgrade RD P2, req 19)
// ========================

// POST /api/webhooks/zapsign — status de assinatura (público, sem CSRF).
// Identifica o tenant pelo envelopeId (Proposal.signatureEnvelopeId) e valida o
// HMAC com o webhookSecret DESSE tenant (feito dentro do signatureService). A
// assinatura é computada sobre o corpo CRU (req.rawBody, capturado no verify do
// express.json em index.ts) — os bytes EXATOS recebidos, para o HMAC bater com o
// provedor. Fallback para JSON.stringify(req.body) se rawBody não estiver presente.
router.post('/zapsign', async (req: Request, res: Response) => {
  try {
    const { signatureService } = await import('../services/signatureService.js');
    const rawBody =
      (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
    const headerSignature =
      (req.headers['x-zapsign-signature'] as string | undefined) ||
      (req.headers['x-signature'] as string | undefined) ||
      (req.headers['x-hub-signature-256'] as string | undefined);

    const result = await signatureService.handleWebhook(rawBody, headerSignature);
    if (!result.handled) {
      logger.info('ZapSign webhook não processado', { reason: result.reason });
    }
    // Sempre 200 para não provocar retry do provedor em casos não-acionáveis.
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Erro ao processar webhook ZapSign', error);
    res.status(200).json({ received: true });
  }
});

// ========================
// Lead Capture Webhook (public, authenticated via API key)
// ========================

// POST /api/webhooks/capture/:apiKey - Capture leads from external systems
router.post('/capture/:apiKey', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.params;
    if (!apiKey) {
      res.status(400).json({ error: 'API key required' });
      return;
    }

    // Find API key and resolve tenant
    const { default: prisma } = await import('../config/database.js');
    const { default: bcrypt } = await import('bcryptjs');

    // API keys are stored with hash — we need to find by iterating active keys
    const activeKeys = await prisma.apiKey.findMany({
      where: { active: true },
      select: { id: true, tenantId: true, keyHash: true },
    });

    let tenantId: string | null = null;
    let keyId: string | null = null;

    for (const key of activeKeys) {
      const match = await bcrypt.compare(apiKey, key.keyHash);
      if (match) {
        tenantId = key.tenantId;
        keyId = key.id;
        break;
      }
    }

    if (!tenantId || !keyId) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    });

    // Parse lead data — flexible format
    const body = req.body;
    const name = body.name || body.nome || body.full_name || body.fullName || 'Lead via Webhook';
    const email = body.email || body.e_mail || null;
    const phone = body.phone || body.telefone || body.whatsapp || body.cel || null;
    const company = body.company || body.empresa || body.organization || null;
    const position = body.position || body.cargo || body.job_title || null;
    const notes = body.notes || body.observacao || body.message || body.mensagem || null;
    const source = body.source || 'OTHER';

    // Map source strings to enum values
    const sourceMap: Record<string, string> = {
      website: 'WEBSITE',
      social_media: 'SOCIAL_MEDIA',
      referral: 'REFERRAL',
      email: 'EMAIL',
      phone: 'PHONE',
      other: 'OTHER',
    };
    const leadSource = sourceMap[String(source).toLowerCase()] || 'OTHER';

    // Create lead
    const { leadService } = await import('../services/leadService.js');
    const lead = await leadService.create(tenantId, {
      name,
      email,
      phone,
      company,
      position,
      notes,
      source: leadSource as any,
    });

    logger.info('Lead captured via webhook', { tenantId, leadId: lead.id, source: 'webhook' });

    res.status(201).json({
      success: true,
      data: { id: lead.id, name: lead.name },
    });
  } catch (error) {
    logger.error('Error processing capture webhook', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
