import { Router } from 'express';
import { z } from 'zod';
import { paymentService } from '../services/paymentService.js';
import { invoiceService } from '../services/invoiceService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { PlanType, PaymentMethod, BillingCycle } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createPaymentIntentSchema = z.object({
  planId: z.string().uuid(),
  planType: z.nativeEnum(PlanType),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  billingCycle: z.nativeEnum(BillingCycle),
});

// POST /api/payments/intent - Create payment intent
router.post('/intent', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = createPaymentIntentSchema.parse(req.body);
    const result = await paymentService.createPaymentIntent(
      req.user.tenantId,
      req.user.userId,
      data
    );
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// GET /api/payments/:id/invoice - Download invoice PDF
router.get('/:id/invoice', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const pdf = await invoiceService.generatePDF(req.user.tenantId, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${req.params.id.slice(0, 8)}.pdf`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/history - Get payment history
router.get('/history', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const payments = await paymentService.getPaymentHistory(req.user.tenantId);
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

export default router;








