import { useState, useEffect, useCallback } from 'react';
import { apiClient, SavedView } from '../services/api/client';
import { toast } from 'sonner';

export type { SavedView };

export interface UseSavedViewsOptions {
  page: string; // 'leads' | 'deals' | 'tasks' | 'companies'
}

export function useSavedViews(page: string) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const fetchViews = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiClient.getSavedViews(page);
      const data = result.data || [];
      setViews(data);

      // Auto-select default view if no active view is set
      const defaultView = data.find((v) => v.isDefault);
      if (defaultView) {
        setActiveViewId((prev) => prev || defaultView.id);
      }
    } catch (err) {
      console.error('Failed to load saved views:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  const saveView = useCallback(
    async (
      name: string,
      filters: Record<string, unknown>,
      options?: {
        columns?: Record<string, unknown> | null;
        isDefault?: boolean;
        isShared?: boolean;
        sortBy?: string | null;
        sortOrder?: string | null;
      }
    ) => {
      try {
        const result = await apiClient.createSavedView({
          name,
          page,
          filters,
          ...options,
        });
        const newView = result.data;
        setViews((prev) => [...prev, newView]);
        setActiveViewId(newView.id);
        toast.success('Visualizacao salva com sucesso!');
        return newView;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao salvar visualizacao';
        toast.error(message);
        throw err;
      }
    },
    [page]
  );

  const updateView = useCallback(
    async (
      id: string,
      data: {
        name?: string;
        filters?: Record<string, unknown>;
        columns?: Record<string, unknown> | null;
        isDefault?: boolean;
        isShared?: boolean;
        sortBy?: string | null;
        sortOrder?: string | null;
      }
    ) => {
      try {
        const result = await apiClient.updateSavedView(id, data);
        const updated = result.data;
        setViews((prev) => {
          let newViews = prev.map((v) => (v.id === id ? updated : v));
          // If this was set as default, unset others locally
          if (data.isDefault) {
            newViews = newViews.map((v) => (v.id === id ? v : { ...v, isDefault: false }));
          }
          return newViews;
        });
        toast.success('Visualizacao atualizada!');
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar visualizacao';
        toast.error(message);
        throw err;
      }
    },
    []
  );

  const deleteView = useCallback(
    async (id: string) => {
      try {
        await apiClient.deleteSavedView(id);
        setViews((prev) => prev.filter((v) => v.id !== id));
        if (activeViewId === id) {
          setActiveViewId(null);
        }
        toast.success('Visualizacao removida!');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao remover visualizacao';
        toast.error(message);
        throw err;
      }
    },
    [activeViewId]
  );

  const activeView = views.find((v) => v.id === activeViewId) || null;

  const selectView = useCallback((id: string | null) => {
    setActiveViewId(id);
  }, []);

  return {
    views,
    loading,
    activeView,
    activeViewId,
    selectView,
    saveView,
    updateView,
    deleteView,
    refetch: fetchViews,
  };
}
