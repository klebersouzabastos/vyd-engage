import prisma from '../config/database.js';
import { DealStage, LeadStatus } from '@prisma/client';

export interface NextAction {
  action: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  icon: string;
  category: string;
}

const NO_ACTION: NextAction = {
  action: 'Tudo em dia',
  reason: 'Nenhuma ação pendente para este registro.',
  priority: 'LOW',
  icon: 'check-circle',
  category: 'ok',
};

function daysSince(date: Date | null | undefined): number {
  if (!date) return Infinity;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

// ===========================
// Lead Rules
// ===========================

export async function getLeadNextAction(tenantId: string, leadId: string): Promise<NextAction> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      score: true,
      createdAt: true,
    },
  });

  if (!lead) {
    return { action: 'Lead não encontrado', reason: '', priority: 'LOW', icon: 'alert-circle', category: 'error' };
  }

  // Get last interaction
  const lastInteraction = await prisma.interaction.findFirst({
    where: { leadId, tenantId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, type: true },
  });

  // Check if lead has any EMAIL interaction
  const hasEmailInteraction = await prisma.interaction.count({
    where: { leadId, tenantId, type: 'EMAIL' },
  });

  // Check if lead has deals
  const dealCount = await prisma.deal.count({
    where: { leadId, tenantId },
  });

  const daysSinceLastInteraction = daysSince(lastInteraction?.createdAt);
  const leadAgeDays = daysSince(lead.createdAt);

  // Rules ordered by priority (first match wins)
  // HIGH priority rules first, then MEDIUM, then LOW

  // Rule: Status NEW for 3+ days → first contact
  if (lead.status === LeadStatus.NEW && leadAgeDays >= 3) {
    return {
      action: 'Fazer primeiro contato',
      reason: `Lead está como "Novo" há ${leadAgeDays} dias sem nenhum contato.`,
      priority: 'HIGH',
      icon: 'phone-outgoing',
      category: 'contact',
    };
  }

  // Rule: No interaction in 7+ days → follow-up
  if (daysSinceLastInteraction >= 7 && lead.status !== LeadStatus.WON && lead.status !== LeadStatus.LOST) {
    return {
      action: 'Fazer follow-up',
      reason: `Última interação foi há ${daysSinceLastInteraction} dias. O lead pode esfriar.`,
      priority: 'HIGH',
      icon: 'message-circle',
      category: 'follow-up',
    };
  }

  // Rule: Score > 80 → hot lead, schedule meeting
  if (lead.score > 80) {
    return {
      action: 'Lead quente — agendar reunião',
      reason: `Score de ${lead.score} indica alto interesse. Aproveite o momento.`,
      priority: 'HIGH',
      icon: 'flame',
      category: 'meeting',
    };
  }

  // Rule: No interaction in 3-7 days → send message
  if (daysSinceLastInteraction >= 3 && daysSinceLastInteraction < 7 && lead.status !== LeadStatus.WON && lead.status !== LeadStatus.LOST) {
    return {
      action: 'Enviar mensagem',
      reason: `Sem interação há ${daysSinceLastInteraction} dias. Mantenha o lead engajado.`,
      priority: 'MEDIUM',
      icon: 'send',
      category: 'message',
    };
  }

  // Rule: Has email but no EMAIL interaction → send intro email
  if (lead.email && hasEmailInteraction === 0 && lead.status !== LeadStatus.WON && lead.status !== LeadStatus.LOST) {
    return {
      action: 'Enviar email de apresentação',
      reason: 'Lead tem email cadastrado mas ainda não recebeu nenhum email.',
      priority: 'MEDIUM',
      icon: 'mail',
      category: 'email',
    };
  }

  // Rule: Qualified without deal → create deal
  if (lead.status === LeadStatus.QUALIFIED && dealCount === 0) {
    return {
      action: 'Criar deal/oportunidade',
      reason: 'Lead qualificado sem nenhum deal associado. Crie uma oportunidade.',
      priority: 'MEDIUM',
      icon: 'handshake',
      category: 'deal',
    };
  }

  // Rule: Score < 20 and age > 30 days → re-engage or discard
  if (lead.score < 20 && leadAgeDays > 30 && lead.status !== LeadStatus.WON && lead.status !== LeadStatus.LOST) {
    return {
      action: 'Re-engajar ou descartar',
      reason: `Score baixo (${lead.score}) e lead com mais de ${leadAgeDays} dias. Avalie se vale investir mais tempo.`,
      priority: 'LOW',
      icon: 'refresh-cw',
      category: 'cleanup',
    };
  }

  return NO_ACTION;
}

// ===========================
// Deal Rules
// ===========================

