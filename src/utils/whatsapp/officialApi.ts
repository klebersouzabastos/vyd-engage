import {
  OfficialConfig,
  WhatsAppMessage,
  SendMessageResult,
  ConnectionTestResult,
  ConnectionStatusInfo,
  WhatsAppTemplate,
} from "../../types/whatsapp";

const WHATSAPP_API_BASE = "https://graph.facebook.com/v18.0";

/**
 * Valida credenciais da API oficial do WhatsApp Business
 */
export async function validateOfficialCredentials(
  config: OfficialConfig
): Promise<ConnectionTestResult> {
  try {
    const response = await fetch(`${WHATSAPP_API_BASE}/${config.phoneNumberId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: `Erro ao validar credenciais: ${error.error?.message || "Credenciais inválidas"}`,
        error: error.error?.message,
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
 * Envia mensagem via WhatsApp Business API oficial
 */
export async function sendOfficialMessage(
  config: OfficialConfig,
  message: WhatsAppMessage
): Promise<SendMessageResult> {
  try {
    const payload: any = {
      messaging_product: "whatsapp",
      to: message.to,
      type: "text",
      text: {
        body: message.message,
      },
    };

    // Se tem template, usar template
    if (message.template) {
      payload.type = "template";
      payload.template = {
        name: message.template.name,
        language: {
          code: message.template.language,
        },
        components: message.template.parameters
          ? [
              {
                type: "body",
                parameters: message.template.parameters.map((param) => ({
                  type: "text",
                  text: param,
                })),
              },
            ]
          : [],
      };
    }

    // Se tem mídia, adicionar
    if (message.media) {
      payload.type = message.media.type;
      payload[message.media.type] = {
        link: message.media.url,
        caption: message.media.caption,
      };
    }

    const response = await fetch(
      `${WHATSAPP_API_BASE}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || "Erro ao enviar mensagem",
        providerResponse: data,
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
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
 * Obtém status da conexão oficial
 */
export async function getOfficialStatus(
  config: OfficialConfig
): Promise<ConnectionStatusInfo> {
  try {
    const response = await fetch(`${WHATSAPP_API_BASE}/${config.phoneNumberId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });

    if (!response.ok) {
      return {
        status: "error",
        errorMessage: "Não foi possível verificar o status",
      };
    }

    return {
      status: "connected",
      lastSync: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Obtém templates aprovados
 */
export async function getOfficialTemplates(
  config: OfficialConfig
): Promise<WhatsAppTemplate[]> {
  try {
    const businessAccountId = config.businessAccountId || config.phoneNumberId;
    const response = await fetch(
      `${WHATSAPP_API_BASE}/${businessAccountId}/message_templates`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (
      data.data?.map((template: any) => ({
        name: template.name,
        language: template.language,
        status: template.status,
        category: template.category,
      })) || []
    );
  } catch (error) {
    console.error("Erro ao buscar templates:", error);
    return [];
  }
}








