import {
  WhatsAppConnection,
  WhatsAppMessage,
  SendMessageResult,
  ConnectionTestResult,
  ConnectionStatusInfo,
  WhatsAppProvider,
  ProviderConfig,
} from '../../types/whatsapp';
import { validateOfficialCredentials, sendOfficialMessage, getOfficialStatus } from './officialApi';
import {
  validateEvolutionCredentials,
  sendEvolutionMessage,
  getEvolutionStatus,
} from './evolutionApi';
import { validateBaileysCredentials, sendBaileysMessage, getBaileysStatus } from './baileysApi';
import { validateChatAPICredentials, sendChatAPIMessage, getChatAPIStatus } from './chatapi';

/**
 * Adapter pattern para unificar chamadas entre diferentes provedores WhatsApp
 */

/**
 * Valida credenciais de uma conexão
 */
export async function validateConnection(
  provider: WhatsAppProvider,
  config: ProviderConfig
): Promise<ConnectionTestResult> {
  switch (provider) {
    case 'official':
      return validateOfficialCredentials(config as any);
    case 'evolution':
      return validateEvolutionCredentials(config as any);
    case 'baileys':
      return validateBaileysCredentials(config as any);
    case 'chatapi':
      return validateChatAPICredentials(config as any);
    default:
      return {
        success: false,
        message: 'Provedor não suportado',
        error: 'Provedor inválido',
      };
  }
}

/**
 * Envia mensagem usando o adapter
 */
export async function sendMessage(
  connection: WhatsAppConnection,
  message: WhatsAppMessage
): Promise<SendMessageResult> {
  switch (connection.provider) {
    case 'official':
      return sendOfficialMessage(connection.config as any, message);
    case 'evolution':
      return sendEvolutionMessage(connection.config as any, message);
    case 'baileys':
      return sendBaileysMessage(connection.config as any, message);
    case 'chatapi':
      return sendChatAPIMessage(connection.config as any, message);
    default:
      return {
        success: false,
        error: 'Provedor não suportado',
      };
  }
}

/**
 * Obtém status da conexão usando o adapter
 */
export async function getConnectionStatus(
  connection: WhatsAppConnection
): Promise<ConnectionStatusInfo> {
  switch (connection.provider) {
    case 'official':
      return getOfficialStatus(connection.config as any);
    case 'evolution':
      return getEvolutionStatus(connection.config as any);
    case 'baileys':
      return getBaileysStatus(connection.config as any);
    case 'chatapi':
      return getChatAPIStatus(connection.config as any);
    default:
      return {
        status: 'error',
        errorMessage: 'Provedor não suportado',
      };
  }
}

/**
 * Formata número de telefone para formato internacional
 */
export function formatPhoneNumber(phone: string): string {
  // Remove caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '');

  // Se começa com 0, remove
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Se não começa com código do país (55 para Brasil), adiciona
  if (!cleaned.startsWith('55') && cleaned.length === 10) {
    cleaned = '55' + cleaned;
  }

  return cleaned;
}

/**
 * Valida formato de número de telefone
 */
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = formatPhoneNumber(phone);
  // Número deve ter entre 10 e 15 dígitos (formato internacional)
  return cleaned.length >= 10 && cleaned.length <= 15;
}
