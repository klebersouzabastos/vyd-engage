export interface AutomationLog {
  id: number;
  leadId?: number;
  lead: string;
  automationId: number;
  automation: string;
  step: number;
  channel: "whatsapp" | "email";
  status: "sent" | "error" | "pending";
  datetime: string;
  errorMessage?: string;
  createdAt?: string;
}

const STORAGE_KEY = "automationLogs";

// Dados padrão de logs (opcional - apenas para demonstração inicial)
const DEFAULT_LOGS: AutomationLog[] = [
  { id: 1, leadId: 1, lead: "Maria Silva", automationId: 1, automation: "Boas-vindas WhatsApp", step: 1, channel: "whatsapp", status: "sent", datetime: "22/11/2024 14:30", createdAt: new Date().toISOString() },
  { id: 2, leadId: 2, lead: "João Santos", automationId: 1, automation: "Boas-vindas WhatsApp", step: 2, channel: "whatsapp", status: "sent", datetime: "22/11/2024 14:15", createdAt: new Date().toISOString() },
  { id: 3, leadId: 3, lead: "Ana Costa", automationId: 2, automation: "Follow-up E-mail", step: 1, channel: "email", status: "sent", datetime: "22/11/2024 13:45", createdAt: new Date().toISOString() },
  { id: 4, leadId: 4, lead: "Pedro Lima", automationId: 1, automation: "Boas-vindas WhatsApp", step: 2, channel: "whatsapp", status: "error", datetime: "22/11/2024 13:20", errorMessage: "Token inválido", createdAt: new Date().toISOString() },
  { id: 5, leadId: 5, lead: "Carla Mendes", automationId: 2, automation: "Follow-up E-mail", step: 2, channel: "email", status: "sent", datetime: "22/11/2024 12:50", createdAt: new Date().toISOString() },
  { id: 6, leadId: 6, lead: "Lucas Ferreira", automationId: 1, automation: "Boas-vindas WhatsApp", step: 1, channel: "whatsapp", status: "pending", datetime: "22/11/2024 15:00", createdAt: new Date().toISOString() },
  { id: 7, leadId: 7, lead: "Juliana Rocha", automationId: 2, automation: "Follow-up E-mail", step: 3, channel: "email", status: "sent", datetime: "22/11/2024 11:30", createdAt: new Date().toISOString() },
  { id: 8, leadId: 8, lead: "Roberto Alves", automationId: 1, automation: "Boas-vindas WhatsApp", step: 1, channel: "whatsapp", status: "error", datetime: "22/11/2024 10:45", errorMessage: "Número inválido", createdAt: new Date().toISOString() },
];

// Obter todos os logs
export function getAllLogs(): AutomationLog[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    // Se não houver dados salvos e for a primeira vez, inicializar com dados padrão
    // (opcional - pode ser removido se não quiser dados de exemplo)
    const isFirstTime = !localStorage.getItem("automationLogsInitialized");
    if (isFirstTime) {
      saveLogs(DEFAULT_LOGS);
      localStorage.setItem("automationLogsInitialized", "true");
      return DEFAULT_LOGS;
    }
    return [];
  } catch (error) {
    console.error("Erro ao buscar logs de automação:", error);
    return [];
  }
}

// Obter logs por automação
export function getLogsByAutomation(automationId: number): AutomationLog[] {
  const logs = getAllLogs();
  return logs.filter((log) => log.automationId === automationId);
}

// Obter logs por lead
export function getLogsByLead(leadId: number): AutomationLog[] {
  const logs = getAllLogs();
  return logs.filter((log) => log.leadId === leadId);
}

// Obter logs por status
export function getLogsByStatus(status: "sent" | "error" | "pending"): AutomationLog[] {
  const logs = getAllLogs();
  return logs.filter((log) => log.status === status);
}

// Criar novo log
export function createLog(log: Omit<AutomationLog, "id" | "createdAt">): AutomationLog {
  const logs = getAllLogs();
  const maxId = logs.length > 0 ? Math.max(...logs.map(l => l.id)) : 0;
  
  const newLog: AutomationLog = {
    ...log,
    id: maxId + 1,
    createdAt: new Date().toISOString(),
  };

  logs.push(newLog);
  saveLogs(logs);
  
  return newLog;
}

// Salvar logs
function saveLogs(logs: AutomationLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error("Erro ao salvar logs de automação:", error);
  }
}

// Atualizar log
export function updateLog(id: number, updates: Partial<AutomationLog>): AutomationLog {
  const logs = getAllLogs();
  const index = logs.findIndex((log) => log.id === id);

  if (index === -1) {
    throw new Error("Log não encontrado");
  }

  const updatedLog = {
    ...logs[index],
    ...updates,
  };

  logs[index] = updatedLog;
  saveLogs(logs);
  
  return updatedLog;
}

// Deletar log
export function deleteLog(id: number): void {
  const logs = getAllLogs();
  const filtered = logs.filter((log) => log.id !== id);
  saveLogs(filtered);
}

// Calcular estatísticas de uma automação
export function getAutomationStats(automationId: number): {
  leadsEnrolled: number;
  sentMessages: number;
  errorMessages: number;
  pendingMessages: number;
} {
  const logs = getLogsByAutomation(automationId);
  
  // Leads únicos inscritos (leads que têm pelo menos um log)
  const uniqueLeads = new Set(logs.map(log => log.leadId || log.lead));
  const leadsEnrolled = uniqueLeads.size;
  
  // Mensagens enviadas com sucesso
  const sentMessages = logs.filter(log => log.status === "sent").length;
  
  // Mensagens com erro
  const errorMessages = logs.filter(log => log.status === "error").length;
  
  // Mensagens pendentes
  const pendingMessages = logs.filter(log => log.status === "pending").length;
  
  return {
    leadsEnrolled,
    sentMessages,
    errorMessages,
    pendingMessages,
  };
}

// Calcular estatísticas gerais de todas as automações
export function getOverallStats(automations?: Array<{ id: number; status: "active" | "paused" }>): {
  totalAutomations: number;
  activeAutomations: number;
  totalLeadsEnrolled: number;
  totalSentMessages: number;
} {
  // Se automations não for fornecido, buscar do localStorage diretamente
  let automationsList: Array<{ id: number; status: "active" | "paused" }> = [];
  
  if (automations) {
    automationsList = automations;
  } else {
    try {
      const stored = localStorage.getItem("automations");
      if (stored) {
        automationsList = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Erro ao buscar automações para estatísticas:", error);
    }
  }
  
  const allLogs = getAllLogs();
  
  // Leads únicos em todas as automações
  const uniqueLeads = new Set(allLogs.map(log => log.leadId || log.lead));
  const totalLeadsEnrolled = uniqueLeads.size;
  
  // Total de mensagens enviadas com sucesso
  const totalSentMessages = allLogs.filter(log => log.status === "sent").length;
  
  // Total de automações
  const totalAutomations = automationsList.length;
  
  // Automações ativas
  const activeAutomations = automationsList.filter(auto => auto.status === "active").length;
  
  return {
    totalAutomations,
    activeAutomations,
    totalLeadsEnrolled,
    totalSentMessages,
  };
}

// Obter leads inscritos em uma automação específica
export function getEnrolledLeads(automationId: number): string[] {
  const logs = getLogsByAutomation(automationId);
  const uniqueLeads = Array.from(new Set(logs.map(log => log.leadId || log.lead)));
  return uniqueLeads.map(id => String(id));
}

