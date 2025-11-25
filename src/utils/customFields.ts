import { CustomField } from "../types";

const STORAGE_KEY = "custom_fields";

export function getCustomFields(): CustomField[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Erro ao buscar campos customizados:", error);
    return [];
  }
}

export function getCustomFieldById(id: string): CustomField | undefined {
  const fields = getCustomFields();
  return fields.find((field) => field.id === id);
}

export function createCustomField(field: Omit<CustomField, "id">): CustomField {
  const fields = getCustomFields();
  
  // Verificar se já existe campo com mesmo nome
  const existingField = fields.find(
    (f) => f.name.toLowerCase() === field.name.toLowerCase()
  );
  
  if (existingField) {
    throw new Error("Já existe um campo com este nome");
  }

  const newField: CustomField = {
    ...field,
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };

  fields.push(newField);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
  
  return newField;
}

export function updateCustomField(id: string, updates: Partial<CustomField>): CustomField {
  const fields = getCustomFields();
  const index = fields.findIndex((field) => field.id === id);

  if (index === -1) {
    throw new Error("Campo customizado não encontrado");
  }

  // Verificar nome único se estiver atualizando o nome
  if (updates.name) {
    const existingField = fields.find(
      (f) => f.id !== id && f.name.toLowerCase() === updates.name!.toLowerCase()
    );
    if (existingField) {
      throw new Error("Já existe um campo com este nome");
    }
  }

  fields[index] = { ...fields[index], ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
  
  return fields[index];
}

export function deleteCustomField(id: string): void {
  const fields = getCustomFields();
  const filteredFields = fields.filter((field) => field.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredFields));
}

export function reorderCustomFields(fieldIds: string[]): void {
  const fields = getCustomFields();
  const reorderedFields = fieldIds
    .map((id) => fields.find((f) => f.id === id))
    .filter((f): f is CustomField => f !== undefined);
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reorderedFields));
}

export function validateFieldValue(field: CustomField, value: any): { valid: boolean; error?: string } {
  if (field.required && (value === null || value === undefined || value === "")) {
    return { valid: false, error: `${field.name} é obrigatório` };
  }

  switch (field.type) {
    case "number":
      if (value !== null && value !== undefined && value !== "" && isNaN(Number(value))) {
        return { valid: false, error: `${field.name} deve ser um número` };
      }
      break;
    case "date":
      if (value && isNaN(Date.parse(value))) {
        return { valid: false, error: `${field.name} deve ser uma data válida` };
      }
      break;
    case "select":
      if (value && field.options && !field.options.includes(value)) {
        return { valid: false, error: `${field.name} deve ser uma das opções disponíveis` };
      }
      break;
  }

  return { valid: true };
}

/**
 * Verifica se um campo customizado está vazio
 */
export function isCustomFieldEmpty(value: any): boolean {
  if (value === null || value === undefined || value === "") {
    return true;
  }
  if (typeof value === "boolean") {
    return false; // checkbox sempre tem valor (true ou false)
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
}

/**
 * Formata o valor de um campo customizado para exibição
 */
export function formatCustomFieldValue(field: CustomField, value: any): string | null {
  if (isCustomFieldEmpty(value)) {
    return null;
  }

  switch (field.type) {
    case "text":
    case "textarea":
      return String(value);

    case "number":
      const numValue = Number(value);
      if (isNaN(numValue)) return String(value);
      // Formatar número com separador de milhar e decimal
      return new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(numValue);

    case "date":
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(date);
      } catch {
        return String(value);
      }

    case "checkbox":
      return value ? "Sim" : "Não";

    case "select":
      return String(value);

    default:
      return String(value);
  }
}

/**
 * Retorna o valor formatado com label para exibição completa
 */
export function getCustomFieldDisplayValue(field: CustomField, value: any): string {
  const formattedValue = formatCustomFieldValue(field, value);
  if (formattedValue === null) {
    return `${field.name}: Não informado`;
  }
  return `${field.name}: ${formattedValue}`;
}

