import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import { useSocket } from './useSocket';
import { handlePendingApproval } from '../lib/approvalResponse';

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
  const [filters, setFilters] = useState<Record<string, string | number | undefined> | undefined>(
    undefined
  );

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

  const { on } = useSocket();

  useEffect(() => {
    const offUpdated = on('task:updated', (data: unknown) => {
      const payload = data as { task: Record<string, unknown> };
      queryClient.setQueryData(['tasks', filters], (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const prev = old as Record<string, unknown>;
        if (Array.isArray(prev)) {
          return prev.map((t: Record<string, unknown>) =>
            t.id === payload.task?.id ? payload.task : t
          );
        }
        if (Array.isArray((prev as { tasks?: unknown[] }).tasks)) {
          return {
            ...prev,
            tasks: (prev as { tasks: Record<string, unknown>[] }).tasks.map((t) =>
              t.id === payload.task?.id ? payload.task : t
            ),
          };
        }
        return prev;
      });
    });

    const offCreated = on('task:created', () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    });

    const offDeleted = on('task:deleted', (data: unknown) => {
      const payload = data as { taskId: string };
      queryClient.setQueryData(['tasks', filters], (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const prev = old as Record<string, unknown>;
        if (Array.isArray(prev)) {
          return prev.filter((t: Record<string, unknown>) => t.id !== payload.taskId);
        }
        if (Array.isArray((prev as { tasks?: unknown[] }).tasks)) {
          return {
            ...prev,
            tasks: (prev as { tasks: Record<string, unknown>[] }).tasks.filter(
              (t) => t.id !== payload.taskId
            ),
          };
        }
        return prev;
      });
    });

    return () => {
      offUpdated();
      offCreated();
      offDeleted();
    };
  }, [on, queryClient, filters]);

  // Preserves the previous signature `fetchTasks(filters, { silent })`; the
  // silent option is a no-op now (read errors surface via the `error` field).
  const fetchTasks = useCallback(
    (next?: Record<string, string | number | undefined>, _options?: { silent?: boolean }) => {
      setFilters(next);
    },
    []
  );

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    [queryClient]
  );

  const createTask = useCallback(
    async (data: Partial<Task>) => {
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
    },
    [invalidate]
  );

  const updateTask = useCallback(
    async (id: string, data: Partial<Task>) => {
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
    },
    [invalidate]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      try {
        const res = await apiClient.deleteTask(id);
        // Perfil exige aprovação (req 16): backend responde 202 e NÃO exclui. Mostra
        // o toast "enviado para aprovação" e NÃO invalida a lista como sucesso.
        if (handlePendingApproval(res)) return;
        toast.success('Tarefa deletada com sucesso!');
        await invalidate();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao deletar tarefa');
        throw err;
      }
    },
    [invalidate]
  );

  const completeTask = useCallback(
    async (id: string) => {
      try {
        const result = await apiClient.updateTask(id, { status: 'COMPLETED' });
        await invalidate();
        return result;
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao completar tarefa');
        throw err;
      }
    },
    [invalidate]
  );

  const uncompleteTask = useCallback(
    async (id: string) => {
      try {
        const result = await apiClient.updateTask(id, { status: 'PENDING' });
        await invalidate();
        return result;
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao reabrir tarefa');
        throw err;
      }
    },
    [invalidate]
  );

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
