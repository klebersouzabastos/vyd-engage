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
    logger.warn('MERCADO_PAGO_WEBHOOK_SECRET not configured — skipping signature validation');
    return true; // Allow in dev without secret configured
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
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1));
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

// POST /api/webhooks/email/sendgrid - SendGrid event webhook
router.post('/email/sendgrid', async (req: Request, res: Response) => {
  try {
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

export default router;








