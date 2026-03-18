import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import { Company } from '../types';

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchCompanies = useCallback(async (filters?: Record<string, string | number | undefined>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.getCompanies(filters);

      const transformedCompanies: Company[] = result.companies.map((c: Record<string, unknown>) => c as Company);

      setCompanies(transformedCompanies);
      setPagination(result.pagination || {
        page: 1,
        limit: 20,
        total: transformedCompanies.length,
        totalPages: 1,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar empresas';
      setError(message);
      toast.error('Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  }, []);

  const createCompany = useCallback(async (data: Partial<Company>) => {
    try {
      const result = await apiClient.createCompany(data);
      const newCompany = result as Company;
      setCompanies(prev => [newCompany, ...prev]);
      toast.success('Empresa criada com sucesso!');
      return newCompany;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar empresa';
      toast.error(message);
      throw err;
    }
  }, []);

  const updateCompany = useCallback(async (id: string, data: Partial<Company>) => {
    const backup = [...companies];
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    try {
      const result = await apiClient.updateCompany(id, data);
      const updated = result as Company;
      setCompanies(prev => prev.map(c => c.id === id ? updated : c));
      toast.success('Empresa atualizada com sucesso!');
      return updated;
    } catch (err: unknown) {
      setCompanies(backup);
      const message = err instanceof Error ? err.message : 'Erro ao atualizar empresa';
      toast.error(message);
      throw err;
    }
  }, [companies]);

  const deleteCompany = useCallback(async (id: string) => {
    const backup = [...companies];
    setCompanies(prev => prev.filter(c => c.id !== id));
    try {
      await apiClient.deleteCompany(id);
      toast.success('Empresa removida com sucesso!');
    } catch (err: unknown) {
      setCompanies(backup);
      const message = err instanceof Error ? err.message : 'Erro ao remover empresa';
      toast.error(message);
      throw err;
    }
  }, [companies]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  return {
    companies,
    loading,
    error,
    pagination,
    fetchCompanies,
    createCompany,
    updateCompany,
    deleteCompany,
    refetch: fetchCompanies,
  };
}
