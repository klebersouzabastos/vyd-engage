import { CustomField } from "../types";
import { formatCustomFieldValue } from "../utils/customFields";

interface CustomFieldDisplayProps {
  field: CustomField;
  value: any;
  mode?: 'compact' | 'full' | 'inline';
  showLabel?: boolean;
}

export function CustomFieldDisplay({
  field,
  value,
  mode = 'full',
  showLabel = true,
}: CustomFieldDisplayProps) {
  const formattedValue = formatCustomFieldValue(field, value);
  const isEmpty = formattedValue === null || formattedValue === undefined || formattedValue === "";

  if (isEmpty && mode === 'compact') {
    return null;
  }

  if (mode === 'inline') {
    return (
      <span className="text-sm text-gray-600">
        {showLabel && (
          <span className="font-medium text-gray-900">{field.name}: </span>
        )}
        {isEmpty ? (
          <span className="text-gray-400 italic">Não informado</span>
        ) : (
          <span>{formattedValue}</span>
        )}
      </span>
    );
  }

  if (mode === 'compact') {
    return (
      <div className="flex items-center gap-1 text-xs">
        {showLabel && (
          <span className="text-gray-600 font-medium">{field.name}:</span>
        )}
        <span className={isEmpty ? "text-gray-400 italic" : "text-gray-900"}>
          {isEmpty ? "—" : formattedValue}
        </span>
      </div>
    );
  }

  // mode === 'full'
  return (
    <div className="py-2">
      {showLabel && (
        <div className="text-xs font-medium text-gray-600 mb-1">
          {field.name}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </div>
      )}
      <div className={`text-sm ${isEmpty ? "text-gray-400 italic" : "text-gray-900"}`}>
        {isEmpty ? "Não informado" : formattedValue}
      </div>
    </div>
  );
}








