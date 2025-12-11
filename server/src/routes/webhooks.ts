import { Router } from 'express';
import { paymentService } from '../services/paymentService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// POST /api/webhooks/mercadopago - Mercado Pago webhook
router.post('/mercadopago', async (req, res) => {
  try {
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







