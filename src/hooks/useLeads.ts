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

      const result = await apiClient.getLeads(serverParams);

      // Transform API response to match Lead type
      const transformedLeads = result.leads.map((lead: any) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        company: lead.company || '',
        position: lead.position || '',
        status: mapStatusFromBackend(lead.status),
        source: mapSourceFromBackend(lead.source),
        score: lead.score || 0,
        customFields: lead.customFields || {},
        notes: lead.notes || '',
        assignedTo: lead.assignedTo || '',
        tags: lead.tags?.map((lt: any) => lt.tag?.id || lt.tagId || lt) || [],
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

    } catch (err: any) {
      setError(err.message || 'Erro ao carregar leads');
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
        status: mapStatusFromBackend(result.status) as any,
        source: mapSourceFromBackend(result.source) as any,
        score: result.score || 0,
        customFields: result.customFields || {},
        notes: result.notes || '',
        assignedTo: result.assignedTo || '',
        tags: result.tags?.map((lt: any) => lt.tag) || [],
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };

      setLeads(prev => [newLead, ...prev]);
      toast.success('Lead criado com sucesso!');
      return newLead;
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar lead');
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
        status: mapStatusFromBackend(result.status) as any,
        source: mapSourceFromBackend(result.source) as any,
        score: result.score || 0,
        customFields: result.customFields || {},
        notes: result.notes || '',
        assignedTo: result.assignedTo || '',
        tags: result.tags?.map((lt: any) => lt.tag) || [],
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };

      setLeads(prev => prev.map(l => l.id === id ? updatedLead : l));
      toast.success('Lead atualizado com sucesso!');
      return updatedLead;
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar lead');
      throw err;
    }
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    try {
      await apiClient.deleteLead(id);
      setLeads(prev => prev.filter(l => l.id !== id));
      toast.success('Lead deletado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao deletar lead');
      throw err;
    }
  }, []);

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



