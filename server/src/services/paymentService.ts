import prisma from '../config/database.js';
import { mercadopagoService } from './mercadopagoService.js';
import { createError } from '../middleware/errorHandler.js';
import { PlanType, PaymentMethod, PaymentStatus, BillingCycle } from '@prisma/client';
import { logger } from '../utils/logger.js';

export interface CreatePaymentIntentData {
  planId: string;
  planType: PlanType;
  amount: number;
  method: PaymentMethod;
  billingCycle: BillingCycle;
}

export const paymentService = {
  async createPaymentIntent(
    tenantId: string,
    userId: string,
    data: CreatePaymentIntentData
  ) {
    // Get plan
    const plan = await prisma.plan.findUnique({
      where: { id: data.planId },
    });

    if (!plan) {
      throw createError('Plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // Create Mercado Pago preference
    const preference = await mercadopagoService.createPreference({
      planId: data.planId,
      planName: plan.name,
      amount: data.amount,
      tenantId,
      userId,
      billingCycle: data.billingCycle,
    });

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        tenantId,
        amount: data.amount,
        currency: 'BRL',
        method: data.method,
        status: 'PENDING',
        mercadoPagoPreferenceId: preference.id,
      },
    });

    return {
      payment,
      preference: {
        id: preference.id,
        initPoint: preference.init_point,
        sandboxInitPoint: preference.sandbox_init_point,
      },
    };
  },

  async handleWebhook(data: Record<string, unknown>) {
    // Handle Mercado Pago webhook
    const { type, data: webhookData } = data as { type: string; data: { id: string; status: string } };

    if (type === 'payment') {
      const paymentId = webhookData.id;
      const paymentStatus = webhookData.status;

      // Find payment by Mercado Pago ID
      const payment = await prisma.payment.findFirst({
        where: {
          mercadoPagoId: paymentId,
        },
        include: {
          tenant: {
            include: {
              subscription: {
                include: {
                  plan: true,
                },
              },
            },
          },
        },
      });

      if (!payment) {
        logger.warn(`Payment not found for Mercado Pago ID: ${paymentId}`);
        return;
      }

      // Update payment status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: this.mapMercadoPagoStatus(paymentStatus),
          mercadoPagoStatus: paymentStatus,
          paidAt: paymentStatus === 'approved' ? new Date() : null,
        },
      });

      // If payment approved, update subscription
      if (paymentStatus === 'approved') {
        await this.activateSubscription(payment.tenantId, payment.subscriptionId || undefined);
      }
    }
  },

  async activateSubscription(tenantId: string, paymentId?: string): Promise<void> {
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId || undefined,
        tenantId,
        status: 'PAID',
      },
      include: {
        subscription: true,
      },
    });

    if (!payment && paymentId) {
      throw createError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    // Get external reference from payment metadata or preference
    // For now, we'll use the subscription from payment
    let subscription = payment?.subscription;

    if (!subscription) {
      // Get current subscription
      subscription = await prisma.subscription.findUnique({
        where: { tenantId },
        include: { plan: true },
      });
    }

    if (!subscription) {
      throw createError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    // Update subscription status
    const renewalDate = new Date();
    if (subscription.billingCycle === 'MONTHLY') {
      renewalDate.setMonth(renewalDate.getMonth() + 1);
    } else {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        renewalDate,
        cancelledAt: null,
      },
    });

    // Schedule next billing job
    if (process.env.ENABLE_BILLING_JOBS === 'true') {
      try {
        const { scheduleBillingJob } = await import('../jobs/billing.js');
        await scheduleBillingJob(updatedSubscription.id, renewalDate);
      } catch (error) {
        // Log but don't fail the operation
        logger.error('Failed to schedule billing job:', error);
      }
    }
  },

  mapMercadoPagoStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      pending: 'PENDING',
      approved: 'PAID',
      authorized: 'PAID',
      in_process: 'PENDING',
      in_mediation: 'PENDING',
      rejected: 'FAILED',
      cancelled: 'FAILED',
      refunded: 'REFUNDED',
      charged_back: 'REFUNDED',
    };

    return statusMap[status] || 'PENDING';
  },

  async getPaymentHistory(tenantId: string) {
    return prisma.payment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });
  },
};


