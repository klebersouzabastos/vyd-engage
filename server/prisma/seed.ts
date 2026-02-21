import { PrismaClient, PlanType, LeadStatus, LeadSource, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedPlans() {
  console.log('Seeding plans...');

  const starterPlan = await prisma.plan.upsert({
    where: { type: PlanType.STARTER },
    update: {},
    create: {
      type: PlanType.STARTER,
      name: 'Starter',
      price: 97,
      description: 'Ideal para pequenas empresas começando',
      features: [
        'Até 250 leads',
        '1 usuário',
        '5 automações',
        'WhatsApp + E-mail',
        'Suporte por e-mail',
      ],
      limits: {
        maxLeads: 250,
        maxUsers: 1,
        maxAutomations: 5,
        maxWhatsAppConnections: 1,
        maxEmailConfigs: 1,
        features: {
          whatsapp: true,
          email: true,
          sms: false,
          api: false,
          customFields: true,
          reports: true,
          automations: true,
          webhooks: true,
          integrations: true,
        },
      },
      highlighted: false,
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { type: PlanType.PRO },
    update: {},
    create: {
      type: PlanType.PRO,
      name: 'Pro',
      price: 197,
      description: 'Para empresas em crescimento',
      features: [
        'Até 1.000 leads',
        '5 usuários',
        'Automações ilimitadas',
        'WhatsApp + E-mail',
        'Suporte prioritário',
        'Integrações avançadas',
      ],
      limits: {
        maxLeads: 1000,
        maxUsers: 5,
        maxAutomations: -1,
        maxWhatsAppConnections: 3,
        maxEmailConfigs: 3,
        features: {
          whatsapp: true,
          email: true,
          sms: false,
          api: false,
          customFields: true,
          reports: true,
          automations: true,
          webhooks: true,
          integrations: true,
        },
      },
      highlighted: true,
    },
  });

  const enterprisePlan = await prisma.plan.upsert({
    where: { type: PlanType.ENTERPRISE },
    update: {},
    create: {
      type: PlanType.ENTERPRISE,
      name: 'Enterprise',
      price: 497,
      description: 'Solução completa para grandes empresas',
      features: [
        'Leads ilimitados',
        'Usuários ilimitados',
        'Automações ilimitadas',
        'WhatsApp + E-mail + SMS',
        'Suporte 24/7',
        'API customizada',
        'Gerente de conta dedicado',
      ],
      limits: {
        maxLeads: -1,
        maxUsers: -1,
        maxAutomations: -1,
        maxWhatsAppConnections: -1,
        maxEmailConfigs: -1,
        features: {
          whatsapp: true,
          email: true,
          sms: true,
          api: true,
          customFields: true,
          reports: true,
          automations: true,
          webhooks: true,
          integrations: true,
        },
      },
      highlighted: false,
    },
  });

  console.log('Plans created:', {
    starter: starterPlan.id,
    pro: proPlan.id,
    enterprise: enterprisePlan.id,
  });

  return { starterPlan, proPlan, enterprisePlan };
}

async function seedDemoData(proPlanId: string) {
  console.log('Seeding demo data...');

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-empresa' },
    update: {},
    create: {
      name: 'Empresa Demo',
      slug: 'demo-empresa',
      settings: {
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        currency: 'BRL',
      },
    },
  });

  // Create demo user (password: demo123)
  const passwordHash = await bcrypt.hash('demo123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@vydengage.com' },
    update: {},
    create: {
      email: 'demo@vydengage.com',
      passwordHash,
      name: 'Usuário Demo',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      tenantId: tenant.id,
    },
  });

  // Create subscription for demo tenant
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      planId: proPlanId,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Create tags
  const tagNames = ['Quente', 'Frio', 'VIP', 'Retorno', 'Indicação'];
  const tagColors = ['#EF4444', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6'];
  const tags = await Promise.all(
    tagNames.map((name, i) =>
      prisma.tag.create({
        data: {
          name,
          color: tagColors[i],
          tenantId: tenant.id,
        },
      })
    )
  );

  // Create demo leads
  const leadData = [
    { name: 'Maria Santos', email: 'maria@empresa.com', phone: '(11) 99999-1111', status: LeadStatus.NEW, source: LeadSource.WEBSITE },
    { name: 'João Oliveira', email: 'joao@startup.com', phone: '(21) 99999-2222', status: LeadStatus.CONTACTED, source: LeadSource.SOCIAL_MEDIA },
    { name: 'Ana Costa', email: 'ana@agencia.com', phone: '(31) 99999-3333', status: LeadStatus.QUALIFIED, source: LeadSource.REFERRAL },
    { name: 'Carlos Ferreira', email: 'carlos@loja.com', phone: '(41) 99999-4444', status: LeadStatus.PROPOSAL, source: LeadSource.EMAIL },
    { name: 'Fernanda Lima', email: 'fernanda@tech.com', phone: '(51) 99999-5555', status: LeadStatus.WON, source: LeadSource.WEBSITE },
  ];

  const leads = await Promise.all(
    leadData.map((lead) =>
      prisma.lead.create({
        data: {
          ...lead,
          tenantId: tenant.id,
          userId: user.id,
        },
      })
    )
  );

  // Assign tags to leads
  await prisma.leadTag.createMany({
    data: [
      { leadId: leads[0].id, tagId: tags[0].id },
      { leadId: leads[2].id, tagId: tags[2].id },
      { leadId: leads[4].id, tagId: tags[2].id },
      { leadId: leads[4].id, tagId: tags[4].id },
    ],
    skipDuplicates: true,
  });

  // Create demo tasks
  const now = new Date();
  const taskData = [
    { title: 'Ligar para Maria Santos', description: 'Follow-up sobre proposta comercial', priority: 'HIGH' as const, dueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), leadId: leads[0].id },
    { title: 'Enviar proposta para João', description: 'Preparar proposta do plano Pro', priority: 'MEDIUM' as const, dueDate: new Date(now.getTime() + 48 * 60 * 60 * 1000), leadId: leads[1].id },
    { title: 'Reunião com Ana Costa', description: 'Apresentação de produto', priority: 'HIGH' as const, dueDate: new Date(now.getTime() + 72 * 60 * 60 * 1000), leadId: leads[2].id },
    { title: 'Atualizar cadastro de leads', description: 'Limpar dados duplicados', priority: 'LOW' as const, dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
  ];

  await Promise.all(
    taskData.map((task) =>
      prisma.task.create({
        data: {
          ...task,
          status: 'PENDING',
          tenantId: tenant.id,
          userId: user.id,
        },
      })
    )
  );

  console.log('Demo data created:', {
    tenant: tenant.slug,
    user: user.email,
    leads: leads.length,
    tags: tags.length,
    tasks: taskData.length,
  });
}

async function main() {
  console.log('Seeding database...');

  const { proPlan } = await seedPlans();

  // Only seed demo data if SEED_DEMO=true
  if (process.env.SEED_DEMO === 'true') {
    await seedDemoData(proPlan.id);
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
