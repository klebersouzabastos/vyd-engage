import { Badge } from '../ui/badge';
import type { DeepResearchTemplate } from '../../types/deepResearch';

interface TemplatePickerProps {
  templates: DeepResearchTemplate[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}

/** Grade de cards para escolher o template-modelo da pesquisa. */
export function TemplatePicker({ templates, selectedId, onSelect }: TemplatePickerProps) {
  if (!templates.length) {
    return (
      <p className="text-sm text-gray-500">
        Nenhum template disponível. Crie um na aba “Templates”.
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
            className={`rounded-lg border p-4 text-left transition-colors ${
              isSelected
                ? 'border-primary ring-1 ring-primary'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-gray-900">{t.name}</span>
              {t.isBuiltin && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                  Padrão
                </Badge>
              )}
            </div>
            {t.description && (
              <p className="mt-1 line-clamp-2 text-sm text-gray-600">{t.description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
