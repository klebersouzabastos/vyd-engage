import { useCallback } from "react";
import { useWhatsApp as useWhatsAppContext } from "../contexts/WhatsAppContext";
import { WhatsAppConnection, WhatsAppMessage, SendMessageResult } from "../types/whatsapp";
import { sendMessage, getConnectionStatus } from "../utils/whatsapp/whatsappAdapter";

/**
 * Hook principal para gerenciar conexões WhatsApp
 * Re-exporta todas as funções do contexto
 */
export function useWhatsApp() {
  return useWhatsAppContext();
}

/**
 * Hook para obter uma conexão específica por ID
 */
export function useWhatsAppConnection(id: string) {
  const { getConnection } = useWhatsAppContext();
  return getConnection(id);
}

/**
 * Hook para obter conexões filtradas por provedor
 */
export function useWhatsAppConnectionsByProvider(provider: string) {
  const { getConnectionsByProvider } = useWhatsAppContext();
  return getConnectionsByProvider(provider as any);
}

/**
 * Hook para testar uma conexão específica
 */
export function useTestConnection() {
  const { getConnection, updateConnectionStatus } = useWhatsAppContext();

  const testConnection = useCallback(
    async (connectionId: string, testPhone: string, testMessage: string): Promise<SendMessageResult> => {
      const connection = getConnection(connectionId);
      if (!connection) {
        return {
          success: false,
          error: "Conexão não encontrada",
        };
      }

      const message: WhatsAppMessage = {
        to: testPhone,
        message: testMessage,
        connectionId,
      };

      const result = await sendMessage(connection, message);

      // Atualizar status da conexão baseado no resultado
      if (result.success) {
        updateConnectionStatus(connectionId, {
          ...connection.status,
          status: "connected",
          lastSync: new Date().toISOString(),
        });
      } else {
        updateConnectionStatus(connectionId, {
          ...connection.status,
          status: "error",
          errorMessage: result.error || "Erro ao enviar mensagem",
        });
      }

      return result;
    },
    [getConnection, updateConnectionStatus]
  );

  return { testConnection };
}

/**
 * Hook para enviar mensagem usando conexão padrão ou específica
 */
export function useSendWhatsAppMessage() {
  const { getDefaultConnection, getConnection } = useWhatsAppContext();

  const sendMessageToLead = useCallback(
    async (
      phone: string,
      message: string,
      connectionId?: string
    ): Promise<SendMessageResult> => {
      let connection: WhatsAppConnection | null = null;

      if (connectionId) {
        connection = getConnection(connectionId);
      } else {
        connection = getDefaultConnection();
      }

      if (!connection) {
        return {
          success: false,
          error: "Nenhuma conexão WhatsApp disponível",
        };
      }

      const whatsappMessage: WhatsAppMessage = {
        to: phone,
        message,
        connectionId: connection.id,
      };

      return await sendMessage(connection, whatsappMessage);
    },
    [getDefaultConnection, getConnection]
  );

  return { sendMessageToLead };
}

/**
 * Hook para atualizar status de todas as conexões
 */
export function useRefreshAllConnections() {
  const { connections, refreshConnectionStatus } = useWhatsAppContext();

  const refreshAll = useCallback(async () => {
    const promises = connections.map((conn) => refreshConnectionStatus(conn.id));
    await Promise.all(promises);
  }, [connections, refreshConnectionStatus]);

  return { refreshAll };
}








