// Hooks de dados do módulo de Atestados Técnicos (TanStack Query + apiClient).
// Componentes consomem só estes hooks — nunca chamam apiClient direto no JSX.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/services/api/client';
import type {
  AtestadoInput,
  Profissional,
  Terceiro,
  Pendencia,
  PendenciaStatus,
  Concorrencia,
  TaxonomiaTipo,
} from '@/types/atestados';

function errMsg(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

// ── Queries ───────────────────────────────────────────────────────────────
export function useAtestadoStatus() {
  return useQuery({ queryKey: ['atestado-status'], queryFn: () => apiClient.getAtestadoStatus() });
}

export function useAtestados(filters: Record<string, string> = {}) {
  return useQuery({ queryKey: ['atestados', filters], queryFn: () => apiClient.listAtestados(filters) });
}

export function useAtestado(id: string | null) {
  return useQuery({
    queryKey: ['atestado', id],
    queryFn: () => apiClient.getAtestado(id as string),
    enabled: !!id,
  });
}

export function useProfissionais(filters: Record<string, string> = {}) {
  return useQuery({ queryKey: ['profissionais', filters], queryFn: () => apiClient.listProfissionais(filters) });
}

export function useTerceiros(search?: string) {
  return useQuery({ queryKey: ['terceiros', search ?? ''], queryFn: () => apiClient.listTerceiros(search) });
}

export function usePendencias(filters: Record<string, string> = {}) {
  return useQuery({ queryKey: ['pendencias', filters], queryFn: () => apiClient.listPendencias(filters) });
}

export function usePendenciaStatus() {
  return useQuery({ queryKey: ['pendencia-status'], queryFn: () => apiClient.listPendenciaStatus() });
}

export function useConcorrencias() {
  return useQuery({ queryKey: ['concorrencias'], queryFn: () => apiClient.listConcorrencias() });
}

export function useConcorrencia(id: string | null) {
  return useQuery({
    queryKey: ['concorrencia', id],
    queryFn: () => apiClient.getConcorrencia(id as string),
    enabled: !!id,
  });
}

export function useCurriculos(profissionalId?: string) {
  return useQuery({
    queryKey: ['curriculos', profissionalId ?? ''],
    queryFn: () => apiClient.listCurriculos(profissionalId),
  });
}

export function useTaxonomias(tipo?: TaxonomiaTipo) {
  return useQuery({ queryKey: ['taxonomias', tipo ?? ''], queryFn: () => apiClient.listTaxonomias(tipo) });
}

export function useAtestadoConfig() {
  return useQuery({ queryKey: ['atestado-config'], queryFn: () => apiClient.getAtestadoConfig() });
}

// ── Actions (mutations com toast + invalidate) ──────────────────────────────
export function useAtestadoActions() {
  const qc = useQueryClient();
  const invalidate = useCallback((keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] }))), [qc]);

  const wrap = useCallback(
    async <T>(fn: () => Promise<T>, okMsg: string | null, keys: string[]): Promise<T> => {
      try {
        const res = await fn();
        if (okMsg) toast.success(okMsg);
        await invalidate(keys);
        return res;
      } catch (err) {
        toast.error(errMsg(err, 'Ocorreu um erro'));
        throw err;
      }
    },
    [invalidate]
  );

  return {
    // Acervo
    createAtestado: (input: AtestadoInput) => wrap(() => apiClient.createAtestado(input), 'Atestado criado', ['atestados']),
    updateAtestado: (id: string, input: Partial<AtestadoInput>) => wrap(() => apiClient.updateAtestado(id, input), 'Atestado atualizado', ['atestados', 'atestado']),
    deleteAtestado: (id: string) => wrap(() => apiClient.deleteAtestado(id), 'Atestado removido', ['atestados']),
    importAtestados: (file: File) => wrap(() => apiClient.importAtestados(file), 'Importação concluída', ['atestados', 'profissionais']),
    sugerirAtestado: (file: File) => apiClient.sugerirAtestado(file),
    uploadDocumento: (id: string, file: File) => wrap(() => apiClient.uploadAtestadoDocumento(id, file), 'Documento processado', ['atestados', 'atestado']),
    reindexAtestado: (id: string) => wrap(() => apiClient.reindexAtestado(id), 'Reindexado', ['atestados']),
    // Profissionais
    createProfissional: (data: Partial<Profissional>) => wrap(() => apiClient.createProfissional(data), 'Profissional criado', ['profissionais']),
    updateProfissional: (id: string, data: Partial<Profissional>) => wrap(() => apiClient.updateProfissional(id, data), 'Profissional atualizado', ['profissionais']),
    deleteProfissional: (id: string) => wrap(() => apiClient.deleteProfissional(id), 'Profissional removido', ['profissionais']),
    // Terceiros
    createTerceiro: (data: Partial<Terceiro>) => wrap(() => apiClient.createTerceiro(data), 'Parceiro criado', ['terceiros']),
    updateTerceiro: (id: string, data: Partial<Terceiro>) => wrap(() => apiClient.updateTerceiro(id, data), 'Parceiro atualizado', ['terceiros']),
    deleteTerceiro: (id: string) => wrap(() => apiClient.deleteTerceiro(id), 'Parceiro removido', ['terceiros']),
    // Pendências
    createPendencia: (data: Partial<Pendencia>) => wrap(() => apiClient.createPendencia(data), 'Pendência criada', ['pendencias']),
    updatePendencia: (id: string, data: Partial<Pendencia>) => wrap(() => apiClient.updatePendencia(id, data), 'Pendência atualizada', ['pendencias']),
    deletePendencia: (id: string) => wrap(() => apiClient.deletePendencia(id), 'Pendência removida', ['pendencias']),
    convertPendencia: (id: string, input: AtestadoInput) => wrap(() => apiClient.convertPendencia(id, input), 'Convertida em atestado', ['pendencias', 'atestados']),
    createStatus: (data: { nome: string; ordem?: number; isFinal?: boolean }) => wrap(() => apiClient.createPendenciaStatus(data), 'Etapa criada', ['pendencia-status']),
    updateStatus: (id: string, data: Partial<PendenciaStatus>) => wrap(() => apiClient.updatePendenciaStatus(id, data), 'Etapa atualizada', ['pendencia-status']),
    deleteStatus: (id: string) => wrap(() => apiClient.deletePendenciaStatus(id), 'Etapa removida', ['pendencia-status']),
    // Concorrências
    createConcorrencia: (data: Partial<Concorrencia>) => wrap(() => apiClient.createConcorrencia(data), 'Concorrência criada', ['concorrencias']),
    updateConcorrencia: (id: string, data: Partial<Concorrencia>) => wrap(() => apiClient.updateConcorrencia(id, data), 'Concorrência atualizada', ['concorrencias', 'concorrencia']),
    deleteConcorrencia: (id: string) => wrap(() => apiClient.deleteConcorrencia(id), 'Concorrência removida', ['concorrencias']),
    analisar: (id: string) => wrap(() => apiClient.analisarConcorrencia(id), 'Análise concluída', ['concorrencias', 'concorrencia']),
    addExigencia: (id: string, data: Record<string, unknown>) => wrap(() => apiClient.addExigencia(id, data), 'Exigência adicionada', ['concorrencia']),
    updateMatch: (matchId: string, data: { status?: string; incluido?: boolean }) => wrap(() => apiClient.updateMatch(matchId, data), null, ['concorrencia']),
    gerarDossie: (id: string, curriculoIds?: string[]) => wrap(() => apiClient.gerarDossie(id, curriculoIds), 'Dossiê gerado', ['concorrencia']),
    // Currículos
    createCurriculo: (data: Record<string, unknown>) => wrap(() => apiClient.createCurriculo(data), 'Currículo criado', ['curriculos']),
    gerarCurriculoPdf: (id: string) => wrap(() => apiClient.gerarCurriculoPdf(id), 'PDF gerado', ['curriculos']),
    deleteCurriculo: (id: string) => wrap(() => apiClient.deleteCurriculo(id), 'Currículo removido', ['curriculos']),
    // Taxonomia
    createTaxonomia: (tipo: TaxonomiaTipo, nome: string) => wrap(() => apiClient.createTaxonomia(tipo, nome), 'Item adicionado', ['taxonomias']),
    deleteTaxonomia: (id: string) => wrap(() => apiClient.deleteTaxonomia(id), 'Item removido', ['taxonomias']),
    // Configuração
    updateConfig: (data: { atestadoAlertDays: number }) => wrap(() => apiClient.updateAtestadoConfig(data), 'Configuração salva', ['atestado-config']),
  };
}
