import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import { Company } from '../types';

const DEFAULT_PAGINATION = { page: 1, limit: 20, total: 0, totalPages: 0 };

/**
 * Companies data hook backed by TanStack Query. Public API unchanged.
 */
export function useCompanies() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string | number | undefined> | undefined>(
    undefined
  );

  const query = useQuery({
    queryKey: ['companies', filters],
    queryFn: async () => {
      const result = await apiClient.getCompanies(filters);
      return {
        companies: (result.companies as Record<string, unknown>[]).map(
          (c) => c as unknown as Company
        ),
        pagination: result.pagination || { ...DEFAULT_PAGINATION },
      };
    },
  });

  useEffect(() => {
    if (query.isError) toast.error('Erro ao carregar empresas');
  }, [query.isError]);

  const fetchCompanies = useCallback((next?: Record<string, string | number | undefined>) => {
    setFilters(next);
  }, []);

  const createCompany = useCallback(
    async (data: Partial<Company>) => {
      try {
        const result = await apiClient.createCompany(data);
        toast.success('Empresa criada com sucesso!');
        await queryClient.invalidateQueries({ queryKey: ['companies'] });
        return result as unknown as Company;
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao criar empresa');
        throw err;
      }
    },
    [queryClient]
  );

  const updateCompany = useCallback(
    async (id: string, data: Partial<Company>) => {
      try {
        const result = await apiClient.updateCompany(id, data);
        toast.success('Empresa atualizada com sucesso!');
        await queryClient.invalidateQueries({ queryKey: ['companies'] });
        return result as unknown as Company;
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao atualizar empresa');
        throw err;
      }
    },
    [queryClient]
  );

  const deleteCompany = useCallback(
    async (id: string) => {
      try {
        await apiClient.deleteCompany(id);
        toast.success('Empresa removida com sucesso!');
        await queryClient.invalidateQueries({ queryKey: ['companies'] });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao remover empresa');
        throw err;
      }
    },
    [queryClient]
  );

  return {
    companies: query.data?.companies ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    pagination: query.data?.pagination ?? { ...DEFAULT_PAGINATION },
    fetchCompanies,
    createCompany,
    updateCompany,
    deleteCompany,
    refetch: fetchCompanies,
  };
}
