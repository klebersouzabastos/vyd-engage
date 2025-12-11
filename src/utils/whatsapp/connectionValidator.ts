import {
  WhatsAppProvider,
  ProviderConfig,
  ConnectionValidation,
  OfficialConfig,
  EvolutionConfig,
  BaileysConfig,
  ChatAPIConfig,
} from "../../types/whatsapp";

/**
 * Valida configuração de conexão baseada no tipo de provedor
 */
export function validateConnectionConfig(
  provider: WhatsAppProvider,
  config: ProviderConfig
): ConnectionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (provider) {
    case "official":
      return validateOfficialConfig(config as OfficialConfig, errors, warnings);
    case "evolution":
      return validateEvolutionConfig(config as EvolutionConfig, errors, warnings);
    case "baileys":
      return validateBaileysConfig(config as BaileysConfig, errors, warnings);
    case "chatapi":
      return validateChatAPIConfig(config as ChatAPIConfig, errors, warnings);
    default:
      return {
        isValid: false,
        errors: ["Provedor não suportado"],
        warnings: [],
      };
  }
}

function validateOfficialConfig(
  config: OfficialConfig,
  errors: string[],
  warnings: string[]
): ConnectionValidation {
  if (!config.accessToken || config.accessToken.trim() === "") {
    errors.push("Access Token é obrigatório");
  } else if (config.accessToken.length < 50) {
    warnings.push("Access Token parece muito curto. Verifique se está correto.");
  }

  if (!config.phoneNumberId || config.phoneNumberId.trim() === "") {
    errors.push("Phone Number ID é obrigatório");
  }

  if (config.businessAccountId && config.businessAccountId.trim() === "") {
    warnings.push("Business Account ID não fornecido. Algumas funcionalidades podem não funcionar.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateEvolutionConfig(
  config: EvolutionConfig,
  errors: string[],
  warnings: string[]
): ConnectionValidation {
  if (!config.instanceName || config.instanceName.trim() === "") {
    errors.push("Nome da instância é obrigatório");
  }

  if (!config.apiUrl || config.apiUrl.trim() === "") {
    errors.push("URL da API é obrigatória");
  } else if (!isValidUrl(config.apiUrl)) {
    errors.push("URL da API inválida");
  }

  if (!config.apiKey || config.apiKey.trim() === "") {
    errors.push("API Key é obrigatória");
  }

  if (!config.webhookUrl && config.webhookUrl !== undefined) {
    warnings.push("Webhook URL não configurado. Você não receberá mensagens recebidas.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateBaileysConfig(
  config: BaileysConfig,
  errors: string[],
  warnings: string[]
): ConnectionValidation {
  if (!config.instanceName || config.instanceName.trim() === "") {
    errors.push("Nome da instância é obrigatório");
  }

  if (!config.apiUrl || config.apiUrl.trim() === "") {
    errors.push("URL da API é obrigatória");
  } else if (!isValidUrl(config.apiUrl)) {
    errors.push("URL da API inválida");
  }

  if (!config.apiKey || config.apiKey.trim() === "") {
    errors.push("API Key é obrigatória");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateChatAPIConfig(
  config: ChatAPIConfig,
  errors: string[],
  warnings: string[]
): ConnectionValidation {
  if (!config.apiUrl || config.apiUrl.trim() === "") {
    errors.push("URL da API é obrigatória");
  } else if (!isValidUrl(config.apiUrl)) {
    errors.push("URL da API inválida");
  }

  if (!config.apiToken || config.apiToken.trim() === "") {
    errors.push("API Token é obrigatório");
  }

  if (!config.instanceId || config.instanceId.trim() === "") {
    errors.push("Instance ID é obrigatório");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida se uma string é uma URL válida
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}







