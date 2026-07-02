import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { TemplatePicker } from './TemplatePicker';
import { friendlyLabel, placeholderExample } from './placeholders';
import { useDeepResearchActions } from '../../hooks/useDeepResearch';
import { apiClient } from '../../services/api/client';
import type {
  DeepResearch,
  DeepResearchStatus,
  DeepResearchTemplate,
} from '../../types/deepResearch';

// Deve bater com CONTEXT_KEY no backend (deepResearchService).
const CONTEXT_KEY = 'Contexto adicional';

// Placeholder do template que representa a EMPRESA — passa a ser herdado do
// Select (não digitado). Casa "empresa"/"company" em qualquer caixa.
const isCompanyKey = (key: string) => /empresa|company/i.test(key);

interface ResearchEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: DeepResearchTemplate[];
  research?: DeepResearch | null;
  /** Empresa herdada ao abrir a partir de uma empresa (Empresas/Detalhe). */
  defaultCompanyId?: string;
  onSaved?: (research: DeepResearch) => void;
}

/**
 * Formulário de pedido de pesquisa. A pesquisa é SEMPRE de uma empresa CADASTRADA
 * (campo Empresa obrigatório, herdado quando aberto a partir de uma empresa).
 * Ordem: empresa → tipo → informações → título → contexto → resumo.
 */
export function ResearchEditor({
  open,
  onOpenChange,
  templates,
  research,
  defaultCompanyId,
  onSaved,
}: ResearchEditorProps) {
  const { createResearch, updateResearch } = useDeepResearchActions();

  const [title, setTitle] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const companiesQuery = useQuery({
    queryKey: ['companies', 'research-picker'],
    queryFn: () => apiClient.getCompanies({ limit: 100 }),
    enabled: open,
  });
  const companies = (companiesQuery.data?.companies ?? []) as Array<{ id: string; name: string }>;

  useEffect(() => {
    if (!open) return;
    setTitle(research?.title ?? '');
    setTitleEdited(!!research); // ao editar, não auto-sobrescreve o título existente
    setCompanyId(defaultCompanyId ?? research?.companyId ?? '');
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
  // A empresa vem do Select — não renderiza input livre para o placeholder de empresa.
  const visiblePlaceholders = placeholders.filter((k) => !isCompanyKey(k));

  const companyName = useMemo(
    () => companies.find((c) => c.id === companyId)?.name ?? '',
    [companies, companyId]
  );

  // Título sugerido: a empresa é o sujeito da pesquisa; senão, o 1º campo preenchido.
  const firstValue =
    companyName ||
    (visiblePlaceholders[0] ? (variables[visiblePlaceholders[0]] ?? '').trim() : '');
  useEffect(() => {
    if (titleEdited) return;
    setTitle(firstValue);
  }, [firstValue, titleEdited]);

  const handleVariableChange = (key: string, value: string) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  };

  // Empresa é obrigatória ao CRIAR (a pesquisa é sempre de uma empresa cadastrada);
  // na edição, a empresa já foi definida na criação e não muda.
  const canSave = title.trim().length > 0 && !!selectedTemplateId && (!!research || !!companyId);

  const handleSave = async (status: DeepResearchStatus) => {
    if (!canSave) return;
    setSaving(true);
    try {
      // Injeta o nome da empresa herdada nos placeholders de empresa do template.
      const vars = { ...variables };
      placeholders.filter(isCompanyKey).forEach((k) => {
        vars[k] = companyName;
      });

      let saved: DeepResearch;
      if (research) {
        saved = await updateResearch(research.id, { title: title.trim(), variables: vars, status });
      } else {
        saved = await createResearch({
          title: title.trim(),
          companyId,
          templateId: selectedTemplateId ?? undefined,
          variables: vars,
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
            Escolha a empresa e o tipo, preencha as informações e solicite. Nossa inteligência monta
            a pesquisa e você recebe um relatório completo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 1. Empresa (obrigatória, cadastrada) */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-800">1. Empresa</Label>
            <Select value={companyId} onValueChange={setCompanyId} disabled={!!research}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    companiesQuery.isLoading ? 'Carregando empresas…' : 'Selecione a empresa'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!companyId && (
              <p className="text-xs text-gray-500">
                A pesquisa é sempre de uma empresa cadastrada. Cadastre-a em Empresas antes, se ainda
                não existir.
              </p>
            )}
          </div>

          {/* 2. Tipo */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-800">2. Tipo de pesquisa</Label>
            <TemplatePicker
              templates={templates}
              selectedId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
            />
          </div>

          {selectedTemplate && (
            <>
              {/* 3. Informações */}
              {visiblePlaceholders.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-800">
                    3. Sobre o que é a pesquisa
                  </Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {visiblePlaceholders.map((key) => {
                      const example = placeholderExample(key);
                      return (
                        <div key={key} className="space-y-1">
                          <Label htmlFor={`f-${key}`} className="text-xs text-gray-500">
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

              {/* 4. Título */}
              <div className="space-y-1">
                <Label htmlFor="research-title" className="text-sm font-semibold text-gray-800">
                  4. Título da pesquisa
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

              {/* 5. Contexto adicional */}
              <div className="space-y-1">
                <Label htmlFor="extra-context" className="text-sm font-semibold text-gray-800">
                  5. Informações adicionais{' '}
                  <span className="font-normal text-gray-400">(opcional)</span>
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
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <ListChecks className="h-4 w-4 text-primary" />O que você vai receber
                  </p>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {outline.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
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
