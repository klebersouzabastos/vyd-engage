import { EmailConfig, EmailMessage, SendEmailResult, EmailTestResult } from "../../types/email";

/**
 * Simula o envio de email usando a configuração especificada
 * Em produção, isso faria chamadas reais às APIs ou servidor SMTP
 */
export async function sendEmail(
  message: EmailMessage,
  config?: EmailConfig
): Promise<SendEmailResult> {
  // Simulação de delay de rede
  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    // Validações básicas
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      return {
        success: false,
        error: "Destinatário não especificado",
      };
    }

    if (!message.subject || message.subject.trim() === "") {
      return {
        success: false,
        error: "Assunto não especificado",
      };
    }

    if (!message.body || message.body.trim() === "") {
      return {
        success: false,
        error: "Corpo do email não especificado",
      };
    }

    // Simulação de envio bem-sucedido
    const messageId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log("Email enviado (simulação):", {
      to: message.to,
      subject: message.subject,
      configId: config?.id,
      provider: config?.provider,
    });

    return {
      success: true,
      messageId,
      providerResponse: {
        provider: config?.provider || "unknown",
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao enviar email",
    };
  }
}

/**
 * Testa a configuração de email enviando um email de teste
 */
export async function testEmailConfig(
  config: EmailConfig,
  testEmail: string
): Promise<EmailTestResult> {
  const startTime = Date.now();

  try {
    const testMessage: EmailMessage = {
      to: testEmail,
      subject: "Teste de Configuração - FlowCRM",
      body: "Este é um email de teste para verificar se sua configuração de email está funcionando corretamente.",
      html: false,
    };

    const result = await sendEmail(testMessage, config);
    const responseTime = Date.now() - startTime;

    if (result.success) {
      return {
        success: true,
        message: "Email de teste enviado com sucesso!",
        responseTime,
        details: {
          messageId: result.messageId,
          provider: config.provider,
        },
      };
    } else {
      return {
        success: false,
        message: "Falha ao enviar email de teste",
        error: result.error,
        responseTime,
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      message: "Erro ao testar configuração",
      error: error instanceof Error ? error.message : "Erro desconhecido",
      responseTime,
    };
  }
}


