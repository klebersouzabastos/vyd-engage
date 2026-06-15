import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

const DEFAULT_PAGINATION = { page: 1, limit: 50, total: 0, totalPages: 0 };

/**
 * Tasks data hook backed by TanStack Query. Public API unchanged.
 */
export function useTasks() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string | number | undefined> | undefined>(undefined);

  const query = useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const result = await apiClient.getTasks(filters);
      return {
        tasks: (result.tasks ?? []) as unknown as Task[],
        pagination: result.pagination || { ...DEFAULT_PAGINATION },
      };
    },
  });

  // Preserves the previous signature `fetchTasks(filters, { silent })`; the
  // silent option is a no-op now (read errors surface via the `error` field).
  const fetchTasks = useCallback(
    (next?: Record<string, string | number | undefined>, _options?: { silent?: boolean }) => {
      setFilters(next);
    },
    [],
  );

  const invalidate = useCallback(() => queryClient.invalidateQueries({ queryKey: ['tasks'] }), [queryClient]);

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
      toast.success('Tarefa criada com sucesso!');
      await invalidate();
      return result;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar tarefa');
      throw err;
    }
  }, [invalidate]);

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
      toast.success('Tarefa atualizada com sucesso!');
      await invalidate();
      return result;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar tarefa');
      throw err;
    }
  }, [invalidate]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      await apiClient.deleteTask(id);
      toast.success('Tarefa deletada com sucesso!');
      await invalidate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar tarefa');
      throw err;
    }
  }, [invalidate]);

  const completeTask = useCallback(async (id: string) => {
    try {
      const result = await apiClient.updateTask(id, { status: 'COMPLETED' });
      await invalidate();
      return result;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao completar tarefa');
      throw err;
    }
  }, [invalidate]);

  const uncompleteTask = useCallback(async (id: string) => {
    try {
      const result = await apiClient.updateTask(id, { status: 'PENDING' });
      await invalidate();
      return result;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reabrir tarefa');
      throw err;
    }
  }, [invalidate]);

  return {
    tasks: query.data?.tasks ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    pagination: query.data?.pagination ?? { ...DEFAULT_PAGINATION },
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    refetch: fetchTasks,
  };
}
