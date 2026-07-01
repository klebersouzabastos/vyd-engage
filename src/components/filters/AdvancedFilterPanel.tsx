import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, ChevronDown, ChevronUp, Filter } from 'lucide-react';

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: { value: string; label: string }[];
}

interface AdvancedFilterPanelProps {
  conditions: FilterCondition[];
  onConditionsChange: (conditions: FilterCondition[]) => void;
  logic: 'AND' | 'OR';
  onLogicChange: (logic: 'AND' | 'OR') => void;
  fields: FieldDefinition[];
  onApply: () => void;
  onClear: () => void;
}

const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: 'equals', label: 'Igual a' },
    { value: 'contains', label: 'Contem' },
    { value: 'starts_with', label: 'Comeca com' },
    { value: 'ends_with', label: 'Termina com' },
    { value: 'not_equals', label: 'Diferente de' },
    { value: 'is_empty', label: 'Esta vazio' },
    { value: 'is_not_empty', label: 'Nao esta vazio' },
  ],
  number: [
    { value: 'equals', label: 'Igual a' },
    { value: 'not_equals', label: 'Diferente de' },
    { value: 'greater_than', label: 'Maior que' },
    { value: 'less_than', label: 'Menor que' },
    { value: 'greater_or_equal', label: 'Maior ou igual' },
    { value: 'less_or_equal', label: 'Menor ou igual' },
    { value: 'is_empty', label: 'Esta vazio' },
  ],
  date: [
    { value: 'equals', label: 'Igual a' },
    { value: 'before', label: 'Antes de' },
    { value: 'after', label: 'Depois de' },
    { value: 'between', label: 'Entre' },
    { value: 'is_empty', label: 'Esta vazio' },
  ],
  select: [
    { value: 'equals', label: 'Igual a' },
    { value: 'not_equals', label: 'Diferente de' },
    { value: 'is_empty', label: 'Esta vazio' },
  ],
  boolean: [{ value: 'equals', label: 'Igual a' }],
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function AdvancedFilterPanel({
  conditions,
  onConditionsChange,
  logic,
  onLogicChange,
  fields,
  onApply,
  onClear,
}: AdvancedFilterPanelProps) {
  const [expanded, setExpanded] = useState(conditions.length > 0);

  const addCondition = () => {
    const firstField = fields[0];
    onConditionsChange([
      ...conditions,
      {
        id: generateId(),
        field: firstField?.key || '',
        operator: 'contains',
        value: '',
      },
    ]);
    if (!expanded) setExpanded(true);
  };

  const removeCondition = (id: string) => {
    onConditionsChange(conditions.filter((c) => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    onConditionsChange(
      conditions.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...updates };
        // Reset operator and value when field changes
        if (updates.field && updates.field !== c.field) {
          const fieldDef = fields.find((f) => f.key === updates.field);
          const fieldType = fieldDef?.type || 'text';
          const ops = OPERATORS_BY_TYPE[fieldType] || OPERATORS_BY_TYPE.text;
          updated.operator = ops[0]?.value || 'equals';
          updated.value = '';
        }
        return updated;
      })
    );
  };

  const getFieldType = (fieldKey: string): string => {
    const field = fields.find((f) => f.key === fieldKey);
    return field?.type || 'text';
  };

  const getOperators = (fieldKey: string) => {
    const fieldType = getFieldType(fieldKey);
    return OPERATORS_BY_TYPE[fieldType] || OPERATORS_BY_TYPE.text;
  };

  const getFieldOptions = (fieldKey: string) => {
    const field = fields.find((f) => f.key === fieldKey);
    return field?.options || [];
  };

  const needsValueInput = (operator: string) => {
    return !['is_empty', 'is_not_empty'].includes(operator);
  };

  const handleClear = () => {
    onConditionsChange([]);
    onClear();
  };

  return (
    <div className="bg-card rounded-lg border border-gray-300 shadow-sm mb-4">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter size={16} />
          Filtros avancados
          {conditions.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-primary text-white rounded-full">
              {conditions.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Panel content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-200">
          {/* Logic toggle */}
          {conditions.length > 1 && (
            <div className="flex items-center gap-2 mt-3 mb-2">
              <span className="text-xs text-gray-500">Combinar com:</span>
              <div className="flex items-center border border-gray-300 rounded-md p-0.5 bg-gray-50">
                <button
                  onClick={() => onLogicChange('AND')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    logic === 'AND' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  E (AND)
                </button>
                <button
                  onClick={() => onLogicChange('OR')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    logic === 'OR' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  OU (OR)
                </button>
              </div>
            </div>
          )}

          {/* Conditions */}
          <div className="space-y-2 mt-3">
            {conditions.map((condition, index) => {
              const fieldType = getFieldType(condition.field);
              const operators = getOperators(condition.field);
              const fieldOptions = getFieldOptions(condition.field);

              return (
                <div key={condition.id} className="flex items-center gap-2 flex-wrap">
                  {index > 0 && (
                    <span className="text-xs text-gray-400 w-8 text-center flex-shrink-0">
                      {logic === 'AND' ? 'E' : 'OU'}
                    </span>
                  )}
                  {index === 0 && conditions.length > 1 && <span className="w-8 flex-shrink-0" />}

                  {/* Field selector */}
                  <Select
                    value={condition.field}
                    onValueChange={(val) => updateCondition(condition.id, { field: val })}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Campo" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator selector */}
                  <Select
                    value={condition.operator}
                    onValueChange={(val) => updateCondition(condition.id, { operator: val })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Operador" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value input */}
                  {needsValueInput(condition.operator) && (
                    <>
                      {fieldType === 'select' ? (
                        <Select
                          value={condition.value}
                          onValueChange={(val) => updateCondition(condition.id, { value: val })}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Valor" />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : fieldType === 'boolean' ? (
                        <Select
                          value={condition.value}
                          onValueChange={(val) => updateCondition(condition.id, { value: val })}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Valor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Sim</SelectItem>
                            <SelectItem value="false">Nao</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={
                            fieldType === 'number'
                              ? 'number'
                              : fieldType === 'date'
                                ? 'date'
                                : 'text'
                          }
                          placeholder="Valor..."
                          value={condition.value}
                          onChange={(e) =>
                            updateCondition(condition.id, {
                              value: e.target.value,
                            })
                          }
                          className="w-[180px]"
                        />
                      )}
                    </>
                  )}

                  {/* Remove condition */}
                  <button
                    onClick={() => removeCondition(condition.id)}
                    className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                    title="Remover condicao"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <Button
              variant="outline"
              size="sm"
              onClick={addCondition}
              className="gap-1.5 text-gray-600"
            >
              <Plus size={14} />
              Adicionar condicao
            </Button>
            <div className="flex items-center gap-2">
              {conditions.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  Limpar
                </Button>
              )}
              <Button size="sm" onClick={onApply} disabled={conditions.length === 0}>
                Aplicar filtros
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
