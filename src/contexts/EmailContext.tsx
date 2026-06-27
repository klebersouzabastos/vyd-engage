import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import {
  EmailConfig,
  EmailProvider as EmailProviderType,
  EmailStatus,
  PlanType,
  PlanLimits,
  ProviderConfig,
  EmailStatusInfo,
} from '../types/email';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import { getErrorMessage } from '../utils/errors';
import { useAuth } from './AuthContext';

interface EmailContextType {
  configs: EmailConfig[];
  currentPlan: PlanType;
  planLimits: PlanLimits;
  addEmailConfig: (config: Omit<EmailConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEmailConfig: (id: string, updates: Partial<EmailConfig>) => Promise<void>;
  deleteEmailConfig: (id: string) => Promise<void>;
  setDefaultEmailConfig: (id: string) => Promise<void>;
  getDefaultEmailConfig: () => EmailConfig | null;
  getEmailConfig: (id: string) => EmailConfig | null;
  updateEmailConfigStatus: (id: string, status: EmailStatusInfo) => void;
  canAddEmailConfig: () => boolean;
  getEmailConfigsByProvider: (provider: EmailProvider) => EmailConfig[];
  refreshEmailConfigStatus: (id: string) => Promise<void>;
}

const EmailContext = createContext<EmailContextType | undefined>(undefined);

// Limites por plano
const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  starter: {
    maxConfigs: 1,
    features: {
      smtp: true,
      sendgrid: true,
      mailgun: false,
      resend: false,
    },
  },
  pro: {
    maxConfigs: 3,
    features: {
      smtp: true,
      sendgrid: true,
      mailgun: true,
      resend: true,
    },
  },
  enterprise: {
    maxConfigs: Infinity,
    features: {
      smtp: true,
      sendgrid: true,
      mailgun: true,
      resend: true,
    },
  },
};

