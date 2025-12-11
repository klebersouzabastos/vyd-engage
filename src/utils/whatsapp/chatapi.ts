import {
  ChatAPIConfig,
  WhatsAppMessage,
  SendMessageResult,
  ConnectionTestResult,
  ConnectionStatusInfo,
} from "../../types/whatsapp";

/**
 * Valida credenciais da ChatAPI
 */
export async function validateChatAPICredentials(
  config: ChatAPIConfig
): Promise<ConnectionTestResult> {
  try {
    const response = await fetch(`${config.apiUrl}/getStatus`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: config.apiToken,
        instance: config.instanceId,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        message: "Erro ao validar credenciais da ChatAPI",
        error: "Credenciais inválidas",
      };
    }

    const data = await response.json();
    return {
      success: data.status === "authenticated",
      message: data.status === "authenticated" ? "Credenciais válidas" : "Instância não autenticada",
      responseTime: Date.now(),
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro de conexão: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Envia mensagem via ChatAPI
 */
export async function sendChatAPIMessage(
  config: ChatAPIConfig,
  message: WhatsAppMessage
): Promise<SendMessageResult> {
  try {
    const payload: any = {
      token: config.apiToken,
      instance: config.instanceId,
      phone: message.to,
      body: message.message,
    };

    // Se tem mídia
    if (message.media) {
      payload.media = message.media.url;
      payload.caption = message.media.caption || message.message;
    }

    const response = await fetch(`${config.apiUrl}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        success: false,
        error: data.error?.message || "Erro ao enviar mensagem",
        providerResponse: data,
      };
    }

    return {
      success: true,
      messageId: data.id,
      providerResponse: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Obtém status da conexão ChatAPI
 */
export async function getChatAPIStatus(
  config: ChatAPIConfig
): Promise<ConnectionStatusInfo> {
  try {
    const response = await fetch(`${config.apiUrl}/getStatus`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: config.apiToken,
        instance: config.instanceId,
      }),
    });

    if (!response.ok) {
      return {
        status: "error",
        errorMessage: "Não foi possível verificar o status",
      };
    }

    const data = await response.json();
    const status = data.status === "authenticated" ? "connected" : "disconnected";

    return {
      status,
      lastSync: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}







