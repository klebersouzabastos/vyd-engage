// Tipos para integração WhatsApp

export type WhatsAppProvider = "official" | "evolution" | "baileys" | "chatapi";

export type ConnectionStatus = "connected" | "disconnected" | "connecting" | "error";

export type PlanType = "starter" | "pro" | "enterprise";

// Configurações específicas por provedor
export interface OfficialConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
  templates?: WhatsAppTemplate[];
}

export interface EvolutionConfig {
  instanceName: string;
  apiUrl: string;
  apiKey: string;
  webhookUrl?: string;
}

export interface BaileysConfig {
  instanceName: string;
  apiUrl: string;
  apiKey: string;
  qrCode?: string;
  qrCodeExpiresAt?: string;
}

export interface ChatAPIConfig {
  apiUrl: string;
  apiToken: string;
  instanceId: string;
}

export type ProviderConfig = 
  | OfficialConfig 
  | EvolutionConfig 
  | BaileysConfig 
  | ChatAPIConfig;

// Template do WhatsApp Business API
export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  category?: string;
}

// Informações de status da conexão
export interface ConnectionStatusInfo {
  status: ConnectionStatus;
  lastSync?: string;
  batteryLevel?: number; // Para Baileys
  errorMessage?: string;
  errorCode?: string;
  qrCode?: string;
  qrCodeExpiresAt?: string;
}

// Conexão WhatsApp completa
export interface WhatsAppConnection {
  id: string;
  name: string;
  provider: WhatsAppProvider;
  config: ProviderConfig;
  status: ConnectionStatusInfo;
  isDefault: boolean;
  phoneNumber?: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  metadata?: {
    messageCount?: number;
    errorCount?: number;
    lastError?: string;
  };
}

// Limites por plano
export interface PlanLimits {
  maxConnections: number;
  features: {
    official: boolean;
    evolution: boolean;
    baileys: boolean;
    chatapi: boolean;
    webhooks: boolean;
    templates: boolean;
    qrCode: boolean;
  };
}

// Resultado de teste de conexão
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  error?: string;
  responseTime?: number;
  details?: Record<string, unknown>;
}

// Resultado de envio de mensagem
export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerResponse?: Record<string, unknown>;
}

// Mensagem para envio
export interface WhatsAppMessage {
  to: string; // Número no formato internacional (ex: 5511999999999)
  message: string;
  connectionId?: string; // Se não especificado, usa conexão padrão
  template?: {
    name: string;
    language: string;
    parameters?: string[];
  };
  media?: {
    type: "image" | "video" | "document" | "audio";
    url: string;
    caption?: string;
  };
}

// Webhook payload (quando recebe mensagem)
export interface WhatsAppWebhookPayload {
  connectionId: string;
  from: string;
  message: string;
  messageId: string;
  timestamp: string;
  type: "text" | "image" | "video" | "audio" | "document" | "location" | "contact";
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
}

// Validação de conexão
export interface ConnectionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}








