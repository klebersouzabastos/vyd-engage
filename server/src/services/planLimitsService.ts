import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';

export interface PlanLimits {
  maxLeads: number;
  maxUsers: number;
  maxAutomations: number;
  maxWhatsAppConnections: number;
  maxEmailConfigs: number;
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

export const planLimitsService = {
  async getLimits(tenantId: string): Promise<PlanLimits> {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan) {
      throw createError('No active subscription found', 404, 'NO_SUBSCRIPTION');
    }

    return subscription.plan.limits as PlanLimits;
  },

  async getUsage(tenantId: string): Promise<PlanUsage> {
    const limits = await this.getLimits(tenantId);

    const [leadsCount, usersCount, automationsCount, whatsappCount, emailCount] =
      await Promise.all([
        prisma.lead.count({ where: { tenantId } }),
        prisma.user.count({ where: { tenantId, status: 'ACTIVE' } }),
        prisma.automation.count({ where: { tenantId } }),
        prisma.whatsAppConnection.count({ where: { tenantId } }),
        prisma.emailConfig.count({ where: { tenantId } }),
      ]);

    const calculatePercentage = (current: number, limit: number) => {
      if (limit === Infinity) return 0;
      return Math.min((current / limit) * 100, 100);
    };

    return {
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
  },

  async checkLimit(
    tenantId: string,
    resource: 'leads' | 'users' | 'automations' | 'whatsappConnections' | 'emailConfigs'
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const limits = await this.getLimits(tenantId);
    const usage = await this.getUsage(tenantId);

    const limitKey = `max${resource.charAt(0).toUpperCase()}${resource.slice(1)}` as keyof PlanLimits;
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
};








