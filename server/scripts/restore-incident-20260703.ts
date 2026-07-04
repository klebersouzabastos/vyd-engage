/**
 * Restauração pós-incidente 03/07/2026 (wipe de users/tasks/funnels/automations
 * por afterEach de teste com tenantId undefined). Sem backup no Railway (Hobby).
 *
 * O que faz (idempotente):
 *  1. Recria o usuário ADMIN kleber.bastos.1984@gmail.com no tenant k2 com senha
 *     temporária (trocar no primeiro acesso).
 *  2. Garante o funil padrão de LEADS e realoca os leads órfãos (funnelColumnId
 *     null) na coluna correspondente ao seu status (mappedStatus) ou na default.
 *
 *   npx tsx scripts/restore-incident-20260703.ts
 *
 * (Os 8 funis de negociação são recriados por seed-rd-config.ts --write.)
 */
import bcrypt from 'bcryptjs';
import prisma from '../src/config/database.js';
import { funnelService } from '../src/services/funnelService.js';
import { FunnelType, UserRole, UserStatus } from '@prisma/client';

const TENANT_SLUG = 'k2-engenharia-e-tecnologia';
const EMAIL = 'kleber.bastos.1984@gmail.com';
const TEMP_PASSWORD = process.env.RESTORE_TEMP_PASSWORD || '';

async function main() {
  if (!TEMP_PASSWORD || TEMP_PASSWORD.length < 10) {
    console.error('Defina RESTORE_TEMP_PASSWORD (>= 10 chars) no ambiente.');
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    console.error(`Tenant ${TENANT_SLUG} não encontrado.`);
    process.exit(1);
  }

  // 1) Usuário ADMIN
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`RESTORE:: usuário já existe (${existing.id}) — nada a fazer.`);
  } else {
    const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);
    const user = await prisma.user.create({
      data: {
        email: EMAIL,
        passwordHash,
        name: 'Kleber Bastos',
        tenantId: tenant.id,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        isPlatformAdmin: true,
      },
    });
    console.log(`RESTORE:: usuário ADMIN recriado (${user.id}).`);
  }

  // 2) Funil padrão de LEADS + realocação dos órfãos por mappedStatus
  const leadFunnel = await funnelService.ensureDefaultFunnel(tenant.id, FunnelType.LEAD);
  const columns = await prisma.funnelColumn.findMany({
    where: { funnelId: leadFunnel.id },
    select: { id: true, title: true, mappedStatus: true, isDefault: true },
    orderBy: { order: 'asc' },
  });
  const defaultColumn = columns.find((c) => c.isDefault) ?? columns[0];
  console.log(
    `RESTORE:: funil de leads "${leadFunnel.name}" com ${columns.length} colunas.`
  );

  let realocados = 0;
  for (const col of columns) {
    if (!col.mappedStatus) continue;
    const r = await prisma.lead.updateMany({
      where: { tenantId: tenant.id, funnelColumnId: null, status: col.mappedStatus },
      data: { funnelColumnId: col.id },
    });
    realocados += r.count;
  }
  const resto = await prisma.lead.updateMany({
    where: { tenantId: tenant.id, funnelColumnId: null },
    data: { funnelColumnId: defaultColumn.id },
  });
  console.log(
    `RESTORE:: leads realocados por status=${realocados}, para coluna default=${resto.count}.`
  );

  const orfaos = await prisma.lead.count({
    where: { tenantId: tenant.id, funnelColumnId: null },
  });
  console.log(`RESTORE:: leads ainda sem coluna: ${orfaos}. Concluído.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERRO::', e?.stack || e);
    process.exit(1);
  });
