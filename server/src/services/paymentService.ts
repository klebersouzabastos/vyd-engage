import prisma from '../config/database.js';
import { mercadopagoService } from './mercadopagoService.js';
import { createError } from '../middleware/errorHandler.js';
import { PlanType } from '@prisma/client';

export interface CreatePaymentIntentData {
  planId: string;
  planType: PlanType;
  amount: number;
  method: 'credit_card' | 'pix' | 'boleto';
  billingCycle: 'monthly' | 'yearly';
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
        status: 'pending',
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

  async handleWebhook(data: any) {
    // Handle Mercado Pago webhook
    const { type, data: webhookData } = data;

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
        console.warn(`Payment not found for Mercado Pago ID: ${paymentId}`);
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
        status: 'paid',
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
    if (subscription.billingCycle === 'monthly') {
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
        console.error('Failed to schedule billing job:', error);
      }
    }
  },

  mapMercadoPagoStatus(status: string): string {
    const statusMap: Record<string, string> = {
      pending: 'pending',
      approved: 'paid',
      authorized: 'paid',
      in_process: 'pending',
      in_mediation: 'pending',
      rejected: 'failed',
      cancelled: 'failed',
      refunded: 'refunded',
      charged_back: 'refunded',
    };

    return statusMap[status] || 'pending';
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


