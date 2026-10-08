import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import type {
  CreateRoadmapInput,
  UpdateRoadmapInput,
  UpsertStakeholderInput,
  ImportStakeholdersInput,
  CreateEmpreendimentoInput,
  UpdateEmpreendimentoInput,
  CreatePlaybookInput,
  UpdatePlaybookInput,
  CommercialRoadmapStatus,
} from '../types/comercial';

const ROADMAPS_KEY = ['roadmaps'] as const;
const PANEL_KEY = ['roadmap-panel'] as const;
const EMPREENDIMENTOS_KEY = ['empreendimentos'] as const;
const PLAYBOOKS_KEY = ['playbooks'] as const;

function msg(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

// ── Roadmaps (desdobramentos) ──────────────────────
export interface RoadmapFilters {
  companyId?: string;
  empreendimentoId?: string;
  status?: CommercialRoadmapStatus;
  search?: string;
}

export function useRoadmaps(filters?: RoadmapFilters) {
  return useQuery({
    queryKey: [...ROADMAPS_KEY, filters ?? {}],
    queryFn: () => apiClient.getRoadmaps(filters as Record<string, string | undefined> | undefined),
  });
}

export function useRoadmap(id?: string) {
  return useQuery({
    queryKey: [...ROADMAPS_KEY, id],
    queryFn: () => apiClient.getRoadmap(id as string),
    enabled: !!id,
  });
}

/** Pré-visualização dos decisores do cap. 7 da pesquisa de Empresa (só quando o diálogo abre). */
export function useStakeholderImportPreview(
  roadmapId?: string,
  deepResearchId?: string,
  enabled = true
) {
  return useQuery({
    queryKey: [...ROADMAPS_KEY, roadmapId, 'stakeholder-import-preview', deepResearchId ?? null],
    queryFn: () =>
      apiClient.getRoadmapStakeholdersImportPreview(roadmapId as string, deepResearchId),
    enabled: !!roadmapId && enabled,
  });
}

export function useRoadmapPanel(filters?: { assignedTo?: string; riskDays?: number }) {
  return useQuery({
    queryKey: [...PANEL_KEY, filters ?? {}],
    queryFn: () =>
      apiClient.getRoadmapPanel(filters as Record<string, string | number | undefined>),
  });
}

export function useRoadmapActions() {
  const qc = useQueryClient();
  const invalidate = useCallback(
    (id?: string) => {
      qc.invalidateQueries({ queryKey: ROADMAPS_KEY });
      qc.invalidateQueries({ queryKey: PANEL_KEY });
      if (id) qc.invalidateQueries({ queryKey: [...ROADMAPS_KEY, id] });
    },
    [qc]
  );

  const createRoadmap = useCallback(
    async (data: CreateRoadmapInput) => {
      try {
        const res = await apiClient.createRoadmap(data);
        invalidate();
        toast.success('Desdobramento criado!');
        return res;
      } catch (err) {
        toast.error(msg(err, 'Erro ao criar desdobramento'));
        throw err;
      }
    },
    [invalidate]
  );

  const updateRoadmap = useCallback(
    async (id: string, data: UpdateRoadmapInput, opts?: { silent?: boolean }) => {
      try {
        const res = await apiClient.updateRoadmap(id, data);
        invalidate(id);
        if (!opts?.silent) toast.success('Desdobramento atualizado!');
        return res;
      } catch (err) {
        toast.error(msg(err, 'Erro ao atualizar desdobramento'));
        throw err;
      }
    },
    [invalidate]
  );

  const deleteRoadmap = useCallback(
    async (id: string) => {
      try {
        await apiClient.deleteRoadmap(id);
        invalidate();
        toast.success('Desdobramento excluído.');
      } catch (err) {
        toast.error(msg(err, 'Erro ao excluir desdobramento'));
        throw err;
      }
    },
    [invalidate]
  );

  const advanceToProposal = useCallback(
    async (id: string) => {
      try {
        const res = await apiClient.advanceRoadmapToProposal(id);
        invalidate(id);
        toast.success('Avançado para pedido de proposta — Deal atualizado.');
        return res;
      } catch (err) {
        toast.error(msg(err, 'Erro ao avançar para proposta'));
        throw err;
      }
    },
    [invalidate]
  );

  const upsertStakeholder = useCallback(
    async (id: string, data: UpsertStakeholderInput) => {
      try {
        const res = await apiClient.upsertRoadmapStakeholder(id, data);
        invalidate(id);
        return res;
      } catch (err) {
        toast.error(msg(err, 'Erro ao salvar contato'));
        throw err;
      }
    },
    [invalidate]
  );

  const removeStakeholder = useCallback(
    async (id: string, leadId: string) => {
      try {
        await apiClient.removeRoadmapStakeholder(id, leadId);
        invalidate(id);
      } catch (err) {
        toast.error(msg(err, 'Erro ao remover contato'));
        throw err;
      }
    },
    [invalidate]
  );

  const importStakeholders = useCallback(
    async (id: string, data: ImportStakeholdersInput) => {
      try {
        const res = await apiClient.importRoadmapStakeholders(id, data);
        invalidate(id);
        const total = res.created + res.linked;
        toast.success(
          `${total} contato(s) adicionado(s) ao desdobramento` +
            (res.created ? ` — ${res.created} novo(s) na empresa.` : '.')
        );
        return res;
      } catch (err) {
        toast.error(msg(err, 'Erro ao importar decisores'));
        throw err;
      }
    },
    [invalidate]
  );

  return {
    createRoadmap,
    updateRoadmap,
    deleteRoadmap,
    advanceToProposal,
    upsertStakeholder,
    removeStakeholder,
    importStakeholders,
    invalidate,
  };
}

// ── Empreendimentos ────────────────────────────────
export function useEmpreendimentos(filters?: { companyId?: string; search?: string }) {
  return useQuery({
    queryKey: [...EMPREENDIMENTOS_KEY, filters ?? {}],
    queryFn: () =>
      apiClient.getEmpreendimentos(filters as Record<string, string | undefined> | undefined),
  });
}

export function useEmpreendimentoActions() {
  const qc = useQueryClient();
  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: EMPREENDIMENTOS_KEY }),
    [qc]
  );

  const createEmpreendimento = useCallback(
    async (data: CreateEmpreendimentoInput) => {
      try {
        const res = await apiClient.createEmpreendimento(data);
        invalidate();
        toast.success('Empreendimento criado!');
        return res;
      } catch (err) {
        toast.error(msg(err, 'Erro ao criar empreendimento'));
        throw err;
      }
    },
    [invalidate]
  );

  const updateEmpreendimento = useCallback(
    async (id: string, data: UpdateEmpreendimentoInput) => {
      try {
        const res = await apiClient.updateEmpreendimento(id, data);
        invalidate();
        toast.success('Empreendimento atualizado!');
        return res;
      } catch (err) {
        toast.error(msg(err, 'Erro ao atualizar empreendimento'));
        throw err;
      }
    },
    [invalidate]
  );

  const deleteEmpreendimento = useCallback(
    async (id: string) => {
      try {
        await apiClient.deleteEmpreendimento(id);
        invalidate();
        toast.success('Empreendimento removido.');
      } catch (err) {
        toast.error(msg(err, 'Erro ao remover empreendimento'));
        throw err;
      }
    },
    [invalidate]
  );

  return { createEmpreendimento, updateEmpreendimento, deleteEmpreendimento };
}