export function EmailProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<PlanType>('pro');
  const planLimits = PLAN_LIMITS[currentPlan];

  // Carregar plano atual da API de assinatura
  useEffect(() => {
    if (!user) return;
    apiClient
      .getCurrentSubscription()
      .then((sub: Record<string, unknown>) => {
        const subscription = sub?.subscription as Record<string, unknown> | undefined;
        const plan = subscription?.plan as Record<string, unknown> | undefined;
        const planType = (plan?.type as string)?.toLowerCase();
        if (planType && ['starter', 'pro', 'enterprise'].includes(planType)) {
          setCurrentPlan(planType as PlanType);
        }
      })
      .catch(() => {
        // Manter default "pro" se API falhar
      });
  }, [user]);

  // Carregar configurações da API
  interface ApiEmailConfig {
    id: string;
    name: string;
    provider: string;
    fromEmail: string;
    fromName?: string;
    config?: ProviderConfig;
    verified?: boolean;
    verifiedAt?: string;
    createdAt: string;
    updatedAt: string;
  }

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const apiConfigs = await apiClient.getEmailConfigs();
      // Transform API response to match EmailConfig type
      const transformedConfigs: EmailConfig[] = apiConfigs.map((config: ApiEmailConfig) => ({
        id: config.id,
        name: config.name,
        provider: config.provider.toLowerCase() as EmailProviderType,
        fromEmail: config.fromEmail,
        fromName: config.fromName || '',
        config: config.config || {},
        status: {
          status: config.verified ? 'verified' : ('unverified' as EmailStatus),
          lastTested: config.verifiedAt || undefined,
        },
        isDefault: false, // Backend doesn't have this field yet
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        lastUsedAt: config.verifiedAt || undefined,
      }));
      setConfigs(transformedConfigs);
    } catch (error) {
      console.error('Erro ao carregar configurações de email:', error);
      toast.error('Erro ao carregar configurações de email');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setConfigs([]);
      setLoading(false);
      return;
    }
    fetchConfigs();
  }, [user, fetchConfigs]);

  // Verificar se pode adicionar mais configurações
  const canAddEmailConfig = useCallback(() => {
    if (planLimits.maxConfigs === Infinity) return true;
    return configs.length < planLimits.maxConfigs;
  }, [configs.length, planLimits.maxConfigs]);

  // Adicionar nova configuração
  const addEmailConfig = useCallback(
    async (configData: Omit<EmailConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!canAddEmailConfig()) {
        throw new Error(
          `Limite de configurações atingido. Seu plano permite ${planLimits.maxConfigs} configuração(ões).`
        );
      }

      try {
        const result = await apiClient.createEmailConfig({
          name: configData.name,
          provider: configData.provider.toUpperCase(),
          fromEmail: configData.fromEmail,
          fromName: configData.fromName,
          config: configData.config,
        });

        const newConfig: EmailConfig = {
          id: result.id,
          name: result.name,
          provider: result.provider.toLowerCase() as EmailProviderType,
          fromEmail: result.fromEmail,
          fromName: result.fromName || '',
          config: result.config || {},
          status: {
            status: result.verified ? 'verified' : ('unverified' as EmailStatus),
            lastTested: result.verifiedAt || undefined,
          },
          isDefault: configs.length === 0,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
          lastUsedAt: result.verifiedAt || undefined,
        };

        setConfigs((prev) => [...prev, newConfig]);
        toast.success('Configuração de email criada com sucesso!');
      } catch (error) {
        toast.error(getErrorMessage(error) || 'Erro ao criar configuração de email');
        throw error;
      }
    },
    [canAddEmailConfig, configs.length, planLimits.maxConfigs]
  );

  // Atualizar configuração
  const updateEmailConfig = useCallback(async (id: string, updates: Partial<EmailConfig>) => {
    try {
      const result = await apiClient.updateEmailConfig(id, {
        name: updates.name,
        provider: updates.provider?.toUpperCase(),
        fromEmail: updates.fromEmail,
        fromName: updates.fromName,
        config: updates.config,
      });

      const updatedConfig: EmailConfig = {
        id: result.id,
        name: result.name,
        provider: result.provider.toLowerCase() as EmailProviderType,
        fromEmail: result.fromEmail,
        fromName: result.fromName || '',
        config: result.config || {},
        status: {
          status: result.verified ? 'verified' : ('unverified' as EmailStatus),
          lastTested: result.verifiedAt || undefined,
        },
        isDefault: updates.isDefault ?? false,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        lastUsedAt: result.verifiedAt || undefined,
      };

      setConfigs((prev) =>
        prev.map((cfg) => {
          if (cfg.id === id) {
            return updatedConfig;
          }
          // Se outra configuração está sendo marcada como padrão, remover padrão desta
          if (updates.isDefault && cfg.isDefault) {
            return { ...cfg, isDefault: false };
          }
          return cfg;
        })
      );
      toast.success('Configuração atualizada com sucesso!');
    } catch (error) {
      toast.error(getErrorMessage(error) || 'Erro ao atualizar configuração');
      throw error;
    }
  }, []);

  // Deletar configuração
  const deleteEmailConfig = useCallback(async (id: string) => {
    try {
      await apiClient.deleteEmailConfig(id);
      setConfigs((prev) => {
        const filtered = prev.filter((cfg) => cfg.id !== id);
        // Se deletou a configuração padrão e ainda há outras, definir primeira como padrão
        const deletedWasDefault = prev.find((cfg) => cfg.id === id)?.isDefault;
        if (deletedWasDefault && filtered.length > 0) {
          return filtered.map((cfg, index) => (index === 0 ? { ...cfg, isDefault: true } : cfg));
        }
        return filtered;
      });
      toast.success('Configuração deletada com sucesso!');
    } catch (error) {
      toast.error(getErrorMessage(error) || 'Erro ao deletar configuração');
      throw error;
    }
  }, []);

  // Definir configuração padrão
  const setDefaultEmailConfig = useCallback(
    async (id: string) => {
      await updateEmailConfig(id, { isDefault: true });
    },
    [updateEmailConfig]
  );

  // Obter configuração padrão
  const getDefaultEmailConfig = useCallback(() => {
    return configs.find((cfg) => cfg.isDefault) || configs[0] || null;
  }, [configs]);

  // Obter configuração por ID
  const getEmailConfig = useCallback(
    (id: string) => {
      return configs.find((cfg) => cfg.id === id) || null;
    },
    [configs]
  );

  // Atualizar status de configuração
  const updateEmailConfigStatus = useCallback((id: string, status: EmailStatusInfo) => {
    const now = new Date().toISOString();
    setConfigs((prev) =>
      prev.map((cfg) => {
        if (cfg.id === id) {
          return {
            ...cfg,
            status,
            updatedAt: now,
            lastUsedAt: status.status === 'connected' ? now : cfg.lastUsedAt,
          };
        }
        return cfg;
      })
    );
  }, []);

  // Obter configurações por provedor
  const getEmailConfigsByProvider = useCallback(
    (provider: EmailProviderType) => {
      return configs.filter((cfg) => cfg.provider === provider);
    },
    [configs]
  );

  // Atualizar status de configuração (buscar da API)
  const refreshEmailConfigStatus = useCallback(
    async (id: string) => {
      try {
        const result = await apiClient.getEmailConfig(id);
        updateEmailConfigStatus(id, {
          status: result.verified ? 'verified' : ('unverified' as EmailStatus),
          lastTested: result.verifiedAt || undefined,
        });
      } catch (error) {
        console.error('Erro ao atualizar status da configuração:', error);
        toast.error('Erro ao atualizar status da configuração');
      }
    },
    [updateEmailConfigStatus]
  );

  const value = useMemo(
    () => ({
      configs,
      currentPlan,
      planLimits,
      addEmailConfig,
      updateEmailConfig,
      deleteEmailConfig,
      setDefaultEmailConfig,
      getDefaultEmailConfig,
      getEmailConfig,
      updateEmailConfigStatus,
      canAddEmailConfig,
      getEmailConfigsByProvider,
      refreshEmailConfigStatus,
    }),
    [
      configs,
      currentPlan,
      planLimits,
      addEmailConfig,
      updateEmailConfig,
      deleteEmailConfig,
      setDefaultEmailConfig,
      getDefaultEmailConfig,
      getEmailConfig,
      updateEmailConfigStatus,
      canAddEmailConfig,
      getEmailConfigsByProvider,
      refreshEmailConfigStatus,
    ]
  );

  return <EmailContext.Provider value={value}>{children}</EmailContext.Provider>;
}

export function useEmail() {
  const context = useContext(EmailContext);
  if (context === undefined) {
    throw new Error('useEmail must be used within an EmailProvider');
  }
  return context;
}
