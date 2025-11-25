import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ArrowLeft, MessageSquare, Clock, Send, Plus, Trash2, X, ArrowDown, AlertCircle } from "lucide-react";
import { Switch } from "../components/ui/switch";
import { useWhatsApp } from "../contexts/WhatsAppContext";
import { ConnectionStatusBadge } from "../components/whatsapp/ConnectionStatusBadge";
import { Alert, AlertDescription } from "../components/ui/alert";

interface Step {
  id: number;
  delay: string;
  channel: "whatsapp" | "email";
  subject?: string;
  message: string;
  whatsappConnectionId?: string;
}

// Função para formatar o delay para exibição
const formatDelay = (delay: string): string => {
  if (delay === "0") return "Enviar imediatamente";
  
  // Suporte para formato antigo (apenas números) - tratado como dias
  if (/^\d+$/.test(delay)) {
    const numValue = parseInt(delay);
    return `Enviar após ${delay} ${numValue === 1 ? "dia" : "dias"}`;
  }
  
  // Formato novo com unidade (ex: "1n", "1h", "2d", "1w", "1m")
  const match = delay.match(/^(\d+)([nhdwm])$/);
  if (!match) return `Enviar após ${delay}`;
  
  const [, value, unit] = match;
  const numValue = parseInt(value);
  
  switch (unit) {
    case "n":
      return `Enviar após ${value} ${numValue === 1 ? "minuto" : "minutos"}`;
    case "h":
      return `Enviar após ${value} ${numValue === 1 ? "hora" : "horas"}`;
    case "d":
      return `Enviar após ${value} ${numValue === 1 ? "dia" : "dias"}`;
    case "w":
      return `Enviar após ${value} ${numValue === 1 ? "semana" : "semanas"}`;
    case "m":
      return `Enviar após ${value} ${numValue === 1 ? "mês" : "meses"}`;
    default:
      return `Enviar após ${delay}`;
  }
};

// Função para parsear delay em valor e unidade
const parseDelay = (delay: string): { value: number; unit: string; isImmediate: boolean } => {
  if (delay === "0") {
    return { value: 0, unit: "d", isImmediate: true };
  }
  
  // Suporte para formato antigo (apenas números) - tratado como dias
  if (/^\d+$/.test(delay)) {
    return { value: parseInt(delay), unit: "d", isImmediate: false };
  }
  
  // Formato novo com unidade (ex: "1n", "1h", "2d", "1w", "1m")
  const match = delay.match(/^(\d+)([nhdwm])$/);
  if (match) {
    return { value: parseInt(match[1]), unit: match[2], isImmediate: false };
  }
  
  return { value: 1, unit: "d", isImmediate: false };
};

// Função para construir delay a partir de valor e unidade
const buildDelay = (value: number, unit: string, isImmediate: boolean): string => {
  if (isImmediate || value === 0) return "0";
  return `${value}${unit}`;
};

