import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { planLimitsService } from '../services/planLimitsService.js';
import { subscriptionService } from '../services/subscriptionService.js';
import { PlanType } from '@prisma/client';
import prisma from '../config/database.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

// GET /api/subscriptions/current - Get current subscription
router.get('/current', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const subscription = await subscriptionService.getCurrentSubscription(req.user.tenantId);
    const usage = await planLimitsService.getUsage(req.user.tenantId);

    res.json({
      subscription,
      usage,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/subscriptions/plans - Get all available plans
router.get('/plans', async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });

    res.json(plans);
  } catch (error) {
    next(error);
  }
});

// PUT /api/subscriptions/change-plan - Change subscription plan
router.put('/change-plan', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const { planType, billingCycle } = z.object({
      planType: z.nativeEnum(PlanType),
      billingCycle: z.enum(['monthly', 'yearly']).optional(),
    }).parse(req.body);

    const subscription = await subscriptionService.changePlan(
      req.user.tenantId,
      planType,
      billingCycle || 'monthly'
    );

    res.json(subscription);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// POST /api/subscriptions/cancel - Cancel subscription
router.post('/cancel', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await subscriptionService.cancelSubscription(req.user.tenantId);
    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/subscriptions/reactivate - Reactivate subscription
router.post('/reactivate', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await subscriptionService.reactivateSubscription(req.user.tenantId);
    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;

