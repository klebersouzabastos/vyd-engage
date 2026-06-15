import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api/client';
import { Lead, DealStats } from '../types';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface DashboardStats {
  totalLeads: number;
  leadsByStatus: Record<string, number>;
  leadsBySource: Record<string, number>;
  recentLeads: Lead[];
  totalTasks: number;
  overdueTasks: number;
  tasksDueToday: number;
  completedTasks: number;
  dealStats: DealStats | null;
}

interface ApiLeadRaw {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  status: string;
  source: string;
  score?: number;
  customFields?: Record<string, string | number | boolean | null>;
  notes?: string;
  assignedTo?: string;
  tags?: Array<{ tag?: { id: string } } | string>;
  createdAt: string;
  updatedAt?: string;
}
interface ApiTaskRaw {
  status: string;
  dueDate?: string;
  createdAt: string;
}

const EMPTY_STATS: DashboardStats = {
  totalLeads: 0,
  leadsByStatus: {},
  leadsBySource: {},
  recentLeads: [],
  totalTasks: 0,
  overdueTasks: 0,
  tasksDueToday: 0,
  completedTasks: 0,
  dealStats: null,
};

async function computeDashboard(dateRange?: DateRange): Promise<DashboardStats> {
  const [leadsResult, tasksResult, dealStatsResult] = await Promise.all([
    apiClient.getLeads({ limit: 100 }),
    apiClient.getTasks({ limit: 100 }),
    apiClient.getDealStats().catch(() => ({ data: null })),
  ]);
  let leads = (leadsResult.leads || []) as unknown as ApiLeadRaw[];
  let tasks = (tasksResult.tasks || []) as unknown as ApiTaskRaw[];
  const dealStats = (dealStatsResult?.data || null) as DealStats | null;

  if (dateRange?.from || dateRange?.to) {
    const from = dateRange.from ? dateRange.from.getTime() : 0;
    const to = dateRange.to ? dateRange.to.getTime() : Infinity;
    leads = leads.filter((l: { createdAt: string }) => {
      const t = new Date(l.createdAt).getTime();
      return t >= from && t <= to;
    });
    tasks = tasks.filter((t: { createdAt: string }) => {
      const time = new Date(t.createdAt).getTime();
      return time >= from && time <= to;
    });
  }

  const leadsByStatus: Record<string, number> = {};
  const leadsBySource: Record<string, number> = {};
  leads.forEach((lead: ApiLeadRaw) => {
    const status = lead.status?.toLowerCase() || 'unknown';
    const source = lead.source?.toLowerCase() || 'unknown';
    leadsByStatus[status] = (leadsByStatus[status] || 0) + 1;
    leadsBySource[source] = (leadsBySource[source] || 0) + 1;
  });

  const recentLeads: Lead[] = leads.slice(0, 5).map((lead: ApiLeadRaw) => ({
    id: lead.id,
    name: lead.name,
    email: lead.email || '',
    phone: lead.phone || '',
    company: lead.company || '',
    position: lead.position || '',
    status: lead.status.toLowerCase(),
    source: lead.source.toLowerCase(),
    score: lead.score || 0,
    customFields: lead.customFields || {},
    notes: lead.notes || '',
    assignedTo: lead.assignedTo || '',
    tags: lead.tags?.map((lt) => (typeof lt === 'string' ? lt : lt.tag)) || [],
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  })) as unknown as Lead[];

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const overdueTasks = tasks.filter((task: ApiTaskRaw) => {
    if (task.status === 'COMPLETED' || !task.dueDate) return false;
    return new Date(task.dueDate) < now;
  }).length;

  const tasksDueToday = tasks.filter((task: ApiTaskRaw) => {
    if (task.status === 'COMPLETED' || !task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    return dueDate >= today && dueDate < tomorrow;
  }).length;

  const completedTasks = tasks.filter((task: ApiTaskRaw) => task.status === 'COMPLETED').length;

  return {
    totalLeads: leads.length,
    leadsByStatus,
    leadsBySource,
    recentLeads,
    totalTasks: tasks.length,
    overdueTasks,
    tasksDueToday,
    completedTasks,
    dealStats,
  };
}

/**
 * Dashboard aggregate hook backed by TanStack Query. Public API unchanged.
 */
export function useDashboard(dateRange?: DateRange) {
  const query = useQuery({
    queryKey: ['dashboard', dateRange?.from?.getTime() ?? null, dateRange?.to?.getTime() ?? null],
    queryFn: () => computeDashboard(dateRange),
  });

  return {
    stats: query.data ?? EMPTY_STATS,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}
