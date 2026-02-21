import {
  PaymentIntent,
  PaymentResult,
  PaymentMethod,
  MercadoPagoConfig,
  MercadoPagoPreference,
  CardTokenData,
  PixPaymentData,
  BoletoPaymentData,
  PaymentStatus,
} from "../types/payment";
import { generateId } from "../utils/id";

// Configuração do Mercado Pago (mock - em produção viria de variáveis de ambiente)
const MOCK_MERCADOPAGO_CONFIG: MercadoPagoConfig = {
  publicKey: import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || "TEST_PUBLIC_KEY",
  accessToken: import.meta.env.VITE_MERCADOPAGO_ACCESS_TOKEN || "TEST_ACCESS_TOKEN",
  environment: (import.meta.env.VITE_MERCADOPAGO_ENV as "sandbox" | "production") || "sandbox",
};

const PAYMENT_INTENTS_STORAGE_KEY = "paymentIntents";

// Simular delay de API
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Criar preferência de pagamento no Mercado Pago
 */
export async function createMercadoPagoPreference(
  preference: MercadoPagoPreference
): Promise<MercadoPagoPreference> {
  // Em produção, isso faria uma chamada real à API do Mercado Pago
  // const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${MOCK_MERCADOPAGO_CONFIG.accessToken}`,
  //   },
  //   body: JSON.stringify(preference),
  // });
  // return await response.json();

  // Mock para desenvolvimento
  await delay(1000);
  return {
    ...preference,
    id: `mock_preference_${generateId()}`,
  };
}

/**
 * Criar intenção de pagamento
 */
export async function createPaymentIntent(
  planId: string,
  amount: number,
  method: PaymentMethod,
  metadata?: Record<string, any>
): Promise<PaymentIntent> {
  const paymentIntent: PaymentIntent = {
    id: generateId(),
    planId,
    amount,
    method,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata,
  };

  // Salvar no localStorage
  const existing = getPaymentIntents();
  existing.push(paymentIntent);
  localStorage.setItem(PAYMENT_INTENTS_STORAGE_KEY, JSON.stringify(existing));

  return paymentIntent;
}

/**
 * Processar pagamento com cartão de crédito via token do Mercado Pago SDK.
 * Dados sensíveis do cartão nunca passam pelo nosso código — apenas o token.
 */
export async function processCreditCardPayment(
  paymentIntentId: string,
  tokenData: CardTokenData
): Promise<PaymentResult> {
  const paymentIntent = getPaymentIntent(paymentIntentId);
  if (!paymentIntent) {
    return {
      success: false,
      paymentIntentId,
      status: "failed",
      message: "Intenção de pagamento não encontrada",
      error: "PAYMENT_INTENT_NOT_FOUND",
    };
  }

  if (!tokenData.token) {
    return {
      success: false,
      paymentIntentId,
      status: "failed",
      message: "Token de pagamento não recebido",
      error: "MISSING_TOKEN",
    };
  }

  // TODO: Em produção, enviar token ao backend:
  // POST /api/payments/process { paymentIntentId, token, paymentMethodId, issuerId, installments }
  // O backend envia o token à API do Mercado Pago para processar o pagamento.
  // Por enquanto, simulamos o resultado.
  await delay(2000);
  const success = Math.random() > 0.1;

  if (success) {
    const updatedIntent: PaymentIntent = {
      ...paymentIntent,
      status: "paid",
      updatedAt: new Date().toISOString(),
      mercadoPagoPaymentId: `mp_payment_${generateId()}`,
    };

    updatePaymentIntent(updatedIntent);

    return {
      success: true,
      paymentIntentId,
      status: "paid",
      message: "Pagamento aprovado com sucesso",
    };
  } else {
    const updatedIntent: PaymentIntent = {
      ...paymentIntent,
      status: "failed",
      updatedAt: new Date().toISOString(),
      errorMessage: "Pagamento recusado pelo banco",
    };

    updatePaymentIntent(updatedIntent);

    return {
      success: false,
      paymentIntentId,
      status: "failed",
      message: "Pagamento recusado. Verifique os dados do cartão.",
      error: "PAYMENT_DECLINED",
    };
  }
}

/**
 * Processar pagamento via PIX
 */
export async function processPixPayment(
  paymentIntentId: string
): Promise<PaymentResult> {
  await delay(1500);

  const paymentIntent = getPaymentIntent(paymentIntentId);
  if (!paymentIntent) {
    return {
      success: false,
      paymentIntentId,
      status: "failed",
      message: "Intenção de pagamento não encontrada",
      error: "PAYMENT_INTENT_NOT_FOUND",
    };
  }

  // Gerar QR Code mock
  const pixData: PixPaymentData = {
    qrCode: `00020126580014BR.GOV.BCB.PIX0136mock_qr_code_${generateId()}`,
    copyPaste: `00020126580014BR.GOV.BCB.PIX0136mock_qr_code_${generateId()}`,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
  };

  const updatedIntent: PaymentIntent = {
    ...paymentIntent,
    status: "pending",
    updatedAt: new Date().toISOString(),
    paymentData: pixData,
  };

  updatePaymentIntent(updatedIntent);

  return {
    success: true,
    paymentIntentId,
    status: "pending",
    message: "QR Code PIX gerado. Escaneie para pagar.",
    requiresAction: true,
    actionData: pixData,
  };
}

