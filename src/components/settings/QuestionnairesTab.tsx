import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { apiClient } from '../../services/api/client';
import { generateId } from '../../utils/id';
import type {
  Questionnaire,
  QuestionnaireQuestion,
  QuestionnaireQuestionType,
} from '../../types/sales';

/**
 * Configurações de Negócios → Questionários (upgrade-rd-parity req 2):
 * lista + builder de questionários com perguntas de escolha única/múltipla
 * (pontos por opção) e perguntas abertas (sem pontos), com adicionar/remover/
 * reordenar. 100% tokens semânticos (STRICT_SCOPE do check:colors).
 */

const TYPE_LABELS: Record<QuestionnaireQuestionType, string> = {
  SINGLE: 'Escolha única',
  MULTI: 'Múltipla escolha',
  TEXT: 'Texto aberto',
};

// Ids de pergunta gerados no cliente (o backend também gera se ausentes);
// padrão do repo (src/utils/id.ts) — não exige secure context.
const newQuestion = (): QuestionnaireQuestion => ({
  id: generateId(),
  text: '',
  type: 'SINGLE',
  options: [{ label: '', points: 0 }],
});

interface Draft {
  id: string | null;
  name: string;
  description: string;
  active: boolean;
  questions: QuestionnaireQuestion[];
}

const emptyDraft = (): Draft => ({
  id: null,
  name: '',
  description: '',
  active: true,
  questions: [newQuestion()],
});

