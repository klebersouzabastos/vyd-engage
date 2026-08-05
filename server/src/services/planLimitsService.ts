import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../config/redis.js';

// Cache TTLs (seconds)
const PLAN_LIMITS_TTL = 3600; // 1 hour — plan data rarely changes
const USAGE_TTL = 300; // 5 minutes — usage counts change more often

// Defaults de armazenamento de anexos (MB) por tipo de plano (Upgrade RD P2).
// Usados quando o JSON `limits` do plano não traz `maxStorageMB`. Enterprise =
// Infinity (ilimitado; representado como 0 nas respostas de limite, como os demais).
const STORAGE_MB_DEFAULTS: Record<string, number> = {
  STARTER: 50,
  PRO: 500,
  ENTERPRISE: Infinity,
};

export interface PlanLimits {
  maxLeads: number;
  maxUsers: number;
  maxAutomations: number;
  maxWhatsAppConnections: number;
  maxEmailConfigs: number;
  // Documentos & integrações externas (Upgrade RD P2) — limite de armazenamento
  // de anexos em MB. Opcional no JSON `limits` do plano; quando ausente, cai nos
  // defaults por tipo de plano (ver STORAGE_MB_DEFAULTS / resolveStorageLimitMB).
  maxStorageMB?: number;
  features: {
    whatsapp: boolean;
    email: boolean;
    sms: boolean;
    api: boolean;
    customFields: boolean;
    reports: boolean;
    automations: boolean;
    webhooks: boolean;
    integrations: boolean;
  };
}

export interface PlanUsage {
  leads: { current: number; limit: number; percentage: number };
  users: { current: number; limit: number; percentage: number };
  automations: { current: number; limit: number; percentage: number };
  whatsappConnections: { current: number; limit: number; percentage: number };
  emailConfigs: { current: number; limit: number; percentage: number };
}

/**
 * Normaliza um limite vindo do JSON `limits` do plano para número comparável.
 *
 * Planos ilimitados gravam **-1** (ver prisma/seed.ts, plano ENTERPRISE) porque
 * `Infinity` não sobrevive ao JSON — `JSON.stringify(Infinity)` vira `null`.
 * Sem esta normalização a checagem virava `current < -1`, sempre falsa, e o
 * plano mais caro era o único incapaz de criar leads/usuários/automações.
 *
 * Regra: negativo, nulo, ausente ou não-finito ⇒ ilimitado. `0` NÃO é ilimitado
 * (é limite zero, legítimo para desligar um recurso num plano).
 */
function normalizeLimit(value: unknown): number {
  if (value === null || value === undefined) return Infinity;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return Infinity;
  return n < 0 ? Infinity : n;
}

/** Aplica normalizeLimit a todos os campos numéricos de limite. */
function normalizeLimits(raw: PlanLimits): PlanLimits {
  return {
    ...raw,
    maxLeads: normalizeLimit(raw?.maxLeads),
    maxUsers: normalizeLimit(raw?.maxUsers),
    maxAutomations: normalizeLimit(raw?.maxAutomations),
    maxWhatsAppConnections: normalizeLimit(raw?.maxWhatsAppConnections),
    maxEmailConfigs: normalizeLimit(raw?.maxEmailConfigs),
    ...(raw?.maxStorageMB !== undefined
      ? { maxStorageMB: normalizeLimit(raw.maxStorageMB) }
      : {}),
  };
}