/**
 * Processar pagamento via Boleto
 */
export async function processBoletoPayment(
  paymentIntentId: string
): Promise<PaymentResult> {
  await delay(1500);

  const paymentIntent = getPaymentIntent(paymentIntentId);
  if (!paymentIntent) {
    return {
      success: false,
      paymentIntentId,
      status: "failed",
      message: "Intenção de pagamento não encontrada",
      error: "PAYMENT_INTENT_NOT_FOUND",
    };
  }

  // Gerar dados do boleto mock
  const boletoData: BoletoPaymentData = {
    barcode: `34191.09008 01234.567890 12345.678901 2 12345678901234`,
    digitableLine: `34191.09008 01234.567890 12345.678901 2 12345678901234`,
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 dias
    pdfUrl: `https://api.mercadopago.com/v1/payments/${paymentIntentId}/ticket/pdf`,
  };

  const updatedIntent: PaymentIntent = {
    ...paymentIntent,
    status: "pending",
    updatedAt: new Date().toISOString(),
    paymentData: boletoData,
  };

  updatePaymentIntent(updatedIntent);

  return {
    success: true,
    paymentIntentId,
    status: "pending",
    message: "Boleto gerado. Pague até a data de vencimento.",
    requiresAction: true,
    actionData: boletoData,
  };
}

/**
 * Verificar status de pagamento
 */
export async function checkPaymentStatus(
  paymentIntentId: string
): Promise<PaymentStatus> {
  await delay(500);

  const paymentIntent = getPaymentIntent(paymentIntentId);
  if (!paymentIntent) {
    return "failed";
  }

  // Em produção, isso consultaria a API do Mercado Pago
  // const response = await fetch(
  //   `https://api.mercadopago.com/v1/payments/${paymentIntent.mercadoPagoPaymentId}`,
  //   {
  //     headers: {
  //       Authorization: `Bearer ${MOCK_MERCADOPAGO_CONFIG.accessToken}`,
  //     },
  //   }
  // );
  // const payment = await response.json();
  // return mapMercadoPagoStatus(payment.status);

  return paymentIntent.status;
}

/**
 * Validar se pode fazer upgrade (verificar pagamento pendente/ativo)
 */
export function validatePaymentForUpgrade(
  planId: string
): { isValid: boolean; reason?: string; pendingPayment?: PaymentIntent } {
  const intents = getPaymentIntents();
  
  // Buscar pagamentos pendentes ou processando para este plano
  const pendingPayment = intents.find(
    (intent) =>
      intent.planId === planId &&
      (intent.status === "pending" || intent.status === "processing")
  );

  if (pendingPayment) {
    return {
      isValid: false,
      reason: "Há um pagamento pendente para este plano",
      pendingPayment,
    };
  }

  // Buscar pagamento aprovado recente (últimas 24h)
  const recentPaidPayment = intents.find(
    (intent) =>
      intent.planId === planId &&
      intent.status === "paid" &&
      new Date(intent.updatedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
  );

  if (recentPaidPayment) {
    return {
      isValid: true,
    };
  }

  // Se não há pagamento recente, precisa pagar
  return {
    isValid: false,
    reason: "É necessário realizar o pagamento antes de fazer upgrade",
  };
}

/**
 * Obter intenção de pagamento
 */
export function getPaymentIntent(paymentIntentId: string): PaymentIntent | null {
  const intents = getPaymentIntents();
  return intents.find((intent) => intent.id === paymentIntentId) || null;
}

/**
 * Obter todas as intenções de pagamento
 */
export function getPaymentIntents(): PaymentIntent[] {
  try {
    const stored = localStorage.getItem(PAYMENT_INTENTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Erro ao carregar intenções de pagamento:", error);
  }
  return [];
}

/**
 * Atualizar intenção de pagamento
 */
function updatePaymentIntent(updatedIntent: PaymentIntent): void {
  const intents = getPaymentIntents();
  const index = intents.findIndex((intent) => intent.id === updatedIntent.id);
  
  if (index >= 0) {
    intents[index] = updatedIntent;
  } else {
    intents.push(updatedIntent);
  }
  
  localStorage.setItem(PAYMENT_INTENTS_STORAGE_KEY, JSON.stringify(intents));
}

/**
 * Simular webhook do Mercado Pago (para testes)
 */
export async function simulateWebhookNotification(
  paymentIntentId: string,
  status: PaymentStatus
): Promise<void> {
  const paymentIntent = getPaymentIntent(paymentIntentId);
  if (!paymentIntent) return;

  const updatedIntent: PaymentIntent = {
    ...paymentIntent,
    status,
    updatedAt: new Date().toISOString(),
  };

  updatePaymentIntent(updatedIntent);
}








