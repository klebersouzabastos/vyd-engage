import {
  PaymentIntent,
  PaymentResult,
  PaymentMethod,
  CardTokenData,
  PaymentStatus,
} from '../types/payment';
import { apiClient } from './api/client';

/**
 * Criar intenção de pagamento via backend API.
 * O backend cria a preferência no Mercado Pago e retorna o link de pagamento.
 */
export async function createPaymentIntent(
  planId: string,
  amount: number,
  method: PaymentMethod,
  metadata?: Record<string, string | number | boolean | undefined>
): Promise<PaymentIntent> {
  const result = await apiClient.createPaymentIntent({
    planId,
    planType: metadata?.planType || 'PRO',
    amount,
    method: mapMethodToBackend(method),
    billingCycle: metadata?.billingCycle || 'MONTHLY',
  });

  const data = result?.data || result;

  return {
    id: data.payment?.id || data.id,
    planId,
    amount,
    method,
    status: 'pending',
    createdAt: data.payment?.createdAt || new Date().toISOString(),
    updatedAt: data.payment?.updatedAt || new Date().toISOString(),
    metadata: {
      ...metadata,
      preferenceId: data.preference?.id,
      initPoint: data.preference?.initPoint,
      sandboxInitPoint: data.preference?.sandboxInitPoint,
    },
  };
}

/**
 * Processar pagamento com cartão de crédito.
 * O frontend obtém o token via Mercado Pago SDK (iframe seguro) e envia
 * APENAS o token ao backend. Dados do cartão nunca passam pelo nosso servidor.
 */
export async function processCreditCardPayment(
  paymentIntentId: string,
  tokenData: CardTokenData
): Promise<PaymentResult> {
  if (!tokenData.token) {
    return {
      success: false,
      paymentIntentId,
      status: 'failed',
      message: 'Token de pagamento não recebido',
      error: 'MISSING_TOKEN',
    };
  }

  try {
    const result = await apiClient.processCardPayment({
      paymentId: paymentIntentId,
      token: tokenData.token,
      paymentMethodId: tokenData.paymentMethodId,
      issuerId: tokenData.issuerId,
      installments: tokenData.installments,
    });

    const data = result?.data || result;
    const mpStatus = data.mercadoPagoStatus || data.payment?.status || 'pending';

    // Map MP status to our result
    if (mpStatus === 'approved') {
      return {
        success: true,
        paymentIntentId,
        status: 'paid',
        message: 'Pagamento aprovado com sucesso!',
      };
    } else if (mpStatus === 'rejected') {
      return {
        success: false,
        paymentIntentId,
        status: 'failed',
        message: data.mercadoPagoStatusDetail
          ? `Pagamento recusado: ${mapStatusDetail(data.mercadoPagoStatusDetail)}`
          : 'Pagamento recusado. Verifique os dados do cartão.',
        error: 'PAYMENT_REJECTED',
      };
    } else {
      return {
        success: true,
        paymentIntentId,
        status: 'pending',
        message: 'Pagamento em processamento. Você será notificado quando for aprovado.',
        requiresAction: true,
      };
    }
  } catch (error) {
    return {
      success: false,
      paymentIntentId,
      status: 'failed',
      message: 'Erro ao processar pagamento. Tente novamente.',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Traduz status_detail do Mercado Pago para mensagens amigáveis em pt-BR.
 */
function mapStatusDetail(detail: string): string {
  const map: Record<string, string> = {
    cc_rejected_insufficient_amount: 'Saldo insuficiente',
    cc_rejected_bad_filled_card_number: 'Número do cartão incorreto',
    cc_rejected_bad_filled_date: 'Data de validade incorreta',
    cc_rejected_bad_filled_other: 'Dados do cartão incorretos',
    cc_rejected_bad_filled_security_code: 'Código de segurança incorreto',
    cc_rejected_blacklist: 'Cartão bloqueado por segurança',
    cc_rejected_call_for_authorize: 'Ligue para a operadora para autorizar',
    cc_rejected_card_disabled: 'Cartão desabilitado para compras online',
    cc_rejected_duplicated_payment: 'Pagamento duplicado',
    cc_rejected_high_risk: 'Pagamento recusado por risco elevado',
    cc_rejected_max_attempts: 'Número máximo de tentativas excedido',
    cc_rejected_other_reason: 'Cartão recusado',
  };
  return map[detail] || 'Verifique os dados do cartão e tente novamente';
}

/**
 * Processar pagamento via PIX.
 * Retorna dados para gerar QR Code (virão do backend via Mercado Pago).
 */
export async function processPixPayment(paymentIntentId: string): Promise<PaymentResult> {
  // O PIX é gerado pelo Mercado Pago durante a criação da preferência.
  // O initPoint/sandboxInitPoint já contém o link para pagamento.
  return {
    success: true,
    paymentIntentId,
    status: 'pending',
    message: 'Redirecionando para pagamento PIX via Mercado Pago.',
    requiresAction: true,
  };
}

/**
 * Processar pagamento via Boleto.
 */
export async function processBoletoPayment(paymentIntentId: string): Promise<PaymentResult> {
  return {
    success: true,
    paymentIntentId,
    status: 'pending',
    message: 'Redirecionando para pagamento via Boleto.',
    requiresAction: true,
  };
}

/**
 * Verificar status de pagamento via backend.
 */
export async function checkPaymentStatus(paymentIntentId: string): Promise<PaymentStatus> {
  try {
    const history = await apiClient.getPaymentHistory();
    const payments = history?.data || history || [];
    const payment = payments.find((p: { id: string; status: string }) => p.id === paymentIntentId);
    if (!payment) return 'failed';

    const statusMap: Record<string, PaymentStatus> = {
      PENDING: 'pending',
      PROCESSING: 'processing',
      PAID: 'paid',
      FAILED: 'failed',
      REFUNDED: 'refunded',
      CANCELLED: 'failed',
    };
    return statusMap[payment.status] || 'pending';
  } catch {
    return 'failed';
  }
}

/**
 * Validar se pode fazer upgrade.
 */
export async function validatePaymentForUpgrade(
  planId: string
): Promise<{ isValid: boolean; reason?: string }> {
  try {
    const history = await apiClient.getPaymentHistory();
    const payments = history?.data || history || [];

    const pendingPayment = payments.find(
      (p: { status: string }) => p.status === 'PENDING' || p.status === 'PROCESSING'
    );

    if (pendingPayment) {
      return {
        isValid: false,
        reason: 'Há um pagamento pendente. Aguarde a confirmação.',
      };
    }

    return { isValid: true };
  } catch {
    return { isValid: true };
  }
}

/**
 * Obter histórico de pagamentos via API.
 */
export async function getPaymentHistory() {
  const result = await apiClient.getPaymentHistory();
  return result?.data || result || [];
}

function mapMethodToBackend(method: PaymentMethod): string {
  const map: Record<string, string> = {
    credit_card: 'CREDIT_CARD',
    pix: 'PIX',
    boleto: 'BOLETO',
  };
  return map[method] || 'CREDIT_CARD';
}

/**
 * Criar preferência de pagamento (agora via backend).
 */
export async function createMercadoPagoPreference(preference: Record<string, unknown>) {
  // A preferência é criada pelo backend durante createPaymentIntent.
  // Esta função mantém compatibilidade com código existente.
  return preference;
}
