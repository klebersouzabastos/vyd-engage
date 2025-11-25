import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Checkbox } from "./ui/checkbox";
import { Clock, Mail, MessageSquare } from "lucide-react";
import { TagSelector } from "./TagSelector";
import { useCustomFields } from "../contexts/CustomFieldsContext";
import { CustomFieldInput } from "./CustomFieldInput";
import { InteractionTimeline } from "./InteractionTimeline";
import { apiClient } from "../services/api/client";
import { TasksList } from "./TasksList";
import { useNotifications } from "../contexts/NotificationContext";
import { calculateLeadScore, getLeadScore, saveLeadScore } from "../utils/leadScoring";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { Lead } from "../types";
import { CommentsSection } from "./CommentsSection";
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

interface LeadModalProps {
  open: boolean;
  onClose: () => void;
  lead?: any;
}

export function LeadModal({ open, onClose, lead }: LeadModalProps) {
  console.log("LeadModal render - open:", open, "lead:", lead);
  const { fields, validateValue } = useCustomFields();
  const { addNotification } = useNotifications();
  const { createLead, updateLead } = useLeads();
  const [interactions, setInteractions] = useState<any[]>([]);
  const [leadScore, setLeadScore] = useState<{ score: number; factors: Array<{ type: string; description: string; points: number }> } | null>(null);
  const [pipelineColumns, setPipelineColumns] = useState(getPipelineColumns());
  const [formData, setFormData] = useState({
    name: lead?.name || "",
    email: lead?.email || "",
    phone: lead?.phone || "",
    source: lead?.source || "manual",
    status: lead?.status || pipelineColumns[0]?.id || "novo",
    automations: lead?.automations || [] as number[],
    tags: lead?.tags || [] as string[],
    customFields: lead?.customFields || {} as Record<string, any>,
  });
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Atualizar colunas do pipeline sempre que o modal abrir
    setPipelineColumns(getPipelineColumns());
  }, [open]);

  useEffect(() => {
    const columns = getPipelineColumns();
    // Garantir que sempre há pelo menos uma coluna
    const defaultStatus = columns.length > 0 ? columns[0].id : "novo";
    
    if (lead) {
      // Garantir que o lead tem um status válido
      const validStatus = columns.some(col => col.id === lead.status) 
        ? lead.status 
        : defaultStatus;
      
      setFormData({
        name: lead.name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        source: lead.source || "manual",
        status: validStatus as "novo" | "contato" | "fechado" | "perdido",
        automations: lead.automations || [],
        tags: lead.tags || [],
        customFields: lead.customFields || {},
      });
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
        status: defaultStatus as "novo" | "contato" | "fechado" | "perdido",
        automations: [],
        tags: [],
        customFields: defaultCustomFields,
      });
    }
    setCustomFieldErrors({});
    
    // Carregar interações do lead
    const loadInteractions = async () => {
      if (lead?.id) {
        try {
          const interactionsData = await apiClient.getLeadInteractions(String(lead.id));
          setInteractions(Array.isArray(interactionsData) ? interactionsData : []);
          
          // Calcular score do lead
          const leadWithInteractions: Lead = {
            ...lead,
            interactions: [],
          };
          const score = calculateLeadScore(leadWithInteractions);
          saveLeadScore(score);
          setLeadScore({ score: score.score, factors: score.factors });
        } catch (error) {
          console.error("Erro ao carregar interações:", error);
          setInteractions([]);
          setLeadScore(null);
        }
      } else {
        setInteractions([]);
        setLeadScore(null);
      }
    };
    
    loadInteractions();
  }, [lead, open, fields]);

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
      
      onClose();
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

  const activities = [
    { id: 1, type: "note", text: "Lead entrou em contato via formulário", time: "Há 2 horas" },
    { id: 2, type: "automation", text: "WhatsApp de boas-vindas enviado", time: "Há 2 horas" },
    { id: 3, type: "status", text: "Status alterado para Em Contato", time: "Há 3 horas" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="flex flex-col overflow-hidden p-0"
        style={{ 
          width: '900px', 
          height: '700px',
          maxWidth: '90vw',
          maxHeight: '90vh'
        }}
      >
        <DialogHeader className="flex-shrink-0 pb-4 border-b border-[#E5E7EB] px-6 pt-6">
          <div className="flex items-center justify-between">
            <DialogTitle>{lead ? "Editar Lead" : "Novo Lead"}</DialogTitle>
            {leadScore && (
              <LeadScoreBadge 
                score={leadScore.score} 
                showDetails 
                factors={leadScore.factors}
              />
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0 py-4 px-6">
          <Tabs defaultValue="info" className="mt-4">
            <TabsList className="inline-flex w-full">
              <TabsTrigger value="info" className="flex-1">Informações</TabsTrigger>
              <TabsTrigger value="activity" className="flex-1">Atividades</TabsTrigger>
              <TabsTrigger value="comments" className="flex-1">Comentários</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
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
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
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
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full mt-1.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
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
                  <div className="mt-1.5 space-y-2 max-h-48 overflow-y-auto border border-[#E5E7EB] rounded-md p-3 bg-[#F9FAFB]">
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
                              <p className="text-sm font-medium text-[#1F2937]">
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
                                <span className="text-xs text-[#6B7280]">
                                  {automation.type === "whatsapp" ? "WhatsApp" : "E-mail"}
                                </span>
                              </div>
                            </div>
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#6B7280] text-center py-4">
                        Nenhuma automação disponível
                      </p>
                    )}
                  </div>
                  {formData.automations && formData.automations.length > 0 && (
                    <p className="text-xs text-[#6B7280] mt-1.5">
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
                    <div className="space-y-4 p-4 border border-[#E5E7EB] rounded-lg bg-[#F9FAFB]">
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
              </form>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              {lead?.id ? (
                <InteractionTimeline
                  leadId={lead.id}
                  interactions={interactions}
                  onDelete={handleDeleteInteraction}
                  onAdd={handleAddInteraction}
                />
              ) : (
                <div className="text-center py-12 text-[#6B7280]">
                  <p>Salve o lead para ver o histórico de interações</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              {lead?.id ? (
                <TasksList leadId={lead.id} />
              ) : (
                <div className="text-center py-12 text-[#6B7280]">
                  <p>Salve o lead para gerenciar tarefas</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="comments" className="mt-4">
              {lead?.id ? (
                <CommentsSection leadId={lead.id} />
              ) : (
                <div className="text-center py-12 text-[#6B7280]">
                  <p>Salve o lead para adicionar comentários</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t border-[#E5E7EB] mt-0 px-6 pb-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="bg-[#2563EB] hover:bg-[#1E40AF]">
            Salvar Lead
          </Button>
        </DialogFooter>
      </DialogContent>

    </Dialog>
  );
}
