import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { PlanType, Plan, PlanLimits, PlanUsage, PaymentHistory, Subscription } from "../types/plan";

interface PlanContextType {
  currentPlan: PlanType;
  plans: Plan[];
  planLimits: PlanLimits;
  planUsage: PlanUsage;
  subscription: Subscription | null;
  paymentHistory: PaymentHistory[];
  changePlan: (newPlan: PlanType, skipPaymentValidation?: boolean) => Promise<void>;
  changePlanWithPayment: (newPlan: PlanType, paymentIntentId: string) => Promise<void>;
  getPlan: (planType: PlanType) => Plan;
  canUpgrade: () => boolean;
  canDowngrade: () => boolean;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

// Limites completos por plano
const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  starter: {
    maxLeads: 250,
    maxUsers: 1,
    maxAutomations: 5,
    maxWhatsAppConnections: 1,
    maxEmailConfigs: 1,
    features: {
      whatsapp: true,
      email: true,
      sms: false,
      api: false,
      customFields: true,
      reports: true,
      automations: true,
      webhooks: true,
      integrations: true,
    },
  },
  pro: {
    maxLeads: 1000,
    maxUsers: 5,
    maxAutomations: Infinity,
    maxWhatsAppConnections: 3,
    maxEmailConfigs: 3,
    features: {
      whatsapp: true,
      email: true,
      sms: false,
      api: false,
      customFields: true,
      reports: true,
      automations: true,
      webhooks: true,
      integrations: true,
    },
  },
  enterprise: {
    maxLeads: Infinity,
    maxUsers: Infinity,
    maxAutomations: Infinity,
    maxWhatsAppConnections: Infinity,
    maxEmailConfigs: Infinity,
    features: {
      whatsapp: true,
      email: true,
      sms: true,
      api: true,
      customFields: true,
      reports: true,
      automations: true,
      webhooks: true,
      integrations: true,
    },
  },
};

// Definição dos planos disponíveis
const AVAILABLE_PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 97,
    description: "Ideal para pequenas empresas começando",
    features: [
      "Até 250 leads",
      "1 usuário",
      "5 automações",
      "WhatsApp + E-mail",
      "Suporte por e-mail",
    ],
    limits: PLAN_LIMITS.starter,
  },
  {
    id: "pro",
    name: "Pro",
    price: 197,
    description: "Para empresas em crescimento",
    features: [
      "Até 1.000 leads",
      "5 usuários",
      "Automações ilimitadas",
      "WhatsApp + E-mail",
      "Suporte prioritário",
      "Integrações avançadas",
    ],
    limits: PLAN_LIMITS.pro,
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 497,
    description: "Solução completa para grandes empresas",
    features: [
      "Leads ilimitados",
      "Usuários ilimitados",
      "Automações ilimitadas",
      "WhatsApp + E-mail + SMS",
      "Suporte 24/7",
      "API customizada",
      "Gerente de conta dedicado",
    ],
    limits: PLAN_LIMITS.enterprise,
  },
];

const PLAN_STORAGE_KEY = "currentPlan";
const SUBSCRIPTION_STORAGE_KEY = "subscription";
const PAYMENT_HISTORY_STORAGE_KEY = "paymentHistory";

