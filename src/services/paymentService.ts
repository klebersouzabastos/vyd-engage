import {
  PaymentIntent,
  PaymentResult,
  PaymentMethod,
  CardTokenData,
  PaymentStatus,
} from "../types/payment";
import { apiClient } from "./api/client";

/**
 * Criar intenção de pagamento via backend API.
 * O backend cria a preferência no Mercado Pago e retorna o link de pagamento.
 */
export async function createPaymentIntent(
  planId: string,
  amount: number,
  method: PaymentMethod,
  metadata?: Record<string, any>
): Promise<PaymentIntent> {
  const result = await apiClient.createPaymentIntent({
    planId,
    planType: metadata?.planType || "PRO",
    amount,
    method: mapMethodToBackend(method),
    billingCycle: metadata?.billingCycle || "MONTHLY",
  });

  const data = result?.data || result;

  return {
    id: data.payment?.id || data.id,
    planId,
    amount,
    method,
    status: "pending",
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
 * O frontend obtém o token via Mercado Pago SDK e envia ao backend.
 */
export async function processCreditCardPayment(
  paymentIntentId: string,
  tokenData: CardTokenData
): Promise<PaymentResult> {
  if (!tokenData.token) {
    return {
      success: false,
      paymentIntentId,
      status: "failed",
      message: "Token de pagamento não recebido",
      error: "MISSING_TOKEN",
    };
  }

  // O fluxo real do Mercado Pago redireciona o usuário para o checkout.
  // O resultado vem via webhook no backend.
  // Por enquanto, retornamos que o pagamento foi iniciado.
  return {
    success: true,
    paymentIntentId,
    status: "pending",
    message: "Pagamento em processamento. Você será notificado quando for aprovado.",
    requiresAction: true,
  };
}

/**
 * Processar pagamento via PIX.
 * Retorna dados para gerar QR Code (virão do backend via Mercado Pago).
 */
export async function processPixPayment(
  paymentIntentId: string
): Promise<PaymentResult> {
  // O PIX é gerado pelo Mercado Pago durante a criação da preferência.
  // O initPoint/sandboxInitPoint já contém o link para pagamento.
  return {
    success: true,
    paymentIntentId,
    status: "pending",
    message: "Redirecionando para pagamento PIX via Mercado Pago.",
    requiresAction: true,
  };
}

/**
 * Processar pagamento via Boleto.
 */
export async function processBoletoPayment(
  paymentIntentId: string
): Promise<PaymentResult> {
  return {
    success: true,
    paymentIntentId,
    status: "pending",
    message: "Redirecionando para pagamento via Boleto.",
    requiresAction: true,
  };
}

/**
 * Verificar status de pagamento via backend.
 */
export async function checkPaymentStatus(
  paymentIntentId: string
): Promise<PaymentStatus> {
  try {
    const history = await apiClient.getPaymentHistory();
    const payments = history?.data || history || [];
    const payment = payments.find((p: any) => p.id === paymentIntentId);
    if (!payment) return "failed";

    const statusMap: Record<string, PaymentStatus> = {
      PENDING: "pending",
      PROCESSING: "processing",
      PAID: "paid",
      FAILED: "failed",
      REFUNDED: "refunded",
      CANCELLED: "failed",
    };
    return statusMap[payment.status] || "pending";
  } catch {
    return "failed";
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
      (p: any) => p.status === "PENDING" || p.status === "PROCESSING"
    );

    if (pendingPayment) {
      return {
        isValid: false,
        reason: "Há um pagamento pendente. Aguarde a confirmação.",
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
    credit_card: "CREDIT_CARD",
    pix: "PIX",
    boleto: "BOLETO",
  };
  return map[method] || "CREDIT_CARD";
}

/**
 * Criar preferência de pagamento (agora via backend).
 */
export async function createMercadoPagoPreference(preference: any) {
  // A preferência é criada pelo backend durante createPaymentIntent.
  // Esta função mantém compatibilidade com código existente.
  return preference;
}
