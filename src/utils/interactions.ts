import { Interaction } from "../types";

const STORAGE_KEY_PREFIX = "lead_interactions_";
const ALL_INTERACTIONS_KEY = "all_interactions";

export function getLeadInteractions(leadId: number): Interaction[] {
  try {
    const key = `${STORAGE_KEY_PREFIX}${leadId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Erro ao buscar interações:", error);
    return [];
  }
}

export function addInteraction(leadId: number, interaction: Omit<Interaction, "id" | "leadId" | "timestamp">): Interaction {
  const newInteraction: Interaction = {
    ...interaction,
    id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    leadId,
    timestamp: new Date().toISOString(),
  };

  // Salvar na lista específica do lead
  const key = `${STORAGE_KEY_PREFIX}${leadId}`;
  const interactions = getLeadInteractions(leadId);
  interactions.unshift(newInteraction); // Adicionar no início
  localStorage.setItem(key, JSON.stringify(interactions));

  // Salvar no backup global
  try {
    const allInteractions = getAllInteractions();
    allInteractions.unshift(newInteraction);
    // Manter apenas as últimas 1000 interações
    const limited = allInteractions.slice(0, 1000);
    localStorage.setItem(ALL_INTERACTIONS_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error("Erro ao salvar interação global:", error);
  }

  return newInteraction;
}

export function deleteInteraction(leadId: number, interactionId: string): void {
  const key = `${STORAGE_KEY_PREFIX}${leadId}`;
  const interactions = getLeadInteractions(leadId);
  const filtered = interactions.filter((i) => i.id !== interactionId);
  localStorage.setItem(key, JSON.stringify(filtered));

  // Remover do backup global
  try {
    const allInteractions = getAllInteractions();
    const filteredGlobal = allInteractions.filter((i) => i.id !== interactionId);
    localStorage.setItem(ALL_INTERACTIONS_KEY, JSON.stringify(filteredGlobal));
  } catch (error) {
    console.error("Erro ao remover interação global:", error);
  }
}

export function getAllInteractions(): Interaction[] {
  try {
    const stored = localStorage.getItem(ALL_INTERACTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Erro ao buscar todas as interações:", error);
    return [];
  }
}

export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "há alguns segundos";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `há ${diffInMinutes} minuto${diffInMinutes > 1 ? "s" : ""}`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `há ${diffInHours} hora${diffInHours > 1 ? "s" : ""}`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `há ${diffInDays} dia${diffInDays > 1 ? "s" : ""}`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `há ${diffInWeeks} semana${diffInWeeks > 1 ? "s" : ""}`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  return `há ${diffInMonths} mês${diffInMonths > 1 ? "es" : ""}`;
}


