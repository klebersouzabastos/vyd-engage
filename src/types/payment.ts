// Tipos para sistema de pagamentos

export type PaymentMethod = 'credit_card' | 'pix' | 'boleto';

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled';

// Token de cartão retornado pelo Mercado Pago SDK (dados sensíveis nunca tocam nosso código)
export interface CardTokenData {
  token: string;
  paymentMethodId: string;
  issuerId: string;
  installments: number;
}

/**
 * @deprecated NEVER use this interface. Raw card data must NEVER be handled
 * in application code. Use CardTokenData from Mercado Pago SDK instead.
 * Kept only for historical migration reference — will be removed.
 */
export interface CreditCardData {
  /** @deprecated */
  cardNumber: string;
  /** @deprecated */
  cardHolderName: string;
  /** @deprecated */
  expirationMonth: string;
  /** @deprecated */
  expirationYear: string;
  /** @deprecated */
  securityCode: string;
  /** @deprecated */
  installments?: number;
}

// Dados para pagamento via PIX
export interface PixPaymentData {
  qrCode?: string;
  qrCodeBase64?: string;
  copyPaste?: string;
  expiresAt?: string;
}

// Dados para pagamento via Boleto
export interface BoletoPaymentData {
  barcode?: string;
  digitableLine?: string;
  expiresAt?: string;
  pdfUrl?: string;
}

// Intenção de pagamento
export interface PaymentIntent {
  id: string;
  planId: string; // PlanType
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  mercadoPagoPreferenceId?: string;
  mercadoPagoPaymentId?: string;
  paymentData?: PixPaymentData | BoletoPaymentData;
  errorMessage?: string;
  metadata?: {
    userId?: string;
    planName?: string;
    upgradeFrom?: string;
  };
}

// Resultado de processamento de pagamento
export interface PaymentResult {
  success: boolean;
  paymentIntentId: string;
  status: PaymentStatus;
  message: string;
  error?: string;
  mercadoPagoResponse?: unknown;
  requiresAction?: boolean; // Se precisa de ação adicional (ex: escanear QR code)
  actionData?: PixPaymentData | BoletoPaymentData;
}

// Configuração do Mercado Pago
export interface MercadoPagoConfig {
  publicKey: string;
  accessToken: string;
  environment: 'sandbox' | 'production';
  webhookSecret?: string;
}

// Preferência de pagamento do Mercado Pago
export interface MercadoPagoPreference {
  id?: string;
  items: Array<{
    title: string;
    quantity: number;
    unit_price: number;
  }>;
  payer?: {
    name?: string;
    email?: string;
  };
  payment_methods?: {
    excluded_payment_methods?: Array<{ id: string }>;
    excluded_payment_types?: Array<{ id: string }>;
    installments?: number;
  };
  back_urls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
  auto_return?: 'approved' | 'all';
  notification_url?: string;
  statement_descriptor?: string;
}

// Webhook do Mercado Pago
export interface MercadoPagoWebhook {
  id: string;
  live_mode: boolean;
  type: string;
  date_created: string;
  application_id: number;
  user_id: number;
  version: number;
  api_version: string;
  action: string;
  data: {
    id: string; // Payment ID
  };
}

// Informações de validação de pagamento
export interface PaymentValidation {
  isValid: boolean;
  canUpgrade: boolean;
  reason?: string;
  pendingPayment?: PaymentIntent;
}
