import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { PlanType, SubscriptionStatus, BillingCycle } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { planLimitsService } from './planLimitsService.js';

export const subscriptionService = {
  async getCurrentSubscription(tenantId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!subscription) {
      throw createError('No subscription found', 404, 'NO_SUBSCRIPTION');
    }

    return subscription;
  },

  async changePlan(
    tenantId: string,
    newPlanType: PlanType,
    billingCycle: BillingCycle = 'MONTHLY'
  ) {
    const currentSubscription = await this.getCurrentSubscription(tenantId);
    const newPlan = await prisma.plan.findUnique({
      where: { type: newPlanType },
    });

    if (!newPlan) {
      throw createError('Plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // Calculate renewal date
    const renewalDate = new Date();
    if (billingCycle === 'MONTHLY') {
      renewalDate.setMonth(renewalDate.getMonth() + 1);
    } else {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    }

    // Update subscription
    const updated = await prisma.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        planId: newPlan.id,
        billingCycle,
        renewalDate,
        status: currentSubscription.status === 'TRIAL' ? 'TRIAL' : 'ACTIVE',
      },
      include: {
        plan: true,
      },
    });

    // Schedule billing job for new renewal date
    if (process.env.ENABLE_BILLING_JOBS === 'true') {
      try {
        const { scheduleBillingJob } = await import('../jobs/billing.js');
        await scheduleBillingJob(updated.id, renewalDate);
      } catch (error) {
        // Log but don't fail the operation
        logger.error('Failed to schedule billing job:', error);
      }
    }

    planLimitsService.invalidateLimits(tenantId).catch(() => {});

    return updated;
  },

  async cancelSubscription(tenantId: string) {
    const subscription = await this.getCurrentSubscription(tenantId);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    planLimitsService.invalidateLimits(tenantId).catch(() => {});
  },

  async reactivateSubscription(tenantId: string) {
    const subscription = await this.getCurrentSubscription(tenantId);

    if (subscription.status !== 'CANCELLED') {
      throw createError('Subscription is not cancelled', 400, 'NOT_CANCELLED');
    }

    const renewalDate = new Date();
    if (subscription.billingCycle === 'MONTHLY') {
      renewalDate.setMonth(renewalDate.getMonth() + 1);
    } else {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        renewalDate,
        cancelledAt: null,
      },
    });

    // Schedule billing job for reactivated subscription
    if (process.env.ENABLE_BILLING_JOBS === 'true') {
      try {
        const { scheduleBillingJob } = await import('../jobs/billing.js');
        await scheduleBillingJob(updated.id, renewalDate);
      } catch (error) {
        // Log but don't fail the operation
        logger.error('Failed to schedule billing job:', error);
      }
    }

    planLimitsService.invalidateLimits(tenantId).catch(() => {});

    return updated;
  },
};


