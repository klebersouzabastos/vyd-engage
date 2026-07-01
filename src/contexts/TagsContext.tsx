import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import { apiClient } from '../services/api/client';
import { toast } from 'sonner';
import { getErrorMessage } from '../utils/errors';
import { useAuth } from './AuthContext';

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface TagsContextType {
  tags: Tag[];
  loading: boolean;
  getTagById: (id: string) => Tag | undefined;
  createTag: (name: string, color?: string) => Promise<Tag>;
  updateTag: (id: string, name?: string, color?: string) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const TagsContext = createContext<TagsContextType | undefined>(undefined);

export function TagsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedTags = await apiClient.getTags();
      setTags(fetchedTags || []);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
      toast.error('Erro ao carregar tags');
    } finally {
      setLoading(false);
    }
  }, []);

  const getTagById = useCallback(
    (id: string): Tag | undefined => {
      return tags.find((tag) => tag.id === id);
    },
    [tags]
  );

  const createTag = useCallback(
    async (name: string, color: string = 'var(--vyd-action-primary)'): Promise<Tag> => {
    try {
      const newTag = await apiClient.createTag({ name, color });
      setTags((prev) => [...prev, newTag]);
      toast.success('Tag criada com sucesso!');
      return newTag;
    } catch (error) {
      toast.error(getErrorMessage(error) || 'Erro ao criar tag');
      throw error;
    }
  }, []);

  const updateTag = useCallback(async (id: string, name?: string, color?: string): Promise<Tag> => {
    try {
      const updatedTag = await apiClient.updateTag(id, { name, color });
      setTags((prev) => prev.map((t) => (t.id === id ? updatedTag : t)));
      toast.success('Tag atualizada com sucesso!');
      return updatedTag;
    } catch (error) {
      toast.error(getErrorMessage(error) || 'Erro ao atualizar tag');
      throw error;
    }
  }, []);

  const deleteTag = useCallback(async (id: string): Promise<void> => {
    try {
      await apiClient.deleteTag(id);
      setTags((prev) => prev.filter((t) => t.id !== id));
      toast.success('Tag deletada com sucesso!');
    } catch (error) {
      toast.error(getErrorMessage(error) || 'Erro ao deletar tag');
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setTags([]);
      setLoading(false);
      return;
    }
    fetchTags();
  }, [user, fetchTags]);

  const value = useMemo(
    () => ({
      tags,
      loading,
      getTagById,
      createTag,
      updateTag,
      deleteTag,
      refetch: fetchTags,
    }),
    [tags, loading, getTagById, createTag, updateTag, deleteTag, fetchTags]
  );

  return <TagsContext.Provider value={value}>{children}</TagsContext.Provider>;
}

export function useTags() {
  const context = useContext(TagsContext);
  if (context === undefined) {
    throw new Error('useTags must be used within a TagsProvider');
  }
  return context;
}
