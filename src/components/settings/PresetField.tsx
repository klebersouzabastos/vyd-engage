// Informações pré-definidas (Upgrade RD P0, reqs 7 e 16): campos padrão de
// empresa/contato/deal cujos valores foram pré-definidos pelo admin viram
// seleção nos formulários. Alimentado por GET /sales-config/presets?entity=…
// (client.getFieldPresets). Regras:
//  - preset com allowCustom=true  → combobox: escolhe da lista OU digita novo valor;
//  - preset com allowCustom=false → seleção restrita à lista;
//  - sem preset cadastrado p/ o campo → Input livre (fallback, sem regressão).
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Pencil } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import type { FieldPreset, PresetEntity } from '../../types/sales';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface PresetFieldProps {
  entity: PresetEntity;
  /** Campo padrão da entidade (ex.: COMPANY: 'industry'; CONTACT: 'position'). */
  field: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  'aria-describedby'?: string;
}

// Valor sentinela do Select para "digitar um valor personalizado" (allowCustom).
const CUSTOM_SENTINEL = '__custom__';

export function PresetField({
  entity,
  field,
  value,
  onChange,
  id,
  placeholder,
  'aria-describedby': ariaDescribedBy,
}: PresetFieldProps) {
  const { data: presets = [], isLoading } = useQuery({
    queryKey: ['field-presets', entity],
    queryFn: () => apiClient.getFieldPresets(entity).then((r) => r.data || []),
    staleTime: 5 * 60 * 1000,
  });

  const preset = useMemo<FieldPreset | undefined>(
    () => presets.find((p) => p.field === field),
    [presets, field]
  );

  const options = preset?.options ?? [];
  const hasPreset = !!preset && options.length > 0;
  const allowCustom = preset?.allowCustom ?? false;

  // Modo "digitar valor personalizado" (só com allowCustom): quando o valor atual
  // não está na lista (ou o usuário escolheu "Outro…"), mostra um Input livre.
  const valueInList = !!value && options.includes(value);
  const [customMode, setCustomMode] = useState(false);
  const showCustomInput = allowCustom && (customMode || (!!value && !valueInList));

  // Fallback: sem preset cadastrado → Input livre (nunca bloqueia o formulário).
  if (!hasPreset && !isLoading) {
    return (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={ariaDescribedBy}
        className="mt-1"
      />
    );
  }

  if (showCustomInput) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={ariaDescribedBy}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- foco intencional ao alternar p/ valor personalizado
          autoFocus
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 shrink-0"
          onClick={() => {
            setCustomMode(false);
            onChange('');
          }}
        >
          Escolher da lista
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={valueInList ? value : ''}
      onValueChange={(v) => {
        if (v === CUSTOM_SENTINEL) {
          setCustomMode(true);
          onChange('');
          return;
        }
        setCustomMode(false);
        onChange(v);
      }}
    >
      <SelectTrigger id={id} className="mt-1" aria-describedby={ariaDescribedBy}>
        <SelectValue placeholder={placeholder ?? 'Selecione...'} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            <span className="inline-flex items-center gap-2">
              {value === opt && <Check size={14} className="text-primary" aria-hidden="true" />}
              {opt}
            </span>
          </SelectItem>
        ))}
        {allowCustom && (
          <SelectItem value={CUSTOM_SENTINEL}>
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Pencil size={14} aria-hidden="true" />
              Outro (digitar…)
            </span>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