export function QuestionnairesTab() {
  const [items, setItems] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getQuestionnaires(true);
      setItems(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar questionários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (q: Questionnaire) => {
    setDraft({
      id: q.id,
      name: q.name,
      description: q.description ?? '',
      active: q.active,
      questions: q.questions.map((question) => ({
        ...question,
        options: question.options ? question.options.map((o) => ({ ...o })) : undefined,
      })),
    });
  };

  const remove = async (q: Questionnaire) => {
    if (!confirm(`Excluir o questionário "${q.name}"?`)) return;
    try {
      await apiClient.deleteQuestionnaire(q.id);
      setItems((prev) => prev.filter((p) => p.id !== q.id));
      toast.success('Questionário excluído');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir questionário');
    }
  };

  // ── Edição de perguntas dentro do draft ────────────
  const patchQuestion = (index: number, patch: Partial<QuestionnaireQuestion>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const questions = prev.questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
      return { ...prev, questions };
    });
  };

  const changeType = (index: number, type: QuestionnaireQuestionType) => {
    patchQuestion(
      index,
      type === 'TEXT'
        ? { type, options: undefined }
        : { type, options: draft?.questions[index].options?.length ? draft.questions[index].options : [{ label: '', points: 0 }] }
    );
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const target = index + dir;
      if (target < 0 || target >= prev.questions.length) return prev;
      const questions = [...prev.questions];
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...prev, questions };
    });
  };

  const removeQuestion = (index: number) => {
    setDraft((prev) =>
      prev ? { ...prev, questions: prev.questions.filter((_, i) => i !== index) } : prev
    );
  };

  const patchOption = (
    qIndex: number,
    oIndex: number,
    patch: Partial<{ label: string; points: number }>
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const questions = prev.questions.map((q, i) => {
        if (i !== qIndex || !q.options) return q;
        const options = q.options.map((o, j) => (j === oIndex ? { ...o, ...patch } : o));
        return { ...q, options };
      });
      return { ...prev, questions };
    });
  };

  const addOption = (qIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const questions = prev.questions.map((q, i) =>
        i === qIndex ? { ...q, options: [...(q.options || []), { label: '', points: 0 }] } : q
      );
      return { ...prev, questions };
    });
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const questions = prev.questions.map((q, i) =>
        i === qIndex ? { ...q, options: (q.options || []).filter((_, j) => j !== oIndex) } : q
      );
      return { ...prev, questions };
    });
  };

  const validateDraft = (d: Draft): string | null => {
    if (!d.name.trim()) return 'Informe o nome do questionário';
    if (d.questions.length === 0) return 'Adicione ao menos uma pergunta';
    for (let i = 0; i < d.questions.length; i++) {
      const q = d.questions[i];
      if (!q.text.trim()) return `Informe o texto da pergunta ${i + 1}`;
      if (q.type !== 'TEXT') {
        const options = q.options || [];
        if (options.length === 0) return `A pergunta ${i + 1} precisa de ao menos uma opção`;
        if (options.some((o) => !o.label.trim()))
          return `Preencha o rótulo de todas as opções da pergunta ${i + 1}`;
        const labels = options.map((o) => o.label.trim());
        if (new Set(labels).size !== labels.length)
          return `A pergunta ${i + 1} tem opções com rótulos repetidos`;
        if (options.some((o) => !Number.isFinite(o.points)))
          return `Pontos inválidos na pergunta ${i + 1}`;
      }
    }
    return null;
  };

  const save = async () => {
    if (!draft) return;
    const error = validateDraft(draft);
    if (error) {
      toast.error(error);
      return;
    }
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      active: draft.active,
      questions: draft.questions.map((q) => ({
        id: q.id,
        text: q.text.trim(),
        type: q.type,
        ...(q.type === 'TEXT'
          ? {}
          : {
              options: (q.options || []).map((o) => ({
                label: o.label.trim(),
                points: Number(o.points) || 0,
              })),
            }),
      })),
    };
    try {
      setSaving(true);
      if (draft.id) {
        await apiClient.updateQuestionnaire(draft.id, payload);
      } else {
        await apiClient.createQuestionnaire(payload);
      }
      toast.success('Questionário salvo!');
      setDraft(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar questionário');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        Carregando questionários...
      </div>
    );
  }

  // ── Builder ────────────────────────────────────────
  if (draft) {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-semibold text-foreground">
            {draft.id ? 'Editar questionário' : 'Novo questionário'}
          </h3>
          <div className="flex items-center gap-2">
            <Label htmlFor="questionnaire-active" className="text-sm">
              Ativo
            </Label>
            <Switch
              id="questionnaire-active"
              checked={draft.active}
              onCheckedChange={(v) => setDraft((p) => (p ? { ...p, active: v } : p))}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="questionnaire-name">Nome</Label>
            <Input
              id="questionnaire-name"
              value={draft.name}
              onChange={(e) => setDraft((p) => (p ? { ...p, name: e.target.value } : p))}
              placeholder="Ex.: Qualificação inicial"
              maxLength={120}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="questionnaire-description">Descrição (opcional)</Label>
            <Textarea
              id="questionnaire-description"
              value={draft.description}
              onChange={(e) => setDraft((p) => (p ? { ...p, description: e.target.value } : p))}
              placeholder="Quando usar este questionário"
              rows={2}
              className="mt-1"
            />
          </div>
        </div>

        <div className="space-y-4">
          {draft.questions.map((q, qIndex) => (
            <div key={q.id} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-start gap-2">
                <span className="mt-2 shrink-0 text-sm font-medium text-muted-foreground">
                  {qIndex + 1}.
                </span>
                <div className="flex-1 space-y-2">
                  <Input
                    value={q.text}
                    onChange={(e) => patchQuestion(qIndex, { text: e.target.value })}
                    placeholder="Texto da pergunta"
                    aria-label={`Texto da pergunta ${qIndex + 1}`}
                  />
                  <Select
                    value={q.type}
                    onValueChange={(v) => changeType(qIndex, v as QuestionnaireQuestionType)}
                  >
                    <SelectTrigger className="w-56" aria-label="Tipo da pergunta">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABELS) as QuestionnaireQuestionType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveQuestion(qIndex, -1)}
                    disabled={qIndex === 0}
                    aria-label="Mover pergunta para cima"
                  >
                    <ArrowUp size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveQuestion(qIndex, 1)}
                    disabled={qIndex === draft.questions.length - 1}
                    aria-label="Mover pergunta para baixo"
                  >
                    <ArrowDown size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeQuestion(qIndex)}
                    aria-label="Remover pergunta"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>

              {q.type === 'TEXT' ? (
                <p className="pl-6 text-xs text-muted-foreground">
                  Resposta aberta — não pontua.
                </p>
              ) : (
                <div className="space-y-2 pl-6">
                  {(q.options || []).map((o, oIndex) => (
                    <div key={oIndex} className="flex items-center gap-2">
                      <Input
                        value={o.label}
                        onChange={(e) => patchOption(qIndex, oIndex, { label: e.target.value })}
                        placeholder={`Opção ${oIndex + 1}`}
                        className="flex-1"
                        aria-label={`Rótulo da opção ${oIndex + 1}`}
                      />
                      <Input
                        type="number"
                        value={String(o.points)}
                        onChange={(e) =>
                          patchOption(qIndex, oIndex, { points: Number(e.target.value) || 0 })
                        }
                        className="w-24"
                        aria-label={`Pontos da opção ${oIndex + 1}`}
                      />
                      <span className="text-xs text-muted-foreground">pts</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(qIndex, oIndex)}
                        disabled={(q.options || []).length <= 1}
                        aria-label="Remover opção"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addOption(qIndex)}>
                    <Plus size={14} className="mr-1" />
                    Adicionar opção
                  </Button>
                </div>
              )}
            </div>
          ))}

          <Button
            variant="outline"
            onClick={() =>
              setDraft((p) => (p ? { ...p, questions: [...p.questions, newQuestion()] } : p))
            }
          >
            <Plus size={16} className="mr-2" />
            Adicionar pergunta
          </Button>
        </div>

        <div className="flex gap-2 border-t border-border pt-4">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            Salvar questionário
          </Button>
          <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // ── Lista ──────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground">Questionários</h3>
          <p className="text-sm text-muted-foreground">
            Respondidos dentro da negociação; a pontuação total pode qualificar o negócio
            automaticamente.
          </p>
        </div>
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus size={16} className="mr-2" />
          Novo questionário
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
          <ClipboardList size={24} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum questionário criado ainda.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{q.name}</span>
                  {!q.active && <Badge variant="outline">Inativo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {q.questions.length}{' '}
                  {q.questions.length === 1 ? 'pergunta' : 'perguntas'}
                  {q.description ? ` — ${q.description}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(q)}
                  aria-label={`Editar ${q.name}`}
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => remove(q)}
                  aria-label={`Excluir ${q.name}`}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
