// Seção "Reuniões" do DealDetail (Upgrade RD P3, req 26 — contrato em
// specs/upgrade-rd-parity.md, design em p3-design.md).
//
// Fluxo: o usuário sobe um ÁUDIO (audio/*) OU cola uma TRANSCRIÇÃO → POST cria a
// reunião (Interaction MEETING). Enquanto a IA processa, mostra loading. Ao
// voltar, exibe o RESUMO, as TAREFAS SUGERIDAS (checkbox por tarefa) e os CAMPOS
// SUGERIDOS (diff Atual × Sugerido, checkbox + justificativa). O botão "Aplicar
// selecionados" só cria as tarefas marcadas e só atualiza os campos aceitos —
// NUNCA aplica nada sem o usuário marcar. Abaixo, a lista de reuniões anteriores
// (resumo + baixar áudio quando houver).
//
// GATING GRACIOSO: esta seção só é renderizada pelo DealDetail quando a IA está
// configurada (useAIStatus().enabled). Arquivo novo → 100% tokenizado
// (STRICT_SCOPE do check:colors): sem hex/rgb, só tokens semânticos do DS.
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calendar,
  Check,
  ClipboardPaste,
  Download,
  FileText,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { apiClient, ApiError } from '../../services/api/client';
import type {
  Meeting,
  MeetingSuggestedField,
  MeetingSuggestedFieldKey,
  MeetingSuggestedTask,
} from '../../types/meetings';
import { formatCurrency } from '../../utils/format';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

