import { Lead } from "../types";

// Stubs para dados que agora vêm da API (utils localStorage foram removidos)
function getAllTasks(): any[] { return []; }
function getAllAutomations(): any[] { return []; }
function getAllInteractions(): any[] { return []; }
function getAllLogs(): any[] { return []; }

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ReportFilters {
  dateRange?: DateRange;
  status?: string[];
  source?: string[];
  tags?: string[];
  automationIds?: number[];
  userId?: string;
}

export interface LeadsData {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  conversionRate: number;
  avgResponseTime: number; // em horas
  newLeads: number;
  closedLeads: number;
  leads: Lead[];
}

export interface PipelineData {
  stages: Array<{ name: string; count: number; color: string }>;
  conversionRate: number;
  avgTimeInStage: Record<string, number>; // em dias
  totalLeads: number;
}

export interface AutomationsData {
  total: number;
  active: number;
  paused: number;
  totalLeadsEnrolled: number;
  totalSentMessages: number;
  successRate: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface TasksData {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  dueToday: number;
  completionRate: number;
  avgCompletionTime: number; // em dias
  byPriority: Record<string, number>;
}

export interface InteractionsData {
  total: number;
  byType: Record<string, number>;
  byDay: Array<{ date: string; count: number }>;
  avgPerLead: number;
}

// Função auxiliar para filtrar por período
function filterByDateRange<T extends { createdAt?: string; date?: string; timestamp?: string; datetime?: string }>(
  items: T[],
  dateRange?: DateRange
): T[] {
  if (!dateRange) return items;
  
  return items.filter((item) => {
    const dateStr = item.createdAt || item.date || item.timestamp || item.datetime;
    if (!dateStr) return false;
    
    let date: Date;
    // Tentar parsear diferentes formatos de data
    if (dateStr.includes('/')) {
      // Formato DD/MM/YYYY ou DD/MM/YYYY HH:mm
      const parts = dateStr.split(' ');
      const dateParts = parts[0].split('/');
      if (dateParts.length === 3) {
        date = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
      } else {
        date = new Date(dateStr);
      }
    } else {
      date = new Date(dateStr);
    }
    
    return date >= dateRange.start && date <= dateRange.end;
  });
}

// Função auxiliar para calcular período padrão
export function getDefaultDateRange(period: "today" | "week" | "month" | "quarter" | "year" | "all" = "month"): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  
  const start = new Date();
  
  switch (period) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "week":
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case "month":
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "quarter":
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      break;
    case "year":
      start.setFullYear(start.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "all":
      start.setFullYear(2020, 0, 1);
      break;
  }
  
  return { start, end };
}

// Buscar dados de leads (stub — real data comes from API via Reports page)
export function getLeadsData(filters?: ReportFilters): LeadsData {
  try {
    let leads: Lead[] = [];
    
    // Aplicar filtros
    if (filters?.dateRange) {
      leads = filterByDateRange(leads, filters.dateRange);
    }
    
    if (filters?.status && filters.status.length > 0) {
      leads = leads.filter(lead => filters.status!.includes(lead.status));
    }
    
    if (filters?.source && filters.source.length > 0) {
      leads = leads.filter(lead => filters.source!.includes(lead.source));
    }
    
    if (filters?.tags && filters.tags.length > 0) {
      leads = leads.filter(lead => 
        lead.tags && lead.tags.some(tag => filters.tags!.includes(tag))
      );
    }
    
    // Calcular estatísticas
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let closedLeads = 0;
    let newLeads = 0;
    
    leads.forEach(lead => {
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
      bySource[lead.source] = (bySource[lead.source] || 0) + 1;
      
      if (lead.status === "fechado") closedLeads++;
      if (lead.status === "novo") newLeads++;
    });
    
    const total = leads.length;
    const conversionRate = total > 0 ? (closedLeads / total) * 100 : 0;
    
    // Calcular tempo médio de resposta (simplificado - baseado em interações)
    const interactions = getAllInteractions();
    let totalResponseTime = 0;
    let responseCount = 0;
    
    leads.forEach(lead => {
      const leadInteractions = interactions.filter(i => i.leadId === lead.id);
      if (leadInteractions.length > 0 && lead.createdAt) {
        const firstInteraction = leadInteractions[0];
        const leadDate = new Date(lead.createdAt);
        const interactionDate = new Date(firstInteraction.timestamp);
        const diffHours = (interactionDate.getTime() - leadDate.getTime()) / (1000 * 60 * 60);
        if (diffHours > 0) {
          totalResponseTime += diffHours;
          responseCount++;
        }
      }
    });
    
    const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;
    
    return {
      total,
      byStatus,
      bySource,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgResponseTime: Math.round(avgResponseTime * 10) / 10,
      newLeads,
      closedLeads,
      leads,
    };
  } catch (error) {
    console.error("Erro ao buscar dados de leads:", error);
    return {
      total: 0,
      byStatus: {},
      bySource: {},
      conversionRate: 0,
      avgResponseTime: 0,
      newLeads: 0,
      closedLeads: 0,
      leads: [],
    };
  }
}

