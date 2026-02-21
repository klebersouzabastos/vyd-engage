import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Checkbox } from "../components/ui/checkbox";
import { Mail, MessageSquare, ArrowLeft } from "lucide-react";
import { TagSelector } from "../components/TagSelector";
import { useCustomFields } from "../contexts/CustomFieldsContext";
import { CustomFieldInput } from "../components/CustomFieldInput";
import { InteractionTimeline } from "../components/InteractionTimeline";
import { apiClient } from "../services/api/client";
import { TasksList } from "../components/TasksList";
import { useNotifications } from "../contexts/NotificationContext";
import { calculateLeadScore, getLeadScore, saveLeadScore } from "../utils/leadScoring";
import { LeadScoreBadge } from "../components/LeadScoreBadge";
import { Lead } from "../types";
import { CommentsSection } from "../components/CommentsSection";
import { useLeads } from "../hooks/useLeads";
import { toast } from "sonner";

interface Automation {
  id: number;
  name: string;
  type: "whatsapp" | "email";
  status: "active" | "paused";
}

const availableAutomations: Automation[] = [
  {
    id: 1,
    name: "Boas-vindas WhatsApp",
    type: "whatsapp",
    status: "active",
  },
  {
    id: 2,
    name: "Follow-up E-mail",
    type: "email",
    status: "active",
  },
  {
    id: 3,
    name: "Recuperação de Leads Perdidos",
    type: "whatsapp",
    status: "paused",
  },
];

// Função para buscar as colunas do kanban (Pipeline)
function getPipelineColumns(): Array<{ id: string; title: string }> {
  try {
    const stored = localStorage.getItem("pipelineColumns");
    if (stored) {
      const columns = JSON.parse(stored);
      return columns.map((col: any) => ({
        id: col.id,
        title: col.title,
      }));
    }
  } catch (error) {
    console.error("Erro ao carregar colunas do pipeline:", error);
  }
  // Retornar colunas padrão se não houver dados salvos
  return [
    { id: "novo", title: "Novo" },
    { id: "contato", title: "Em Contato" },
    { id: "fechado", title: "Fechado" },
  ];
}

