import { apiClient } from '../services/api/client';

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
  avgResponseTime: number;
  newLeads: number;
  closedLeads: number;
}

export interface PipelineData {
  stages: Array<{ name: string; count: number; color: string }>;
  conversionRate: number;
  avgTimeInStage: Record<string, number>;
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
  avgCompletionTime: number;
  byPriority: Record<string, number>;
}

export interface InteractionsData {
  total: number;
  byType: Record<string, number>;
  byDay: Array<{ date: string; count: number }>;
  avgPerLead: number;
}

export interface AllMetricsData {
  leads: LeadsData;
  pipeline: PipelineData;
  automations: AutomationsData;
  tasks: TasksData;
  interactions: InteractionsData;
}

// Cache to avoid repeated API calls within a single render cycle
let cachedMetrics: AllMetricsData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds

function getCachedMetrics(): AllMetricsData | null {
  if (cachedMetrics && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedMetrics;
  }
  return null;
}

export function setCachedMetrics(data: AllMetricsData): void {
  cachedMetrics = data;
  cacheTimestamp = Date.now();
}

export function clearMetricsCache(): void {
  cachedMetrics = null;
  cacheTimestamp = 0;
}

// Default empty data to prevent crashes when API hasn't loaded yet
const emptyLeads: LeadsData = {
  total: 0,
  byStatus: {},
  bySource: {},
  conversionRate: 0,
  avgResponseTime: 0,
  newLeads: 0,
  closedLeads: 0,
};
const emptyPipeline: PipelineData = {
  stages: [],
  conversionRate: 0,
  avgTimeInStage: {},
  totalLeads: 0,
};
const emptyAutomations: AutomationsData = {
  total: 0,
  active: 0,
  paused: 0,
  totalLeadsEnrolled: 0,
  totalSentMessages: 0,
  successRate: 0,
  byType: {},
  byStatus: {},
};
const emptyTasks: TasksData = {
  total: 0,
  completed: 0,
  pending: 0,
  overdue: 0,
  dueToday: 0,
  completionRate: 0,
  avgCompletionTime: 0,
  byPriority: {},
};
const emptyInteractions: InteractionsData = { total: 0, byType: {}, byDay: [], avgPerLead: 0 };

export function getDefaultDateRange(
  period: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' = 'month'
): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'all':
      start.setFullYear(2020, 0, 1);
      break;
  }

  return { start, end };
}

// These functions return cached data synchronously.
// The ReportWidgetRenderer must call fetchReportMetrics() first to populate the cache.

export function getLeadsData(_filters?: ReportFilters): LeadsData {
  return getCachedMetrics()?.leads || emptyLeads;
}

export function getPipelineData(_filters?: ReportFilters): PipelineData {
  return getCachedMetrics()?.pipeline || emptyPipeline;
}

export function getAutomationsData(_filters?: ReportFilters): AutomationsData {
  return getCachedMetrics()?.automations || emptyAutomations;
}

export function getTasksData(_filters?: ReportFilters): TasksData {
  return getCachedMetrics()?.tasks || emptyTasks;
}

export function getInteractionsData(_filters?: ReportFilters): InteractionsData {
  return getCachedMetrics()?.interactions || emptyInteractions;
}

export function getAggregatedData(_filters?: ReportFilters): AllMetricsData {
  return (
    getCachedMetrics() || {
      leads: emptyLeads,
      pipeline: emptyPipeline,
      automations: emptyAutomations,
      tasks: emptyTasks,
      interactions: emptyInteractions,
    }
  );
}

// Async function to fetch metrics from API
export async function fetchReportMetrics(filters?: ReportFilters): Promise<AllMetricsData> {
  try {
    const params: { from?: string; to?: string } = {};
    if (filters?.dateRange) {
      params.from = filters.dateRange.start.toISOString();
      params.to = filters.dateRange.end.toISOString();
    }

    const result = await apiClient.getReportMetrics(params);
    const data = result?.data || result;
    setCachedMetrics(data);
    return data;
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    return {
      leads: emptyLeads,
      pipeline: emptyPipeline,
      automations: emptyAutomations,
      tasks: emptyTasks,
      interactions: emptyInteractions,
    };
  }
}
