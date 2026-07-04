// Seção "Questionários" do DealDetail (Upgrade RD P0, reqs 2 e 3):
// escolher questionário ativo, responder em dialog (SINGLE = radio, MULTI =
// checkboxes, TEXT = textarea), ver o score ao concluir e o histórico de
// respostas (data, autor, score) com visualização das respostas dadas.
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList, Eye, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import type {
  Questionnaire,
  QuestionnaireAnswerInput,
  QuestionnaireQuestion,
  QuestionnaireResponse,
} from '../../types/sales';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';

interface QuestionnaireSectionProps {
  dealId: string;
  /** Chamado quando a resposta auto-qualificou o deal (reflete as estrelas). */
  onQualified?: (qualification: number) => void;
}

type DraftAnswer = { optionLabels: string[]; text: string };

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function QuestionnaireSection({ dealId, onQualified }: QuestionnaireSectionProps) {
  const queryClient = useQueryClient();

  // includeInactive: o histórico pode referenciar questionários já desativados
  // (precisamos das perguntas para exibir as respostas dadas).
  const { data: questionnaires = [], isLoading: loadingQuestionnaires } = useQuery({
    queryKey: ['questionnaires', 'all'],
    queryFn: () => apiClient.getQuestionnaires(true).then((r) => r.data || []),
    staleTime: 60 * 1000,
  });

  const { data: responses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['questionnaire-responses', dealId],
    queryFn: () => apiClient.getQuestionnaireResponses(dealId).then((r) => r.data || []),
  });

  const activeQuestionnaires = useMemo(
    () => questionnaires.filter((q) => q.active),
    [questionnaires]
  );

  const [selectedId, setSelectedId] = useState('');
  const selected = activeQuestionnaires.find((q) => q.id === selectedId) || null;

  // ── Dialog de resposta ──
  const [answerOpen, setAnswerOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, DraftAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resultScore, setResultScore] = useState<number | null>(null);
  const [resultQualification, setResultQualification] = useState<number | null>(null);

  const openAnswerDialog = () => {
    if (!selected) return;
    const initial: Record<string, DraftAnswer> = {};
    selected.questions.forEach((question) => {
      initial[question.id] = { optionLabels: [], text: '' };
    });
    setDraft(initial);
    setResultScore(null);
    setResultQualification(null);
    setAnswerOpen(true);
  };

  const setSingle = (questionId: string, label: string) =>
    setDraft((prev) => ({ ...prev, [questionId]: { optionLabels: [label], text: '' } }));

  const toggleMulti = (questionId: string, label: string, checked: boolean) =>
    setDraft((prev) => {
      const current = prev[questionId]?.optionLabels || [];
      const next = checked ? [...current, label] : current.filter((l) => l !== label);
      return { ...prev, [questionId]: { optionLabels: next, text: '' } };
    });

  const setText = (questionId: string, text: string) =>
    setDraft((prev) => ({ ...prev, [questionId]: { optionLabels: [], text } }));

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const answers: QuestionnaireAnswerInput[] = selected.questions.map((question) => {
        const d = draft[question.id] || { optionLabels: [], text: '' };
        if (question.type === 'TEXT') {
          return { questionId: question.id, text: d.text };
        }
        return { questionId: question.id, optionLabels: d.optionLabels };
      });
      const res = await apiClient.respondQuestionnaire(selected.id, { dealId, answers });
      const { response, dealQualification } = res.data;
      setResultScore(response.score);
      setResultQualification(dealQualification);
      queryClient.invalidateQueries({ queryKey: ['questionnaire-responses', dealId] });
      if (dealQualification !== null && dealQualification !== undefined) {
        onQualified?.(dealQualification);
        toast.success(`Resposta registrada — negociação qualificada automaticamente`);
      } else {
        toast.success('Resposta registrada');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar respostas');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Dialog de visualização de resposta do histórico ──
  const [viewResponse, setViewResponse] = useState<QuestionnaireResponse | null>(null);

  const questionsById = useMemo(() => {
    const map = new Map<string, { question: QuestionnaireQuestion; questionnaire: Questionnaire }>();
    questionnaires.forEach((questionnaire) =>
      questionnaire.questions.forEach((question) =>
        map.set(question.id, { question, questionnaire })
      )
    );
    return map;
  }, [questionnaires]);

  const answeredAll = selected
    ? selected.questions.every((question) => {
        const d = draft[question.id];
        if (!d) return false;
        if (question.type === 'TEXT') return true; // aberta pode ficar em branco
        if (question.type === 'SINGLE') return d.optionLabels.length === 1;
        return true; // MULTI pode ter 0..n marcadas
      })
    : false;

  return (
    <div className="space-y-4">
      {/* Responder questionário ativo */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <ClipboardList size={16} aria-hidden="true" />
          Responder questionário
        </h3>
        {loadingQuestionnaires ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Carregando questionários...
          </div>
        ) : activeQuestionnaires.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum questionário ativo. Crie um em Configurações de Negociações →
            Questionários.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full sm:w-[320px]">
                <SelectValue placeholder="Selecione um questionário" />
              </SelectTrigger>
              <SelectContent>
                {activeQuestionnaires.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openAnswerDialog} disabled={!selected}>
              Responder
            </Button>
          </div>
        )}
        {selected?.description && (
          <p className="text-xs text-muted-foreground mt-2">{selected.description}</p>
        )}
      </div>

      {/* Histórico de respostas */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Histórico de respostas</h3>
        {loadingResponses ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Carregando histórico...
          </div>
        ) : responses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma resposta registrada para esta negociação.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {responses.map((response) => (
              <li key={response.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {response.questionnaire?.name || 'Questionário'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(response.createdAt)}
                    {response.user?.name ? ` — por ${response.user.name}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-primary/10 text-primary">
                    {response.score} pts
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setViewResponse(response)}
                  >
                    <Eye size={13} aria-hidden="true" />
                    Ver
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Dialog: responder */}
      <Dialog open={answerOpen} onOpenChange={(open) => !open && setAnswerOpen(false)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.name || 'Responder questionário'}</DialogTitle>
          </DialogHeader>

          {resultScore !== null ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Pontuação total</p>
              <p className="text-4xl font-bold text-foreground">{resultScore}</p>
              {resultQualification !== null && (
                <p className="text-sm text-muted-foreground">
                  A negociação foi qualificada automaticamente (nível {resultQualification} de
                  5).
                </p>
              )}
              <Button onClick={() => setAnswerOpen(false)}>Fechar</Button>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {selected?.questions.map((question, idx) => (
                <div key={question.id} className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    {idx + 1}. {question.text}
                  </Label>

                  {question.type === 'SINGLE' && (
                    <RadioGroup
                      value={draft[question.id]?.optionLabels[0] || ''}
                      onValueChange={(v) => setSingle(question.id, v)}
                    >
                      {(question.options || []).map((option) => (
                        <div key={option.label} className="flex items-center gap-2">
                          <RadioGroupItem
                            value={option.label}
                            id={`${question.id}-${option.label}`}
                          />
                          <Label
                            htmlFor={`${question.id}-${option.label}`}
                            className="text-sm font-normal text-foreground cursor-pointer"
                          >
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {question.type === 'MULTI' && (
                    <div className="space-y-2">
                      {(question.options || []).map((option) => (
                        <div key={option.label} className="flex items-center gap-2">
                          <Checkbox
                            id={`${question.id}-${option.label}`}
                            checked={(draft[question.id]?.optionLabels || []).includes(
                              option.label
                            )}
                            onCheckedChange={(checked) =>
                              toggleMulti(question.id, option.label, checked === true)
                            }
                          />
                          <Label
                            htmlFor={`${question.id}-${option.label}`}
                            className="text-sm font-normal text-foreground cursor-pointer"
                          >
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {question.type === 'TEXT' && (
                    <Textarea
                      value={draft[question.id]?.text || ''}
                      onChange={(e) => setText(question.id, e.target.value)}
                      placeholder="Resposta aberta (não pontua)"
                      rows={3}
                    />
                  )}
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setAnswerOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={submitting || !answeredAll}>
                  {submitting && (
                    <Loader2 size={14} className="mr-2 animate-spin" aria-hidden="true" />
                  )}
                  Enviar respostas
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: visualizar resposta do histórico */}
      <Dialog open={!!viewResponse} onOpenChange={(open) => !open && setViewResponse(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewResponse?.questionnaire?.name || 'Resposta do questionário'}
            </DialogTitle>
          </DialogHeader>
          {viewResponse && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                {formatDate(viewResponse.createdAt)}
                {viewResponse.user?.name ? ` — por ${viewResponse.user.name}` : ''} — pontuação:{' '}
                <span className="font-semibold text-foreground">{viewResponse.score}</span>
              </p>
              <ul className="space-y-3">
                {viewResponse.answers.map((answer, idx) => {
                  const meta = questionsById.get(answer.questionId);
                  const given =
                    answer.optionLabels && answer.optionLabels.length > 0
                      ? answer.optionLabels.join(', ')
                      : answer.text?.trim() || '—';
                  return (
                    <li key={`${answer.questionId}-${idx}`} className="text-sm">
                      <p className="font-medium text-foreground">
                        {meta?.question.text || 'Pergunta removida'}
                      </p>
                      <p className="text-muted-foreground whitespace-pre-wrap">{given}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