export function LeadForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { fields, validateValue } = useCustomFields();
  const { addNotification } = useNotifications();
  const { leads, createLead, updateLead, fetchLeads } = useLeads();
  const [interactions, setInteractions] = useState<any[]>([]);
  const [leadScore, setLeadScore] = useState<{ score: number; factors: Array<{ type: string; description: string; points: number }> } | null>(null);
  const [lead, setLead] = useState<any>(null);
  const [pipelineColumns, setPipelineColumns] = useState(getPipelineColumns());
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    source: "manual" as const,
    status: pipelineColumns[0]?.id || "novo",
    automations: [] as number[],
    tags: [] as string[],
    customFields: {} as Record<string, any>,
  });
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadLead = async () => {
      if (id) {
        try {
          const foundLead = leads.find(l => String(l.id) === String(id));
          if (foundLead) {
            setLead(foundLead);
            setFormData({
              name: foundLead.name || "",
              email: foundLead.email || "",
              phone: foundLead.phone || "",
              source: foundLead.source || "manual",
              status: foundLead.status || "novo",
              automations: foundLead.automations || [],
              tags: foundLead.tags?.map((t: any) => typeof t === 'string' ? t : t.id) || [],
              customFields: foundLead.customFields || {},
            });
            
            // Carregar interações
            try {
              const interactionsData = await apiClient.getLeadInteractions(String(foundLead.id));
              setInteractions(Array.isArray(interactionsData) ? interactionsData : []);
            } catch (error) {
              console.error("Erro ao carregar interações:", error);
              setInteractions([]);
            }
            
            // Calcular score do lead
            const leadWithInteractions: Lead = {
              ...foundLead,
              interactions: [],
            };
            const score = calculateLeadScore(leadWithInteractions);
            saveLeadScore(score);
            setLeadScore({ score: score.score, factors: score.factors });
          }
        } catch (error) {
          console.error("Erro ao carregar lead:", error);
        }
      } else {
        // Inicializar campos customizados com valores padrão
        const defaultCustomFields: Record<string, any> = {};
        fields.forEach((field) => {
          if (field.defaultValue !== undefined) {
            defaultCustomFields[field.id] = field.defaultValue;
          }
        });
        
        setFormData({
          name: "",
          email: "",
          phone: "",
          source: "manual",
          status: "novo",
          automations: [],
          tags: [],
          customFields: defaultCustomFields,
        });
      }
      setCustomFieldErrors({});
    };
    
    loadLead();
  }, [id, fields, leads]);

  const handleAddInteraction = async (interactionData: any) => {
    if (!lead?.id) return;
    try {
      const newInteraction = await apiClient.createInteraction({
        leadId: String(lead.id),
        type: interactionData.type,
        content: interactionData.content,
        metadata: interactionData.metadata,
      });
      setInteractions([newInteraction, ...interactions]);
    } catch (error) {
      console.error("Erro ao criar interação:", error);
      toast.error("Erro ao criar interação");
    }
  };

  const handleDeleteInteraction = async (interactionId: string) => {
    if (!lead?.id) return;
    try {
      await apiClient.deleteInteraction(interactionId);
      setInteractions(interactions.filter((i) => i.id !== interactionId));
    } catch (error) {
      console.error("Erro ao deletar interação:", error);
      toast.error("Erro ao deletar interação");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar campos customizados
    const errors: Record<string, string> = {};
    fields.forEach((field) => {
      const value = formData.customFields[field.id];
      const validation = validateValue(field, value);
      if (!validation.valid && validation.error) {
        errors[field.id] = validation.error;
      }
    });

    if (Object.keys(errors).length > 0) {
      setCustomFieldErrors(errors);
      return;
    }

    try {
      if (lead) {
        // Verificar se o status mudou
        if (lead.status !== formData.status) {
          const columns = getPipelineColumns();
          const statusLabels: Record<string, string> = {};
          columns.forEach((col) => {
            statusLabels[col.id] = col.title;
          });
          
          const oldStatusLabel = statusLabels[lead.status] || lead.status;
          const newStatusLabel = statusLabels[formData.status] || formData.status;
          
          await apiClient.createInteraction({
            leadId: String(lead.id),
            type: "status_change",
            content: `Status alterado de "${oldStatusLabel}" para "${newStatusLabel}"`,
            metadata: {
              oldStatus: lead.status,
              newStatus: formData.status,
            },
          });
          
          // Recarregar interações
          const interactionsData = await apiClient.getLeadInteractions(String(lead.id));
          setInteractions(Array.isArray(interactionsData) ? interactionsData : []);
        }

        // Atualizar lead existente
        await updateLead(String(lead.id), {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          source: formData.source,
          status: formData.status,
          customFields: formData.customFields,
          tags: formData.tags.map((tagId: string) => ({ id: tagId })),
        });
      } else {
        // Criar novo lead
        const newLead = await createLead({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          source: formData.source,
          status: formData.status,
          customFields: formData.customFields,
          tags: formData.tags.map((tagId: string) => ({ id: tagId })),
        });
        
        // Criar interação inicial
        await apiClient.createInteraction({
          leadId: String(newLead.id),
          type: "note",
          content: "Lead criado",
        });

        // Criar notificação
        addNotification({
          type: "new_lead",
          title: "Novo Lead Criado",
          message: `Lead "${formData.name}" foi adicionado ao sistema`,
          link: `/app/leads`,
        });
      }
      
      // Navegar de volta
      navigate("/app/leads");
    } catch (error) {
      console.error("Erro ao salvar lead:", error);
      toast.error("Erro ao salvar lead");
    }
  };

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setFormData({
      ...formData,
      customFields: {
        ...formData.customFields,
        [fieldId]: value,
      },
    });
    // Limpar erro do campo quando alterado
    if (customFieldErrors[fieldId]) {
      setCustomFieldErrors({
        ...customFieldErrors,
        [fieldId]: "",
      });
    }
  };

  const handleAutomationToggle = (automationId: number) => {
    setFormData((prev) => {
      const currentAutomations = prev.automations || [];
      if (currentAutomations.includes(automationId)) {
        return {
          ...prev,
          automations: currentAutomations.filter((id) => id !== automationId),
        };
      } else {
        return {
          ...prev,
          automations: [...currentAutomations, automationId],
        };
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header 
        title={lead ? "Editar Lead" : "Novo Lead"} 
        subtitle={lead ? `Editando: ${lead.name}` : "Preencha os dados do novo lead"}
      />
      
      <div className="p-8">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate("/app/leads")}
            className="gap-2"
          >
            <ArrowLeft size={16} />
            Voltar para Leads
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
          <div className="p-6 border-b border-gray-300 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {lead ? "Editar Lead" : "Novo Lead"}
            </h2>
            {leadScore && (
              <LeadScoreBadge 
                score={leadScore.score} 
                showDetails 
                factors={leadScore.factors}
              />
            )}
          </div>

          <div className="p-6">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="inline-flex w-full mb-6 h-auto">
                <TabsTrigger value="info" className="flex-1 py-2">Informações</TabsTrigger>
                <TabsTrigger value="activity" className="flex-1 py-2">Atividades</TabsTrigger>
                <TabsTrigger value="comments" className="flex-1 py-2">Comentários</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-0 outline-none relative">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome completo</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="João Silva"
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(11) 99999-9999"
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="joao@email.com"
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="source">Origem</Label>
                      <select
                        id="source"
                        value={formData.source}
                        onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
                        className="w-full mt-1.5 px-3 py-2 border border-gray-300 rounded-md bg-white"
                      >
                        <option value="meta">Meta Ads</option>
                        <option value="google">Google Ads</option>
                        <option value="organico">Orgânico</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <select
                        id="status"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full mt-1.5 px-3 py-2 border border-gray-300 rounded-md bg-white"
                      >
                        {pipelineColumns.map((column) => (
                          <option key={column.id} value={column.id}>
                            {column.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label>Automações</Label>
                    <div className="mt-1.5 space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-100">
                      {availableAutomations.length > 0 ? (
                        availableAutomations.map((automation) => (
                          <div
                            key={automation.id}
                            className="flex items-center gap-3 p-2 rounded-md hover:bg-white transition-colors"
                          >
                            <Checkbox
                              id={`automation-${automation.id}`}
                              checked={formData.automations?.includes(automation.id) || false}
                              onCheckedChange={() => handleAutomationToggle(automation.id)}
                            />
                            <label
                              htmlFor={`automation-${automation.id}`}
                              className="flex-1 flex items-center gap-2 cursor-pointer"
                            >
                              <div
                                className={`
                                  w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                                  ${automation.type === "whatsapp"
                                    ? "bg-green-100 text-green-600"
                                    : "bg-blue-100 text-blue-600"
                                  }
                                `}
                              >
                                {automation.type === "whatsapp" ? (
                                  <MessageSquare size={16} />
                                ) : (
                                  <Mail size={16} />
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {automation.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span
                                    className={`
                                      text-xs px-1.5 py-0.5 rounded
                                      ${automation.status === "active"
                                        ? "bg-green-50 text-green-700"
                                        : "bg-gray-100 text-gray-600"
                                      }
                                    `}
                                  >
                                    {automation.status === "active" ? "Ativa" : "Pausada"}
                                  </span>
                                  <span className="text-xs text-gray-600">
                                    {automation.type === "whatsapp" ? "WhatsApp" : "E-mail"}
                                  </span>
                                </div>
                              </div>
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-600 text-center py-4">
                          Nenhuma automação disponível
                        </p>
                      )}
                    </div>
                    {formData.automations && formData.automations.length > 0 && (
                      <p className="text-xs text-gray-600 mt-1.5">
                        {formData.automations.length} automação(ões) selecionada(s)
                      </p>
                    )}
                  </div>

                  <div className="mt-4">
                    <Label>Tags</Label>
                    <TagSelector
                      selectedTagIds={formData.tags}
                      onChange={(tagIds) => setFormData({ ...formData, tags: tagIds })}
                      placeholder="Adicionar tags..."
                    />
                  </div>

                  {fields.length > 0 && (
                    <div className="mt-4">
                      <Label className="mb-2 block">Campos Customizados</Label>
                      <div className="space-y-4 p-4 border border-gray-300 rounded-lg bg-gray-100">
                        {fields.map((field) => (
                          <CustomFieldInput
                            key={field.id}
                            field={field}
                            value={formData.customFields[field.id]}
                            onChange={(value) => handleCustomFieldChange(field.id, value)}
                            error={customFieldErrors[field.id]}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <Label htmlFor="notes">Notas</Label>
                    <Textarea
                      id="notes"
                      placeholder="Adicione observações sobre este lead..."
                      className="mt-1.5"
                      rows={4}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-300 mt-6">
                    <Button variant="outline" type="button" onClick={() => navigate("/app/leads")}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="bg-primary hover:bg-primary-dark">
                      Salvar Lead
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="activity" className="mt-0 outline-none relative">
                {lead?.id ? (
                  <InteractionTimeline
                    leadId={lead.id}
                    interactions={interactions}
                    onDelete={handleDeleteInteraction}
                    onAdd={handleAddInteraction}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-600">
                    <p>Salve o lead para ver o histórico de interações</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="tasks" className="mt-0 outline-none relative">
                {lead?.id ? (
                  <TasksList leadId={lead.id} />
                ) : (
                  <div className="text-center py-12 text-gray-600">
                    <p>Salve o lead para gerenciar tarefas</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="comments" className="mt-0 outline-none relative">
                {lead?.id ? (
                  <CommentsSection leadId={lead.id} />
                ) : (
                  <div className="text-center py-12 text-gray-600">
                    <p>Salve o lead para adicionar comentários</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

    </div>
  );
}

