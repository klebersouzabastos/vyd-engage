import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { CustomField } from "../types";
import { apiClient } from "../services/api/client";
import { toast } from "sonner";
import { getErrorMessage } from "../utils/errors";
import { validateFieldValue } from "../utils/customFields";
import { useAuth } from "./AuthContext";

interface CustomFieldsContextType {
  fields: CustomField[];
  loading: boolean;
  createField: (field: Omit<CustomField, "id">) => Promise<CustomField>;
  updateField: (id: string, updates: Partial<CustomField>) => Promise<CustomField>;
  deleteField: (id: string) => Promise<void>;
  reorderFields: (fieldIds: string[]) => Promise<void>;
  getFieldById: (id: string) => CustomField | undefined;
  validateValue: (field: CustomField, value: any) => { valid: boolean; error?: string };
  refreshFields: () => Promise<void>;
}

const CustomFieldsContext = createContext<CustomFieldsContextType | undefined>(undefined);

export function CustomFieldsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshFields = useCallback(async () => {
    try {
      setLoading(true);
      const apiFields = await apiClient.getCustomFields(true);
      // Transform API response to match CustomField type
      const transformedFields: CustomField[] = apiFields.map((field: any) => ({
        id: field.id,
        name: field.name,
        type: field.type,
        options: field.options || undefined,
        required: field.required || false,
        order: field.order || 0,
        active: field.active !== false,
      }));
      setFields(transformedFields);
    } catch (error) {
      console.error("Erro ao carregar campos customizados:", error);
      toast.error("Erro ao carregar campos customizados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setFields([]);
      setLoading(false);
      return;
    }
    refreshFields();
  }, [user, refreshFields]);

  const createField = useCallback(async (field: Omit<CustomField, "id">): Promise<CustomField> => {
    try {
      const result = await apiClient.createCustomField({
        name: field.name,
        type: field.type,
        options: field.options,
        required: field.required || false,
        order: field.order || 0,
        active: field.active !== false,
      });
      const newField: CustomField = {
        id: result.id,
        name: result.name,
        type: result.type,
        options: result.options || undefined,
        required: result.required || false,
        order: result.order || 0,
        active: result.active !== false,
      };
      setFields(prev => [...prev, newField]);
      toast.success("Campo customizado criado com sucesso!");
      return newField;
    } catch (error) {
      toast.error(getErrorMessage(error) ||"Erro ao criar campo customizado");
      throw error;
    }
  }, []);

  const updateField = useCallback(async (id: string, updates: Partial<CustomField>): Promise<CustomField> => {
    try {
      const result = await apiClient.updateCustomField(id, {
        name: updates.name,
        type: updates.type,
        options: updates.options,
        required: updates.required,
        order: updates.order,
        active: updates.active,
      });
      const updatedField: CustomField = {
        id: result.id,
        name: result.name,
        type: result.type,
        options: result.options || undefined,
        required: result.required || false,
        order: result.order || 0,
        active: result.active !== false,
      };
      setFields(prev => prev.map(f => f.id === id ? updatedField : f));
      toast.success("Campo customizado atualizado com sucesso!");
      return updatedField;
    } catch (error) {
      toast.error(getErrorMessage(error) ||"Erro ao atualizar campo customizado");
      throw error;
    }
  }, []);

  const deleteField = useCallback(async (id: string): Promise<void> => {
    try {
      await apiClient.deleteCustomField(id);
      setFields(prev => prev.filter(f => f.id !== id));
      toast.success("Campo customizado deletado com sucesso!");
    } catch (error) {
      toast.error(getErrorMessage(error) ||"Erro ao deletar campo customizado");
      throw error;
    }
  }, []);

  const reorderFields = useCallback(async (fieldIds: string[]): Promise<void> => {
    // Update order locally for now - backend doesn't have a reorder endpoint yet
    const reorderedFields = fieldIds
      .map((id) => fields.find((f) => f.id === id))
      .filter((f): f is CustomField => f !== undefined)
      .map((field, index) => ({ ...field, order: index }));
    
    // Update each field's order via API
    try {
      await Promise.all(reorderedFields.map((field, index) => 
        apiClient.updateCustomField(field.id, { order: index })
      ));
      setFields(reorderedFields);
      toast.success("Ordem dos campos atualizada!");
    } catch (error) {
      toast.error("Erro ao reordenar campos");
      throw error;
    }
  }, [fields]);

  const getFieldById = useCallback((id: string) => {
    return fields.find((field) => field.id === id);
  }, [fields]);

  const value = useMemo(() => ({
    fields,
    loading,
    createField,
    updateField,
    deleteField,
    reorderFields,
    getFieldById,
    validateValue: validateFieldValue,
    refreshFields,
  }), [fields, loading, createField, updateField, deleteField, reorderFields, getFieldById, refreshFields]);

  return (
    <CustomFieldsContext.Provider value={value}>
      {children}
    </CustomFieldsContext.Provider>
  );
}

export function useCustomFields() {
  const context = useContext(CustomFieldsContext);
  if (context === undefined) {
    throw new Error("useCustomFields must be used within a CustomFieldsProvider");
  }
  return context;
}