export function AutomationDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { connections, getDefaultConnection } = useWhatsApp();
  
  const [isActive, setIsActive] = useState(true);
  const [trigger, setTrigger] = useState("Quando lead é criado");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [steps, setSteps] = useState<Step[]>([
    {
      id: 1,
      delay: "0",
      channel: "whatsapp",
      message: "Olá {{nome}}! 👋\n\nObrigado por se cadastrar. Estamos felizes em ter você conosco!",
    },
    {
      id: 2,
      delay: "1d",
      channel: "whatsapp",
      message: "Oi {{nome}}! Gostaria de saber mais sobre nossos serviços? Estou aqui para ajudar! 😊",
    },
    {
      id: 3,
      delay: "3d",
      channel: "email",
      subject: "Não perca essa oportunidade!",
      message: "Olá {{nome}},\n\nNotamos que você demonstrou interesse. Temos uma oferta especial para você!\n\nAté breve,\nEquipe FlowCRM",
    },
  ]);

  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  const currentStep = selectedStep ? steps.find(s => s.id === selectedStep) : null;

  const closeStepEditor = () => {
    setSelectedStep(null);
  };

  const addStep = () => {
    const newStep: Step = {
      id: Math.max(...steps.map(s => s.id)) + 1,
      delay: "1d",
      channel: "whatsapp",
      message: "",
    };
    setSteps([...steps, newStep]);
    setSelectedStep(newStep.id);
  };

  const deleteStep = (stepId: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter(s => s.id !== stepId));
      if (selectedStep === stepId) {
        setSelectedStep(null);
      }
    }
  };

  const recentActivities = [
    { id: 1, lead: "Maria Silva", action: "Step 1 enviado", time: "2 min atrás", status: "success" },
    { id: 2, lead: "João Santos", action: "Step 2 enviado", time: "15 min atrás", status: "success" },
    { id: 3, lead: "Ana Costa", action: "Step 1 enviado", time: "1 hora atrás", status: "success" },
    { id: 4, lead: "Pedro Lima", action: "Step 2 falhou", time: "2 horas atrás", status: "error" },
  ];

  // Função para renderizar campos dinâmicos baseados no gatilho
  const renderTriggerFields = () => {
    const updateConfig = (key: string, value: any) => {
      setTriggerConfig({ ...triggerConfig, [key]: value });
    };

    switch (trigger) {
      case "Quando lead muda de status":
        return (
          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={triggerConfig.status || ""}
              onChange={(e) => updateConfig("status", e.target.value)}
              className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
            >
              <option value="">Selecione um status</option>
              <option value="novo">Novo</option>
              <option value="contato">Contato</option>
              <option value="fechado">Fechado</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>
        );

      case "Quando lead entra no funil":
      case "Quando lead sai do funil":
        return (
          <div>
            <Label htmlFor="funnel">Funil</Label>
            <select
              id="funnel"
              value={triggerConfig.funnel || ""}
              onChange={(e) => updateConfig("funnel", e.target.value)}
              className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
            >
              <option value="">Selecione um funil</option>
              <option value="vendas">Funil de Vendas</option>
              <option value="marketing">Funil de Marketing</option>
              <option value="suporte">Funil de Suporte</option>
            </select>
          </div>
        );

      case "Quando lead não responde após X dias":
      case "Quando lead não tem atividade há X dias":
      case "Quando lead completa X dias no sistema":
        return (
          <div>
            <Label htmlFor="days">Número de dias</Label>
            <Input
              id="days"
              type="number"
              min="1"
              value={triggerConfig.days || ""}
              onChange={(e) => updateConfig("days", parseInt(e.target.value) || 0)}
              placeholder="Digite o número de dias"
              className="mt-1.5"
            />
          </div>
        );

      case "Quando lead recebe interação":
        return (
          <div>
            <Label htmlFor="interactionType">Tipo de interação</Label>
            <select
              id="interactionType"
              value={triggerConfig.interactionType || ""}
              onChange={(e) => updateConfig("interactionType", e.target.value)}
              className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
            >
              <option value="">Selecione o tipo</option>
              <option value="note">Nota</option>
              <option value="call">Chamada</option>
              <option value="email">E-mail</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="meeting">Reunião</option>
            </select>
          </div>
        );

      case "Quando lead completa tarefa":
        return (
          <div>
            <Label htmlFor="taskType">Tipo de tarefa</Label>
            <select
              id="taskType"
              value={triggerConfig.taskType || ""}
              onChange={(e) => updateConfig("taskType", e.target.value)}
              className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
            >
              <option value="">Selecione o tipo</option>
              <option value="any">Qualquer tarefa</option>
              <option value="specific">Tarefa específica</option>
            </select>
            {triggerConfig.taskType === "specific" && (
              <Input
                type="text"
                value={triggerConfig.taskName || ""}
                onChange={(e) => updateConfig("taskName", e.target.value)}
                placeholder="Nome da tarefa"
                className="mt-2"
              />
            )}
          </div>
        );

      case "Quando lead visita página específica":
        return (
          <div>
            <Label htmlFor="pageUrl">URL da página</Label>
            <Input
              id="pageUrl"
              type="url"
              value={triggerConfig.pageUrl || ""}
              onChange={(e) => updateConfig("pageUrl", e.target.value)}
              placeholder="https://exemplo.com/pagina"
              className="mt-1.5"
            />
          </div>
        );

      case "Quando lead baixa arquivo":
        return (
          <div>
            <Label htmlFor="fileName">Nome do arquivo</Label>
            <Input
              id="fileName"
              type="text"
              value={triggerConfig.fileName || ""}
              onChange={(e) => updateConfig("fileName", e.target.value)}
              placeholder="nome-do-arquivo.pdf"
              className="mt-1.5"
            />
          </div>
        );

      case "Quando lead preenche formulário":
        return (
          <div>
            <Label htmlFor="formId">Formulário</Label>
            <select
              id="formId"
              value={triggerConfig.formId || ""}
              onChange={(e) => updateConfig("formId", e.target.value)}
              className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
            >
              <option value="">Selecione um formulário</option>
              <option value="form1">Formulário de Contato</option>
              <option value="form2">Formulário de Orçamento</option>
              <option value="form3">Formulário de Newsletter</option>
            </select>
          </div>
        );

      case "Quando lead clica em link do e-mail":
      case "Quando lead não abre e-mail":
        return (
          <div>
            <Label htmlFor="emailCampaign">Campanha de e-mail</Label>
            <select
              id="emailCampaign"
              value={triggerConfig.emailCampaign || ""}
              onChange={(e) => updateConfig("emailCampaign", e.target.value)}
              className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
            >
              <option value="">Selecione uma campanha</option>
              <option value="campaign1">Boas-vindas</option>
              <option value="campaign2">Promoção Especial</option>
              <option value="campaign3">Newsletter Semanal</option>
            </select>
          </div>
        );

      case "Quando lead recebe tag específica":
      case "Quando lead perde tag específica":
        return (
          <div>
            <Label htmlFor="tag">Tag</Label>
            <select
              id="tag"
              value={triggerConfig.tag || ""}
              onChange={(e) => updateConfig("tag", e.target.value)}
              className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
            >
              <option value="">Selecione uma tag</option>
              <option value="tag1">Cliente VIP</option>
              <option value="tag2">Interessado</option>
              <option value="tag3">Follow-up</option>
              <option value="tag4">Oportunidade</option>
            </select>
          </div>
        );

      case "Quando lead atinge score específico":
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor="scoreOperator">Operador</Label>
              <select
                id="scoreOperator"
                value={triggerConfig.scoreOperator || ">="}
                onChange={(e) => updateConfig("scoreOperator", e.target.value)}
                className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
              >
                <option value=">=">Maior ou igual a</option>
                <option value="<=">Menor ou igual a</option>
                <option value="=">Igual a</option>
                <option value=">">Maior que</option>
                <option value="<">Menor que</option>
              </select>
            </div>
            <div>
              <Label htmlFor="scoreValue">Valor do score</Label>
              <Input
                id="scoreValue"
                type="number"
                min="0"
                max="100"
                value={triggerConfig.scoreValue || ""}
                onChange={(e) => updateConfig("scoreValue", parseInt(e.target.value) || 0)}
                placeholder="0-100"
                className="mt-1.5"
              />
            </div>
          </div>
        );

      case "Quando lead faz compra":
      case "Quando lead fecha negócio":
        return (
          <div>
            <Label htmlFor="minValue">Valor mínimo (opcional)</Label>
            <Input
              id="minValue"
              type="number"
              min="0"
              value={triggerConfig.minValue || ""}
              onChange={(e) => updateConfig("minValue", parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="mt-1.5"
            />
          </div>
        );

      case "Quando lead abandona carrinho":
        return (
          <div>
            <Label htmlFor="abandonTime">Tempo de abandono (horas)</Label>
            <Input
              id="abandonTime"
              type="number"
              min="1"
              value={triggerConfig.abandonTime || ""}
              onChange={(e) => updateConfig("abandonTime", parseInt(e.target.value) || 0)}
              placeholder="24"
              className="mt-1.5"
            />
          </div>
        );

      case "Quando data específica é atingida":
        return (
          <div>
            <Label htmlFor="specificDate">Data</Label>
            <Input
              id="specificDate"
              type="date"
              value={triggerConfig.specificDate || ""}
              onChange={(e) => updateConfig("specificDate", e.target.value)}
              className="mt-1.5"
            />
          </div>
        );

      case "Quando aniversário do lead":
        return (
          <div>
            <Label htmlFor="daysBefore">Dias antes do aniversário</Label>
            <Input
              id="daysBefore"
              type="number"
              min="0"
              value={triggerConfig.daysBefore || ""}
              onChange={(e) => updateConfig("daysBefore", parseInt(e.target.value) || 0)}
              placeholder="0"
              className="mt-1.5"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Detalhes da Automação" />
      
      <div className="p-8">
        {/* Back Button and Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            className="gap-2"
            onClick={() => navigate("/app/automations")}
          >
            <ArrowLeft size={16} />
            Voltar
          </Button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#6B7280]">Status:</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-sm font-medium text-[#1F2937]">
                {isActive ? "Ativo" : "Pausado"}
              </span>
            </div>
            <Button className="bg-[#2563EB] hover:bg-[#1E40AF]">
              Salvar Alterações
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Step Editor + Recent Activities */}
          <div className="lg:col-span-2 space-y-6">
            {/* Automation Info */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB]">
              <h3 className="text-[#1F2937] mb-4">Informações</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome da Automação</Label>
                  <Input
                    id="name"
                    defaultValue="Boas-vindas WhatsApp"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="trigger">Gatilho</Label>
                  <select
                    id="trigger"
                    value={trigger}
                    onChange={(e) => {
                      setTrigger(e.target.value);
                      setTriggerConfig({}); // Limpa a configuração ao mudar o gatilho
                    }}
                    className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
                  >
                    <optgroup label="Criação e Status">
                      <option>Quando lead é criado</option>
                      <option>Quando lead muda de status</option>
                      <option>Quando lead entra no funil</option>
                      <option>Quando lead sai do funil</option>
                    </optgroup>
                    <optgroup label="Interações">
                      <option>Quando lead recebe interação</option>
                      <option>Quando lead não responde após X dias</option>
                      <option>Quando lead não tem atividade há X dias</option>
                      <option>Quando lead completa tarefa</option>
                    </optgroup>
                    <optgroup label="Comportamento Digital">
                      <option>Quando lead visita página específica</option>
                      <option>Quando lead baixa arquivo</option>
                      <option>Quando lead preenche formulário</option>
                      <option>Quando lead clica em link do e-mail</option>
                      <option>Quando lead não abre e-mail</option>
                    </optgroup>
                    <optgroup label="Tags e Score">
                      <option>Quando lead recebe tag específica</option>
                      <option>Quando lead atinge score específico</option>
                      <option>Quando lead perde tag específica</option>
                    </optgroup>
                    <optgroup label="Vendas">
                      <option>Quando lead faz compra</option>
                      <option>Quando lead abandona carrinho</option>
                      <option>Quando lead fecha negócio</option>
                      <option>Quando lead perde negócio</option>
                    </optgroup>
                    <optgroup label="Agendamento">
                      <option>Quando data específica é atingida</option>
                      <option>Quando aniversário do lead</option>
                      <option>Quando lead completa X dias no sistema</option>
                    </optgroup>
                  </select>
                </div>
                
                {/* Campos dinâmicos baseados no gatilho */}
                {(() => {
                  const fields = renderTriggerFields();
                  return fields && (
                    <div className="pt-4 border-t border-[#E5E7EB]">
                      {fields}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Step Editor */}
            {currentStep ? (
              <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB]">
                <div className="px-6 pt-6 pb-4 border-b border-[#E5E7EB]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[#1F2937]">
                      Editar Step {steps.findIndex(s => s.id === selectedStep) + 1}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={closeStepEditor}
                      className="h-8 w-8 p-0"
                    >
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
                              type="checkbox"
                              id="immediate"
                              checked={delayParsed.isImmediate}
                              onChange={(e) => {
                                const newDelay = e.target.checked ? "0" : buildDelay(1, "d", false);
                                setSteps(steps.map(s => 
                                  s.id === selectedStep ? { ...s, delay: newDelay } : s
                                ));
                              }}
                              className="w-4 h-4 text-[#2563EB] border-[#E5E7EB] rounded focus:ring-[#2563EB]"
                            />
                            <Label htmlFor="immediate" className="text-sm font-normal cursor-pointer">
                              Enviar imediatamente
                            </Label>
                          </div>
                          
                          {!delayParsed.isImmediate && (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <div className="flex-1">
                                <Input
                                  type="number"
                                  id="delayValue"
                                  min="1"
                                  value={delayParsed.value}
                                  onChange={(e) => {
                                    const newValue = parseInt(e.target.value) || 1;
                                    const newDelay = buildDelay(newValue, delayParsed.unit, false);
                                    setSteps(steps.map(s => 
                                      s.id === selectedStep ? { ...s, delay: newDelay } : s
                                    ));
                                  }}
                                  className="w-full"
                                  placeholder="Valor"
                                />
                              </div>
                              <div className="flex-1">
                                <select
                                  id="delayUnit"
                                  value={delayParsed.unit}
                                  onChange={(e) => {
                                    const newDelay = buildDelay(delayParsed.value, e.target.value, false);
                                    setSteps(steps.map(s => 
                                      s.id === selectedStep ? { ...s, delay: newDelay } : s
                                    ));
                                  }}
                                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
                                >
                                  <option value="n">Minutos</option>
                                  <option value="h">Horas</option>
                                  <option value="d">Dias</option>
                                  <option value="w">Semanas</option>
                                  <option value="m">Meses</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <Label htmlFor="channel">Canal</Label>
                    <select
                      id="channel"
                      value={currentStep.channel}
                      onChange={(e) => {
                        setSteps(steps.map(s => 
                          s.id === selectedStep ? { ...s, channel: e.target.value as "whatsapp" | "email" } : s
                        ));
                      }}
                      className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">E-mail</option>
                    </select>
                  </div>

                  {currentStep.channel === "whatsapp" && (
                    <div>
                      <Label htmlFor="whatsapp-connection">Conexão WhatsApp</Label>
                      {connections.length === 0 ? (
                        <Alert className="mt-1.5">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Nenhuma conexão WhatsApp configurada.{" "}
                            <a href="/app/settings?tab=integrations" className="text-[#2563EB] underline">
                              Configure uma conexão
                            </a>
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <>
                          <select
                            id="whatsapp-connection"
                            value={currentStep.whatsappConnectionId || getDefaultConnection()?.id || ""}
                            onChange={(e) => {
                              setSteps(steps.map(s => 
                                s.id === selectedStep ? { ...s, whatsappConnectionId: e.target.value } : s
                              ));
                            }}
                            className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
                          >
                            {connections.map((conn) => (
                              <option key={conn.id} value={conn.id}>
                                {conn.name} {conn.isDefault ? "(Padrão)" : ""}
                                {conn.status.status === "disconnected" ? " - Desconectado" : ""}
                              </option>
                            ))}
                          </select>
                          {currentStep.whatsappConnectionId && (
                            <div className="mt-2">
                              {(() => {
                                const selectedConn = connections.find(c => c.id === currentStep.whatsappConnectionId);
                                return selectedConn ? (
                                  <ConnectionStatusBadge status={selectedConn.status} />
                                ) : null;
                              })()}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {currentStep.channel === "email" && (
                    <div>
                      <Label htmlFor="subject">Assunto</Label>
                      <Input
                        id="subject"
                        value={currentStep.subject || ""}
                        onChange={(e) => {
                          setSteps(steps.map(s => 
                            s.id === selectedStep ? { ...s, subject: e.target.value } : s
                          ));
                        }}
                        placeholder="Assunto do e-mail"
                        className="mt-1.5"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="message">Mensagem</Label>
                    <Textarea
                      id="message"
                      value={currentStep.message}
                      onChange={(e) => {
                        setSteps(steps.map(s => 
                          s.id === selectedStep ? { ...s, message: e.target.value } : s
                        ));
                      }}
                      placeholder="Digite sua mensagem..."
                      className="mt-1.5"
                      rows={6}
                    />
                    <p className="text-xs text-[#6B7280] mt-2">
                      Use {`{{nome}}`} para personalizar com o nome do lead
                    </p>
                  </div>

                  <Button variant="outline" className="w-full">
                    Testar Mensagem
                  </Button>

                  <div className="flex gap-2 pt-2 border-t border-[#E5E7EB]">
                    <Button variant="outline" className="flex-1" onClick={closeStepEditor}>
                      Cancelar
                    </Button>
                    <Button 
                      className="flex-1 bg-[#2563EB] hover:bg-[#1E40AF]"
                      onClick={closeStepEditor}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Recent Activities */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB]">
              <h3 className="text-[#1F2937] mb-4">Atividades Recentes</h3>
              
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="pb-3 border-b border-[#E5E7EB] last:border-0">
                    <p className="font-medium text-sm text-[#1F2937] mb-1">
                      {activity.lead}
                    </p>
                    <p className="text-sm text-[#6B7280] mb-1">{activity.action}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#6B7280]">{activity.time}</span>
                      <span className={`
                        text-xs px-2 py-0.5 rounded-full
                        ${activity.status === "success" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-red-100 text-red-700"
                        }
                      `}>
                        {activity.status === "success" ? "Enviado" : "Erro"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Steps Flow */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB] sticky top-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[#1F2937]">Fluxo de Mensagens</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={addStep}
                >
                  <Plus size={16} />
                  Adicionar Step
                </Button>
              </div>

              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.id}>
                    <div
                      className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all
                        ${selectedStep === step.id 
                          ? 'border-[#2563EB] bg-[#2563EB]/5' 
                          : 'border-[#E5E7EB] hover:border-[#2563EB]/50'
                        }
                      `}
                      onClick={() => setSelectedStep(step.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                            ${step.channel === "whatsapp" 
                              ? "bg-green-100 text-green-600" 
                              : "bg-blue-100 text-blue-600"
                            }
                          `}>
                            {step.channel === "whatsapp" ? (
                              <MessageSquare size={16} />
                            ) : (
                              <Send size={16} />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-[#1F2937]">
                                Step {index + 1}
                              </span>
                              <span className="text-sm text-[#6B7280]">•</span>
                              <span className="text-sm text-[#6B7280]">
                                {step.channel === "whatsapp" ? "WhatsApp" : "E-mail"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                              <Clock size={14} />
                              <span>
                                {formatDelay(step.delay)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {steps.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteStep(step.id);
                            }}
                            className="text-[#DC2626] hover:text-[#DC2626] hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </div>

                    {index < steps.length - 1 && (
                      <div className="flex flex-col items-center py-3">
                        <div className="w-0.5 h-4 bg-[#2563EB]"></div>
                        <ArrowDown size={20} className="text-[#2563EB] my-1" />
                        <div className="w-0.5 h-4 bg-[#2563EB]"></div>
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
