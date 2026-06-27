import { CustomField } from '../types';

// Pure utility functions for custom fields (localStorage CRUD removed — use CustomFieldsContext/API)

export function validateFieldValue(
  field: CustomField,
  value: unknown
): { valid: boolean; error?: string } {
  if (field.required && (value === null || value === undefined || value === '')) {
    return { valid: false, error: `${field.name} é obrigatório` };
  }

  switch (field.type) {
    case 'number':
      if (value !== null && value !== undefined && value !== '' && isNaN(Number(value))) {
        return { valid: false, error: `${field.name} deve ser um número` };
      }
      break;
    case 'date':
      if (value && typeof value === 'string' && isNaN(Date.parse(value))) {
        return { valid: false, error: `${field.name} deve ser uma data válida` };
      }
      break;
    case 'select':
      if (value && typeof value === 'string' && field.options && !field.options.includes(value)) {
        return { valid: false, error: `${field.name} deve ser uma das opções disponíveis` };
      }
      break;
  }

  return { valid: true };
}

export function isCustomFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  if (typeof value === 'boolean') {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
}

export function formatCustomFieldValue(field: CustomField, value: unknown): string | null {
  if (isCustomFieldEmpty(value)) {
    return null;
  }

  switch (field.type) {
    case 'text':
    case 'textarea':
      return String(value);

    case 'number': {
      const numValue = Number(value);
      if (isNaN(numValue)) return String(value);
      return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(numValue);
    }

    case 'date':
      try {
        const date = new Date(String(value));
        if (isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(date);
      } catch {
        return String(value);
      }

    case 'checkbox':
      return value ? 'Sim' : 'Não';

    case 'select':
      return String(value);

    default:
      return String(value);
  }
}

export function getCustomFieldDisplayValue(field: CustomField, value: unknown): string {
  const formattedValue = formatCustomFieldValue(field, value);
  if (formattedValue === null) {
    return `${field.name}: Não informado`;
  }
  return `${field.name}: ${formattedValue}`;
}