export async function getDealNextAction(tenantId: string, dealId: string): Promise<NextAction> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId },
    select: {
      id: true,
      name: true,
      value: true,
      stage: true,
      probability: true,
      expectedCloseDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!deal) {
    return { action: 'Deal não encontrado', reason: '', priority: 'LOW', icon: 'alert-circle', category: 'error' };
  }

  // Skip closed deals
  if (deal.stage === DealStage.WON || deal.stage === DealStage.LOST) {
    return NO_ACTION;
  }

  // Get last interaction for this deal
  const lastInteraction = await prisma.interaction.findFirst({
    where: { dealId, tenantId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  // Get average deal value for this tenant (active deals only)
  const avgResult = await prisma.deal.aggregate({
    where: {
      tenantId,
      stage: { notIn: [DealStage.WON, DealStage.LOST] },
    },
    _avg: { value: true },
  });
  const avgDealValue = Number(avgResult._avg.value || 0);

  const daysSinceLastInteraction = daysSince(lastInteraction?.createdAt);
  const dealValue = Number(deal.value);
  const daysSinceUpdate = daysSince(deal.updatedAt);

  // Rule: expectedCloseDate in the past → update forecast
  if (deal.expectedCloseDate && new Date(deal.expectedCloseDate) < new Date()) {
    return {
      action: 'Atualizar previsão de fechamento',
      reason: 'A data prevista de fechamento já passou. Atualize para manter o forecast correto.',
      priority: 'HIGH',
      icon: 'calendar-x',
      category: 'update',
    };
  }

  // Rule: Probability < 30% in CLOSING stage → decisive meeting
  if (deal.stage === DealStage.CLOSING && deal.probability < 30) {
    return {
      action: 'Agendar reunião decisiva',
      reason: `Deal em fase de fechamento mas com probabilidade de apenas ${deal.probability}%. Precisa de atenção imediata.`,
      priority: 'HIGH',
      icon: 'target',
      category: 'meeting',
    };
  }

  // Rule: No interaction in 5+ days → resume negotiation
  if (daysSinceLastInteraction >= 5) {
    return {
      action: 'Retomar negociação',
      reason: `Sem interação há ${daysSinceLastInteraction} dias. A negociação pode esfriar.`,
      priority: 'HIGH',
      icon: 'message-circle',
      category: 'follow-up',
    };
  }

  // Rule: Value > avg × 2 → strategic deal, special attention
  if (avgDealValue > 0 && dealValue > avgDealValue * 2) {
    return {
      action: 'Deal estratégico — atenção especial',
      reason: `Valor de ${formatBRL(dealValue)} é mais que o dobro do ticket médio (${formatBRL(avgDealValue)}). Priorize este deal.`,
      priority: 'HIGH',
      icon: 'star',
      category: 'strategic',
    };
  }

  // Rule: In same stage for 14+ days → move deal forward
  if (daysSinceUpdate >= 14) {
    return {
      action: 'Mover negociação adiante',
      reason: `Deal parado no stage atual há ${daysSinceUpdate} dias. Tente avançar para a próxima etapa.`,
      priority: 'MEDIUM',
      icon: 'arrow-right',
      category: 'progress',
    };
  }

  // Rule: No expectedCloseDate → set one
  if (!deal.expectedCloseDate) {
    return {
      action: 'Definir data prevista de fechamento',
      reason: 'Deal sem previsão de fechamento. Defina uma data para melhor controle do pipeline.',
      priority: 'MEDIUM',
      icon: 'calendar',
      category: 'update',
    };
  }

  return NO_ACTION;
}

// ===========================
// Dashboard Summary (top 5 urgent actions)
// ===========================

export interface ActionSummaryItem {
  entityType: 'lead' | 'deal';
  entityId: string;
  entityName: string;
  action: NextAction;
}

export async function getActionSummary(tenantId: string, limit = 5): Promise<ActionSummaryItem[]> {
  const results: ActionSummaryItem[] = [];

  // Fetch active leads (not WON/LOST, limited to recent/relevant)
  const leads = await prisma.lead.findMany({
    where: {
      tenantId,
      status: { notIn: [LeadStatus.WON, LeadStatus.LOST] },
    },
    select: { id: true, name: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  // Fetch active deals (not WON/LOST)
  const deals = await prisma.deal.findMany({
    where: {
      tenantId,
      stage: { notIn: [DealStage.WON, DealStage.LOST] },
    },
    select: { id: true, name: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  // Evaluate actions for all leads and deals
  const leadActions = await Promise.all(
    leads.map(async (lead) => {
      const action = await getLeadNextAction(tenantId, lead.id);
      return { entityType: 'lead' as const, entityId: lead.id, entityName: lead.name, action };
    })
  );

  const dealActions = await Promise.all(
    deals.map(async (deal) => {
      const action = await getDealNextAction(tenantId, deal.id);
      return { entityType: 'deal' as const, entityId: deal.id, entityName: deal.name, action };
    })
  );

  // Combine and filter out "Tudo em dia"
  const allActions = [...leadActions, ...dealActions].filter(
    (item) => item.action.category !== 'ok'
  );

  // Sort by priority: HIGH first, then MEDIUM, then LOW
  const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  allActions.sort((a, b) => priorityOrder[a.action.priority] - priorityOrder[b.action.priority]);

  return allActions.slice(0, limit);
}

// Helper
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
