import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import { Lead } from '../types';
import { mapStatusToBackend, mapSourceToBackend, mapStatusFromBackend, mapSourceFromBackend } from '../utils/leadEnums';

export interface LeadsFilters {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: string;
  source?: string;
  search?: string;
  tagId?: string;
  assignedTo?: string;
  isContact?: string | boolean;
}

interface ApiLeadTag {
  tag?: { id: string; name: string; color: string };
  tagId?: string;
}
interface ApiLead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  status: string;
  source: string;
  score?: number;
  isContact?: boolean;
  convertedAt?: string | null;
  customFields?: Record<string, string | number | boolean | null>;
  notes?: string;
  assignedTo?: string;
  tags?: Array<ApiLeadTag | string>;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_PAGINATION = { page: 1, limit: 20, total: 0, totalPages: 0 };

function buildServerParams(filters?: LeadsFilters): Record<string, string | number> {
  const serverParams: Record<string, string | number> = {};
  if (!filters) return serverParams;
  if (filters.page) serverParams.page = filters.page;
  if (filters.limit) serverParams.limit = filters.limit;
  if (filters.sort) serverParams.sort = filters.sort;
  if (filters.order) serverParams.order = filters.order;
  if (filters.status) serverParams.status = filters.status;
  if (filters.source) serverParams.source = filters.source;
  if (filters.search) serverParams.search = filters.search;
  if (filters.tagId) serverParams.tagId = filters.tagId;
  if (filters.assignedTo) serverParams.assignedTo = filters.assignedTo;
  if (filters.isContact !== undefined && filters.isContact !== '') serverParams.isContact = String(filters.isContact);
  return serverParams;
}

function transformLead(lead: ApiLead): Lead {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email || '',
    phone: lead.phone || '',
    company: lead.company || '',
    position: lead.position || '',
    status: mapStatusFromBackend(lead.status) as Lead['status'],
    source: mapSourceFromBackend(lead.source) as Lead['source'],
    score: lead.score || 0,
    isContact: lead.isContact || false,
    convertedAt: lead.convertedAt || null,
    customFields: lead.customFields || {},
    notes: lead.notes || '',
    assignedTo: lead.assignedTo || '',
    tags: lead.tags?.map((lt) => (typeof lt === 'string' ? lt : lt.tag?.id || lt.tagId || '')) || [],
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  } as Lead;
}

/**
 * Leads data hook backed by TanStack Query. Public API is unchanged from the
 * previous hand-rolled version (leads/loading/error/pagination/fetchLeads/CRUD/refetch);
 * `fetchLeads(filters)` now drives the query key instead of an imperative fetch.
 */
export function useLeads() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<LeadsFilters | undefined>(undefined);

  const query = useQuery({
    queryKey: ['leads', filters],
    queryFn: async () => {
      const result = await apiClient.getLeads(buildServerParams(filters));
      return {
        leads: (result.leads as unknown as ApiLead[]).map(transformLead),
        pagination: result.pagination || { ...DEFAULT_PAGINATION },
      };
    },
  });

  useEffect(() => {
    if (query.isError) toast.error('Erro ao carregar leads');
  }, [query.isError]);

  const fetchLeads = useCallback((next?: LeadsFilters) => {
    setFilters(next);
  }, []);

  const createLead = useCallback(async (data: Partial<Lead>) => {
    try {
      const result = await apiClient.createLead({
        name: data.name || '',
        email: data.email,
        phone: data.phone,
        company: data.company,
        position: data.position,
        status: data.status ? mapStatusToBackend(data.status) : undefined,
        source: data.source ? mapSourceToBackend(data.source) : undefined,
        score: data.score || 0,
        customFields: data.customFields || {},
        notes: data.notes,
        assignedTo: data.assignedTo,
        tagIds: data.tags || [],
      });
      const newLead = transformLead(result as unknown as ApiLead);
      toast.success('Lead criado com sucesso!');
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      return newLead;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar lead');
      throw err;
    }
  }, [queryClient]);

  const updateLead = useCallback(async (id: string, data: Partial<Lead>) => {
    try {
      const result = await apiClient.updateLead(id, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        position: data.position,
        status: data.status ? mapStatusToBackend(data.status) : undefined,
        source: data.source ? mapSourceToBackend(data.source) : undefined,
        score: data.score,
        customFields: data.customFields,
        notes: data.notes,
        assignedTo: data.assignedTo,
        tagIds: data.tags || [],
      });
      const updatedLead = transformLead(result as unknown as ApiLead);
      toast.success('Lead atualizado com sucesso!');
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      return updatedLead;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar lead');
      throw err;
    }
  }, [queryClient]);

  const deleteLead = useCallback(async (id: string) => {
    try {
      await apiClient.deleteLead(id);
      toast.success('Lead deletado com sucesso!');
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar lead');
      throw err;
    }
  }, [queryClient]);

  return {
    leads: query.data?.leads ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    pagination: query.data?.pagination ?? { ...DEFAULT_PAGINATION },
    fetchLeads,
    createLead,
    updateLead,
    deleteLead,
    refetch: fetchLeads,
  };
}
