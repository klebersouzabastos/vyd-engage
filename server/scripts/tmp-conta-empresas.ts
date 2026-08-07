import 'dotenv/config';
import prisma from '../src/config/database.js';
(async () => {
  const t = '10ce1bfe-4463-411b-ae18-db9b8b5a044c';
  const total = await prisma.company.count({ where: { tenantId: t, deletedAt: null } });
  console.log('empresas no tenant K2+:', total, '| o seletor carrega no máximo 100');
})().finally(() => prisma.$disconnect());
