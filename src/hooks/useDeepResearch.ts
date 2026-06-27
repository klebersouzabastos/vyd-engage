import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import type {
  CreateDeepResearchInput,
  DeepResearch,
  DeepResearchListItem,
  DeepResearchStatus,
  UpdateDeepResearchInput,
} from '../types/deepResearch';

const LIST_KEY = ['deep-research'] as const;
const TEMPLATES_KEY = ['deep-research-templates'] as const;

export interface DeepResearchFilters {
  status?: DeepResearchStatus;
  search?: string;
}

/** Lista de pesquisas (TanStack Query). */
export function useDeepResearchList(filters?: DeepResearchFilters) {
  return useQuery({
    queryKey: [...LIST_KEY, filters ?? {}],
    queryFn: () =>
      apiClient.getDeepResearches(filters as Record<string, string | undefined> | undefined),
    // Atualiza enquanto houver pesquisa em andamento (poller publica o resultado).
    refetchInterval: (query) => {
      const data = query.state.data as { items?: DeepResearchListItem[] } | undefined;
      return data?.items?.some((i) => i.status === 'RESEARCHING') ? 12000 : false;
    },
  });
}

/** Detalhe de uma pesquisa (inclui markdown e prompt). */
export function useDeepResearchItem(id?: string) {
  return useQuery({
    queryKey: [...LIST_KEY, id],
    queryFn: () => apiClient.getDeepResearch(id as string),
    enabled: !!id,
    // Enquanto RESEARCHING, atualiza sozinho até o relatório ficar pronto.
    refetchInterval: (query) =>
      (query.state.data as DeepResearch | undefined)?.status === 'RESEARCHING' ? 8000 : false,
  });
}

/** Biblioteca de templates (auto-provisiona os builtins no backend). */
export function useDeepResearchTemplates() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: () => apiClient.getDeepResearchTemplates(),
  });
}

/**
 * Ações de escrita (mutations) com toast + invalidação de cache. Retornam
 * funções assíncronas simples para facilitar o uso com await nas telas.
 */
export function useDeepResearchActions() {
  const qc = useQueryClient();

  const invalidateList = useCallback(() => qc.invalidateQueries({ queryKey: LIST_KEY }), [qc]);
  const invalidateTemplates = useCallback(
    () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
    [qc]
  );

  const createResearch = useCallback(
    async (data: CreateDeepResearchInput) => {
      try {
        const res = await apiClient.createDeepResearch(data);
        await invalidateList();
        return res;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao criar pesquisa');
        throw err;
      }
    },
    [invalidateList]
  );

  const updateResearch = useCallback(
    async (id: string, data: UpdateDeepResearchInput, opts?: { silent?: boolean }) => {
      try {
        const res = await apiClient.updateDeepResearch(id, data);
        await invalidateList();
        await qc.invalidateQueries({ queryKey: [...LIST_KEY, id] });
        if (!opts?.silent) toast.success('Pesquisa salva!');
        return res;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao salvar pesquisa');
        throw err;
      }
    },
    [invalidateList, qc]
  );

  const deleteResearch = useCallback(
    async (id: string) => {
      try {
        await apiClient.deleteDeepResearch(id);
        await invalidateList();
        toast.success('Pesquisa excluída.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao excluir pesquisa');
        throw err;
      }
    },
    [invalidateList]
  );

  const createTemplate = useCallback(
    async (data: { name: string; description?: string; promptBody: string }) => {
      try {
        const res = await apiClient.createDeepResearchTemplate(data);
        await invalidateTemplates();
        toast.success('Template criado!');
        return res;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao criar template');
        throw err;
      }
    },
    [invalidateTemplates]
  );

  const updateTemplate = useCallback(
    async (id: string, data: { name?: string; description?: string; promptBody?: string }) => {
      try {
        const res = await apiClient.updateDeepResearchTemplate(id, data);
        await invalidateTemplates();
        toast.success('Template atualizado!');
        return res;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao atualizar template');
        throw err;
      }
    },
    [invalidateTemplates]
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      try {
        await apiClient.deleteDeepResearchTemplate(id);
        await invalidateTemplates();
        toast.success('Template excluído.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao excluir template');
        throw err;
      }
    },
    [invalidateTemplates]
  );

  return {
    createResearch,
    updateResearch,
    deleteResearch,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
