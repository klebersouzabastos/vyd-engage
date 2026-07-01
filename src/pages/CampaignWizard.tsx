import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Loader2, Send, Mail, Users, Eye, Clock } from 'lucide-react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { BlockEditor } from '../components/campaigns/BlockEditor';
import {
  CampaignPreview,
  substituteMergeTags,
  SAMPLE_LEAD,
} from '../components/campaigns/CampaignPreview';
import { useAuth } from '../contexts/AuthContext';
import {
  apiClient,
  type Block,
  type CampaignAudienceFilters,
  type CampaignAudiencePreview,
} from '../services/api/client';

type StepId = 'name' | 'sender' | 'subject' | 'editor' | 'audience' | 'schedule';

const STEPS: { id: StepId; label: string }[] = [
  { id: 'name', label: 'Nome' },
  { id: 'sender', label: 'Remetente' },
  { id: 'subject', label: 'Assunto' },
  { id: 'editor', label: 'Editor' },
  { id: 'audience', label: 'Audiência' },
  { id: 'schedule', label: 'Agendar' },
];

const LEAD_STATUS_OPTIONS = [
  { value: 'NEW', label: 'Novo' },
  { value: 'CONTACTED', label: 'Contatado' },
  { value: 'QUALIFIED', label: 'Qualificado' },
  { value: 'PROPOSAL', label: 'Proposta' },
  { value: 'NEGOTIATION', label: 'Negociação' },
  { value: 'WON', label: 'Ganho' },
  { value: 'LOST', label: 'Perdido' },
];

const LEAD_SOURCE_OPTIONS = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'SOCIAL_MEDIA', label: 'Redes Sociais' },
  { value: 'REFERRAL', label: 'Indicação' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'OTHER', label: 'Outro' },
];

const ANY = '__any__';

