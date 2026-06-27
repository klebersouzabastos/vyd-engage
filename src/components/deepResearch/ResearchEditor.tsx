import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ListChecks } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { TemplatePicker } from './TemplatePicker';
import { friendlyLabel, placeholderExample } from './placeholders';
import { useDeepResearchActions } from '../../hooks/useDeepResearch';
import type {
  DeepResearch,
  DeepResearchStatus,
  DeepResearchTemplate,
} from '../../types/deepResearch';

// Deve bater com CONTEXT_KEY no backend (deepResearchService).
const CONTEXT_KEY = 'Contexto adicional';

interface ResearchEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: DeepResearchTemplate[];
  research?: DeepResearch | null;
  onSaved?: (research: DeepResearch) => void;
}

/**
 * Formulário de pedido de pesquisa. Ordem: tipo → informações → título
 * (auto-sugerido) → contexto → resumo. NÃO expõe o prompt (montado no backend).
 */
export function ResearchEditor({
  open,
  onOpenChange,
  templates,
  research,
  onSaved,
}: ResearchEditorProps) {
  const { createResearch, updateResearch } = useDeepResearchActions();

  const [title, setTitle] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(research?.title ?? '');
    setTitleEdited(!!research); // ao editar, não auto-sobrescreve o título existente
    setSelectedTemplateId(research?.templateId ?? templates[0]?.id ?? null);
    setVariables((research?.variables as Record<string, string>) ?? {});
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, research?.id]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const placeholders = selectedTemplate?.placeholders ?? [];
  const outline = selectedTemplate?.outline ?? [];

  // Título sugerido automaticamente a partir do primeiro campo preenchido.
  const firstValue = placeholders[0] ? (variables[placeholders[0]] ?? '').trim() : '';
  useEffect(() => {
    if (titleEdited) return;
    setTitle(firstValue);
  }, [firstValue, titleEdited]);

  const handleVariableChange = (key: string, value: string) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  };

  const canSave = title.trim().length > 0 && !!selectedTemplateId;

  const handleSave = async (status: DeepResearchStatus) => {
    if (!canSave) return;
    setSaving(true);
    try {
      let saved: DeepResearch;
      if (research) {
        saved = await updateResearch(research.id, { title: title.trim(), variables, status });
      } else {
        saved = await createResearch({
          title: title.trim(),
          templateId: selectedTemplateId ?? undefined,
          variables,
          status,
        });
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch {
      // toast já exibido no hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {research ? 'Editar pesquisa' : 'Nova pesquisa de inteligência'}
          </DialogTitle>
          <DialogDescription>
            Escolha o tipo, preencha as informações e solicite. Nossa inteligência monta a pesquisa
            e você recebe um relatório completo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 1. Tipo */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-800">1. Tipo de pesquisa</Label>
            <TemplatePicker
              templates={templates}
              selectedId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
            />
          </div>

          {selectedTemplate && (
            <>
              {/* 2. Informações */}
              {placeholders.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-800">
                    2. Sobre o que é a pesquisa
                  </Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {placeholders.map((key) => {
                      const example = placeholderExample(key);
                      return (
                        <div key={key} className="space-y-1">
                          <Label htmlFor={`f-${key}`} className="text-xs text-slate-500">
                            {friendlyLabel(key)}
                          </Label>
                          <Input
                            id={`f-${key}`}
                            value={variables[key] ?? ''}
                            onChange={(e) => handleVariableChange(key, e.target.value)}
                            placeholder={example ? `Ex.: ${example}` : friendlyLabel(key)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Título */}
              <div className="space-y-1">
                <Label htmlFor="research-title" className="text-sm font-semibold text-slate-800">
                  3. Título da pesquisa
                </Label>
                <Input
                  id="research-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleEdited(true);
                  }}
                  placeholder="Preenchido automaticamente — você pode ajustar"
                />
              </div>

              {/* 4. Contexto adicional */}
              <div className="space-y-1">
                <Label htmlFor="extra-context" className="text-sm font-semibold text-slate-800">
                  4. Informações adicionais{' '}
                  <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <Textarea
                  id="extra-context"
                  value={variables[CONTEXT_KEY] ?? ''}
                  onChange={(e) => handleVariableChange(CONTEXT_KEY, e.target.value)}
                  rows={3}
                  placeholder="Contexto, foco específico, restrições… o que ajudar a enriquecer a pesquisa."
                />
              </div>

              {/* Resumo */}
              {outline.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <ListChecks className="h-4 w-4 text-primary" />O que você vai receber
                  </p>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {outline.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSave('DRAFT')}
            disabled={saving || !canSave}
          >
            Salvar rascunho
          </Button>
          <Button onClick={() => handleSave('RESEARCHING')} disabled={saving || !canSave}>
            <Sparkles className="mr-1 h-4 w-4" />
            {saving ? 'Enviando…' : 'Solicitar pesquisa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
