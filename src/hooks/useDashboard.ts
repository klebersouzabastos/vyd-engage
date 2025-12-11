import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api/client';
import { Lead } from '../types';

export interface DashboardStats {
  totalLeads: number;
  leadsByStatus: Record<string, number>;
  leadsBySource: Record<string, number>;
  recentLeads: Lead[];
  totalTasks: number;
  overdueTasks: number;
  tasksDueToday: number;
  completedTasks: number;
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    leadsByStatus: {},
    leadsBySource: {},
    recentLeads: [],
    totalTasks: 0,
    overdueTasks: 0,
    tasksDueToday: 0,
    completedTasks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch leads
      const leadsResult = await apiClient.getLeads({ limit: 100 });
      const leads = leadsResult.leads || [];

      // Fetch tasks
      const tasksResult = await apiClient.getTasks({ limit: 100 });
      const tasks = tasksResult.tasks || [];

      // Calculate stats
      const leadsByStatus: Record<string, number> = {};
      const leadsBySource: Record<string, number> = {};

      leads.forEach((lead: any) => {
        const status = lead.status?.toLowerCase() || 'unknown';
        const source = lead.source?.toLowerCase() || 'unknown';
        
        leadsByStatus[status] = (leadsByStatus[status] || 0) + 1;
        leadsBySource[source] = (leadsBySource[source] || 0) + 1;
      });

      // Get recent leads (last 5)
      const recentLeads: Lead[] = leads
        .slice(0, 5)
        .map((lead: any) => ({
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
          tags: lead.tags?.map((lt: any) => lt.tag) || [],
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
        }));

      // Calculate task stats
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const overdueTasks = tasks.filter((task: any) => {
        if (task.status === 'COMPLETED' || !task.dueDate) return false;
        return new Date(task.dueDate) < now;
      }).length;

      const tasksDueToday = tasks.filter((task: any) => {
        if (task.status === 'COMPLETED' || !task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate >= today && dueDate < tomorrow;
      }).length;

      const completedTasks = tasks.filter((task: any) => task.status === 'COMPLETED').length;

      setStats({
        totalLeads: leads.length,
        leadsByStatus,
        leadsBySource,
        recentLeads,
        totalTasks: tasks.length,
        overdueTasks,
        tasksDueToday,
        completedTasks,
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do dashboard');
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    stats,
    loading,
    error,
    refetch: fetchDashboardData,
  };
}






