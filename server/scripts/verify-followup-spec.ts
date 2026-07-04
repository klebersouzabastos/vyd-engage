/**
 * Verificação da spec followup-clientes-contratos em tenant descartável.
 * Cria um tenant isolado, exercita o job (follow-up + contratos) e a promoção
 * por deal GANHO, valida os comportamentos da DoD e APAGA tudo ao final
 * (mesmo padrão dos testes de integração — nenhum dado de teste permanece).
 *
 * Uso: npx tsx scripts/verify-followup-spec.ts
 */
import prisma from '../src/config/database.js';
import { checkClientFollowUpsAndContracts } from '../src/jobs/clientFollowUpChecker.js';
import { dealService } from '../src/services/dealService.js';

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

// Fixtures date-only pela mesma convenção do job: dia UTC (meia-noite UTC).
function daysFromToday(days: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

async function main() {
  const stamp = Date.now();
  const tenant = await prisma.tenant.create({
    data: { name: 'Spec Verify Followup', slug: `spec-verify-followup-${stamp}` },
  });

  try {
    const admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `admin-${stamp}@spec-verify.test`,
        passwordHash: 'x',
        name: 'Admin Verify',
        role: 'ADMIN',
      },
    });
    const seller = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `seller-${stamp}@spec-verify.test`,
        passwordHash: 'x',
        name: 'Vendedor Verify',
        role: 'USER',
      },
    });

    // A: cliente ativo sem NENHUMA interação, com dono → follow-up na 1ª varredura.
    const companyA = await prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: 'Cliente Sem Contato',
        clientStatus: 'CLIENTE_ATIVO',
        assignedTo: seller.id,
      },
    });
    // A2: cliente ativo SEM dono e com interação velha (40d > 30d) → alerta p/ gestores.
    const companyA2 = await prisma.company.create({
      data: { tenantId: tenant.id, name: 'Cliente Sem Dono', clientStatus: 'CLIENTE_ATIVO' },
    });
    await prisma.interaction.create({
      data: {
        tenantId: tenant.id,
        companyId: companyA2.id,
        type: 'CALL',
        direction: 'OUTBOUND',
        content: 'contato antigo',
        createdAt: daysFromToday(-40),
      },
    });
    // A3: cliente ativo com interação RECENTE (5d) → NÃO gera follow-up.
    const companyA3 = await prisma.company.create({
      data: { tenantId: tenant.id, name: 'Cliente Em Dia', clientStatus: 'CLIENTE_ATIVO' },
    });
    await prisma.interaction.create({
      data: {
        tenantId: tenant.id,
        companyId: companyA3.id,
        type: 'CALL',
        direction: 'OUTBOUND',
        content: 'contato recente',
        createdAt: daysFromToday(-5),
      },
    });
    // A4: PROSPECT sem interação → fora da varredura de follow-up.
    await prisma.company.create({
      data: { tenantId: tenant.id, name: 'Prospect Fora', clientStatus: 'PROSPECT' },
    });

    // B: contrato do concorrente vencendo em 20 dias → só o limiar 30 (DoD).
    const companyB = await prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: 'Contrato Concorrente 20d',
        contractHolder: 'CONCORRENTE',
        contractCompetitor: 'ACME Rival',
        contractEndDate: daysFromToday(20),
        assignedTo: seller.id,
      },
    });
    // C: contrato já vencido → UMA notificação de vencido.
    const companyC = await prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: 'Contrato Vencido',
        contractHolder: 'NOS',
        contractEndDate: daysFromToday(-5),
      },
    });
    // D: contrato sem data de vencimento → nunca alerta.
    await prisma.company.create({
      data: { tenantId: tenant.id, name: 'Contrato Sem Data', contractHolder: 'NOS' },
    });
    // E: soft-deleted com contrato vencendo → fora da varredura.
    await prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: 'Empresa Deletada',
        contractHolder: 'NOS',
        contractEndDate: daysFromToday(10),
        deletedAt: new Date(),
      },
    });

    // ── 1ª varredura ──
    await checkClientFollowUpsAndContracts();

    const tasks1 = await prisma.task.findMany({ where: { tenantId: tenant.id } });
    const followA = tasks1.filter((t) => t.companyId === companyA.id);
    check(
      'Follow-up A: 1 tarefa criada, título/dono/dueDate corretos',
      followA.length === 1 &&
        followA[0].title === `Follow-up — ${companyA.name}` &&
        followA[0].assignedTo === seller.id &&
        !!followA[0].dueDate,
      JSON.stringify(followA)
    );
    const followA2 = tasks1.filter((t) => t.companyId === companyA2.id);
    check(
      'Follow-up A2 (sem dono, 40d): tarefa criada SEM atribuição',
      followA2.length === 1 && followA2[0].assignedTo === null
    );
    const followA3 = tasks1.filter((t) => t.companyId === companyA3.id);
    check('A3 (interação recente): NENHUMA tarefa', followA3.length === 0);
    check(
      'A4/Prospect e deletada: nenhuma tarefa extra',
      tasks1.length === 2,
      `total=${tasks1.length}`
    );

    const notifs1 = await prisma.notification.findMany({ where: { tenantId: tenant.id } });
    const fuA = notifs1.filter(
      (n) => n.type === 'CLIENT_FOLLOWUP' && (n.metadata as any)?.companyId === companyA.id
    );
    check(
      'Notificação CLIENT_FOLLOWUP de A vai para o dono (vendedor)',
      fuA.length === 1 && fuA[0].userId === seller.id && fuA[0].link === `/app/companies/${companyA.id}`
    );
    const fuA2 = notifs1.filter(
      (n) => n.type === 'CLIENT_FOLLOWUP' && (n.metadata as any)?.companyId === companyA2.id
    );
    check(
      'A2 sem dono: CLIENT_FOLLOWUP vai para admins/gestores',
      fuA2.length === 1 && fuA2[0].userId === admin.id
    );

    const ceB = notifs1.filter(
      (n) => n.type === 'CONTRACT_EXPIRING' && (n.metadata as any)?.companyId === companyB.id
    );
    const thresholdsB = [...new Set(ceB.map((n) => (n.metadata as any)?.threshold))];
    check(
      'Contrato B (20d): dispara SÓ o limiar 30 (menor aplicável), não 60/90',
      thresholdsB.length === 1 && thresholdsB[0] === 30,
      JSON.stringify(thresholdsB)
    );
    check(
      'Contrato B: notifica dono + admin (2 destinatários)',
      ceB.length === 2 &&
        new Set(ceB.map((n) => n.userId)).size === 2 &&
        ceB.every((n) => n.title.includes('ACME Rival') && n.title.includes('vence em 20 dias'))
    );
    const ceC = notifs1.filter(
      (n) => n.type === 'CONTRACT_EXPIRING' && (n.metadata as any)?.companyId === companyC.id
    );
    check(
      'Contrato C (vencido): notificação única de vencido (threshold EXPIRED)',
      ceC.length === 1 && (ceC[0].metadata as any)?.threshold === 'EXPIRED',
      JSON.stringify(ceC.map((n) => n.metadata))
    );
    check(
      'Sem-data e deletada: nenhum CONTRACT_EXPIRING extra',
      notifs1.filter((n) => n.type === 'CONTRACT_EXPIRING').length === 3
    );

    // ── 2ª varredura (dedup) ──
    await checkClientFollowUpsAndContracts();
    const tasks2 = await prisma.task.findMany({ where: { tenantId: tenant.id } });
    const notifs2 = await prisma.notification.findMany({ where: { tenantId: tenant.id } });
    check('Dedup: 2ª varredura não cria novas tarefas', tasks2.length === tasks1.length);
    check('Dedup: 2ª varredura não cria novas notificações', notifs2.length === notifs1.length);

    // ── Interação nova reinicia o relógio + tarefa concluída → novo ciclo ──
    await prisma.task.updateMany({
      where: { tenantId: tenant.id, companyId: companyA.id },
      data: { status: 'COMPLETED' },
    });
    await prisma.interaction.create({
      data: {
        tenantId: tenant.id,
        companyId: companyA.id,
        type: 'CALL',
        direction: 'OUTBOUND',
        content: 'novo contato — reinicia ciclo',
      },
    });
    await checkClientFollowUpsAndContracts();
    const tasksA3rd = await prisma.task.findMany({
      where: { tenantId: tenant.id, companyId: companyA.id },
    });
    check(
      'Interação nova reinicia o relógio: sem nova tarefa mesmo com anterior concluída',
      tasksA3rd.length === 1
    );

    // ── Promoção por deal GANHO (req 6) ──
    const companyP = await prisma.company.create({
      data: { tenantId: tenant.id, name: 'Prospect Que Ganhou', clientStatus: 'PROSPECT' },
    });
    const deal = await prisma.deal.create({
      data: {
        tenantId: tenant.id,
        name: 'Deal Verify',
        value: 1000,
        companyId: companyP.id,
      },
    });
    await dealService.markWon(tenant.id, deal.id);
    const promoted = await prisma.company.findUnique({ where: { id: companyP.id } });
    check('Deal GANHO promove empresa a CLIENTE_ATIVO', promoted?.clientStatus === 'CLIENTE_ATIVO');

    // No-op: já CLIENTE_ATIVO permanece (edição manual segue possível)
    await prisma.company.update({ where: { id: companyP.id }, data: { clientStatus: 'INATIVO' } });
    const manual = await prisma.company.findUnique({ where: { id: companyP.id } });
    check('Edição manual de status continua possível (INATIVO)', manual?.clientStatus === 'INATIVO');

    // Re-marcar deal JÁ ganho não re-promove empresa rebaixada manualmente (guarda de transição)
    await dealService.markWon(tenant.id, deal.id);
    const afterRewon = await prisma.company.findUnique({ where: { id: companyP.id } });
    check(
      'markWon de deal já WON não re-promove empresa rebaixada (no-op)',
      afterRewon?.clientStatus === 'INATIVO'
    );
  } finally {
    // Cleanup TOTAL — nenhum dado de verificação permanece no banco.
    await prisma.tenant.delete({ where: { id: tenant.id } });
    const leftover = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    console.log(leftover ? '✗ CLEANUP FALHOU' : '✓ Cleanup: tenant de verificação removido');
  }

  console.log(failures === 0 ? '\nTODAS AS VERIFICAÇÕES PASSARAM' : `\n${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