// Buscar dados do pipeline (stub — real data comes from API via useFunnels)
export function getPipelineData(filters?: ReportFilters): PipelineData {
  try {
    const funnels: any[] = [];
    
    // Usar o funil padrão ou o primeiro disponível
    const defaultFunnel = funnels.find((f: any) => f.isDefault) || funnels[0];
    if (!defaultFunnel) {
      return {
        stages: [],
        conversionRate: 0,
        avgTimeInStage: {},
        totalLeads: 0,
      };
    }
    
    const stages = defaultFunnel.columns.map((col: any) => ({
      name: col.title,
      count: col.leads?.length || 0,
      color: col.color || "#3B82F6",
    }));
    
    const totalLeads = stages.reduce((sum: number, stage: any) => sum + stage.count, 0);
    const closedStage = stages.find((s: any) => s.name.toLowerCase().includes("fechado") || s.name.toLowerCase().includes("concluído"));
    const closedCount = closedStage?.count || 0;
    const conversionRate = totalLeads > 0 ? (closedCount / totalLeads) * 100 : 0;
    
    // Calcular tempo médio em cada estágio (simplificado)
    const avgTimeInStage: Record<string, number> = {};
    stages.forEach((stage: any) => {
      avgTimeInStage[stage.name] = Math.random() * 5 + 1; // Placeholder - seria calculado com base em timestamps reais
    });
    
    return {
      stages,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgTimeInStage,
      totalLeads,
    };
  } catch (error) {
    console.error("Erro ao buscar dados do pipeline:", error);
    return {
      stages: [],
      conversionRate: 0,
      avgTimeInStage: {},
      totalLeads: 0,
    };
  }
}

// Buscar dados de automações
export function getAutomationsData(filters?: ReportFilters): AutomationsData {
  try {
    const automations = getAllAutomations();
    const logs = getAllLogs();
    
    // Filtrar logs por período se necessário
    let filteredLogs = logs;
    if (filters?.dateRange) {
      filteredLogs = filterByDateRange(logs, filters.dateRange);
    }
    
    if (filters?.automationIds && filters.automationIds.length > 0) {
      filteredLogs = filteredLogs.filter(log => filters.automationIds!.includes(log.automationId));
    }
    
    const total = automations.length;
    const active = automations.filter(a => a.status === "active").length;
    const paused = automations.filter(a => a.status === "paused").length;
    
    const uniqueLeads = new Set(filteredLogs.map(log => log.leadId || log.lead));
    const totalLeadsEnrolled = uniqueLeads.size;
    const totalSentMessages = filteredLogs.filter(log => log.status === "sent").length;
    const totalMessages = filteredLogs.length;
    const successRate = totalMessages > 0 ? (totalSentMessages / totalMessages) * 100 : 0;
    
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    
    automations.forEach(auto => {
      byType[auto.type] = (byType[auto.type] || 0) + 1;
      byStatus[auto.status] = (byStatus[auto.status] || 0) + 1;
    });
    
    return {
      total,
      active,
      paused,
      totalLeadsEnrolled,
      totalSentMessages,
      successRate: Math.round(successRate * 10) / 10,
      byType,
      byStatus,
    };
  } catch (error) {
    console.error("Erro ao buscar dados de automações:", error);
    return {
      total: 0,
      active: 0,
      paused: 0,
      totalLeadsEnrolled: 0,
      totalSentMessages: 0,
      successRate: 0,
      byType: {},
      byStatus: {},
    };
  }
}

