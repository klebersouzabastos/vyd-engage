import { PrismaClient, PlanType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create plans
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
        maxAutomations: Infinity,
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
        maxLeads: Infinity,
        maxUsers: Infinity,
        maxAutomations: Infinity,
        maxWhatsAppConnections: Infinity,
        maxEmailConfigs: Infinity,
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

  console.log('Plans created:', { starterPlan, proPlan, enterprisePlan });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

