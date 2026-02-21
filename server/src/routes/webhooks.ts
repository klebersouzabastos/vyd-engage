import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { paymentService } from '../services/paymentService.js';
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
  } catch (error: any) {
    logger.error('Error processing Mercado Pago webhook', error);
    // Still return 200 to prevent Mercado Pago from retrying
    res.status(200).json({ received: true, error: error.message });
  }
});

export default router;








