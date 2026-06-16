/**
 * Provisiona o ambiente SaaS inicial:
 *  - tenant "K2+ Engenharia e Tecnologia" (plano Enterprise, ACTIVE)
 *  - usuário kleber.bastos.1984@gmail.com como ADMIN + super-admin de plataforma
 *
 * Idempotente (upsert) — seguro rodar de novo. Requer os planos semeados
 * (`npm run prisma:seed` cria os planos sem dados de demo).
 *
 * Uso: npm run provision-saas
 * Em prod (Railway): railway run npm run provision-saas
 */
import 'dotenv/config';
import { PlanType } from '@prisma/client';
import prisma from '../src/config/database.js';
import { platformService } from '../src/services/platformService.js';

async function main() {
  const result = await platformService.provisionTenant({
    tenantName: 'K2+ Engenharia e Tecnologia',
    slug: 'k2-engenharia',
    planType: PlanType.ENTERPRISE,
    subscriptionStatus: 'ACTIVE',
    admin: {
      email: 'kleber.bastos.1984@gmail.com',
      name: 'Kleber Bastos',
      isPlatformAdmin: true,
      // sem `password` → gera uma senha temporária (mostrada uma única vez abaixo)
    },
  });

  console.log('✅ Provisionado:');
  console.log('  Tenant:', result.tenant.name, `(${result.tenant.slug})`, result.tenant.id);
  console.log('  Admin :', result.user.email, '| platformAdmin:', result.user.isPlatformAdmin);
  console.log('  Plano :', 'ENTERPRISE | subscription:', result.subscription.status);

  if (result.generatedPassword) {
    console.log('\n================ SENHA TEMPORÁRIA (mostrada uma única vez) ================');
    console.log('  ', result.generatedPassword);
    console.log('  Troque após o primeiro login (Configurações > Segurança).');
    console.log('===========================================================================\n');
  } else {
    console.log('\n  Usuário já existia — senha preservada. Use `npm run reset-password` se precisar.\n');
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
