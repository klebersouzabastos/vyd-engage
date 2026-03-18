import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { paymentService } from '../services/paymentService.js';
import { whatsappMessagingService } from '../services/whatsappMessagingService.js';
import { emailMessagingService } from '../services/emailMessagingService.js';
import { logger } from '../utils/logger.js';

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
    xSignature.split(',').map(part => {
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
    res.status(200).json({ received: true, error: error instanceof Error ? error.message : 'Unknown error' });
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
    logger.warn('WhatsApp webhook verification failed', { mode, tokenMatch: token === verifyToken });
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

      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        logger.warn('WhatsApp webhook: invalid signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    logger.info('WhatsApp webhook received', { object: req.body?.object });

    // Process webhook asynchronously - always return 200 quickly
    whatsappMessagingService.processWebhook(req.body).catch(error => {
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

// Validate email webhook signing secret (shared pattern for SendGrid & Resend)
function validateEmailWebhookSecret(req: Request): boolean {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — allow through (operator's choice to not protect)
    return true;
  }
  const provided = req.headers['x-webhook-secret'] as string | undefined;
  if (!provided) return false;
  if (secret.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(provided));
}

// POST /api/webhooks/email/sendgrid - SendGrid event webhook
router.post('/email/sendgrid', async (req: Request, res: Response) => {
  try {
    if (!validateEmailWebhookSecret(req)) {
      logger.warn('SendGrid webhook: invalid or missing secret', { ip: req.ip });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    logger.info('SendGrid webhook received');
    emailMessagingService.processWebhook('sendgrid', req.body).catch(error => {
      logger.error('Error processing SendGrid webhook', error);
    });
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling SendGrid webhook', error);
    res.status(200).json({ received: true });
  }
});

// POST /api/webhooks/email/resend - Resend event webhook
router.post('/email/resend', async (req: Request, res: Response) => {
  try {
    if (!validateEmailWebhookSecret(req)) {
      logger.warn('Resend webhook: invalid or missing secret', { ip: req.ip });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    logger.info('Resend webhook received', { type: req.body?.type });
    emailMessagingService.processWebhook('resend', req.body).catch(error => {
      logger.error('Error processing Resend webhook', error);
    });
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error handling Resend webhook', error);
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








