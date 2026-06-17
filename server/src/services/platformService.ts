import prisma from '../config/database.js';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PlanType, SubscriptionStatus } from '@prisma/client';

/**
 * Serviço de plataforma (super-admin / cross-tenant): visão geral, listagem de
 * tenants e provisionamento idempotente de tenant + admin + subscription.
 * Reutilizado pelas rotas /admin e pelo script de provisionamento.
 */

export interface ProvisionTenantInput {
  tenantName: string;
  slug: string;
  planType: PlanType;
  subscriptionStatus?: 'ACTIVE' | 'TRIAL';
  admin: {
    email: string;
    name: string;
    /** Se ausente, gera uma senha temporária e a retorna em `generatedPassword`. */
    password?: string;
    /** Concede super-admin de plataforma. NUNCA exposto via API pública. */
    isPlatformAdmin?: boolean;
  };
}

function generatePassword(): string {
  return randomBytes(12).toString('base64url'); // ~16 chars url-safe
}

export const platformService = {
  async getOverview() {
    const [tenants, users, leads, deals, activeSubs] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.lead.count(),
      prisma.deal.count(),
      prisma.subscription.findMany({
        where: { status: SubscriptionStatus.ACTIVE },
        select: { plan: { select: { price: true } } },
      }),
    ]);
    const mrr = activeSubs.reduce((sum, s) => sum + Number(s.plan.price), 0);
    return { tenants, users, leads, deals, activeSubscriptions: activeSubs.length, mrr };
  },

  async listTenants() {
    return prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { users: true, leads: true } },
        subscription: { select: { status: true, plan: { select: { type: true, name: true } } } },
      },
    });
  },

  async getTenant(id: string) {
    return prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        settings: true,
        _count: { select: { users: true, leads: true, deals: true, automations: true } },
        subscription: {
          select: {
            status: true,
            billingCycle: true,
            renewalDate: true,
            plan: { select: { type: true, name: true, price: true } },
          },
        },
        users: {
          select: { id: true, email: true, name: true, role: true, status: true, isPlatformAdmin: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  async slugExists(slug: string): Promise<boolean> {
    return (await prisma.tenant.count({ where: { slug } })) > 0;
  },

  /**
   * Cria/garante tenant + usuário admin + subscription. Idempotente por
   * `slug` (tenant) e `email` (usuário) — seguro para rodar de novo.
   */
  async provisionTenant(input: ProvisionTenantInput) {
    const { tenantName, slug, planType, admin } = input;
    const subscriptionStatus = (input.subscriptionStatus || 'ACTIVE') as SubscriptionStatus;

    const plan = await prisma.plan.findUnique({ where: { type: planType } });
    if (!plan) throw new Error(`Plano ${planType} não existe (rode o seed de planos primeiro).`);

    const tenant = await prisma.tenant.upsert({
      where: { slug },
      update: { name: tenantName },
      create: {
        name: tenantName,
        slug,
        settings: { timezone: 'America/Sao_Paulo', language: 'pt-BR', currency: 'BRL' },
      },
    });

    // Usuário admin idempotente por e-mail (não "rouba" usuário de outro tenant).
    const existingUser = await prisma.user.findUnique({ where: { email: admin.email } });
    let generatedPassword: string | undefined;
    let user;

    if (existingUser) {
      if (existingUser.tenantId !== tenant.id) {
        throw new Error(`E-mail ${admin.email} já pertence a outro tenant.`);
      }
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: admin.name,
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true,
          isPlatformAdmin: admin.isPlatformAdmin ?? existingUser.isPlatformAdmin,
        },
      });
    } else {
      generatedPassword = admin.password || generatePassword();
      const passwordHash = await bcrypt.hash(generatedPassword, 10);
      user = await prisma.user.create({
        data: {
          email: admin.email,
          passwordHash,
          name: admin.name,
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: new Date(),
          tenantId: tenant.id,
          isPlatformAdmin: admin.isPlatformAdmin ?? false,
        },
      });
    }

    const subscription = await prisma.subscription.upsert({
      where: { tenantId: tenant.id },
      update: { planId: plan.id, status: subscriptionStatus },
      create: {
        tenantId: tenant.id,
        planId: plan.id,
        status: subscriptionStatus,
        startDate: new Date(),
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trialEndsAt:
          subscriptionStatus === SubscriptionStatus.TRIAL
            ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            : null,
      },
    });

    return { tenant, user, subscription, generatedPassword };
  },
};
