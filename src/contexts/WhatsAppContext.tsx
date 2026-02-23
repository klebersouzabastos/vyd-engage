import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import {
  WhatsAppConnection,
  WhatsAppProvider as WhatsAppProviderType,
  ConnectionStatus,
  PlanType,
  PlanLimits,
  ProviderConfig,
  ConnectionStatusInfo,
} from "../types/whatsapp";
import { apiClient } from "../services/api/client";
import { toast } from "sonner";
import { getErrorMessage } from "../utils/errors";
import { useAuth } from "./AuthContext";

interface WhatsAppContextType {
  connections: WhatsAppConnection[];
  currentPlan: PlanType;
  planLimits: PlanLimits;
  addConnection: (connection: Omit<WhatsAppConnection, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateConnection: (id: string, updates: Partial<WhatsAppConnection>) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  setDefaultConnection: (id: string) => Promise<void>;
  getDefaultConnection: () => WhatsAppConnection | null;
  getConnection: (id: string) => WhatsAppConnection | null;
  updateConnectionStatus: (id: string, status: ConnectionStatusInfo) => void;
  canAddConnection: () => boolean;
  getConnectionsByProvider: (provider: WhatsAppProvider) => WhatsAppConnection[];
  refreshConnectionStatus: (id: string) => Promise<void>;
}

const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined);

// Limites por plano
const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  starter: {
    maxConnections: 1,
    features: {
      official: true,
      evolution: true,
      baileys: true,
      chatapi: true,
      webhooks: true,
      templates: true,
      qrCode: true,
    },
  },
  pro: {
    maxConnections: 3,
    features: {
      official: true,
      evolution: true,
      baileys: true,
      chatapi: true,
      webhooks: true,
      templates: true,
      qrCode: true,
    },
  },
  enterprise: {
    maxConnections: Infinity,
    features: {
      official: true,
      evolution: true,
      baileys: true,
      chatapi: true,
      webhooks: true,
      templates: true,
      qrCode: true,
    },
  },
};