// Buscar dados de tarefas
export function getTasksData(filters?: ReportFilters): TasksData {
  try {
    let tasks = getAllTasks();
    
    // Aplicar filtros
    if (filters?.dateRange) {
      tasks = filterByDateRange(tasks, filters.dateRange);
    }
    
    if (filters?.userId) {
      tasks = tasks.filter(task => task.userId === filters.userId);
    }
    
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = tasks.filter(t => !t.completed).length;
    
    const now = new Date();
    const overdue = tasks.filter(t => !t.completed && new Date(t.dueDate) < now).length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueToday = tasks.filter(t => 
      !t.completed && 
      new Date(t.dueDate) >= today && 
      new Date(t.dueDate) < tomorrow
    ).length;
    
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    
    // Calcular tempo médio de conclusão
    let totalCompletionTime = 0;
    let completionCount = 0;
    
    tasks.filter(t => t.completed && t.completedAt && t.createdAt).forEach(task => {
      const created = new Date(task.createdAt);
      const completed = new Date(task.completedAt!);
      const diffDays = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      totalCompletionTime += diffDays;
      completionCount++;
    });
    
    const avgCompletionTime = completionCount > 0 ? totalCompletionTime / completionCount : 0;
    
    const byPriority: Record<string, number> = {};
    tasks.forEach(task => {
      byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
    });
    
    return {
      total,
      completed,
      pending,
      overdue,
      dueToday,
      completionRate: Math.round(completionRate * 10) / 10,
      avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
      byPriority,
    };
  } catch (error) {
    console.error("Erro ao buscar dados de tarefas:", error);
    return {
      total: 0,
      completed: 0,
      pending: 0,
      overdue: 0,
      dueToday: 0,
      completionRate: 0,
      avgCompletionTime: 0,
      byPriority: {},
    };
  }
}

// Buscar dados de interações
export function getInteractionsData(filters?: ReportFilters): InteractionsData {
  try {
    let interactions = getAllInteractions();
    
    // Aplicar filtros
    if (filters?.dateRange) {
      interactions = filterByDateRange(interactions, filters.dateRange);
    }
    
    const total = interactions.length;
    
    const byType: Record<string, number> = {};
    interactions.forEach(interaction => {
      byType[interaction.type] = (byType[interaction.type] || 0) + 1;
    });
    
    // Agrupar por dia
    const byDayMap: Record<string, number> = {};
    interactions.forEach(interaction => {
      const date = new Date(interaction.timestamp);
      const dateKey = date.toISOString().split('T')[0];
      byDayMap[dateKey] = (byDayMap[dateKey] || 0) + 1;
    });
    
    const byDay = Object.entries(byDayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Calcular média por lead
    const uniqueLeads = new Set(interactions.map(i => i.leadId));
    const avgPerLead = uniqueLeads.size > 0 ? total / uniqueLeads.size : 0;
    
    return {
      total,
      byType,
      byDay,
      avgPerLead: Math.round(avgPerLead * 10) / 10,
    };
  } catch (error) {
    console.error("Erro ao buscar dados de interações:", error);
    return {
      total: 0,
      byType: {},
      byDay: [],
      avgPerLead: 0,
    };
  }
}

// Função auxiliar para obter dados agregados de múltiplas fontes
export function getAggregatedData(filters?: ReportFilters) {
  return {
    leads: getLeadsData(filters),
    pipeline: getPipelineData(filters),
    automations: getAutomationsData(filters),
    tasks: getTasksData(filters),
    interactions: getInteractionsData(filters),
  };
}








