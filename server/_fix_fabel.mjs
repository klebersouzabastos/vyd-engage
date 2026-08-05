// Canoniza o email do Ricardo Fabel para lowercase. Usa a API tipada do Prisma
// (sem raw SQL / sem cast), com checagem de colisão e idempotência. READ + 1 UPDATE.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const ID = '27ffa2b6-cf05-44fd-8be5-1bef0a38898c';
const show = (o) => JSON.stringify(o, null, 2);

console.log('>> _fix_fabel v2 (usa API Prisma, sem $queryRaw)\n');

try {
  const before = await prisma.user.findUnique({
    where: { id: ID },
    select: { id: true, email: true, status: true, lastLoginAt: true },
  });
  console.log('ANTES:', show(before));

  if (!before) {
    console.log('Usuário não encontrado — nada a fazer.');
  } else {
    const canonical = before.email.trim().toLowerCase();
    if (canonical === before.email) {
      console.log('Email já está canônico (lowercase) — nada a fazer.');
    } else {
      const collision = await prisma.user.findFirst({
        where: { email: canonical, id: { not: ID } },
        select: { id: true },
      });
      if (collision) {
        console.log(`ABORTADO: já existe outro User com email "${canonical}" (id ${collision.id}).`);
      } else {
        await prisma.user.update({ where: { id: ID }, data: { email: canonical } });
        const after = await prisma.user.findUnique({
          where: { id: ID },
          select: { id: true, email: true, status: true, lastLoginAt: true },
        });
        console.log('DEPOIS:', show(after));
        console.log('\n✓ Email canonizado com sucesso. O Ricardo já pode logar / resetar senha com', canonical);
      }
    }
  }
} catch (e) {
  console.error('ERRO:', e.message);
} finally {
  await prisma.$disconnect();
}
