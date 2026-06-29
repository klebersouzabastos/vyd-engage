import { CustomField } from '../types';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface CustomFieldInputProps {
  field: CustomField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

export function CustomFieldInput({ field, value, onChange, error }: CustomFieldInputProps) {
  // Normaliza o tipo para ser robusto a maiúsculas/minúsculas (o backend usa o enum
  // UPPERCASE TEXT/NUMBER/MULTI_SELECT; telas antigas usam lowercase). Também unifica
  // MULTI_SELECT/multi_select → 'multiselect'.
  const normalizedType = String(field.type || '')
    .toLowerCase()
    .replace('multi_select', 'multiselect');
  const renderInput = () => {
    switch (normalizedType) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Digite ${field.name.toLowerCase()}...`}
            className={error ? 'border-red-500' : ''}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder={`Digite ${field.name.toLowerCase()}...`}
            className={error ? 'border-red-500' : ''}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-red-500' : ''}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Digite ${field.name.toLowerCase()}...`}
            rows={4}
            className={error ? 'border-red-500' : ''}
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <Checkbox checked={value || false} onCheckedChange={(checked) => onChange(checked)} />
            <Label className="font-normal cursor-pointer">{field.name}</Label>
          </div>
        );

      case 'select':
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger className={error ? 'border-red-500' : ''}>
              <SelectValue placeholder={`Selecione ${field.name.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect': {
        const selected: string[] = Array.isArray(value) ? value : [];
        return (
          <div className={`space-y-1.5 ${error ? 'rounded border border-red-500 p-2' : ''}`}>
            {field.options?.map((option) => {
              const checked = selected.includes(option);
              return (
                <label
                  key={option}
                  className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) =>
                      onChange(c ? [...selected, option] : selected.filter((o) => o !== option))
                    }
                  />
                  {option}
                </label>
              );
            })}
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (normalizedType === 'checkbox') {
    return (
      <div>
        {renderInput()}
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor={field.id}>
        {field.name}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className="mt-1.5">{renderInput()}</div>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
