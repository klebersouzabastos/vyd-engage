import { Lead, LeadScore, ScoreFactor } from "../types";
import { getAllInteractions } from "./interactions";

const SCORING_RULES = {
  // Pontos por fonte
  source: {
    meta: 10,
    google: 10,
    organico: 15, // Leads orgânicos são mais valiosos
    manual: 5,
  },
  // Pontos por interações
  interaction: {
    email_opened: 5,
    email_clicked: 10,
    whatsapp_replied: 15,
    call_answered: 20,
    meeting_scheduled: 30,
  },
  // Pontos por comportamento
  behavior: {
    visited_website: 5,
    downloaded_content: 10,
    requested_demo: 25,
    multiple_visits: 10,
  },
  // Pontos por tempo
  recency: {
    last_24h: 20,
    last_7d: 10,
    last_30d: 5,
  },
  // Pontos por status
  status: {
    novo: 0,
    contato: 20,
    fechado: 50,
    perdido: -10,
  },
};

export function calculateLeadScore(lead: Lead): LeadScore {
  const factors: ScoreFactor[] = [];
  let totalScore = 0;

  // Fonte do lead
  const sourcePoints = SCORING_RULES.source[lead.source] || 0;
  if (sourcePoints > 0) {
    factors.push({
      type: "source",
      description: `Lead capturado via ${lead.source}`,
      points: sourcePoints,
    });
    totalScore += sourcePoints;
  }

  // Status atual
  const statusPoints = SCORING_RULES.status[lead.status] || 0;
  if (statusPoints !== 0) {
    factors.push({
      type: "status",
      description: `Status: ${lead.status}`,
      points: statusPoints,
    });
    totalScore += statusPoints;
  }

  // Interações
  if (lead.interactions && lead.interactions.length > 0) {
    const interactions = lead.interactions;
    const emailCount = interactions.filter((i) => i.type === "email").length;
    const whatsappCount = interactions.filter((i) => i.type === "whatsapp").length;
    const callCount = interactions.filter((i) => i.type === "call").length;
    const meetingCount = interactions.filter((i) => i.type === "meeting").length;

    if (emailCount > 0) {
      const points = emailCount * SCORING_RULES.interaction.email_opened;
      factors.push({
        type: "interaction",
        description: `${emailCount} interação(ões) por email`,
        points,
      });
      totalScore += points;
    }

    if (whatsappCount > 0) {
      const points = whatsappCount * SCORING_RULES.interaction.whatsapp_replied;
      factors.push({
        type: "interaction",
        description: `${whatsappCount} interação(ões) por WhatsApp`,
        points,
      });
      totalScore += points;
    }

    if (callCount > 0) {
      const points = callCount * SCORING_RULES.interaction.call_answered;
      factors.push({
        type: "interaction",
        description: `${callCount} chamada(s) realizada(s)`,
        points,
      });
      totalScore += points;
    }

    if (meetingCount > 0) {
      const points = meetingCount * SCORING_RULES.interaction.meeting_scheduled;
      factors.push({
        type: "interaction",
        description: `${meetingCount} reunião(ões) agendada(s)`,
        points,
      });
      totalScore += points;
    }

    // Recência da última interação
    if (interactions.length > 0) {
      const lastInteraction = interactions.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
      const daysSince = Math.floor(
        (Date.now() - new Date(lastInteraction.timestamp).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSince <= 1) {
        factors.push({
          type: "recency",
          description: "Última interação nas últimas 24h",
          points: SCORING_RULES.recency.last_24h,
        });
        totalScore += SCORING_RULES.recency.last_24h;
      } else if (daysSince <= 7) {
        factors.push({
          type: "recency",
          description: "Última interação nos últimos 7 dias",
          points: SCORING_RULES.recency.last_7d,
        });
        totalScore += SCORING_RULES.recency.last_7d;
      } else if (daysSince <= 30) {
        factors.push({
          type: "recency",
          description: "Última interação nos últimos 30 dias",
          points: SCORING_RULES.recency.last_30d,
        });
        totalScore += SCORING_RULES.recency.last_30d;
      }
    }
  }

  // Automações ativas
  if (lead.automations && lead.automations.length > 0) {
    factors.push({
      type: "automation",
      description: `${lead.automations.length} automação(ões) ativa(s)`,
      points: lead.automations.length * 5,
    });
    totalScore += lead.automations.length * 5;
  }

  // Tags (indicam segmentação)
  if (lead.tags && lead.tags.length > 0) {
    factors.push({
      type: "tags",
      description: `${lead.tags.length} tag(s) atribuída(s)`,
      points: lead.tags.length * 3,
    });
    totalScore += lead.tags.length * 3;
  }

  // Garantir que o score não seja negativo
  totalScore = Math.max(0, totalScore);

  return {
    leadId: lead.id,
    score: totalScore,
    factors,
    lastUpdated: new Date().toISOString(),
  };
}

export function getLeadScore(leadId: number): LeadScore | null {
  try {
    const stored = localStorage.getItem(`leadScore_${leadId}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Erro ao carregar score do lead:", error);
  }
  return null;
}

export function saveLeadScore(score: LeadScore) {
  localStorage.setItem(`leadScore_${score.leadId}`, JSON.stringify(score));
}

export function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Quente", color: "text-red-600 bg-red-50" };
  if (score >= 50) return { label: "Morno", color: "text-orange-600 bg-orange-50" };
  if (score >= 25) return { label: "Frio", color: "text-blue-600 bg-blue-50" };
  return { label: "Muito Frio", color: "text-gray-600 bg-gray-50" };
}







