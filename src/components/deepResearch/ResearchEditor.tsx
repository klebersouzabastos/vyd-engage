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
import { friendlyLabel } from './placeholders';
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
 * Formulário de pedido de pesquisa. NÃO expõe o prompt: o usuário escolhe o
 * tipo, preenche os campos e vê um resumo do que será entregue. O prompt é
 * montado no backend a partir desses dados.
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(research?.title ?? '');
    setSelectedTemplateId(research?.templateId ?? templates[0]?.id ?? null);
    setVariables((research?.variables as Record<string, string>) ?? {});
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, research?.id]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const placeholders = selectedTemplate?.placeholders ?? [];
  const outline = selectedTemplate?.outline ?? [];

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
          <DialogTitle>{research ? 'Editar pesquisa' : 'Nova pesquisa de inteligência'}</DialogTitle>
          <DialogDescription>
            Escolha o tipo de pesquisa, preencha as informações e solicite. Nossa inteligência
            monta a pesquisa e você recebe um relatório completo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1">
            <Label htmlFor="research-title">Título</Label>
            <Input
              id="research-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: ACME Mineração — oportunidades 2026"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de pesquisa</Label>
            <TemplatePicker
              templates={templates}
              selectedId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
            />
          </div>

          {selectedTemplate && (
            <>
              {placeholders.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Informações da pesquisa</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {placeholders.map((key) => (
                      <div key={key} className="space-y-1">
                        <Label htmlFor={`f-${key}`} className="text-xs text-gray-600">
                          {friendlyLabel(key)}
                        </Label>
                        <Input
                          id={`f-${key}`}
                          value={variables[key] ?? ''}
                          onChange={(e) => handleVariableChange(key, e.target.value)}
                          placeholder={friendlyLabel(key)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="extra-context">Informações adicionais (opcional)</Label>
                <Textarea
                  id="extra-context"
                  value={variables[CONTEXT_KEY] ?? ''}
                  onChange={(e) => handleVariableChange(CONTEXT_KEY, e.target.value)}
                  rows={3}
                  placeholder="Contexto, foco específico, restrições… o que ajudar a enriquecer a pesquisa."
                />
              </div>

              {outline.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <ListChecks className="h-4 w-4 text-primary" />
                    O que você vai receber
                  </p>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {outline.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
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
