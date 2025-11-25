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

  const fetchTasks = useCallback(async (filters?: any) => {
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
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar tarefas');
      toast.error('Erro ao carregar tarefas');
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
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar tarefa');
      throw err;
    }
  }, []);

  const updateTask = useCallback(async (id: string, data: Partial<Task>) => {
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
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar tarefa');
      throw err;
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    try {
      await apiClient.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Tarefa deletada com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao deletar tarefa');
      throw err;
    }
  }, []);

  const completeTask = useCallback(async (id: string) => {
    try {
      const result = await apiClient.updateTask(id, {
        status: 'COMPLETED',
      });
      setTasks(prev => prev.map(t => t.id === id ? result : t));
      return result;
    } catch (err: any) {
      toast.error(err.message || 'Erro ao completar tarefa');
      throw err;
    }
  }, []);

  const uncompleteTask = useCallback(async (id: string) => {
    try {
      const result = await apiClient.updateTask(id, {
        status: 'PENDING',
      });
      setTasks(prev => prev.map(t => t.id === id ? result : t));
      return result;
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reabrir tarefa');
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchTasks();
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