// ── Playbooks ──────────────────────────────────────
export function usePlaybooks() {
  return useQuery({
    queryKey: PLAYBOOKS_KEY,
    queryFn: () => apiClient.getPlaybooks(),
  });
}

export function usePlaybookActions() {
  const qc = useQueryClient();
  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: PLAYBOOKS_KEY }), [qc]);

  const createPlaybook = useCallback(
    async (data: CreatePlaybookInput) => {
      try {
        const res = await apiClient.createPlaybook(data);
        invalidate();
        toast.success('Playbook criado!');
        return res;
      } catch (err) {
        toast.error(msg(err, 'Erro ao criar playbook'));
        throw err;
      }
    },
    [invalidate]
  );

  const updatePlaybook = useCallback(
    async (id: string, data: UpdatePlaybookInput) => {
      try {
        const res = await apiClient.updatePlaybook(id, data);
        invalidate();
        toast.success('Playbook atualizado!');
        return res;
      } catch (err) {
        toast.error(msg(err, 'Erro ao atualizar playbook'));
        throw err;
      }
    },
    [invalidate]
  );

  const deletePlaybook = useCallback(
    async (id: string) => {
      try {
        await apiClient.deletePlaybook(id);
        invalidate();
        toast.success('Playbook removido.');
      } catch (err) {
        toast.error(msg(err, 'Erro ao remover playbook'));
        throw err;
      }
    },
    [invalidate]
  );

  return { createPlaybook, updatePlaybook, deletePlaybook };
}