export function CampaignWizard() {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Persisted campaign id — created lazily so the :id-scoped endpoints
  // (preview-audience, test-email, schedule) have a campaign to act on.
  const [campaignId, setCampaignId] = useState<string | null>(routeId ?? null);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Campaign fields
  const [name, setName] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [filters, setFilters] = useState<CampaignAudienceFilters>({});

  // Audience preview (req 13)
  const [audience, setAudience] = useState<CampaignAudiencePreview | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);

  // Scheduling (req 15)
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Tags + users for audience filters (req 12)
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => apiClient.getTags(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.getUsers(),
    staleTime: 5 * 60 * 1000,
  });

  const step = STEPS[stepIndex];

  /** Builds the payload from current field state. */
  const buildPayload = () => ({
    name: name.trim(),
    fromName: fromName.trim() || undefined,
    fromEmail: fromEmail.trim() || undefined,
    subject,
    blocks,
    audienceFilters: filters,
  });

  /** Creates or updates the campaign, returning its id. */
  const persist = async (): Promise<string> => {
    const payload = buildPayload();
    if (campaignId) {
      await apiClient.updateCampaign(campaignId, payload);
      return campaignId;
    }
    const created = await apiClient.createCampaign(payload);
    setCampaignId(created.id);
    return created.id;
  };

  const loadAudiencePreview = async () => {
    setLoadingAudience(true);
    setAudience(null);
    try {
      const id = await persist();
      const preview = await apiClient.previewCampaignAudience(id);
      setAudience(preview);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular audiência');
    } finally {
      setLoadingAudience(false);
    }
  };

  /** Per-step validation gate for advancing. */
  const canAdvance = (): boolean => {
    switch (step.id) {
      case 'name':
        if (!name.trim()) {
          toast.error('Informe um nome para a campanha');
          return false;
        }
        return true;
      case 'subject':
        if (!subject.trim()) {
          toast.error('Informe o assunto do email');
          return false;
        }
        return true;
      case 'editor':
        if (blocks.length === 0) {
          toast.error('Adicione ao menos um bloco ao corpo do email');
          return false;
        }
        return true;
      case 'audience':
        // Empty audience blocks advancing (edge case).
        if (!audience || audience.count === 0) {
          toast.error('A audiência está vazia. Ajuste os filtros para continuar.');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const goNext = async () => {
    if (!canAdvance()) return;
    setSaving(true);
    try {
      await persist();
      const next = stepIndex + 1;
      setStepIndex(next);
      // Auto-load the audience preview when entering the Audiência step.
      if (STEPS[next]?.id === 'audience') {
        await loadAudiencePreview();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar a campanha');
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (stepIndex === 0) {
      navigate('/app/campaigns');
      return;
    }
    setStepIndex((i) => i - 1);
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    try {
      const id = await persist();
      await apiClient.sendCampaignTestEmail(id);
      toast.success(`Email de teste enviado para ${user?.email ?? 'seu email'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar email de teste');
    } finally {
      setSendingTest(false);
    }
  };

  const handleFinish = async () => {
    let sendAt: string | null = null;
    if (sendMode === 'schedule') {
      if (!scheduleDate || !scheduleTime) {
        toast.error('Selecione a data e a hora do agendamento');
        return;
      }
      const when = new Date(`${scheduleDate}T${scheduleTime}`);
      // Campaign scheduled in the past (edge case).
      if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        toast.error('O horário agendado deve ser no futuro');
        return;
      }
      sendAt = when.toISOString();
    }

    setSaving(true);
    try {
      const id = await persist();
      await apiClient.scheduleCampaign(id, sendAt);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(sendAt ? 'Campanha agendada' : 'Campanha enviada');
      navigate('/app/campaigns');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao finalizar a campanha');
    } finally {
      setSaving(false);
    }
  };

  const updateFilter = (patch: Partial<CampaignAudienceFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setAudience(null); // filters changed → preview is stale
  };

  return (
    <div className="min-h-screen">
      <Header title="Nova Campanha" subtitle="Crie e dispare uma campanha de email" />

      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        {/* Stepper */}
        <ol className="mb-8 flex items-center gap-2 overflow-x-auto">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li key={s.id} className="flex items-center gap-2 shrink-0">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                    active
                      ? 'bg-primary text-white'
                      : done
                        ? 'bg-primary/20 text-primary'
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {done ? <Check size={14} /> : i + 1}
                </div>
                <span
                  className={`text-sm ${active ? 'font-medium text-gray-900' : 'text-gray-500'}`}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <div className="h-px w-6 bg-gray-200" />}
              </li>
            );
          })}
        </ol>

        <div className="rounded-lg border border-gray-200 bg-card p-6">
          {/* Step: Nome */}
          {step.id === 'name' && (
            <div className="space-y-3">
              <Label htmlFor="campaign-name">Nome da campanha</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Newsletter de Junho"
              />
              <p className="text-xs text-gray-500">
                Uso interno — não aparece para os destinatários.
              </p>
            </div>
          )}

          {/* Step: Remetente */}
          {step.id === 'sender' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="from-name">Nome do remetente</Label>
                <Input
                  id="from-name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Ex.: Equipe VYD"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-email">Email do remetente</Label>
                <Input
                  id="from-email"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="contato@suaempresa.com"
                />
              </div>
            </div>
          )}

          {/* Step: Assunto */}
          {step.id === 'subject' && (
            <div className="space-y-3">
              <Label htmlFor="subject">Assunto</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto do email — use {{lead.name}} para personalizar"
              />
              <div className="flex flex-wrap gap-1.5">
                {['{{lead.name}}', '{{lead.company}}', '{{lead.email}}'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSubject((s) => s + tag)}
                    className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {subject && (
                <p className="text-xs text-gray-500">
                  Pré-visualização: {substituteMergeTags(subject, SAMPLE_LEAD)}
                </p>
              )}
            </div>
          )}

          {/* Step: Editor */}
          {step.id === 'editor' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-900">Blocos</h3>
                <BlockEditor blocks={blocks} onChange={setBlocks} />
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Eye size={16} /> Pré-visualização
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-3 border-b border-gray-200 pb-2 text-sm font-medium">
                    Assunto: {substituteMergeTags(subject, SAMPLE_LEAD) || '(sem assunto)'}
                  </p>
                  <CampaignPreview blocks={blocks} />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={handleSendTest}
                  disabled={sendingTest || blocks.length === 0}
                >
                  {sendingTest ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      <Mail size={14} /> Enviar email de teste
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Audiência */}
          {step.id === 'audience' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={filters.status ?? ANY}
                    onValueChange={(v) => updateFilter({ status: v === ANY ? undefined : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Qualquer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Qualquer</SelectItem>
                      {LEAD_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tag</Label>
                  <Select
                    value={filters.tagId ?? ANY}
                    onValueChange={(v) => updateFilter({ tagId: v === ANY ? undefined : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Qualquer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Qualquer</SelectItem>
                      {tags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Select
                    value={filters.assignedTo ?? ANY}
                    onValueChange={(v) => updateFilter({ assignedTo: v === ANY ? undefined : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Qualquer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Qualquer</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select
                    value={filters.source ?? ANY}
                    onValueChange={(v) => updateFilter({ source: v === ANY ? undefined : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Qualquer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Qualquer</SelectItem>
                      {LEAD_SOURCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-score">Score mínimo</Label>
                  <Input
                    id="min-score"
                    type="number"
                    value={filters.minScore ?? ''}
                    onChange={(e) =>
                      updateFilter({
                        minScore: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="Ex.: 50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-score">Score máximo</Label>
                  <Input
                    id="max-score"
                    type="number"
                    value={filters.maxScore ?? ''}
                    onChange={(e) =>
                      updateFilter({
                        maxScore: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="Ex.: 100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last-after">Última interação depois de</Label>
                  <Input
                    id="last-after"
                    type="date"
                    value={filters.lastInteractionAfter ?? ''}
                    onChange={(e) =>
                      updateFilter({ lastInteractionAfter: e.target.value || undefined })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last-before">Última interação antes de</Label>
                  <Input
                    id="last-before"
                    type="date"
                    value={filters.lastInteractionBefore ?? ''}
                    onChange={(e) =>
                      updateFilter({ lastInteractionBefore: e.target.value || undefined })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="no-interaction">Sem interação há (dias)</Label>
                  <Input
                    id="no-interaction"
                    type="number"
                    value={filters.noInteractionDays ?? ''}
                    onChange={(e) =>
                      updateFilter({
                        noInteractionDays:
                          e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="Ex.: 30"
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={loadAudiencePreview}
                disabled={loadingAudience}
              >
                {loadingAudience ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Calculando...
                  </>
                ) : (
                  <>
                    <Users size={14} /> Atualizar audiência
                  </>
                )}
              </Button>

              {/* Audience preview (req 13) */}
              {loadingAudience ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={14} className="animate-spin" /> Calculando audiência...
                </div>
              ) : audience ? (
                audience.count === 0 ? (
                  <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                    Nenhum lead corresponde aos filtros selecionados (descadastrados são excluídos
                    automaticamente). Ajuste os filtros para continuar.
                  </div>
                ) : (
                  <div className="rounded-md border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-800">
                      {audience.count} leads selecionados
                    </p>
                    {audience.sample.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-green-700">
                        {audience.sample.map((s, i) => (
                          <li key={`${s.email}-${i}`}>
                            {s.name} &bull; {s.email}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              ) : null}
            </div>
          )}

          {/* Step: Agendar */}
          {step.id === 'schedule' && (
            <div className="space-y-5">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSendMode('now')}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${
                    sendMode === 'now'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Send size={14} /> Enviar agora
                </button>
                <button
                  type="button"
                  onClick={() => setSendMode('schedule')}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${
                    sendMode === 'schedule'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Clock size={14} /> Agendar para
                </button>
              </div>

              {sendMode === 'schedule' && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                  <Input
                    type="date"
                    value={scheduleDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-auto"
                  />
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-auto"
                  />
                </div>
              )}

              {audience && (
                <p className="text-sm text-gray-600">
                  Esta campanha será enviada para <strong>{audience.count}</strong>{' '}
                  {audience.count === 1 ? 'lead' : 'leads'}.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            className="gap-2"
            disabled={saving}
          >
            <ArrowLeft size={16} /> {stepIndex === 0 ? 'Cancelar' : 'Voltar'}
          </Button>

          {step.id === 'schedule' ? (
            <Button type="button" onClick={handleFinish} disabled={saving} className="gap-2">
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Processando...
                </>
              ) : sendMode === 'schedule' ? (
                <>
                  <Clock size={16} /> Agendar campanha
                </>
              ) : (
                <>
                  <Send size={16} /> Enviar campanha
                </>
              )}
            </Button>
          ) : (
            <Button type="button" onClick={goNext} disabled={saving} className="gap-2">
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  Próximo <ArrowRight size={16} />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
