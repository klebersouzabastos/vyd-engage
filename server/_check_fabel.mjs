// READ-ONLY. Estado atual da conta do Ricardo Fabel.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const u = await prisma.user.findFirst({
    where: { email: { contains: 'fabel', mode: 'insensitive' } },
    select: {
      id: true, email: true, name: true, status: true,
      emailVerified: true, lastLoginAt: true,
    },
  });
  console.log(JSON.stringify(u, null, 2));
  if (u) {
    console.log('\nEmail canônico esperado no login:', u.email);
    console.log('Já logou alguma vez (lastLoginAt):', u.lastLoginAt ?? 'NUNCA');
  }
} catch (e) {
  console.error('ERRO:', e.message);
} finally {
  await prisma.$disconnect();
}
