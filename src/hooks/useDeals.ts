import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import { Deal, DealStats } from '../types';

export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchDeals = useCallback(async (filters?: Record<string, string | number | undefined>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.getDeals(filters);

      const transformedDeals: Deal[] = result.deals.map((deal: Record<string, unknown>) => ({
        ...deal,
        value: Number(deal.value),
      } as Deal));

      setDeals(transformedDeals);
      setPagination(result.pagination || {
        page: 1,
        limit: 20,
        total: transformedDeals.length,
        totalPages: 1,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar deals';
      setError(message);
      toast.error('Erro ao carregar deals');
    } finally {
      setLoading(false);
    }
  }, []);

  const createDeal = useCallback(async (data: Partial<Deal>) => {
    try {
      const result = await apiClient.createDeal(data);
      const newDeal: Deal = { ...result, value: Number(result.value) };
      setDeals(prev => [newDeal, ...prev]);
      toast.success('Deal criado com sucesso!');
      return newDeal;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar deal';
      toast.error(message);
      throw err;
    }
  }, []);

  const updateDeal = useCallback(async (id: string, data: Partial<Deal>) => {
    try {
      const result = await apiClient.updateDeal(id, data);
      const updated: Deal = { ...result, value: Number(result.value) };
      setDeals(prev => prev.map(d => d.id === id ? updated : d));
      toast.success('Deal atualizado com sucesso!');
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar deal';
      toast.error(message);
      throw err;
    }
  }, []);

  const deleteDeal = useCallback(async (id: string) => {
    try {
      await apiClient.deleteDeal(id);
      setDeals(prev => prev.filter(d => d.id !== id));
      toast.success('Deal removido com sucesso!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao remover deal';
      toast.error(message);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  return {
    deals,
    loading,
    error,
    pagination,
    fetchDeals,
    createDeal,
    updateDeal,
    deleteDeal,
    refetch: fetchDeals,
  };
}

export function useDealStats() {
  const [stats, setStats] = useState<DealStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiClient.getDealStats();
      setStats(result.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
