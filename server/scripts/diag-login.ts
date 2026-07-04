/**
 * Diagnóstico READ-ONLY do incidente "credenciais inválidas" (03/07/2026).
 * Não altera nada — só lê o estado das contas no banco.
 *   npx tsx scripts/diag-login.ts
 */
import prisma from '../src/config/database.js';

async function main() {
  // 1. Conta do usuário
  const users = await prisma.user.findMany({
    where: { email: { contains: 'kleber', mode: 'insensitive' } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      emailVerified: true,
      twoFactorEnabled: true,
      isPlatformAdmin: true,
      updatedAt: true,
      createdAt: true,
      lastLoginAt: true,
      tenant: { select: { slug: true, name: true } },
      passwordHash: true,
    },
  });
  console.log('=== Contas com "kleber" ===');
  for (const u of users) {
    console.log({
      email: u.email,
      role: u.role,
      status: u.status,
      emailVerified: u.emailVerified,
      twoFactorEnabled: u.twoFactorEnabled,
      isPlatformAdmin: u.isPlatformAdmin,
      tenant: u.tenant.slug,
      updatedAt: u.updatedAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      hashPrefix: u.passwordHash.slice(0, 7),
      hashLen: u.passwordHash.length,
    });
  }

  // 2. Usuários modificados nas últimas 24h (algum processo mexeu em contas?)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const touched = await prisma.user.findMany({
    where: { updatedAt: { gte: since } },
    select: { email: true, status: true, updatedAt: true, tenant: { select: { slug: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
  console.log(`\n=== Usuários com updatedAt nas últimas 24h (${touched.length}) ===`);
  for (const u of touched) {
    console.log(`${u.updatedAt.toISOString()}  ${u.email}  [${u.tenant.slug}]  status=${u.status}`);
  }

  // 3. Sobras de tenants de teste (não deveriam existir)
  const testTenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { slug: { contains: 'test' } },
        { slug: { contains: 'spec-verify' } },
        { slug: { contains: 'task-test' } },
      ],
    },
    select: { slug: true, createdAt: true },
    take: 20,
  });
  console.log(`\n=== Tenants de teste remanescentes (${testTenants.length}) ===`);
  for (const t of testTenants) console.log(`${t.createdAt.toISOString()}  ${t.slug}`);

  // 4. Total de usuários/tenants (sanidade — nada foi apagado em massa?)
  console.log('\n=== Totais ===');
  console.log('tenants:', await prisma.tenant.count(), '| users:', await prisma.user.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
