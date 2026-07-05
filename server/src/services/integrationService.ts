/**
 * integrationService — credenciais de provedores externos por tenant, GATED
 * (Upgrade RD P2, reqs 19 e 21).
 *
 * Cada tenant pode configurar no máximo uma credencial por `kind`
 * (SIGNATURE | PHONE). O `config` é gravado criptografado (safeEncryptConfig,
 * mesmo molde de WhatsAppConnection/EmailConfig) e nunca é devolvido em claro
 * para o cliente: os endpoints só expõem `{ configured, provider, active }`.
 *
 * GATING GRACIOSO: sem credencial, `getConfig` devolve null e as features
 * (assinatura/telefonia) ficam ocultas na UI; os endpoints respondem "não
 * configurado" (400) em vez de quebrar.
 */
import type { IntegrationKind } from '@prisma/client';
import prisma from '../config/database.js';
import { safeEncryptConfig, safeDecryptConfig } from '../utils/encryption.js';

/** Credencial de assinatura (ZapSign). */
export interface SignatureConfig {
  provider: 'zapsign';
  apiKey: string;
  webhookSecret: string;
}

/** Credencial de telefonia (Twilio). */
export interface PhoneConfig {
  provider: 'twilio';
  accountSid: string;
  authToken: string;
  twimlAppSid?: string;
}

export interface IntegrationStatus {
  configured: boolean;
  provider?: string | null;
  active?: boolean;
}

export const integrationService = {
  /**
   * Devolve o config DECIFRADO de um tenant+kind (ou null se não configurado
   * / desativado). Uso interno pelos serviços (signatureService, phone route).
   * NUNCA exponha o retorno diretamente ao cliente — contém segredos.
   */
  async getConfig<T = Record<string, unknown>>(
    tenantId: string,
    kind: IntegrationKind
  ): Promise<T | null> {
    const row = await prisma.integrationConfig.findUnique({
      where: { tenantId_kind: { tenantId, kind } },
    });
    if (!row || !row.active) return null;
    return safeDecryptConfig<T>(row.config);
  },

  /** Status seguro (sem segredos) para os endpoints GET /status. */
  async getStatus(tenantId: string, kind: IntegrationKind): Promise<IntegrationStatus> {
    const row = await prisma.integrationConfig.findUnique({
      where: { tenantId_kind: { tenantId, kind } },
    });
    if (!row) return { configured: false };
    return { configured: row.active, provider: row.provider, active: row.active };
  },

  /**
   * Cria/atualiza (upsert) a credencial de um tenant+kind. O config é
   * criptografado antes de persistir. Retorna apenas o status seguro.
   */
  async setConfig(
    tenantId: string,
    kind: IntegrationKind,
    provider: string,
    config: Record<string, unknown>
  ): Promise<IntegrationStatus> {
    const encrypted = safeEncryptConfig(config) as object;
    const row = await prisma.integrationConfig.upsert({
      where: { tenantId_kind: { tenantId, kind } },
      create: { tenantId, kind, provider, config: encrypted, active: true },
      update: { provider, config: encrypted, active: true },
    });
    return { configured: row.active, provider: row.provider, active: row.active };
  },

  /** Remove a credencial (hard-delete). Idempotente — não quebra se ausente. */
  async deleteConfig(tenantId: string, kind: IntegrationKind): Promise<{ deleted: boolean }> {
    const result = await prisma.integrationConfig.deleteMany({ where: { tenantId, kind } });
    return { deleted: result.count > 0 };
  },
};
