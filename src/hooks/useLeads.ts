import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import { Lead } from '../types';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const fetchLeads = useCallback(async (filters?: any) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.getLeads(filters);
      
      // Transform API response to match Lead type
      const transformedLeads = result.leads.map((lead: any) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        company: lead.company || '',
        position: lead.position || '',
        status: lead.status.toLowerCase(),
        source: lead.source.toLowerCase(),
        score: lead.score || 0,
        customFields: lead.customFields || {},
        notes: lead.notes || '',
        assignedTo: lead.assignedTo || '',
        tags: lead.tags?.map((lt: any) => lt.tag) || [],
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      }));

      setLeads(transformedLeads);
      setPagination(result.pagination || {
        page: 1,
        limit: 50,
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
        status: data.status?.toUpperCase(),
        source: data.source?.toUpperCase(),
        score: data.score || 0,
        customFields: data.customFields || {},
        notes: data.notes,
        assignedTo: data.assignedTo,
        tagIds: data.tags?.map(t => t.id) || [],
      });

      // Transform and add to list
      const newLead: Lead = {
        id: result.id,
        name: result.name,
        email: result.email || '',
        phone: result.phone || '',
        company: result.company || '',
        position: result.position || '',
        status: result.status.toLowerCase() as any,
        source: result.source.toLowerCase() as any,
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
        status: data.status?.toUpperCase(),
        source: data.source?.toUpperCase(),
        score: data.score,
        customFields: data.customFields,
        notes: data.notes,
        assignedTo: data.assignedTo,
        tagIds: data.tags?.map(t => t.id) || [],
      });

      // Transform and update in list
      const updatedLead: Lead = {
        id: result.id,
        name: result.name,
        email: result.email || '',
        phone: result.phone || '',
        company: result.company || '',
        position: result.position || '',
        status: result.status.toLowerCase() as any,
        source: result.source.toLowerCase() as any,
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


