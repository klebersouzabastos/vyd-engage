import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { PlanType, Plan, PlanLimits, PlanUsage, PaymentHistory, Subscription } from "../types/plan";
import { apiClient } from "../services/api/client";
import { useAuth } from "./AuthContext";

interface PlanContextType {
  currentPlan: PlanType;
  plans: Plan[];
  planLimits: PlanLimits;
  planUsage: PlanUsage;
  subscription: Subscription | null;
  paymentHistory: PaymentHistory[];
  loading: boolean;
  changePlan: (newPlan: PlanType) => Promise<void>;
  changePlanWithPayment: (newPlan: PlanType, paymentIntentId: string) => Promise<void>;
  getPlan: (planType: PlanType) => Plan;
  canUpgrade: () => boolean;
  canDowngrade: () => boolean;
  refresh: () => Promise<void>;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

// Default limits per plan (used as fallback when API is unavailable)
const DEFAULT_PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  starter: {
    maxLeads: 250,
    maxUsers: 1,
    maxAutomations: 5,
    maxWhatsAppConnections: 1,
    maxEmailConfigs: 1,
    features: {
      whatsapp: true, email: true, sms: false, api: false,
      customFields: true, reports: true, automations: true, webhooks: true, integrations: true,
    },
  },
  pro: {
    maxLeads: 1000,
    maxUsers: 5,
    maxAutomations: Infinity,
    maxWhatsAppConnections: 3,
    maxEmailConfigs: 3,
    features: {
      whatsapp: true, email: true, sms: false, api: false,
      customFields: true, reports: true, automations: true, webhooks: true, integrations: true,
    },
  },
  enterprise: {
    maxLeads: Infinity,
    maxUsers: Infinity,
    maxAutomations: Infinity,
    maxWhatsAppConnections: Infinity,
    maxEmailConfigs: Infinity,
    features: {
      whatsapp: true, email: true, sms: true, api: true,
      customFields: true, reports: true, automations: true, webhooks: true, integrations: true,
    },
  },
};

const DEFAULT_PLANS: Plan[] = [
  {
    id: "starter", name: "Starter", price: 97,
    description: "Ideal para pequenas empresas começando",
    features: ["Até 250 leads", "1 usuário", "5 automações", "WhatsApp + E-mail", "Suporte por e-mail"],
    limits: DEFAULT_PLAN_LIMITS.starter,
  },
  {
    id: "pro", name: "Pro", price: 197,
    description: "Para empresas em crescimento",
    features: ["Até 1.000 leads", "5 usuários", "Automações ilimitadas", "WhatsApp + E-mail", "Suporte prioritário", "Integrações avançadas"],
    limits: DEFAULT_PLAN_LIMITS.pro,
    highlighted: true,
  },
  {
    id: "enterprise", name: "Enterprise", price: 497,
    description: "Solução completa para grandes empresas",
    features: ["Leads ilimitados", "Usuários ilimitados", "Automações ilimitadas", "WhatsApp + E-mail + SMS", "Suporte 24/7", "API customizada", "Gerente de conta dedicado"],
    limits: DEFAULT_PLAN_LIMITS.enterprise,
  },
];

const emptyUsage: PlanUsage = {
  leads: { current: 0, limit: 0, percentage: 0 },
  users: { current: 0, limit: 0, percentage: 0 },
  automations: { current: 0, limit: 0, percentage: 0 },
  whatsappConnections: { current: 0, limit: 0, percentage: 0 },
  emailConfigs: { current: 0, limit: 0, percentage: 0 },
};

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<PlanType>("pro");
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [planUsage, setPlanUsage] = useState<PlanUsage>(emptyUsage);
  const [loading, setLoading] = useState(true);

  const loadFromApi = useCallback(async () => {
    try {
      const [subResult, plansResult] = await Promise.allSettled([
        apiClient.getCurrentSubscription(),
        apiClient.getPlans(),
      ]);

      if (subResult.status === "fulfilled" && subResult.value) {
        const sub = subResult.value.subscription;
        const usage = subResult.value.usage;

        if (sub?.plan?.type) {
          const planType = sub.plan.type.toLowerCase() as PlanType;
          setCurrentPlan(planType);
          setSubscription({
            plan: planType,
            status: sub.status?.toLowerCase() || "active",
            startDate: sub.startDate || sub.createdAt,
            renewalDate: sub.renewalDate,
            billingCycle: sub.billingCycle?.toLowerCase() || "monthly",
          });
        }

        if (sub?.payments) {
          setPaymentHistory(
            sub.payments.map((p: { id: string; createdAt?: string; amount: number | string; status?: string }) => ({
              id: p.id,
              date: p.createdAt,
              amount: Number(p.amount),
              status: p.status?.toLowerCase() || "pending",
              plan: (sub.plan?.type?.toLowerCase() || "pro") as PlanType,
            }))
          );
        }

        if (usage) {
          setPlanUsage(usage);
        }
      }

      if (plansResult.status === "fulfilled" && Array.isArray(plansResult.value)) {
        const apiPlans = plansResult.value.map((p: { type: string; name: string; price: number | string; description?: string; features?: string[]; limits?: PlanLimits; highlighted?: boolean }) => ({
          id: p.type.toLowerCase() as PlanType,
          name: p.name,
          price: Number(p.price),
          description: p.description || "",
          features: p.features || [],
          limits: p.limits || DEFAULT_PLAN_LIMITS[p.type.toLowerCase() as PlanType],
          highlighted: p.highlighted || false,
        }));
        if (apiPlans.length > 0) setPlans(apiPlans);
      }
    } catch {
      // API unavailable - use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadFromApi();
  }, [user, loadFromApi]);

  const planLimits = useMemo(() => DEFAULT_PLAN_LIMITS[currentPlan], [currentPlan]);

  const changePlan = useCallback(async (newPlan: PlanType) => {
    if (newPlan === currentPlan) return;
    await apiClient.changePlan({ planType: newPlan.toUpperCase() });
    setCurrentPlan(newPlan);
    await loadFromApi();
  }, [currentPlan, loadFromApi]);

  const changePlanWithPayment = useCallback(async (newPlan: PlanType, _paymentIntentId: string) => {
    await changePlan(newPlan);
  }, [changePlan]);

  const getPlan = useCallback((planType: PlanType): Plan => {
    return plans.find(p => p.id === planType) || plans[1];
  }, [plans]);

  const canUpgrade = useCallback((): boolean => currentPlan !== "enterprise", [currentPlan]);
  const canDowngrade = useCallback((): boolean => currentPlan !== "starter", [currentPlan]);

  const value = useMemo(() => ({
    currentPlan, plans, planLimits, planUsage, subscription, paymentHistory, loading,
    changePlan, changePlanWithPayment, getPlan, canUpgrade, canDowngrade, refresh: loadFromApi,
  }), [currentPlan, plans, planLimits, planUsage, subscription, paymentHistory, loading,
    changePlan, changePlanWithPayment, getPlan, canUpgrade, canDowngrade, loadFromApi]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (context === undefined) {
    throw new Error("usePlan deve ser usado dentro de um PlanProvider");
  }
  return context;
}
