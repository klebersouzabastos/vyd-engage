import { PrismaClient, PlanType, LeadStatus, LeadSource, UserRole, UserStatus, DealStage } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BUILTIN_TEMPLATES } from '../src/services/deepResearch/builtinTemplates.js';

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

  // Create admin user (email: admin@test.com, password: admin123)
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      passwordHash: adminPasswordHash,
      name: 'Admin Test',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      tenantId: tenant.id,
    },
  });

  // Create demo user (email: demo@vydengage.com, password: demo123)
  const demoPasswordHash = await bcrypt.hash('demo123', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@vydengage.com' },
    update: {},
    create: {
      email: 'demo@vydengage.com',
      passwordHash: demoPasswordHash,
      name: 'Usuário Demo',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      tenantId: tenant.id,
    },
  });

  // Create subscription for demo tenant (using correct schema fields)
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      planId: proPlanId,
      status: 'ACTIVE',
      startDate: new Date(),
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Create tags (idempotent via upsert on unique [tenantId, name])
  const tagEntries = [
    { name: 'Quente', color: '#EF4444' },
    { name: 'Frio', color: '#3B82F6' },
    { name: 'VIP', color: '#F59E0B' },
    { name: 'Retorno', color: '#10B981' },
    { name: 'Indicação', color: '#8B5CF6' },
  ];
  const tags = await Promise.all(
    tagEntries.map((tag) =>
      prisma.tag.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: tag.name } },
        update: { color: tag.color },
        create: {
          name: tag.name,
          color: tag.color,
          tenantId: tenant.id,
        },
      })
    )
  );

  // Create demo leads (idempotent via upsert on tenantId + email)
  const leadData = [
    { name: 'Maria Santos', email: 'maria@empresa.com', phone: '(11) 99999-1111', status: LeadStatus.NEW, source: LeadSource.WEBSITE },
    { name: 'João Oliveira', email: 'joao@startup.com', phone: '(21) 99999-2222', status: LeadStatus.CONTACTED, source: LeadSource.SOCIAL_MEDIA },
    { name: 'Ana Costa', email: 'ana@agencia.com', phone: '(31) 99999-3333', status: LeadStatus.QUALIFIED, source: LeadSource.REFERRAL },
    { name: 'Carlos Ferreira', email: 'carlos@loja.com', phone: '(41) 99999-4444', status: LeadStatus.PROPOSAL, source: LeadSource.EMAIL },
    { name: 'Fernanda Lima', email: 'fernanda@tech.com', phone: '(51) 99999-5555', status: LeadStatus.WON, source: LeadSource.WEBSITE },
    { name: 'Pedro Almeida', email: 'pedro@consulting.com', phone: '(61) 99999-6666', status: LeadStatus.NEGOTIATION, source: LeadSource.REFERRAL },
    { name: 'Luciana Souza', email: 'luciana@ecommerce.com', phone: '(71) 99999-7777', status: LeadStatus.NEW, source: LeadSource.SOCIAL_MEDIA },
    { name: 'Ricardo Mendes', email: 'ricardo@fintech.com', phone: '(81) 99999-8888', status: LeadStatus.CONTACTED, source: LeadSource.EMAIL },
    { name: 'Camila Rocha', email: 'camila@saude.com', phone: '(91) 99999-9999', status: LeadStatus.LOST, source: LeadSource.PHONE },
    { name: 'Bruno Dias', email: 'bruno@educacao.com', phone: '(11) 98888-0000', status: LeadStatus.QUALIFIED, source: LeadSource.OTHER },
  ];

  // Use findFirst + create pattern for leads (no unique on email alone, only tenantId+email index)
  const leads: Awaited<ReturnType<typeof prisma.lead.create>>[] = [];
  for (const ld of leadData) {
    const existing = await prisma.lead.findFirst({
      where: { tenantId: tenant.id, email: ld.email },
    });
    if (existing) {
      leads.push(existing);
    } else {
      const created = await prisma.lead.create({
        data: {
          ...ld,
          tenantId: tenant.id,
          assignedTo: adminUser.id,
        },
      });
      leads.push(created);
    }
  }

  // Assign tags to leads (skipDuplicates makes this idempotent)
  await prisma.leadTag.createMany({
    data: [
      { leadId: leads[0].id, tagId: tags[0].id }, // Maria - Quente
      { leadId: leads[1].id, tagId: tags[1].id }, // João - Frio
      { leadId: leads[2].id, tagId: tags[2].id }, // Ana - VIP
      { leadId: leads[3].id, tagId: tags[3].id }, // Carlos - Retorno
      { leadId: leads[4].id, tagId: tags[2].id }, // Fernanda - VIP
      { leadId: leads[4].id, tagId: tags[4].id }, // Fernanda - Indicação
      { leadId: leads[5].id, tagId: tags[0].id }, // Pedro - Quente
      { leadId: leads[6].id, tagId: tags[1].id }, // Luciana - Frio
      { leadId: leads[9].id, tagId: tags[4].id }, // Bruno - Indicação
    ],
    skipDuplicates: true,
  });

  // Create demo tasks (idempotent via findFirst + create)
  const now = new Date();
  const taskData = [
    { title: 'Ligar para Maria Santos', description: 'Follow-up sobre proposta comercial', priority: 'HIGH' as const, dueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), leadId: leads[0].id },
    { title: 'Enviar proposta para João', description: 'Preparar proposta do plano Pro', priority: 'MEDIUM' as const, dueDate: new Date(now.getTime() + 48 * 60 * 60 * 1000), leadId: leads[1].id },
    { title: 'Reunião com Ana Costa', description: 'Apresentação de produto', priority: 'HIGH' as const, dueDate: new Date(now.getTime() + 72 * 60 * 60 * 1000), leadId: leads[2].id },
    { title: 'Atualizar cadastro de leads', description: 'Limpar dados duplicados', priority: 'LOW' as const, dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
  ];

  for (const task of taskData) {
    const existing = await prisma.task.findFirst({
      where: { tenantId: tenant.id, title: task.title },
    });
    if (!existing) {
      await prisma.task.create({
        data: {
          ...task,
          status: 'PENDING',
          tenantId: tenant.id,
          assignedTo: adminUser.id,
        },
      });
    }
  }

  // Create demo deals (idempotent via findFirst + create)
  const dealData = [
    {
      name: 'Consultoria Digital - Ana Costa',
      value: 15000,
      stage: DealStage.PROPOSAL,
      probability: 60,
      expectedCloseDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      leadId: leads[2].id,
      notes: 'Interessada em pacote completo de automação',
    },
    {
      name: 'Plano Enterprise - Pedro Almeida',
      value: 50000,
      stage: DealStage.NEGOTIATION,
      probability: 40,
      expectedCloseDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      leadId: leads[5].id,
      notes: 'Negociação de contrato anual com desconto',
    },
  ];

  for (const deal of dealData) {
    const existing = await prisma.deal.findFirst({
      where: { tenantId: tenant.id, name: deal.name },
    });
    if (!existing) {
      await prisma.deal.create({
        data: {
          ...deal,
          tenantId: tenant.id,
          assignedTo: adminUser.id,
        },
      });
    }
  }

  // Deep Research builtin templates (idempotente)
  await seedDeepResearchTemplates(tenant.id);

  console.log('Demo data created:', {
    tenant: tenant.slug,
    adminUser: adminUser.email,
    demoUser: demoUser.email,
    leads: leads.length,
    tags: tags.length,
    tasks: taskData.length,
    deals: dealData.length,
    deepResearchTemplates: BUILTIN_TEMPLATES.length,
  });
}

async function seedDeepResearchTemplates(tenantId: string) {
  for (const t of BUILTIN_TEMPLATES) {
    const existing = await prisma.deepResearchTemplate.findFirst({
      where: { tenantId, isBuiltin: true, name: t.name },
    });
    if (!existing) {
      await prisma.deepResearchTemplate.create({
        data: {
          tenantId,
          name: t.name,
          description: t.description,
          promptBody: t.promptBody,
          isBuiltin: true,
        },
      });
    }
  }
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