const FIELD_LABELS: Record<MeetingSuggestedFieldKey, string> = {
  value: 'Valor',
  stage: 'Etapa',
  notes: 'Notas',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Exibe o valor de um campo sugerido, tratando `value` como moeda. */
function displayFieldValue(key: MeetingSuggestedFieldKey, raw: string | null): string {
  if (raw === null || raw === '') return '—';
  if (key === 'value') {
    const n = Number(raw);
    return Number.isFinite(n) ? formatCurrency(n) : raw;
  }
  return raw;
}

/**
 * Painel de sugestões de UMA reunião: resumo + tarefas (checkbox) + campos (diff
 * + checkbox) + "Aplicar selecionados". Só chama apply com o que foi marcado.
 */
function MeetingSuggestions({
  dealId,
  meeting,
}: {
  dealId: string;
  meeting: Meeting;
}) {
  const queryClient = useQueryClient();
  const applied = meeting.appliedAt !== null;

  // Seleção inicial: nada marcado (o usuário escolhe conscientemente).
  const [selectedTasks, setSelectedTasks] = useState<Record<string, boolean>>({});
  const [selectedFields, setSelectedFields] = useState<
    Partial<Record<MeetingSuggestedFieldKey, boolean>>
  >({});
  const [applying, setApplying] = useState(false);

  const toggleTask = (id: string) =>
    setSelectedTasks((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleField = (key: MeetingSuggestedFieldKey) =>
    setSelectedFields((prev) => ({ ...prev, [key]: !prev[key] }));

  const anySelected =
    Object.values(selectedTasks).some(Boolean) ||
    Object.values(selectedFields).some(Boolean);

  const handleApply = async () => {
    const taskIds = meeting.suggestedTasks
      .filter((t) => selectedTasks[t.id])
      .map((t) => t.id);
    const fieldUpdates: Partial<Record<MeetingSuggestedFieldKey, string>> = {};
    for (const f of meeting.suggestedFields) {
      if (selectedFields[f.key] && f.suggested !== null) {
        fieldUpdates[f.key] = f.suggested;
      }
    }
    if (taskIds.length === 0 && Object.keys(fieldUpdates).length === 0) {
      toast.error('Selecione ao menos uma tarefa ou campo para aplicar.');
      return;
    }
    setApplying(true);
    try {
      const res = await apiClient.applyMeeting(dealId, meeting.id, {
        taskIds,
        fieldUpdates,
      });
      const nTasks = res.data.createdTaskIds.length;
      const nFields = res.data.updatedFields.length;
      toast.success(
        `Aplicado: ${nTasks} tarefa${nTasks !== 1 ? 's' : ''} e ${nFields} campo${
          nFields !== 1 ? 's' : ''
        }.`
      );
      // Recarrega a reunião (appliedAt) + o deal (campos atualizados).
      await queryClient.invalidateQueries({ queryKey: ['deal-meetings', dealId] });
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
    } catch (err) {
      const msg =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Erro ao aplicar sugestões';
      toast.error(msg);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <Sparkles size={14} className="text-primary" /> Resumo
        </h4>
        <p className="text-sm text-foreground whitespace-pre-wrap">{meeting.summary}</p>
      </div>

      {applied && (
        <div className="flex items-center gap-2 text-xs text-success bg-success/15 rounded-md px-3 py-2">
          <Check size={14} /> Sugestões aplicadas em {formatDate(meeting.appliedAt as string)}.
        </div>
      )}

      {/* Tarefas sugeridas */}
      {meeting.suggestedTasks.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Tarefas sugeridas</h4>
          <ul className="space-y-2">
            {meeting.suggestedTasks.map((task: MeetingSuggestedTask) => (
              <li
                key={task.id}
                className="flex items-start gap-3 rounded-md border border-border p-3"
              >
                <input
                  type="checkbox"
                  id={`task-${meeting.id}-${task.id}`}
                  checked={!!selectedTasks[task.id]}
                  onChange={() => toggleTask(task.id)}
                  disabled={applied}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <label
                  htmlFor={`task-${meeting.id}-${task.id}`}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <span className="block text-sm text-foreground">{task.title}</span>
                  {task.description && (
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {task.description}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar size={11} />
                      {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Campos sugeridos (diff Atual × Sugerido) */}
      {meeting.suggestedFields.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Campos sugeridos</h4>
          <ul className="space-y-2">
            {meeting.suggestedFields.map((field: MeetingSuggestedField) => (
              <li
                key={field.key}
                className="flex items-start gap-3 rounded-md border border-border p-3"
              >
                <input
                  type="checkbox"
                  id={`field-${meeting.id}-${field.key}`}
                  checked={!!selectedFields[field.key]}
                  onChange={() => toggleField(field.key)}
                  disabled={applied}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <label
                  htmlFor={`field-${meeting.id}-${field.key}`}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <span className="block text-sm font-medium text-foreground">
                    {FIELD_LABELS[field.key]}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground line-through">
                      {displayFieldValue(field.key, field.current)}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
                      {displayFieldValue(field.key, field.suggested)}
                    </span>
                  </span>
                  {field.reason && (
                    <span className="block text-xs text-muted-foreground mt-1">
                      {field.reason}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!applied &&
        (meeting.suggestedTasks.length > 0 || meeting.suggestedFields.length > 0) && (
          <div className="flex justify-end">
            <Button size="sm" onClick={handleApply} disabled={applying || !anySelected}>
              {applying ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Check size={14} className="mr-2" />
              )}
              Aplicar selecionados
            </Button>
          </div>
        )}
    </div>
  );
}

export function MeetingsSection({ dealId }: { dealId: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'audio' | 'transcript'>('audio');
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ['deal-meetings', dealId],
    queryFn: () => apiClient.getDealMeetings(dealId).then((r) => r.data),
  });

  // Reunião mais recente em destaque (sugestões abertas); as demais viram lista.
  const [latest, ...previous] = useMemo(
    () => [...meetings].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [meetings]
  );

  const afterCreate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['deal-meetings', dealId] });
  };

  const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    setProcessing(true);
    try {
      await apiClient.createMeetingFromAudio(dealId, file);
      toast.success('Reunião processada.');
      await afterCreate();
    } catch (err) {
      const msg =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Erro ao processar o áudio';
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleTranscriptSubmit = async () => {
    if (!transcript.trim()) {
      toast.error('Cole a transcrição da reunião.');
      return;
    }
    setProcessing(true);
    try {
      await apiClient.createMeetingFromTranscript(dealId, transcript.trim());
      toast.success('Reunião processada.');
      setTranscript('');
      await afterCreate();
    } catch (err) {
      const msg =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Erro ao analisar a transcrição';
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadAudio = async (meeting: Meeting) => {
    if (!meeting.audioAttachmentId) return;
    setDownloadingId(meeting.id);
    try {
      const blob = await apiClient.downloadAttachment(meeting.audioAttachmentId);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `reuniao-${meeting.id}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error('Erro ao baixar o áudio');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Entrada: áudio OU transcrição */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Reuniões</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Suba o áudio de uma reunião ou cole a transcrição. A IA gera um resumo, tarefas e
          sugestões de atualização do negócio — que você revisa e aplica manualmente.
        </p>

        {/* Alternância de modo */}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'audio' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setMode('audio')}
            disabled={processing}
          >
            <Upload size={14} /> Áudio
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'transcript' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setMode('transcript')}
            disabled={processing}
          >
            <ClipboardPaste size={14} /> Colar transcrição
          </Button>
        </div>

        {processing ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 size={16} className="animate-spin" /> Processando a reunião com IA…
          </div>
        ) : mode === 'audio' ? (
          <div>
            <label
              htmlFor={`meeting-audio-${dealId}`}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center hover:bg-muted/50 transition-colors"
            >
              <Upload size={20} className="text-muted-foreground" />
              <span className="text-sm text-foreground">
                Clique para selecionar um arquivo de áudio
              </span>
              <span className="text-xs text-muted-foreground">
                Requer IA com transcrição (OpenAI). Formatos de áudio.
              </span>
            </label>
            <input
              id={`meeting-audio-${dealId}`}
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={handleAudioChange}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Cole aqui a transcrição da reunião…"
              rows={6}
              className="text-sm"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleTranscriptSubmit} disabled={!transcript.trim()}>
                <Sparkles size={14} className="mr-2" /> Analisar transcrição
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Reunião mais recente — sugestões abertas */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : latest ? (
        <div className="bg-card rounded-lg shadow-sm border border-border p-6 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar size={12} /> {formatDate(latest.createdAt)}
            </span>
            {latest.audioAttachmentId && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleDownloadAudio(latest)}
                disabled={downloadingId === latest.id}
              >
                {downloadingId === latest.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Baixar áudio
              </Button>
            )}
          </div>
          <MeetingSuggestions dealId={dealId} meeting={latest} />
        </div>
      ) : (
        <div className="bg-card rounded-lg shadow-sm border border-border p-8 text-center">
          <FileText size={36} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhuma reunião registrada. Suba um áudio ou cole uma transcrição para começar.
          </p>
        </div>
      )}

      {/* Reuniões anteriores — resumo + baixar áudio */}
      {previous.length > 0 && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Reuniões anteriores</h3>
          <ul className="space-y-3">
            {previous.map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar size={11} /> {formatDate(m.createdAt)}
                    {m.appliedAt && (
                      <span className="inline-flex items-center gap-0.5 text-success">
                        <Check size={11} /> aplicada
                      </span>
                    )}
                  </span>
                  <p className="text-sm text-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                    {m.summary}
                  </p>
                </div>
                {m.audioAttachmentId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 flex-shrink-0"
                    onClick={() => handleDownloadAudio(m)}
                    disabled={downloadingId === m.id}
                    aria-label="Baixar áudio"
                  >
                    {downloadingId === m.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
