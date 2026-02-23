import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createError } from '../middleware/errorHandler.js';
import { BillingCycle } from '@prisma/client';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY || '';

if (!accessToken) {
  logger.warn('MERCADOPAGO_ACCESS_TOKEN not set. Payment features will not work.');
}

const client = new MercadoPagoConfig({
  accessToken,
  options: {
    timeout: 5000,
  },
});

export interface CreatePreferenceParams {
  planId: string;
  planName: string;
  amount: number;
  tenantId: string;
  userId: string;
  billingCycle: BillingCycle;
}

export const mercadopagoService = {
  async createPreference(params: CreatePreferenceParams): Promise<any> {
    if (!accessToken) {
      throw createError('Mercado Pago not configured', 500, 'MP_NOT_CONFIGURED');
    }

    const preference = new Preference(client);

    const preferenceData = {
      items: [
        {
          id: params.planId,
          title: `VYD Engage - ${params.planName}`,
          quantity: 1,
          unit_price: params.amount,
          currency_id: 'BRL',
        },
      ],
      payer: {
        email: '', // Will be filled by user during payment
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL}/app/settings?payment=success`,
        failure: `${process.env.FRONTEND_URL}/app/settings?payment=failure`,
        pending: `${process.env.FRONTEND_URL}/app/settings?payment=pending`,
      },
      auto_return: 'approved',
      external_reference: JSON.stringify({
        tenantId: params.tenantId,
        userId: params.userId,
        planId: params.planId,
        billingCycle: params.billingCycle,
      }),
      notification_url: `${process.env.API_URL}/api/webhooks/mercadopago`,
      statement_descriptor: 'VYD Engage',
      metadata: {
        tenantId: params.tenantId,
        planId: params.planId,
        billingCycle: params.billingCycle,
      },
    };

    try {
      const response = await preference.create({
        body: preferenceData,
        requestOptions: { idempotencyKey: crypto.randomUUID() },
      });
      return response;
    } catch (error) {
      logger.error('Mercado Pago error:', error);
      throw createError(
        `Failed to create payment preference: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'MP_CREATE_ERROR'
      );
    }
  },

  async getPayment(paymentId: string) {
    if (!accessToken) {
      throw createError('Mercado Pago not configured', 500, 'MP_NOT_CONFIGURED');
    }

    // In a real implementation, you would use the Mercado Pago SDK to fetch payment
    // For now, we'll return a mock structure
    return {
      id: paymentId,
      status: 'pending',
    };
  },
};








