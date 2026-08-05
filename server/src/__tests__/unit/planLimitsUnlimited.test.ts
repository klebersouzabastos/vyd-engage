import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Planos "ilimitados" gravam -1 no JSON `limits` (ver prisma/seed.ts: o plano
 * ENTERPRISE usa maxLeads/maxUsers/... = -1). O serviço só reconhecia Infinity,
 * então a checagem virava `current < -1` → sempre falsa → 403 PLAN_LIMIT_REACHED.
 * Efeito em produção: o plano MAIS CARO era o único incapaz de criar leads,
 * usuários, automações e conexões.
 *
 * `Infinity` não é uma alternativa possível no banco: JSON.stringify(Infinity)
 * serializa como `null` — daí a convenção -1, que o serviço precisa entender.
 */

const mockSubscription = {
  findUnique: vi.fn(),
};

vi.mock('../../config/database.js', () => ({
  default: {
    subscription: { findUnique: (...a: unknown[]) => mockSubscription.findUnique(...a) },
    lead: { count: vi.fn().mockResolvedValue(357) },
    user: { count: vi.fn().mockResolvedValue(12) },
    automation: { count: vi.fn().mockResolvedValue(3) },
    whatsAppConnection: { count: vi.fn().mockResolvedValue(1) },
    emailConfig: { count: vi.fn().mockResolvedValue(1) },
  },
}));

// Cache desligado: cada chamada vai ao "banco" mockado.
vi.mock('../../config/redis.js', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
  cacheDelPattern: vi.fn().mockResolvedValue(undefined),
}));

const { planLimitsService } = await import('../../services/planLimitsService.js');

const enterpriseLimits = {
  maxLeads: -1,
  maxUsers: -1,
  maxAutomations: -1,
  maxWhatsAppConnections: -1,
  maxEmailConfigs: -1,
  features: {},
};

function givenPlan(limits: unknown) {
  mockSubscription.findUnique.mockResolvedValue({
    tenantId: 't1',
    plan: { limits },
  });
}

describe('planLimitsService — planos ilimitados (-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite criar lead no plano ENTERPRISE (maxLeads: -1) mesmo com 357 leads', async () => {
    givenPlan(enterpriseLimits);
    const check = await planLimitsService.checkLimit('t1', 'leads');
    expect(check.allowed).toBe(true);
    expect(check.current).toBe(357);
  });

  it('não lança 403 no enforceLimit com plano ilimitado', async () => {
    givenPlan(enterpriseLimits);
    await expect(planLimitsService.enforceLimit('t1', 'leads')).resolves.toBeUndefined();
    await expect(planLimitsService.enforceLimit('t1', 'users')).resolves.toBeUndefined();
    await expect(planLimitsService.enforceLimit('t1', 'automations')).resolves.toBeUndefined();
  });

  it('reporta limite ilimitado como 0 no uso (convenção das respostas)', async () => {
    givenPlan(enterpriseLimits);
    const usage = await planLimitsService.getUsage('t1');
    expect(usage.leads.limit).toBe(0);
    expect(usage.leads.percentage).toBe(0);
  });

  it('continua ENFORÇANDO limites finitos (não vira "tudo liberado")', async () => {
    givenPlan({ ...enterpriseLimits, maxLeads: 250 });
    const check = await planLimitsService.checkLimit('t1', 'leads');
    expect(check.allowed).toBe(false); // 357 >= 250
    expect(check.limit).toBe(250);
    await expect(planLimitsService.enforceLimit('t1', 'leads')).rejects.toThrow(
      /Plan limit reached/
    );
  });

  it('trata limite ausente/nulo como ilimitado (Infinity vira null no JSON)', async () => {
    givenPlan({ maxLeads: null, features: {} });
    const check = await planLimitsService.checkLimit('t1', 'leads');
    expect(check.allowed).toBe(true);
  });

  it('limite 0 continua sendo zero — não é "ilimitado"', async () => {
    givenPlan({ ...enterpriseLimits, maxAutomations: 0 });
    const check = await planLimitsService.checkLimit('t1', 'automations');
    expect(check.allowed).toBe(false);
  });
});
