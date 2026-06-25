import { Check } from 'lucide-react';
import type { DeepResearchTemplate } from '../../types/deepResearch';

interface TemplatePickerProps {
  templates: DeepResearchTemplate[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}

/** Seletor compacto do tipo de pesquisa (cards lado a lado, seleção clara). */
export function TemplatePicker({ templates, selectedId, onSelect }: TemplatePickerProps) {
  if (!templates.length) {
    return (
      <p className="text-sm text-slate-500">
        Nenhum tipo disponível. Um admin da plataforma precisa criar um modelo.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {templates.map((t) => {
        const isSelected = selectedId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-pressed={isSelected}
            className={`relative rounded-xl border p-4 text-left transition-all ${
              isSelected
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {isSelected && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                <Check className="h-3 w-3 text-white" />
              </span>
            )}
            <p className="pr-6 font-semibold text-slate-900">{t.name}</p>
            {t.description && (
              <p className="mt-1 text-sm leading-snug text-slate-500">{t.description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
