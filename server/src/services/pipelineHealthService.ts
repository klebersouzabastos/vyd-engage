import prisma from '../config/database.js';

export interface Factor {
  name: string;
  score: number;
  maxScore: number;
  detail: string;
}

export interface PipelineHealth {
  score: number;
  factors: Factor[];
  label: 'healthy' | 'warning' | 'critical';
}

/**
 * Calculates a pipeline health score (0–100) for a tenant across four factors
 * (activity rate, stage distribution, win rate, stale deals ratio), each worth 25 pts.
 */
export async function getPipelineHealth(tenantId: string): Promise<PipelineHealth> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch tenant staleDays for factor 4
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { staleDays: true },
  });
  const staleDays = tenant?.staleDays ?? 5;
  const staleThreshold = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);

  // Open deals (not WON/LOST, not deleted)
  const openDeals = await prisma.deal.findMany({
    where: {
      tenantId,
      stage: { notIn: ['WON', 'LOST'] },
      deletedAt: null,
    },
    select: { id: true, stage: true },
  });

  const totalOpenDeals = openDeals.length;
  const openDealIds = openDeals.map((d) => d.id);

  // ── Factor 1: Activity rate ────────────────────────────────────────────────
  // % of open deals with at least 1 interaction in the last 7 days
  let activityScore = 0;
  let activityDetail = 'Sem deals em aberto';

  if (totalOpenDeals > 0) {
    const recentlyActiveDeals = await prisma.interaction.findMany({
      where: {
        tenantId,
        dealId: { in: openDealIds },
        createdAt: { gte: sevenDaysAgo },
      },
      distinct: ['dealId'],
      select: { dealId: true },
    });

    const activeCount = recentlyActiveDeals.length;
    const activityRate = activeCount / totalOpenDeals;
    activityScore = Math.round(activityRate * 25);
    activityDetail = `${activeCount} de ${totalOpenDeals} deals com atividade nos últimos 7 dias (${Math.round(activityRate * 100)}%)`;
  }

  const factorActivity: Factor = {
    name: 'Taxa de atividade',
    score: activityScore,
    maxScore: 25,
    detail: activityDetail,
  };

  // ── Factor 2: Stage distribution ──────────────────────────────────────────
  const uniqueStages = new Set(openDeals.map((d) => d.stage)).size;
  let stageScore: number;
  let stageDetail: string;

  if (uniqueStages >= 3) {
    stageScore = 25;
    stageDetail = `Deals distribuídos em ${uniqueStages} etapas`;
  } else if (uniqueStages === 2) {
    stageScore = 15;
    stageDetail = `Deals distribuídos em 2 etapas`;
  } else if (uniqueStages === 1) {
    stageScore = 5;
    stageDetail = `Todos os deals concentrados em 1 etapa`;
  } else {
    stageScore = 0;
    stageDetail = `Sem deals em aberto`;
  }

  const factorStage: Factor = {
    name: 'Distribuição por etapa',
    score: stageScore,
    maxScore: 25,
    detail: stageDetail,
  };

  // ── Factor 3: Win rate last 30 days ───────────────────────────────────────
  const closedDeals = await prisma.deal.findMany({
    where: {
      tenantId,
      stage: { in: ['WON', 'LOST'] },
      updatedAt: { gte: thirtyDaysAgo },
      deletedAt: null,
    },
    select: { stage: true },
  });

  let winRateScore: number;
  let winRateDetail: string;

  if (closedDeals.length === 0) {
    winRateScore = 20;
    winRateDetail = 'Nenhum deal fechado nos últimos 30 dias (padrão: 20pts)';
  } else {
    const wonCount = closedDeals.filter((d) => d.stage === 'WON').length;
    const winRate = wonCount / closedDeals.length;
    winRateScore = Math.round(winRate * 25);
    winRateDetail = `${wonCount} ganhos de ${closedDeals.length} fechados nos últimos 30 dias (${Math.round(winRate * 100)}%)`;
  }

  const factorWinRate: Factor = {
    name: 'Taxa de vitória (30 dias)',
    score: winRateScore,
    maxScore: 25,
    detail: winRateDetail,
  };

  // ── Factor 4: Stale deals ratio ───────────────────────────────────────────
  let staleScore = 25;
  let staleDetail = 'Sem deals em aberto';

  if (totalOpenDeals > 0) {
    const latestInteractions = await prisma.interaction.findMany({
      where: { dealId: { in: openDealIds } },
      orderBy: { createdAt: 'desc' },
      distinct: ['dealId'],
      select: { dealId: true, createdAt: true },
    });

    const lastActivityByDeal = new Map<string, Date>();
    for (const interaction of latestInteractions) {
      if (interaction.dealId) {
        lastActivityByDeal.set(interaction.dealId, interaction.createdAt);
      }
    }

    const staleCount = openDeals.filter((deal) => {
      const lastActivity = lastActivityByDeal.get(deal.id);
      return !lastActivity || lastActivity < staleThreshold;
    }).length;

    const staleRatio = staleCount / totalOpenDeals;
    staleScore = Math.max(0, Math.round(25 * (1 - staleRatio)));
    staleDetail = `${staleCount} de ${totalOpenDeals} deals sem atividade há mais de ${staleDays} dias (${Math.round(staleRatio * 100)}%)`;
  }

  const factorStale: Factor = {
    name: 'Deals sem atividade',
    score: staleScore,
    maxScore: 25,
    detail: staleDetail,
  };

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const factors: Factor[] = [factorActivity, factorStage, factorWinRate, factorStale];
  const score = factors.reduce((sum, f) => sum + f.score, 0);

  let label: 'healthy' | 'warning' | 'critical';
  if (score >= 70) {
    label = 'healthy';
  } else if (score >= 40) {
    label = 'warning';
  } else {
    label = 'critical';
  }

  return { score, factors, label };
}
