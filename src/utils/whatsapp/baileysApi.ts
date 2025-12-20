import {
  BaileysConfig,
  WhatsAppMessage,
  SendMessageResult,
  ConnectionTestResult,
  ConnectionStatusInfo,
} from "../../types/whatsapp";

/**
 * Valida credenciais da Baileys/WPPConnect API
 */
export async function validateBaileysCredentials(
  config: BaileysConfig
): Promise<ConnectionTestResult> {
  try {
    const response = await fetch(`${config.apiUrl}/api/${config.instanceName}/status`, {
      method: "GET",
      headers: {
        apikey: config.apiKey,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: "Erro ao validar credenciais da Baileys API",
        error: "Credenciais inválidas",
      };
    }

    return {
      success: true,
      message: "Credenciais válidas",
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
 * Envia mensagem via Baileys/WPPConnect API
 */
export async function sendBaileysMessage(
  config: BaileysConfig,
  message: WhatsAppMessage
): Promise<SendMessageResult> {
  try {
    const payload: any = {
      phone: message.to,
      message: message.message,
    };

    // Se tem mídia
    if (message.media) {
      payload.media = {
        url: message.media.url,
        caption: message.media.caption || message.message,
      };
    }

    const response = await fetch(
      `${config.apiUrl}/api/${config.instanceName}/send-message`,
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
 * Obtém status da conexão Baileys
 */
export async function getBaileysStatus(
  config: BaileysConfig
): Promise<ConnectionStatusInfo> {
  try {
    const response = await fetch(`${config.apiUrl}/api/${config.instanceName}/status`, {
      method: "GET",
      headers: {
        apikey: config.apiKey,
      },
    });

    if (!response.ok) {
      return {
        status: "error",
        errorMessage: "Não foi possível verificar o status",
      };
    }

    const data = await response.json();
    const status = data.status === "connected" ? "connected" : "disconnected";

    return {
      status,
      lastSync: new Date().toISOString(),
      batteryLevel: data.battery?.level,
    };
  } catch (error) {
    return {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Obtém QR Code da Baileys/WPPConnect
 */
export async function getBaileysQRCode(
  config: BaileysConfig
): Promise<{ qrCode: string; expiresAt: string } | null> {
  try {
    const response = await fetch(
      `${config.apiUrl}/api/${config.instanceName}/qr-code`,
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
    if (data.qrcode) {
      return {
        qrCode: data.qrcode.base64
          ? `data:image/png;base64,${data.qrcode.base64}`
          : data.qrcode,
        expiresAt: new Date(Date.now() + 60 * 1000).toISOString(), // 1 minuto
      };
    }

    return null;
  } catch (error) {
    console.error("Erro ao obter QR Code:", error);
    return null;
  }
}

/**
 * Inicia conexão Baileys (gera QR Code)
 */
export async function startBaileysConnection(
  config: BaileysConfig
): Promise<{ qrCode: string; expiresAt: string } | null> {
  try {
    const response = await fetch(
      `${config.apiUrl}/api/${config.instanceName}/start`,
      {
        method: "POST",
        headers: {
          apikey: config.apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.qrcode) {
      return {
        qrCode: data.qrcode.base64
          ? `data:image/png;base64,${data.qrcode.base64}`
          : data.qrcode,
        expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
      };
    }

    return null;
  } catch (error) {
    console.error("Erro ao iniciar conexão:", error);
    return null;
  }
}








