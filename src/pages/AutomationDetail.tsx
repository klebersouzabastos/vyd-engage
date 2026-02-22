import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ArrowLeft, MessageSquare, Clock, Send, Plus, Trash2, X, ArrowDown, Loader2, Calendar, Settings2 } from "lucide-react";
import { Switch } from "../components/ui/switch";
import { apiClient } from "../services/api/client";
import { toast } from "sonner";

interface Step {
  id: number;
  delay: string;
  channel: "whatsapp" | "email";
  type: string;
  subject?: string;
  message: string;
  config?: Record<string, any>;
}

interface Schedule {
  enabled: boolean;
  days: number[];
  startHour: number;
  endHour: number;
  timezone: string;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const TRIGGER_OPTIONS = [
  { value: "lead_created", label: "Quando lead é criado" },
  { value: "status_changed", label: "Quando lead muda de status" },
  { value: "lead_score_changed", label: "Quando lead atinge score" },
  { value: "tag_added", label: "Quando lead recebe tag" },
  { value: "form_submitted", label: "Quando formulário é preenchido" },
  { value: "scheduled", label: "Agendamento" },
];

const formatDelay = (delay: string): string => {
  if (delay === "0") return "Enviar imediatamente";
  if (/^\d+$/.test(delay)) {
    const numValue = parseInt(delay);
    return `Enviar após ${delay} ${numValue === 1 ? "dia" : "dias"}`;
  }
  const match = delay.match(/^(\d+)([nhdwm])$/);
  if (!match) return `Enviar após ${delay}`;
  const [, value, unit] = match;
  const numValue = parseInt(value);
  switch (unit) {
    case "n": return `Enviar após ${value} ${numValue === 1 ? "minuto" : "minutos"}`;
    case "h": return `Enviar após ${value} ${numValue === 1 ? "hora" : "horas"}`;
    case "d": return `Enviar após ${value} ${numValue === 1 ? "dia" : "dias"}`;
    case "w": return `Enviar após ${value} ${numValue === 1 ? "semana" : "semanas"}`;
    case "m": return `Enviar após ${value} ${numValue === 1 ? "mês" : "meses"}`;
    default: return `Enviar após ${delay}`;
  }
};

const parseDelay = (delay: string): { value: number; unit: string; isImmediate: boolean } => {
  if (delay === "0") return { value: 0, unit: "d", isImmediate: true };
  if (/^\d+$/.test(delay)) return { value: parseInt(delay), unit: "d", isImmediate: false };
  const match = delay.match(/^(\d+)([nhdwm])$/);
  if (match) return { value: parseInt(match[1]), unit: match[2], isImmediate: false };
  return { value: 1, unit: "d", isImmediate: false };
};

const buildDelay = (value: number, unit: string, isImmediate: boolean): string => {
  if (isImmediate || value === 0) return "0";
  return `${value}${unit}`;
};

export function AutomationDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [automationName, setAutomationName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [trigger, setTrigger] = useState("lead_created");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, delay: "0", channel: "whatsapp", type: "send_whatsapp", message: "" },
  ]);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({
    enabled: false,
    days: [1, 2, 3, 4, 5],
    startHour: 8,
    endHour: 18,
    timezone: "America/Sao_Paulo",
  });

  useEffect(() => {
    if (id) loadAutomation();
  }, [id]);

  const loadAutomation = async () => {
    setLoading(true);
    try {
      const result = await apiClient.getAutomation(id!);
      const automation = result?.data || result;

      setAutomationName(automation.name || "");
      setDescription(automation.description || "");
      setIsActive(automation.status === "ACTIVE");

      // Parse trigger
      const triggerData = automation.trigger || {};
      if (typeof triggerData === "object" && triggerData.type) {
        setTrigger(triggerData.type);
        setTriggerConfig(triggerData.conditions || {});
      } else if (typeof triggerData === "string") {
        setTrigger(triggerData);
      }

      // Parse schedule from conditions or top-level
      const scheduleData = automation.conditions?.schedule || automation.schedule;
      if (scheduleData && scheduleData.enabled) {
        setSchedule({
          enabled: true,
          days: scheduleData.days || [1, 2, 3, 4, 5],
          startHour: scheduleData.startHour ?? 8,
          endHour: scheduleData.endHour ?? 18,
          timezone: scheduleData.timezone || "America/Sao_Paulo",
        });
      }

      // Parse steps from API
      const apiSteps = (automation.steps || []).map((s: any, i: number) => ({
        id: i + 1,
        delay: s.delay || "0",
        channel: s.type === "send_email" ? "email" as const : "whatsapp" as const,
        type: s.type || "send_whatsapp",
        subject: s.config?.subject || "",
        message: s.config?.message || s.config?.content || "",
        config: s.config || {},
      }));
      setSteps(apiSteps.length > 0 ? apiSteps : [{ id: 1, delay: "0", channel: "whatsapp", type: "send_whatsapp", message: "" }]);

      // Load recent logs
      try {
        const logsResult = await apiClient.getAutomationLogs(id!, 10);
        setLogs(logsResult?.data || logsResult || []);
      } catch {
        // Non-critical
      }
    } catch (error) {
      console.error("Erro ao carregar automação:", error);
      toast.error("Erro ao carregar automação");
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = () => {
    const apiSteps = steps.map((s, i) => ({
      order: i,
      type: s.channel === "email" ? "send_email" : "send_whatsapp",
      delay: s.delay,
      config: {
        message: s.message,
        content: s.message,
        ...(s.subject ? { subject: s.subject } : {}),
        ...s.config,
      },
    }));

    const triggerPayload: any = { type: trigger };
    if (Object.keys(triggerConfig).length > 0) {
      triggerPayload.conditions = triggerConfig;
    }

    return {
      name: automationName,
      description,
      status: isActive ? "ACTIVE" : "PAUSED",
      trigger: triggerPayload,
      steps: apiSteps,
      conditions: schedule.enabled ? { schedule } : null,
    };
  };

  const handleSave = async () => {
    if (!automationName.trim()) {
      toast.error("Nome da automação é obrigatório");
      return;
    }
    if (steps.length === 0) {
      toast.error("Adicione pelo menos um step");
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();

      if (isNew) {
        await apiClient.createAutomation(payload);
        toast.success("Automação criada com sucesso");
      } else {
        await apiClient.updateAutomation(id!, payload);
        toast.success("Automação salva com sucesso");
      }

      navigate("/app/automations");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar automação");
    } finally {
      setSaving(false);
    }
  };

  const currentStep = selectedStep ? steps.find(s => s.id === selectedStep) : null;

  const addStep = () => {
    const newStep: Step = {
      id: Math.max(0, ...steps.map(s => s.id)) + 1,
      delay: "1d",
      channel: "whatsapp",
      type: "send_whatsapp",
      message: "",
    };
    setSteps([...steps, newStep]);
    setSelectedStep(newStep.id);
  };

  const deleteStep = (stepId: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter(s => s.id !== stepId));
      if (selectedStep === stepId) setSelectedStep(null);
    }
  };

  const toggleScheduleDay = (day: number) => {
    setSchedule(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day].sort(),
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title={isNew ? "Nova Automação" : "Detalhes da Automação"} />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title={isNew ? "Nova Automação" : "Detalhes da Automação"} />

      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" className="gap-2" onClick={() => navigate("/app/automations")}>
            <ArrowLeft size={16} /> Voltar
          </Button>
          <div className="flex items-center gap-4">
            {!isNew && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Status:</span>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <span className="text-sm font-medium text-gray-900">{isActive ? "Ativo" : "Pausado"}</span>
              </div>
            )}
            <Button className="bg-primary hover:bg-primary-dark gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {isNew ? "Criar Automação" : "Salvar Alterações"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Info */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
              <h3 className="text-gray-900 mb-4">Informações</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome da Automação</Label>
                  <Input
                    id="name"
                    value={automationName}
                    onChange={(e) => setAutomationName(e.target.value)}
                    placeholder="Ex: Follow-up após cadastro"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva o objetivo desta automação"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="trigger">Gatilho</Label>
                  <select
                    id="trigger" value={trigger}
                    onChange={(e) => { setTrigger(e.target.value); setTriggerConfig({}); }}
                    className="w-full mt-1.5 px-3 py-2 border border-gray-300 rounded-md bg-white"
                  >
                    {TRIGGER_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Trigger Conditions */}
                {trigger === "status_changed" && (
                  <div>
                    <Label htmlFor="triggerStatus">Status específico (opcional)</Label>
                    <select
                      id="triggerStatus"
                      value={triggerConfig.status || ""}
                      onChange={(e) => setTriggerConfig(prev => ({ ...prev, status: e.target.value || undefined }))}
                      className="w-full mt-1.5 px-3 py-2 border border-gray-300 rounded-md bg-white"
                    >
                      <option value="">Qualquer mudança de status</option>
                      <option value="NEW">Novo</option>
                      <option value="CONTACTED">Contatado</option>
                      <option value="QUALIFIED">Qualificado</option>
                      <option value="PROPOSAL">Proposta</option>
                      <option value="NEGOTIATION">Negociação</option>
                      <option value="WON">Ganho</option>
                      <option value="LOST">Perdido</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Dispara apenas quando o lead mudar para este status</p>
                  </div>
                )}
                {trigger === "lead_score_changed" && (
                  <div>
                    <Label htmlFor="triggerScore">Score mínimo</Label>
                    <Input
                      id="triggerScore"
                      type="number"
                      min="0"
                      max="100"
                      value={triggerConfig.minScore || ""}
                      onChange={(e) => setTriggerConfig(prev => ({ ...prev, minScore: parseInt(e.target.value) || undefined }))}
                      placeholder="Ex: 50"
                      className="mt-1.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">Dispara quando o score do lead atingir este valor</p>
                  </div>
                )}
                {trigger === "tag_added" && (
                  <div>
                    <Label htmlFor="triggerTag">Tag ID (opcional)</Label>
                    <Input
                      id="triggerTag"
                      value={triggerConfig.tagId || ""}
                      onChange={(e) => setTriggerConfig(prev => ({ ...prev, tagId: e.target.value || undefined }))}
                      placeholder="ID da tag específica"
                      className="mt-1.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">Deixe vazio para disparar com qualquer tag</p>
                  </div>
                )}
                {trigger === "lead_created" && (
                  <div>
                    <Label htmlFor="triggerSource">Fonte do lead (opcional)</Label>
                    <select
                      id="triggerSource"
                      value={triggerConfig.source || ""}
                      onChange={(e) => setTriggerConfig(prev => ({ ...prev, source: e.target.value || undefined }))}
                      className="w-full mt-1.5 px-3 py-2 border border-gray-300 rounded-md bg-white"
                    >
                      <option value="">Qualquer fonte</option>
                      <option value="WEBSITE">Website</option>
                      <option value="REFERRAL">Indicação</option>
                      <option value="SOCIAL_MEDIA">Redes Sociais</option>
                      <option value="PAID_ADS">Anúncios Pagos</option>
                      <option value="OTHER">Outra</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Dispara apenas para leads desta fonte</p>
                  </div>
                )}
              </div>
            </div>

            {/* Scheduling */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-gray-500" />
                  <h3 className="text-gray-900">Agendamento</h3>
                </div>
                <Switch
                  checked={schedule.enabled}
                  onCheckedChange={(checked) => setSchedule(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              {schedule.enabled ? (
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Dias permitidos</Label>
                    <div className="flex gap-2">
                      {DAY_LABELS.map((label, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => toggleScheduleDay(index)}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                            schedule.days.includes(index)
                              ? "bg-primary text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startHour">Hora início</Label>
                      <select
                        id="startHour"
                        value={schedule.startHour}
                        onChange={(e) => setSchedule(prev => ({ ...prev, startHour: parseInt(e.target.value) }))}
                        className="w-full mt-1.5 px-3 py-2 border border-gray-300 rounded-md bg-white"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="endHour">Hora fim</Label>
                      <select
                        id="endHour"
                        value={schedule.endHour}
                        onChange={(e) => setSchedule(prev => ({ ...prev, endHour: parseInt(e.target.value) }))}
                        className="w-full mt-1.5 px-3 py-2 border border-gray-300 rounded-md bg-white"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="timezone">Fuso horário</Label>
                    <select
                      id="timezone"
                      value={schedule.timezone}
                      onChange={(e) => setSchedule(prev => ({ ...prev, timezone: e.target.value }))}
                      className="w-full mt-1.5 px-3 py-2 border border-gray-300 rounded-md bg-white"
                    >
                      <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                      <option value="America/Manaus">Manaus (GMT-4)</option>
                      <option value="America/Belem">Belém (GMT-3)</option>
                      <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                      <option value="America/Recife">Recife (GMT-3)</option>
                      <option value="America/Cuiaba">Cuiabá (GMT-4)</option>
                      <option value="America/Rio_Branco">Rio Branco (GMT-5)</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-500">
                    Mensagens fora do horário serão reagendadas para o próximo horário permitido.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Automação executará a qualquer momento. Ative para restringir dias e horários.</p>
              )}
            </div>

            {/* Step Editor */}
            {currentStep && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-300">
                <div className="px-6 pt-6 pb-4 border-b border-gray-300">
                  <div className="flex items-center justify-between">
                    <h3 className="text-gray-900">Editar Step {steps.findIndex(s => s.id === selectedStep) + 1}</h3>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedStep(null)} className="h-8 w-8 p-0">
                      <X size={16} />
                    </Button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <Label htmlFor="delay">Delay</Label>
                    {(() => {
                      const delayParsed = parseDelay(currentStep.delay);
                      return (
                        <div className="space-y-3 mt-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox" id="immediate" checked={delayParsed.isImmediate}
                              onChange={(e) => {
                                const newDelay = e.target.checked ? "0" : buildDelay(1, "d", false);
                                setSteps(steps.map(s => s.id === selectedStep ? { ...s, delay: newDelay } : s));
                              }}
                              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                            <Label htmlFor="immediate" className="text-sm font-normal cursor-pointer">Enviar imediatamente</Label>
                          </div>
                          {!delayParsed.isImmediate && (
                            <div className="flex gap-2">
                              <Input
                                type="number" min="1" value={delayParsed.value}
                                onChange={(e) => {
                                  const newDelay = buildDelay(parseInt(e.target.value) || 1, delayParsed.unit, false);
                                  setSteps(steps.map(s => s.id === selectedStep ? { ...s, delay: newDelay } : s));
                                }}
                                className="flex-1"
                              />
                              <select
                                value={delayParsed.unit}
                                onChange={(e) => {
                                  const newDelay = buildDelay(delayParsed.value, e.target.value, false);
                                  setSteps(steps.map(s => s.id === selectedStep ? { ...s, delay: newDelay } : s));
                                }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white"
                              >
                                <option value="n">Minutos</option>
                                <option value="h">Horas</option>
                                <option value="d">Dias</option>
                                <option value="w">Semanas</option>
                                <option value="m">Meses</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <Label htmlFor="channel">Canal</Label>
                    <select
                      id="channel" value={currentStep.channel}
                      onChange={(e) => {
                        const ch = e.target.value as "whatsapp" | "email";
                        setSteps(steps.map(s => s.id === selectedStep ? { ...s, channel: ch, type: ch === "email" ? "send_email" : "send_whatsapp" } : s));
                      }}
                      className="w-full mt-1.5 px-3 py-2 border border-gray-300 rounded-md bg-white"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">E-mail</option>
                    </select>
                  </div>
                  {currentStep.channel === "email" && (
                    <div>
                      <Label htmlFor="subject">Assunto</Label>
                      <Input
                        id="subject" value={currentStep.subject || ""}
                        onChange={(e) => setSteps(steps.map(s => s.id === selectedStep ? { ...s, subject: e.target.value } : s))}
                        placeholder="Assunto do e-mail" className="mt-1.5"
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="message">Mensagem</Label>
                    <Textarea
                      id="message" value={currentStep.message}
                      onChange={(e) => setSteps(steps.map(s => s.id === selectedStep ? { ...s, message: e.target.value } : s))}
                      placeholder="Digite sua mensagem..." className="mt-1.5" rows={6}
                    />
                    <p className="text-xs text-gray-600 mt-2">
                      Variáveis: {`{{nome}}`}, {`{{email}}`}, {`{{telefone}}`}, {`{{empresa}}`}
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gray-300">
                    <Button variant="outline" className="flex-1" onClick={() => setSelectedStep(null)}>Fechar</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Activities (only for existing automations) */}
            {!isNew && (
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-900">Atividades Recentes</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/app/automations/logs")}
                    className="text-sm text-primary"
                  >
                    Ver todos os logs
                  </Button>
                </div>
                {logs.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma atividade registrada ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {logs.slice(0, 5).map((log: any, i: number) => (
                      <div key={log.id || i} className="pb-3 border-b border-gray-300 last:border-0">
                        <p className="font-medium text-sm text-gray-900 mb-1">Step {log.stepOrder != null ? log.stepOrder + 1 : "?"}</p>
                        <p className="text-sm text-gray-600 mb-1 truncate">{log.message || (log.status === "SUCCESS" ? "Enviado" : "Erro")}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">{new Date(log.executedAt || log.createdAt).toLocaleString("pt-BR")}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${log.status === "SUCCESS" ? "bg-green-100 text-green-700" : log.status === "SKIPPED" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                            {log.status === "SUCCESS" ? "Sucesso" : log.status === "SKIPPED" ? "Pulado" : "Erro"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Steps Flow */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300 sticky top-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-gray-900">Fluxo de Mensagens</h3>
                <Button variant="outline" size="sm" className="gap-2" onClick={addStep}>
                  <Plus size={16} /> Adicionar Step
                </Button>
              </div>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.id}>
                    <div
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedStep === step.id ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary/50"}`}
                      onClick={() => setSelectedStep(step.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${step.channel === "whatsapp" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"}`}>
                            {step.channel === "whatsapp" ? <MessageSquare size={16} /> : <Send size={16} />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">Step {index + 1}</span>
                              <span className="text-sm text-gray-600">•</span>
                              <span className="text-sm text-gray-600">{step.channel === "whatsapp" ? "WhatsApp" : "E-mail"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock size={14} />
                              <span>{formatDelay(step.delay)}</span>
                            </div>
                            {step.message && (
                              <p className="text-xs text-gray-400 mt-1 truncate">{step.message.slice(0, 50)}{step.message.length > 50 ? "..." : ""}</p>
                            )}
                          </div>
                        </div>
                        {steps.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteStep(step.id); }} className="text-error hover:text-error hover:bg-red-50">
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <div className="flex flex-col items-center py-3">
                        <div className="w-0.5 h-4 bg-primary" />
                        <ArrowDown size={20} className="text-primary my-1" />
                        <div className="w-0.5 h-4 bg-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
