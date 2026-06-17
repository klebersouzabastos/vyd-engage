/**
 * Provisiona o ambiente SaaS inicial:
 *  - tenant "K2+ Engenharia e Tecnologia" (plano Enterprise, ACTIVE)
 *  - marca kleber.bastos.1984@gmail.com como platform admin (no tenant que já possui)
 *
 * Idempotente (upsert) — seguro rodar de novo.
 *
 * Uso: npm run provision-saas
 * Em prod (Railway): railway run npm run provision-saas
 */
import 'dotenv/config';
import { PlanType } from '@prisma/client';
import prisma from '../src/config/database.js';
import { platformService } from '../src/services/platformService.js';

const PLATFORM_ADMIN_EMAIL = 'kleber.bastos.1984@gmail.com';

async function main() {
  // 1. Verifica se kleber já existe em outro tenant
  const kleblerUser = await prisma.user.findUnique({ where: { email: PLATFORM_ADMIN_EMAIL } });
  const k2Tenant = await prisma.tenant.findUnique({ where: { slug: 'k2-engenharia' } });

  let tenantResult;

  if (!kleblerUser || !k2Tenant || kleblerUser.tenantId === k2Tenant.id) {
    // Kleber não existe OU é do tenant k2-engenharia: provisiona normalmente
    tenantResult = await platformService.provisionTenant({
      tenantName: 'K2+ Engenharia e Tecnologia',
      slug: 'k2-engenharia',
      planType: PlanType.ENTERPRISE,
      subscriptionStatus: 'ACTIVE',
      admin: {
        email: PLATFORM_ADMIN_EMAIL,
        name: 'Kleber Bastos',
        isPlatformAdmin: true,
      },
    });
  } else {
    // Kleber já pertence a outro tenant: provisiona o K2+ sem movê-lo.
    console.log(`ℹ️  ${PLATFORM_ADMIN_EMAIL} já pertence a outro tenant. Provisionando K2+ separadamente.`);
    const plan = await prisma.plan.findUnique({ where: { type: PlanType.ENTERPRISE } });
    if (!plan) throw new Error('Plano ENTERPRISE não existe (rode o seed de planos primeiro).');

    const tenant = await prisma.tenant.upsert({
      where: { slug: 'k2-engenharia' },
      update: { name: 'K2+ Engenharia e Tecnologia' },
      create: {
        name: 'K2+ Engenharia e Tecnologia',
        slug: 'k2-engenharia',
        settings: { timezone: 'America/Sao_Paulo', language: 'pt-BR', currency: 'BRL' },
      },
    });

    const subscription = await prisma.subscription.upsert({
      where: { tenantId: tenant.id },
      update: { planId: plan.id, status: 'ACTIVE' },
      create: {
        tenantId: tenant.id,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: new Date(),
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trialEndsAt: null,
      },
    });

    tenantResult = { tenant, subscription };
  }

  // 2. Garante isPlatformAdmin = true para kleber (independente do tenant).
  const updatedKleber = await prisma.user.update({
    where: { email: PLATFORM_ADMIN_EMAIL },
    data: { isPlatformAdmin: true },
    select: { id: true, email: true, tenantId: true, isPlatformAdmin: true },
  });

  console.log('\n✅ Tenant provisionado:');
  console.log('  Nome  :', tenantResult.tenant.name, `(${tenantResult.tenant.slug})`);
  console.log('  ID    :', tenantResult.tenant.id);
  console.log('  Plano :', 'ENTERPRISE | status:', tenantResult.subscription.status);

  console.log('\n✅ Platform Admin configurado:');
  console.log('  Usuário       :', updatedKleber.email);
  console.log('  isPlatformAdmin:', updatedKleber.isPlatformAdmin);
  console.log('  tenantId      :', updatedKleber.tenantId);

  if ('generatedPassword' in tenantResult && tenantResult.generatedPassword) {
    console.log('\n================ SENHA TEMPORÁRIA (mostrada uma única vez) ================');
    console.log('  ', tenantResult.generatedPassword);
    console.log('  Troque após o primeiro login (Configurações > Segurança).');
    console.log('===========================================================================\n');
  }
}

main()
  .catch((e) => {
    console.error('❌ ERRO ao provisionar:', e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
