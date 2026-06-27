import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
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

  /**
   * Create a payment using a secure token from the Mercado Pago CardForm SDK.
   * The token encapsulates card data — raw card info (number, CVV) never reaches
   * this server, satisfying PCI compliance requirements.
   */
  async createPayment(params: {
    token: string;
    paymentMethodId: string;
    issuerId?: string;
    installments: number;
    amount: number;
    description: string;
    payerEmail: string;
    externalReference: string;
    notificationUrl?: string;
  }): Promise<any> {
    if (!accessToken) {
      throw createError('Mercado Pago not configured', 500, 'MP_NOT_CONFIGURED');
    }

    const payment = new Payment(client);

    try {
      const response = await payment.create({
        body: {
          transaction_amount: params.amount,
          token: params.token,
          description: params.description,
          installments: params.installments,
          payment_method_id: params.paymentMethodId,
          issuer_id: params.issuerId ? Number(params.issuerId) : undefined,
          payer: {
            email: params.payerEmail,
          },
          external_reference: params.externalReference,
          notification_url:
            params.notificationUrl || `${process.env.API_URL}/api/webhooks/mercadopago`,
          statement_descriptor: 'VYD Engage',
        },
        requestOptions: { idempotencyKey: crypto.randomUUID() },
      });
      return response;
    } catch (error) {
      logger.error('Mercado Pago createPayment error:', error);
      throw createError(
        `Failed to create payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'MP_PAYMENT_ERROR'
      );
    }
  },

  async getPayment(paymentId: string) {
    if (!accessToken) {
      throw createError('Mercado Pago not configured', 500, 'MP_NOT_CONFIGURED');
    }

    const payment = new Payment(client);

    try {
      const response = await payment.get({ id: paymentId });
      return response;
    } catch (error) {
      logger.error('Mercado Pago getPayment error:', error);
      throw createError(
        `Failed to fetch payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'MP_FETCH_ERROR'
      );
    }
  },
};
