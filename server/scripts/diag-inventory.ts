/** Inventário READ-ONLY pós-incidente — o que sobrou no banco. */
import prisma from '../src/config/database.js';

async function main() {
  const tenant = await prisma.tenant.findFirst({
    select: { id: true, slug: true, name: true, createdAt: true },
  });
  const counts: Record<string, number> = {
    users: await prisma.user.count(),
    tasks: await prisma.task.count(),
    funnels: await prisma.funnel.count(),
    funnelColumns: await prisma.funnelColumn.count(),
    automations: await prisma.automation.count(),
    notifications: await prisma.notification.count(),
    refreshTokens: await prisma.refreshToken.count(),
    invitations: await prisma.invitation.count(),
    companies: await prisma.company.count(),
    leads: await prisma.lead.count(),
    deals: await prisma.deal.count(),
    interactions: await prisma.interaction.count(),
    empreendimentos: await prisma.empreendimento.count(),
    commercialRoadmaps: await prisma.commercialRoadmap.count(),
    playbookTemplates: await prisma.playbookTemplate.count(),
    deepResearches: await prisma.deepResearch.count(),
    products: await prisma.product.count(),
    lostReasons: await prisma.lostReason.count(),
    dealSources: await prisma.dealSource.count(),
    stageTaskTemplates: await prisma.stageTaskTemplate.count(),
    savedViews: await prisma.savedView.count(),
    goals: await prisma.goal.count(),
    reports: await prisma.report.count(),
    campaigns: await prisma.campaign.count(),
    tags: await prisma.tag.count(),
    customFields: await prisma.customField.count(),
    emailConfigs: await prisma.emailConfig.count(),
    whatsappConnections: await prisma.whatsAppConnection.count(),
    apiKeys: await prisma.apiKey.count(),
    subscriptions: await prisma.subscription.count(),
    auditLogs: await prisma.auditLog.count(),
  };
  // Leads/deals órfãos de coluna (SetNull do cascade dos funis)
  const leadsSemColuna = await prisma.lead.count({ where: { funnelColumnId: null } });
  const dealsSemColuna = await prisma.deal.count({ where: { funnelColumnId: null } });
  const dealsSemDono = await prisma.deal.count({ where: { assignedTo: null } });
  const leadsSemDono = await prisma.lead.count({ where: { assignedTo: null } });

  console.log('TENANT_RESTANTE::', JSON.stringify(tenant));
  console.log('COUNTS::', JSON.stringify(counts));
  console.log(
    'ORFAOS::',
    JSON.stringify({ leadsSemColuna, dealsSemColuna, leadsSemDono, dealsSemDono })
  );
}

main()
  .catch((e) => {
    console.error('ERRO::', e?.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