// Função para calcular uso atual
const calculateUsage = (currentPlan: PlanType): PlanUsage => {
  // Buscar leads do localStorage
  let leadsCount = 0;
  try {
    const stored = localStorage.getItem("leads");
    if (stored) {
      const leads = JSON.parse(stored);
      leadsCount = Array.isArray(leads) ? leads.length : 0;
    }
  } catch (error) {
    console.error("Erro ao calcular leads:", error);
  }

  // Buscar conexões WhatsApp
  let whatsappConnectionsCount = 0;
  try {
    const stored = localStorage.getItem("whatsappConnections");
    if (stored) {
      const connections = JSON.parse(stored);
      whatsappConnectionsCount = Array.isArray(connections) ? connections.length : 0;
    }
  } catch (error) {
    console.error("Erro ao calcular conexões WhatsApp:", error);
  }

  // Buscar configurações de email
  let emailConfigsCount = 0;
  try {
    const stored = localStorage.getItem("emailConfigs");
    if (stored) {
      const configs = JSON.parse(stored);
      emailConfigsCount = Array.isArray(configs) ? configs.length : 0;
    }
  } catch (error) {
    console.error("Erro ao calcular configurações de email:", error);
  }

  // Buscar automações
  let automationsCount = 0;
  try {
    const stored = localStorage.getItem("automations");
    if (stored) {
      const automations = JSON.parse(stored);
      automationsCount = Array.isArray(automations) ? automations.length : 0;
    }
  } catch (error) {
    console.error("Erro ao calcular automações:", error);
  }

  // Usuários (mockado por enquanto - fixo em 2)
  const usersCount = 2;

  const limits = PLAN_LIMITS[currentPlan];

  const calculatePercentage = (current: number, limit: number) => {
    if (limit === Infinity) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  return {
    leads: {
      current: leadsCount,
      limit: limits.maxLeads === Infinity ? 0 : limits.maxLeads,
      percentage: calculatePercentage(leadsCount, limits.maxLeads),
    },
    users: {
      current: usersCount,
      limit: limits.maxUsers === Infinity ? 0 : limits.maxUsers,
      percentage: calculatePercentage(usersCount, limits.maxUsers),
    },
    automations: {
      current: automationsCount,
      limit: limits.maxAutomations === Infinity ? 0 : limits.maxAutomations,
      percentage: calculatePercentage(automationsCount, limits.maxAutomations),
    },
    whatsappConnections: {
      current: whatsappConnectionsCount,
      limit: limits.maxWhatsAppConnections === Infinity ? 0 : limits.maxWhatsAppConnections,
      percentage: calculatePercentage(whatsappConnectionsCount, limits.maxWhatsAppConnections),
    },
    emailConfigs: {
      current: emailConfigsCount,
      limit: limits.maxEmailConfigs === Infinity ? 0 : limits.maxEmailConfigs,
      percentage: calculatePercentage(emailConfigsCount, limits.maxEmailConfigs),
    },
  };
};

export function PlanProvider({ children }: { children: ReactNode }) {
  const [currentPlan, setCurrentPlan] = useState<PlanType>(() => {
    try {
      const saved = localStorage.getItem(PLAN_STORAGE_KEY);
      if (saved && (saved === "starter" || saved === "pro" || saved === "enterprise")) {
        return saved as PlanType;
      }
    } catch (error) {
      console.error("Erro ao carregar plano do localStorage:", error);
    }
    return "pro"; // Plano padrão
  });

  const [subscription, setSubscription] = useState<Subscription | null>(() => {
    try {
      const saved = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error("Erro ao carregar assinatura do localStorage:", error);
    }
    // Criar assinatura padrão se não existir
    const defaultSubscription: Subscription = {
      plan: currentPlan,
      status: "active",
      startDate: new Date().toISOString(),
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
      billingCycle: "monthly",
    };
    return defaultSubscription;
  });

  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>(() => {
    try {
      const saved = localStorage.getItem(PAYMENT_HISTORY_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico de pagamentos do localStorage:", error);
    }
    return [];
  });

  // Calcular uso atual
  const planUsage = useMemo(() => calculateUsage(currentPlan), [currentPlan]);

  // Limites do plano atual
  const planLimits = useMemo(() => PLAN_LIMITS[currentPlan], [currentPlan]);

  // Função para mudar plano
  const changePlan = async (newPlan: PlanType, skipPaymentValidation: boolean = false) => {
    if (newPlan === currentPlan) return;

    // Verificar se é upgrade (não downgrade)
    const planOrder: PlanType[] = ["starter", "pro", "enterprise"];
    const currentIndex = planOrder.indexOf(currentPlan);
    const newIndex = planOrder.indexOf(newPlan);
    const isUpgrade = newIndex > currentIndex;

    // Se for upgrade, validar pagamento (a menos que seja explicitamente ignorado)
    if (isUpgrade && !skipPaymentValidation) {
      // Importar dinamicamente para evitar dependência circular
      const { validatePaymentForUpgrade } = await import("../services/paymentService");
      const validation = validatePaymentForUpgrade(newPlan);

      if (!validation.isValid) {
        throw new Error(
          validation.reason || "É necessário realizar o pagamento antes de fazer upgrade"
        );
      }

      // Verificar se há pagamento aprovado recente
      const recentPaidPayment = paymentHistory.find(
        (payment) =>
          payment.plan === newPlan &&
          payment.status === "paid" &&
          new Date(payment.date).getTime() > Date.now() - 24 * 60 * 60 * 1000
      );

      if (!recentPaidPayment) {
        throw new Error(
          "É necessário realizar o pagamento antes de fazer upgrade. Use a função changePlanWithPayment."
        );
      }
    }

    try {
      // Atualizar plano no localStorage
      localStorage.setItem(PLAN_STORAGE_KEY, newPlan);

      // Atualizar também nos contextos de Email e WhatsApp para manter sincronização
      localStorage.setItem("currentPlan", newPlan);

      // Atualizar assinatura
      const updatedSubscription: Subscription = {
        ...subscription!,
        plan: newPlan,
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      setSubscription(updatedSubscription);
      localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(updatedSubscription));

      // Se for upgrade e houver pagamento recente, não adicionar novamente ao histórico
      // (já foi adicionado quando o pagamento foi processado)
      if (!isUpgrade || skipPaymentValidation) {
        // Adicionar ao histórico de pagamentos apenas para downgrade ou quando skipPaymentValidation
        const newPayment: PaymentHistory = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          amount: AVAILABLE_PLANS.find(p => p.id === newPlan)?.price || 0,
          status: isUpgrade ? "paid" : "paid", // Downgrade também registra (mas sem cobrança)
          plan: newPlan,
        };
        const updatedHistory = [newPayment, ...paymentHistory];
        setPaymentHistory(updatedHistory);
        localStorage.setItem(PAYMENT_HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
      }

      setCurrentPlan(newPlan);

      // Recarregar a página para atualizar todos os contextos
      window.location.reload();
    } catch (error) {
      console.error("Erro ao mudar plano:", error);
      throw error;
    }
  };

  // Função para mudar plano após pagamento aprovado
  const changePlanWithPayment = async (newPlan: PlanType, paymentIntentId: string) => {
    // Verificar se o pagamento foi aprovado
    const { getPaymentIntent } = await import("../services/paymentService");
    const paymentIntent = getPaymentIntent(paymentIntentId);

    if (!paymentIntent || paymentIntent.status !== "paid") {
      throw new Error("Pagamento não encontrado ou não aprovado");
    }

    if (paymentIntent.planId !== newPlan) {
      throw new Error("Pagamento não corresponde ao plano selecionado");
    }

    // Mudar plano sem validação adicional (já foi validado)
    await changePlan(newPlan, true);
  };

  // Obter informações de um plano específico
  const getPlan = (planType: PlanType): Plan => {
    return AVAILABLE_PLANS.find(p => p.id === planType) || AVAILABLE_PLANS[1];
  };

  // Verificar se pode fazer upgrade
  const canUpgrade = (): boolean => {
    return currentPlan !== "enterprise";
  };

  // Verificar se pode fazer downgrade
  const canDowngrade = (): boolean => {
    return currentPlan !== "starter";
  };

  // Atualizar assinatura quando o plano muda
  useEffect(() => {
    if (subscription && subscription.plan !== currentPlan) {
      const updatedSubscription: Subscription = {
        ...subscription,
        plan: currentPlan,
      };
      setSubscription(updatedSubscription);
      localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(updatedSubscription));
    }
  }, [currentPlan]);

  const value: PlanContextType = {
    currentPlan,
    plans: AVAILABLE_PLANS,
    planLimits,
    planUsage,
    subscription,
    paymentHistory,
    changePlan,
    changePlanWithPayment,
    getPlan,
    canUpgrade,
    canDowngrade,
  };

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (context === undefined) {
    throw new Error("usePlan deve ser usado dentro de um PlanProvider");
  }
  return context;
}

