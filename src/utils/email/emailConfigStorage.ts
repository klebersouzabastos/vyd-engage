import { EmailConfig } from "../../types/email";

const STORAGE_KEY = "emailConfigs";

/**
 * Carrega configurações de email do localStorage
 */
export function loadEmailConfigs(): EmailConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Erro ao carregar configurações de email do localStorage:", error);
  }
  return [];
}

/**
 * Salva configurações de email no localStorage
 */
export function saveEmailConfigs(configs: EmailConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch (error) {
    console.error("Erro ao salvar configurações de email no localStorage:", error);
  }
}

/**
 * Obtém configuração padrão
 */
export function getDefaultEmailConfig(configs: EmailConfig[]): EmailConfig | null {
  return configs.find((cfg) => cfg.isDefault) || configs[0] || null;
}


