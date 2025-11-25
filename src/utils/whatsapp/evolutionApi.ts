import {
  EvolutionConfig,
  WhatsAppMessage,
  SendMessageResult,
  ConnectionTestResult,
  ConnectionStatusInfo,
} from "../../types/whatsapp";

/**
 * Valida credenciais da Evolution API
 */
export async function validateEvolutionCredentials(
  config: EvolutionConfig
): Promise<ConnectionTestResult> {
  try {
    const response = await fetch(`${config.apiUrl}/instance/fetchInstances`, {
      method: "GET",
      headers: {
        apikey: config.apiKey,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: "Erro ao validar credenciais da Evolution API",
        error: "Credenciais inválidas",
      };
    }

    const data = await response.json();
    const instanceExists = data.find(
      (inst: any) => inst.instance.instanceName === config.instanceName
    );

    return {
      success: !!instanceExists,
      message: instanceExists
        ? "Instância encontrada"
        : "Instância não encontrada",
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
 * Envia mensagem via Evolution API
 */
export async function sendEvolutionMessage(
  config: EvolutionConfig,
  message: WhatsAppMessage
): Promise<SendMessageResult> {
  try {
    const payload: any = {
      number: message.to,
      textMessage: {
        text: message.message,
      },
    };

    // Se tem mídia
    if (message.media) {
      payload.mediaMessage = {
        mediatype: message.media.type,
        media: message.media.url,
        caption: message.media.caption || message.message,
      };
    }

    const response = await fetch(
      `${config.apiUrl}/message/sendText/${config.instanceName}`,
      {
        method: "POST",
        headers: {
          apikey: config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

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
      messageId: data.key?.id,
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
 * Obtém status da conexão Evolution
 */
export async function getEvolutionStatus(
  config: EvolutionConfig
): Promise<ConnectionStatusInfo> {
  try {
    const response = await fetch(
      `${config.apiUrl}/instance/fetchInstances`,
      {
        method: "GET",
        headers: {
          apikey: config.apiKey,
        },
      }
    );

    if (!response.ok) {
      return {
        status: "error",
        errorMessage: "Não foi possível verificar o status",
      };
    }

    const data = await response.json();
    const instance = data.find(
      (inst: any) => inst.instance.instanceName === config.instanceName
    );

    if (!instance) {
      return {
        status: "disconnected",
        errorMessage: "Instância não encontrada",
      };
    }

    const status = instance.instance.status === "open" ? "connected" : "disconnected";

    return {
      status,
      lastSync: new Date().toISOString(),
      batteryLevel: instance.instance.battery?.level,
    };
  } catch (error) {
    return {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Obtém QR Code da Evolution API (se disponível)
 */
export async function getEvolutionQRCode(
  config: EvolutionConfig
): Promise<{ qrCode: string; expiresAt: string } | null> {
  try {
    const response = await fetch(
      `${config.apiUrl}/instance/connect/${config.instanceName}`,
      {
        method: "GET",
        headers: {
          apikey: config.apiKey,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.qrcode?.base64) {
      return {
        qrCode: `data:image/png;base64,${data.qrcode.base64}`,
        expiresAt: new Date(Date.now() + 60 * 1000).toISOString(), // 1 minuto
      };
    }

    return null;
  } catch (error) {
    console.error("Erro ao obter QR Code:", error);
    return null;
  }
}