export const planLimitsService = {
  async getLimits(tenantId: string): Promise<PlanLimits> {
    const cacheKey = `plan:${tenantId}:limits`;
    // A normalização acontece na LEITURA (aqui e no cache), nunca antes de gravar:
    // o cache é JSON, e um Infinity gravado voltaria como null.
    const cached = await cacheGet<PlanLimits>(cacheKey);
    if (cached) return normalizeLimits(cached);

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan) {
      throw createError('No active subscription found', 404, 'NO_SUBSCRIPTION');
    }

    const limits = subscription.plan.limits as unknown as PlanLimits;
    await cacheSet(cacheKey, limits, PLAN_LIMITS_TTL);
    return normalizeLimits(limits);
  },

  /**
   * Resolve o limite de armazenamento de anexos (MB) do tenant (Upgrade RD P2).
   * Prioridade: `maxStorageMB` no JSON `limits` do plano → default por tipo de
   * plano (STORAGE_MB_DEFAULTS) → 50MB (fallback conservador). Retorna Infinity
   * para planos ilimitados. Sem assinatura, cai no fallback (não lança).
   */
  async resolveStorageLimitMB(tenantId: string): Promise<number> {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    const limits = (subscription?.plan?.limits ?? {}) as Partial<PlanLimits>;
    if (typeof limits.maxStorageMB === 'number') return limits.maxStorageMB;
    const planType = subscription?.plan?.type;
    if (planType && planType in STORAGE_MB_DEFAULTS) return STORAGE_MB_DEFAULTS[planType];
    return STORAGE_MB_DEFAULTS.STARTER;
  },

  async getUsage(tenantId: string): Promise<PlanUsage> {
    const usageCacheKey = `plan:${tenantId}:usage`;
    const cached = await cacheGet<PlanUsage>(usageCacheKey);
    if (cached) return cached;

    const limits = await this.getLimits(tenantId);

    const [leadsCount, usersCount, automationsCount, whatsappCount, emailCount] = await Promise.all(
      [
        prisma.lead.count({ where: { tenantId, deletedAt: null } }),
        prisma.user.count({ where: { tenantId, status: 'ACTIVE' } }),
        prisma.automation.count({ where: { tenantId } }),
        prisma.whatsAppConnection.count({ where: { tenantId } }),
        prisma.emailConfig.count({ where: { tenantId } }),
      ]
    );

    const calculatePercentage = (current: number, limit: number) => {
      if (limit === Infinity) return 0;
      return Math.min((current / limit) * 100, 100);
    };

    const usage: PlanUsage = {
      leads: {
        current: leadsCount,
        limit: limits.maxLeads === Infinity ? 0 : limits.maxLeads,
        percentage: calculatePercentage(leadsCount, limits.maxLeads),
      },
      users: {
        current: usersCount,
        limit: limits.maxUsers === Infinity ? 0 : limits.maxUsers,
        percentage: calculatePercentage(usersCount, limits.maxUsers),
      },
      automations: {
        current: automationsCount,
        limit: limits.maxAutomations === Infinity ? 0 : limits.maxAutomations,
        percentage: calculatePercentage(automationsCount, limits.maxAutomations),
      },
      whatsappConnections: {
        current: whatsappCount,
        limit: limits.maxWhatsAppConnections === Infinity ? 0 : limits.maxWhatsAppConnections,
        percentage: calculatePercentage(whatsappCount, limits.maxWhatsAppConnections),
      },
      emailConfigs: {
        current: emailCount,
        limit: limits.maxEmailConfigs === Infinity ? 0 : limits.maxEmailConfigs,
        percentage: calculatePercentage(emailCount, limits.maxEmailConfigs),
      },
    };

    await cacheSet(usageCacheKey, usage, USAGE_TTL);
    return usage;
  },

  async checkLimit(
    tenantId: string,
    resource: 'leads' | 'users' | 'automations' | 'whatsappConnections' | 'emailConfigs'
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const limits = await this.getLimits(tenantId);
    const usage = await this.getUsage(tenantId);

    const limitKey =
      `max${resource.charAt(0).toUpperCase()}${resource.slice(1)}` as keyof PlanLimits;
    const limit = limits[limitKey] as number;
    const current = usage[resource].current;

    return {
      allowed: limit === Infinity || current < limit,
      current,
      limit: limit === Infinity ? 0 : limit,
    };
  },

  async enforceLimit(
    tenantId: string,
    resource: 'leads' | 'users' | 'automations' | 'whatsappConnections' | 'emailConfigs'
  ): Promise<void> {
    const check = await this.checkLimit(tenantId, resource);

    if (!check.allowed) {
      throw createError(
        `Plan limit reached for ${resource}. Current: ${check.current}, Limit: ${check.limit}`,
        403,
        'PLAN_LIMIT_REACHED'
      );
    }
  },

  /** Invalidate usage cache when a resource count changes (lead created/deleted, etc.) */
  async invalidateUsage(tenantId: string): Promise<void> {
    await cacheDel(`plan:${tenantId}:usage`);
  },

  /** Invalidate plan limits cache when subscription/plan changes */
  async invalidateLimits(tenantId: string): Promise<void> {
    await cacheDel(`plan:${tenantId}:limits`, `plan:${tenantId}:usage`);
  },
};
