import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string;
  leadId?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const fetchTasks = useCallback(async (filters?: Record<string, string | number | undefined>, options?: { silent?: boolean }) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.getTasks(filters);

      setTasks(result.tasks || []);
      setPagination(result.pagination || {
        page: 1,
        limit: 50,
        total: result.tasks?.length || 0,
        totalPages: 1,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar tarefas';
      setError(message);
      if (!options?.silent) {
        toast.error('Erro ao carregar tarefas');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = useCallback(async (data: Partial<Task>) => {
    try {
      const result = await apiClient.createTask({
        title: data.title || '',
        description: data.description,
        status: data.status,
        priority: data.priority,
        assignedTo: data.assignedTo,
        leadId: data.leadId,
        dueDate: data.dueDate,
      });

      setTasks(prev => [result, ...prev]);
      toast.success('Tarefa criada com sucesso!');
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar tarefa';
      toast.error(message);
      throw err;
    }
  }, []);

  const updateTask = useCallback(async (id: string, data: Partial<Task>) => {
    // Optimistic update
    const backup = [...tasks];
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    try {
      const result = await apiClient.updateTask(id, {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assignedTo: data.assignedTo,
        leadId: data.leadId,
        dueDate: data.dueDate,
      });

      setTasks(prev => prev.map(t => t.id === id ? result : t));
      toast.success('Tarefa atualizada com sucesso!');
      return result;
    } catch (err: unknown) {
      // Rollback on failure
      setTasks(backup);
      const message = err instanceof Error ? err.message : 'Erro ao atualizar tarefa';
      toast.error(message);
      throw err;
    }
  }, [tasks]);

  const deleteTask = useCallback(async (id: string) => {
    const backup = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await apiClient.deleteTask(id);
      toast.success('Tarefa deletada com sucesso!');
    } catch (err: unknown) {
      setTasks(backup);
      const message = err instanceof Error ? err.message : 'Erro ao deletar tarefa';
      toast.error(message);
      throw err;
    }
  }, [tasks]);

  const completeTask = useCallback(async (id: string) => {
    const backup = [...tasks];
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'COMPLETED' as const, completedAt: new Date().toISOString() } : t));
    try {
      const result = await apiClient.updateTask(id, {
        status: 'COMPLETED',
      });
      setTasks(prev => prev.map(t => t.id === id ? result : t));
      return result;
    } catch (err: unknown) {
      setTasks(backup);
      const message = err instanceof Error ? err.message : 'Erro ao completar tarefa';
      toast.error(message);
      throw err;
    }
  }, [tasks]);

  const uncompleteTask = useCallback(async (id: string) => {
    const backup = [...tasks];
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'PENDING' as const, completedAt: undefined } : t));
    try {
      const result = await apiClient.updateTask(id, {
        status: 'PENDING',
      });
      setTasks(prev => prev.map(t => t.id === id ? result : t));
      return result;
    } catch (err: unknown) {
      setTasks(backup);
      const message = err instanceof Error ? err.message : 'Erro ao reabrir tarefa';
      toast.error(message);
      throw err;
    }
  }, [tasks]);

  useEffect(() => {
    fetchTasks(undefined, { silent: true });
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    pagination,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    refetch: fetchTasks,
  };
}