export function WhatsAppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<PlanType>("pro");
  const planLimits = PLAN_LIMITS[currentPlan];

  // Carregar plano atual da API de assinatura
  useEffect(() => {
    if (!user) return;
    apiClient.getCurrentSubscription().then((sub: any) => {
      const planType = sub?.subscription?.plan?.type?.toLowerCase();
      if (planType && ["starter", "pro", "enterprise"].includes(planType)) {
        setCurrentPlan(planType as PlanType);
      }
    }).catch(() => {
      // Manter default "pro" se API falhar
    });
  }, [user]);

  // Carregar conexões da API
  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const apiConnections = await apiClient.getWhatsAppConnections();
      // Transform API response to match WhatsAppConnection type
      const transformedConnections: WhatsAppConnection[] = apiConnections.map((conn: any) => ({
        id: conn.id,
        name: conn.name,
        provider: conn.provider.toLowerCase() as WhatsAppProviderType,
        status: {
          status: conn.status.toLowerCase() as ConnectionStatus,
          lastSync: conn.lastConnectedAt || new Date().toISOString(),
          qrCode: conn.qrCode || undefined,
        },
        config: conn.config || {},
        isDefault: false, // Backend doesn't have this field yet
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
        lastUsedAt: conn.lastConnectedAt || undefined,
      }));
      setConnections(transformedConnections);
    } catch (error) {
      console.error("Erro ao carregar conexões WhatsApp:", error);
      toast.error("Erro ao carregar conexões WhatsApp");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setConnections([]);
      setLoading(false);
      return;
    }
    fetchConnections();
  }, [user, fetchConnections]);

  // Verificar se pode adicionar mais conexões
  const canAddConnection = useCallback(() => {
    if (planLimits.maxConnections === Infinity) return true;
    return connections.length < planLimits.maxConnections;
  }, [connections.length, planLimits.maxConnections]);

  // Adicionar nova conexão
  const addConnection = useCallback(
    async (connectionData: Omit<WhatsAppConnection, "id" | "createdAt" | "updatedAt">) => {
      if (!canAddConnection()) {
        throw new Error(
          `Limite de conexões atingido. Seu plano permite ${planLimits.maxConnections} conexão(ões).`
        );
      }

      try {
        const result = await apiClient.createWhatsAppConnection({
          name: connectionData.name,
          provider: connectionData.provider.toUpperCase(),
          config: connectionData.config,
        });

        const newConnection: WhatsAppConnection = {
          id: result.id,
          name: result.name,
          provider: result.provider.toLowerCase() as WhatsAppProviderType,
          status: {
            status: result.status.toLowerCase() as ConnectionStatus,
            lastSync: result.lastConnectedAt || new Date().toISOString(),
            qrCode: result.qrCode || undefined,
          },
          config: result.config || {},
          isDefault: connections.length === 0,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
          lastUsedAt: result.lastConnectedAt || undefined,
        };

        setConnections((prev) => [...prev, newConnection]);
        toast.success("Conexão WhatsApp criada com sucesso!");
      } catch (error) {
        toast.error(getErrorMessage(error) ||"Erro ao criar conexão WhatsApp");
        throw error;
      }
    },
    [canAddConnection, connections.length, planLimits.maxConnections]
  );

  // Atualizar conexão
  const updateConnection = useCallback(async (id: string, updates: Partial<WhatsAppConnection>) => {
    try {
      const result = await apiClient.updateWhatsAppConnection(id, {
        name: updates.name,
        provider: updates.provider?.toUpperCase(),
        config: updates.config,
      });

      const updatedConnection: WhatsAppConnection = {
        id: result.id,
        name: result.name,
        provider: result.provider.toLowerCase() as WhatsAppProviderType,
        status: {
          status: result.status.toLowerCase() as ConnectionStatus,
          lastSync: result.lastConnectedAt || new Date().toISOString(),
          qrCode: result.qrCode || undefined,
        },
        config: result.config || {},
        isDefault: updates.isDefault ?? false,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        lastUsedAt: result.lastConnectedAt || undefined,
      };

      setConnections((prev) =>
        prev.map((conn) => {
          if (conn.id === id) {
            return updatedConnection;
          }
          // Se outra conexão está sendo marcada como padrão, remover padrão desta
          if (updates.isDefault && conn.isDefault) {
            return { ...conn, isDefault: false };
          }
          return conn;
        })
      );
      toast.success("Conexão atualizada com sucesso!");
    } catch (error) {
      toast.error(getErrorMessage(error) ||"Erro ao atualizar conexão");
      throw error;
    }
  }, []);

  // Deletar conexão
  const deleteConnection = useCallback(async (id: string) => {
    try {
      await apiClient.deleteWhatsAppConnection(id);
      setConnections((prev) => {
        const filtered = prev.filter((conn) => conn.id !== id);
        // Se deletou a conexão padrão e ainda há outras, definir primeira como padrão
        const deletedWasDefault = prev.find((conn) => conn.id === id)?.isDefault;
        if (deletedWasDefault && filtered.length > 0) {
          return filtered.map((conn, index) =>
            index === 0 ? { ...conn, isDefault: true } : conn
          );
        }
        return filtered;
      });
      toast.success("Conexão deletada com sucesso!");
    } catch (error) {
      toast.error(getErrorMessage(error) ||"Erro ao deletar conexão");
      throw error;
    }
  }, []);

  // Definir conexão padrão
  const setDefaultConnection = useCallback(async (id: string) => {
    await updateConnection(id, { isDefault: true });
  }, [updateConnection]);

  // Obter conexão padrão
  const getDefaultConnection = useCallback(() => {
    return connections.find((conn) => conn.isDefault) || connections[0] || null;
  }, [connections]);

  // Obter conexão por ID
  const getConnection = useCallback(
    (id: string) => {
      return connections.find((conn) => conn.id === id) || null;
    },
    [connections]
  );

  // Atualizar status de conexão
  const updateConnectionStatus = useCallback((id: string, status: ConnectionStatusInfo) => {
    const now = new Date().toISOString();
    setConnections((prev) =>
      prev.map((conn) => {
        if (conn.id === id) {
          return {
            ...conn,
            status,
            updatedAt: now,
            lastUsedAt: status.status === "connected" ? now : conn.lastUsedAt,
          };
        }
        return conn;
      })
    );
  }, []);

  // Obter conexões por provedor
  const getConnectionsByProvider = useCallback(
    (provider: WhatsAppProviderType) => {
      return connections.filter((conn) => conn.provider === provider);
    },
    [connections]
  );

  // Atualizar status de conexão (buscar da API)
  const refreshConnectionStatus = useCallback(
    async (id: string) => {
      try {
        const result = await apiClient.getWhatsAppConnection(id);
        updateConnectionStatus(id, {
          status: result.status.toLowerCase() as ConnectionStatus,
          lastSync: result.lastConnectedAt || new Date().toISOString(),
          qrCode: result.qrCode || undefined,
        });
      } catch (error) {
        console.error("Erro ao atualizar status da conexão:", error);
        toast.error("Erro ao atualizar status da conexão");
      }
    },
    [updateConnectionStatus]
  );

  const value = useMemo(() => ({
    connections,
    currentPlan,
    planLimits,
    addConnection,
    updateConnection,
    deleteConnection,
    setDefaultConnection,
    getDefaultConnection,
    getConnection,
    updateConnectionStatus,
    canAddConnection,
    getConnectionsByProvider,
    refreshConnectionStatus,
  }), [connections, currentPlan, planLimits, addConnection, updateConnection, deleteConnection, setDefaultConnection, getDefaultConnection, getConnection, updateConnectionStatus, canAddConnection, getConnectionsByProvider, refreshConnectionStatus]);

  return (
    <WhatsAppContext.Provider value={value}>
      {children}
    </WhatsAppContext.Provider>
  );
}


export function useWhatsApp() {
  const context = useContext(WhatsAppContext);
  if (context === undefined) {
    throw new Error("useWhatsApp must be used within a WhatsAppProvider");
  }
  return context;
}

