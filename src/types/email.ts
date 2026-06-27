// Tipos para integração de Email

export type EmailProvider = 'smtp' | 'sendgrid' | 'mailgun' | 'resend';

export type EmailStatus = 'connected' | 'disconnected' | 'testing' | 'error';

export type PlanType = 'starter' | 'pro' | 'enterprise';

// Limites por plano
export interface PlanLimits {
  maxConfigs: number;
  features: {
    smtp: boolean;
    sendgrid: boolean;
    mailgun: boolean;
    resend: boolean;
  };
}

// Configurações específicas por provedor
export interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean; // SSL/TLS
  fromEmail?: string;
  fromName?: string;
}

export interface SendGridConfig {
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
}

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  fromEmail?: string;
  fromName?: string;
}

export interface ResendConfig {
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
}

export type ProviderConfig = SMTPConfig | SendGridConfig | MailgunConfig | ResendConfig;

// Informações de status da configuração
export interface EmailStatusInfo {
  status: EmailStatus;
  lastTested?: string;
  errorMessage?: string;
  errorCode?: string;
}

// Configuração de email completa
export interface EmailConfig {
  id: string;
  name: string;
  provider: EmailProvider;
  config: ProviderConfig;
  status: EmailStatusInfo;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  metadata?: {
    emailCount?: number;
    errorCount?: number;
    lastError?: string;
  };
}

// Resultado de teste de configuração
export interface EmailTestResult {
  success: boolean;
  message: string;
  error?: string;
  responseTime?: number;
  details?: Record<string, unknown>;
}

// Resultado de envio de email
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerResponse?: Record<string, unknown>;
}

// Email para envio
export interface EmailMessage {
  to: string | string[]; // Email(s) destinatário(s)
  subject: string;
  body: string; // HTML ou texto
  html?: boolean; // Se true, body é HTML
  from?: string; // Se não especificado, usa da configuração
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
  configId?: string; // Se não especificado, usa configuração padrão
}

// Anexo de email
export interface EmailAttachment {
  filename: string;
  content: string; // Base64 ou URL
  contentType?: string;
}

// Validação de configuração
export interface EmailConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
