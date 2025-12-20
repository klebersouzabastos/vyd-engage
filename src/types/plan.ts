// Tipos para gerenciamento de planos

export type PlanType = "starter" | "pro" | "enterprise";

// Limites completos por plano
export interface PlanLimits {
  maxLeads: number; // Infinity para ilimitado
  maxUsers: number; // Infinity para ilimitado
  maxAutomations: number; // Infinity para ilimitado
  maxWhatsAppConnections: number; // Infinity para ilimitado
  maxEmailConfigs: number; // Infinity para ilimitado
  features: {
    whatsapp: boolean;
    email: boolean;
    sms: boolean; // Apenas Enterprise
    api: boolean; // API customizada apenas Enterprise
    customFields: boolean;
    reports: boolean;
    automations: boolean;
    webhooks: boolean;
    integrations: boolean;
  };
}

// Informações do plano
export interface Plan {
  id: PlanType;
  name: string;
  price: number; // Preço mensal em reais
  description: string;
  features: string[]; // Lista de features em texto
  limits: PlanLimits;
  highlighted?: boolean; // Para destacar plano recomendado
}

// Uso atual do plano
export interface PlanUsage {
  leads: {
    current: number;
    limit: number;
    percentage: number;
  };
  users: {
    current: number;
    limit: number;
    percentage: number;
  };
  automations: {
    current: number;
    limit: number;
    percentage: number;
  };
  whatsappConnections: {
    current: number;
    limit: number;
    percentage: number;
  };
  emailConfigs: {
    current: number;
    limit: number;
    percentage: number;
  };
}

// Histórico de pagamento
export interface PaymentHistory {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed" | "refunded";
  plan: PlanType;
  invoiceUrl?: string;
}

// Informações da assinatura atual
export interface Subscription {
  plan: PlanType;
  status: "active" | "cancelled" | "expired" | "trial";
  startDate: string;
  renewalDate: string;
  billingCycle: "monthly" | "yearly";
  paymentMethod?: {
    type: "credit_card" | "pix" | "boleto";
    last4?: string;
    brand?: string;
  };
}








