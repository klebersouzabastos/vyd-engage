/**
 * Diagnóstico read-only: o usuário enxerga os contatos? Onde estão os dados?
 *   npx tsx scripts/diag-contacts.ts
 */
import prisma from '../src/config/database.js';

const EMAIL = 'kleber.bastos.1984@gmail.com';

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: EMAIL },
    select: { id: true, email: true, tenantId: true, isPlatformAdmin: true, role: true },
  });
  console.log('USER:', JSON.stringify(user, null, 2));
  if (!user) return;

  const tid = user.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tid }, select: { id: true, name: true, slug: true } });
  console.log('TENANT do usuário:', JSON.stringify(tenant));

  // Contagens NO TENANT DO USUÁRIO
  const companies = await prisma.company.count({ where: { tenantId: tid, deletedAt: null } });
  const contactsActive = await prisma.lead.count({ where: { tenantId: tid, isContact: true, deletedAt: null } });
  const contactsAll = await prisma.lead.count({ where: { tenantId: tid, isContact: true } });
  const leadsActive = await prisma.lead.count({ where: { tenantId: tid, deletedAt: null } });
  const leadsAll = await prisma.lead.count({ where: { tenantId: tid } });
  console.log(`\n[NO TENANT DO USUÁRIO ${tid}]`);
  console.log(`  empresas(ativas)=${companies}`);
  console.log(`  contatos isContact=true ativos(deletedAt=null)=${contactsActive} | incl. deletados=${contactsAll}`);
  console.log(`  leads(todos) ativos=${leadsActive} | incl. deletados=${leadsAll}`);

  // Onde estão TODOS os contatos do banco (por tenant)?
  const byTenant = await prisma.lead.groupBy({
    by: ['tenantId'],
    where: { isContact: true },
    _count: { _all: true },
  });
  console.log('\n[CONTATOS isContact=true POR TENANT (todo o banco)]');
  for (const g of byTenant) {
    const t = await prisma.tenant.findUnique({ where: { id: g.tenantId }, select: { name: true, slug: true } });
    console.log(`  tenant ${g.tenantId} (${t?.slug ?? '???'}): ${g._count._all}`);
  }

  // Amostra de 3 contatos do tenant do usuário (campos que o front usa)
  const sample = await prisma.lead.findMany({
    where: { tenantId: tid, isContact: true, deletedAt: null },
    select: { id: true, name: true, email: true, status: true, source: true, isContact: true, deletedAt: true, companyId: true },
    take: 3,
  });
  console.log('\n[AMOSTRA 3 contatos do tenant do usuário]');
  console.log(JSON.stringify(sample, null, 2));

  // Total de tenants restantes
  const tenants = await prisma.tenant.count();
  console.log(`\n[TENANTS no banco]: ${tenants}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERRO:', e?.stack || e); process.exit(1); });
