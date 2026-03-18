import { useState, useEffect, useCallback } from 'react';
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

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const fetchLeads = useCallback(async (filters?: LeadsFilters) => {
    try {
      setLoading(true);
      setError(null);

      // Build server params — only include defined, non-empty values
      const serverParams: Record<string, string | number> = {};
      if (filters?.page) serverParams.page = filters.page;
      if (filters?.limit) serverParams.limit = filters.limit;
      if (filters?.sort) serverParams.sort = filters.sort;
      if (filters?.order) serverParams.order = filters.order;
      if (filters?.status) serverParams.status = filters.status;
      if (filters?.source) serverParams.source = filters.source;
      if (filters?.search) serverParams.search = filters.search;
      if (filters?.tagId) serverParams.tagId = filters.tagId;
      if (filters?.assignedTo) serverParams.assignedTo = filters.assignedTo;
      if (filters?.isContact !== undefined && filters?.isContact !== '') serverParams.isContact = String(filters.isContact);

      const result = await apiClient.getLeads(serverParams);

      // Transform API response to match Lead type
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
      const transformedLeads = result.leads.map((lead: ApiLead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        company: lead.company || '',
        position: lead.position || '',
        status: mapStatusFromBackend(lead.status),
        source: mapSourceFromBackend(lead.source),
        score: lead.score || 0,
        isContact: lead.isContact || false,
        convertedAt: lead.convertedAt || null,
        customFields: lead.customFields || {},
        notes: lead.notes || '',
        assignedTo: lead.assignedTo || '',
        tags: lead.tags?.map((lt: ApiLeadTag | string) => {
          if (typeof lt === 'string') return lt;
          return lt.tag?.id || lt.tagId || '';
        }) || [],
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      }));

      setLeads(transformedLeads);
      setPagination(result.pagination || {
        page: 1,
        limit: 20,
        total: transformedLeads.length,
        totalPages: 1,
      });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar leads';
      setError(message);
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
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

      // Transform and add to list
      const newLead: Lead = {
        id: result.id,
        name: result.name,
        email: result.email || '',
        phone: result.phone || '',
        company: result.company || '',
        position: result.position || '',
        status: mapStatusFromBackend(result.status) as Lead['status'],
        source: mapSourceFromBackend(result.source) as Lead['source'],
        score: result.score || 0,
        customFields: result.customFields || {},
        notes: result.notes || '',
        assignedTo: result.assignedTo || '',
        tags: result.tags?.map((lt: { tag?: { id: string } }) => lt.tag) || [],
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };

      setLeads(prev => [newLead, ...prev]);
      toast.success('Lead criado com sucesso!');
      return newLead;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar lead';
      toast.error(message);
      throw err;
    }
  }, []);

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

      // Transform and update in list
      const updatedLead: Lead = {
        id: result.id,
        name: result.name,
        email: result.email || '',
        phone: result.phone || '',
        company: result.company || '',
        position: result.position || '',
        status: mapStatusFromBackend(result.status) as Lead['status'],
        source: mapSourceFromBackend(result.source) as Lead['source'],
        score: result.score || 0,
        customFields: result.customFields || {},
        notes: result.notes || '',
        assignedTo: result.assignedTo || '',
        tags: result.tags?.map((lt: { tag?: { id: string } }) => lt.tag) || [],
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };

      setLeads(prev => prev.map(l => l.id === id ? updatedLead : l));
      toast.success('Lead atualizado com sucesso!');
      return updatedLead;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar lead';
      toast.error(message);
      throw err;
    }
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    const backup = [...leads];
    setLeads(prev => prev.filter(l => l.id !== id));
    try {
      await apiClient.deleteLead(id);
      toast.success('Lead deletado com sucesso!');
    } catch (err: unknown) {
      setLeads(backup);
      const message = err instanceof Error ? err.message : 'Erro ao deletar lead';
      toast.error(message);
      throw err;
    }
  }, [leads]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return {
    leads,
    loading,
    error,
    pagination,
    fetchLeads,
    createLead,
    updateLead,
    deleteLead,
    refetch: fetchLeads,
  };
}



