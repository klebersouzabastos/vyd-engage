import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { Header } from "../components/Header";
import { LeadStatusBadge } from "../components/LeadStatusBadge";
import { LeadSourceBadge } from "../components/LeadSourceBadge";
import { TagBadge } from "../components/TagBadge";
import { LeadScoreBadge } from "../components/LeadScoreBadge";
import { ScoreBreakdownModal } from "../components/ScoreBreakdownModal";
import { CustomFieldDisplay } from "../components/CustomFieldDisplay";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { PageSkeleton } from "../components/PageSkeleton";
import {
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Zap,
  Building2,
  Clock,
  User,
  ChevronDown,
} from "lucide-react";
import { apiClient } from "../services/api/client";
import { useTags } from "../contexts/TagsContext";
import { useCustomFields } from "../contexts/CustomFieldsContext";
import { mapStatusFromBackend, mapSourceFromBackend } from "../utils/leadEnums";
import { DealStageBadge } from "../components/deals/DealStageBadge";
import { DealForm } from "../components/deals/DealForm";
import { Deal, DealStage } from "../types";
import { Handshake, DollarSign } from "lucide-react";

// Number of interactions to show per "page"
const ITEMS_PER_PAGE = 10;

interface LeadData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  status: string;
  source: string;
  score: number;
  notes?: string;
  tags: Array<{ tag: { id: string; name: string; color: string } } | string>;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface InteractionData {
  id: string;
  leadId: string;
  type: string;
  direction: string;
  subject?: string;
  content: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

// Icon mapping for interaction types
function getInteractionIcon(type: string) {
  switch (type) {
    case "EMAIL":
      return <Mail size={16} />;
    case "WHATSAPP":
      return <MessageSquare size={16} />;
    case "CALL":
      return <Phone size={16} />;
    case "MEETING":
      return <Calendar size={16} />;
    case "NOTE":
      return <FileText size={16} />;
    case "STATUS_CHANGE":
      return <ArrowRightLeft size={16} />;
    case "AUTOMATION":
      return <Zap size={16} />;
    default:
      return <FileText size={16} />;
  }
}

// Icon background color per type
function getInteractionIconStyle(type: string): string {
  switch (type) {
    case "EMAIL":
      return "bg-blue-100 text-blue-600";
    case "WHATSAPP":
      return "bg-green-100 text-green-600";
    case "CALL":
      return "bg-purple-100 text-purple-600";
    case "MEETING":
      return "bg-orange-100 text-orange-600";
    case "NOTE":
      return "bg-gray-100 text-gray-600";
    case "STATUS_CHANGE":
      return "bg-yellow-100 text-yellow-600";
    case "AUTOMATION":
      return "bg-indigo-100 text-indigo-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

// Type label mapping
function getInteractionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    EMAIL: "E-mail",
    WHATSAPP: "WhatsApp",
    CALL: "Ligação",
    MEETING: "Reunião",
    NOTE: "Nota",
    STATUS_CHANGE: "Mudança de Status",
    AUTOMATION: "Automação",
  };
  return labels[type] || type;
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `${diffMinutes}min atras`;
  if (diffHours < 24) return `${diffHours}h atras`;
  if (diffDays < 7) return `${diffDays}d atras`;

  // Absolute date for older entries
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Format date for display
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Direction badge component
function DirectionBadge({ direction }: { direction: string }) {
  if (direction === "INBOUND") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        Recebido
      </span>
    );
  }
  if (direction === "OUTBOUND") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        Enviado
      </span>
    );
  }
  return null;
}

export function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTagById } = useTags();
  const { fields: customFields } = useCustomFields();

  const [lead, setLead] = useState<LeadData | null>(null);
  const [interactions, setInteractions] = useState<InteractionData[]>([]);
  const [loadingLead, setLoadingLead] = useState(true);
  const [loadingInteractions, setLoadingInteractions] = useState(true);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Note form state
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);

  // Lead-Deal integration
  const [leadDeals, setLeadDeals] = useState<Deal[]>([]);
  const [dealFormOpen, setDealFormOpen] = useState(false);

  const fetchLead = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingLead(true);
      const result = await apiClient.getLead(id);
      setLead(result);
    } catch (error: any) {
      console.error("Erro ao carregar lead:", error);
      toast.error("Erro ao carregar dados do lead");
      navigate("/app/leads");
    } finally {
      setLoadingLead(false);
    }
  }, [id, navigate]);

  const fetchInteractions = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingInteractions(true);
      const result = await apiClient.getLeadInteractions(id);
      setInteractions(Array.isArray(result) ? result : []);
    } catch (error: any) {
      console.error("Erro ao carregar interacoes:", error);
      toast.error("Erro ao carregar historico de atividades");
    } finally {
      setLoadingInteractions(false);
    }
  }, [id]);

  const fetchLeadDeals = useCallback(async () => {
    if (!id) return;
    try {
      const result = await apiClient.getDeals({ leadId: id, limit: 50 });
      setLeadDeals((result.deals || []).map((d: any) => ({ ...d, value: Number(d.value) })));
    } catch {
      // Silent fail
    }
  }, [id]);

  useEffect(() => {
    fetchLead();
    fetchInteractions();
    fetchLeadDeals();
  }, [fetchLead, fetchInteractions, fetchLeadDeals]);

  const handleSaveNote = async () => {
    if (!noteContent.trim() || !id) return;

    try {
      setSavingNote(true);
      const newInteraction = await apiClient.createInteraction({
        leadId: id,
        type: "NOTE",
        direction: "OUTBOUND",
        content: noteContent.trim(),
      });
      setInteractions((prev) => [newInteraction, ...prev]);
      setNoteContent("");
      setShowNoteForm(false);
      toast.success("Nota adicionada com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar nota:", error);
      toast.error("Erro ao salvar nota");
    } finally {
      setSavingNote(false);
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  // Visible interactions (client-side pagination)
  const visibleInteractions = useMemo(
    () => interactions.slice(0, visibleCount),
    [interactions, visibleCount]
  );
  const hasMore = visibleCount < interactions.length;

  // Extract tag objects from lead data
  const leadTags = useMemo(() => {
    if (!lead?.tags) return [];
    return lead.tags
      .map((t: any) => {
        // Handle both { tag: { id, name, color } } and plain string id formats
        if (typeof t === "string") {
          return getTagById(t);
        }
        if (t?.tag) {
          return t.tag;
        }
        if (t?.id) {
          return t;
        }
        return undefined;
      })
      .filter(Boolean);
  }, [lead?.tags, getTagById]);

  // Map backend status/source to frontend display values
  const displayStatus = lead ? mapStatusFromBackend(lead.status) : "";
  const displaySource = lead ? mapSourceFromBackend(lead.source) : "";

  // Custom fields with values
  const customFieldsWithValues = useMemo(() => {
    if (!lead?.customFields || !customFields.length) return [];
    return customFields.filter((field) => {
      const value = lead.customFields[field.id];
      return value !== null && value !== undefined && value !== "";
    });
  }, [lead?.customFields, customFields]);

  if (loadingLead) {
    return (
      <div className="min-h-screen">
        <Header title="Detalhes do Lead" />
        <PageSkeleton type="form" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen">
        <Header title="Lead nao encontrado" />
        <div className="p-8 text-center">
          <p className="text-gray-600 mb-4">
            O lead solicitado nao foi encontrado.
          </p>
          <Button onClick={() => navigate("/app/leads")}>
            <ArrowLeft size={16} className="mr-2" />
            Voltar para Leads
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title={lead.name}
        subtitle="Detalhes e historico de atividades"
      />

      <div className="p-8">
        {/* Back button */}
        <button
          onClick={() => navigate("/app/leads")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">Voltar para Leads</span>
        </button>

        {/* Split layout: 70/30 */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Activity Timeline (70%) */}
          <div className="lg:w-[70%]">
            <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Atividades
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowNoteForm(!showNoteForm)}
                >
                  <Plus size={14} />
                  Adicionar nota
                </Button>
              </div>

              {/* Inline note form */}
              {showNoteForm && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <Textarea
                    placeholder="Escreva uma nota sobre este lead..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={3}
                    className="mb-3"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowNoteForm(false);
                        setNoteContent("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveNote}
                      disabled={!noteContent.trim() || savingNote}
                    >
                      {savingNote && (
                        <Loader2 size={14} className="mr-2 animate-spin" />
                      )}
                      Salvar nota
                    </Button>
                  </div>
                </div>
              )}

              {/* Timeline */}
              {loadingInteractions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-gray-400" />
                </div>
              ) : interactions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText
                    size={40}
                    className="mx-auto text-gray-300 mb-3"
                  />
                  <p className="text-gray-500 text-sm">
                    Nenhuma atividade registrada para este lead.
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Adicione uma nota para iniciar o historico.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

                  <div className="space-y-1">
                    {visibleInteractions.map((interaction) => (
                      <div
                        key={interaction.id}
                        className="relative flex gap-4 py-3 group"
                      >
                        {/* Icon circle */}
                        <div
                          className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 ${getInteractionIconStyle(
                            interaction.type
                          )}`}
                        >
                          {getInteractionIcon(interaction.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-3">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {getInteractionTypeLabel(interaction.type)}
                            </span>
                            <DirectionBadge
                              direction={interaction.direction}
                            />
                            <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                              {formatRelativeTime(interaction.createdAt)}
                            </span>
                          </div>

                          {interaction.subject && (
                            <p className="text-sm font-medium text-gray-700 mb-1">
                              {interaction.subject}
                            </p>
                          )}

                          <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                            {interaction.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Load more */}
                  {hasMore && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        className="gap-2"
                      >
                        <ChevronDown size={14} />
                        Carregar mais ({interactions.length - visibleCount}{" "}
                        restantes)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Lead Info Sidebar (30%) */}
          <div className="lg:w-[30%]">
            <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-6 space-y-6 sticky top-4">
              {/* Name and basic info */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {lead.name}
                </h2>
                {lead.position && (
                  <p className="text-sm text-gray-500">{lead.position}</p>
                )}
              </div>

              {/* Contact info */}
              <div className="space-y-3">
                {lead.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={14} className="text-gray-400 flex-shrink-0" />
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-blue-600 hover:underline truncate"
                    >
                      {lead.email}
                    </a>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={14} className="text-gray-400 flex-shrink-0" />
                    <a
                      href={`tel:${lead.phone}`}
                      className="text-gray-700 hover:underline"
                    >
                      {lead.phone}
                    </a>
                  </div>
                )}
                {lead.company && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2
                      size={14}
                      className="text-gray-400 flex-shrink-0"
                    />
                    <span className="text-gray-700">{lead.company}</span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <hr className="border-gray-200" />

              {/* Status and Source */}
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                    Status
                  </span>
                  <LeadStatusBadge status={displayStatus} />
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                    Origem
                  </span>
                  <LeadSourceBadge source={displaySource as any} />
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                    Score
                  </span>
                  <button type="button" onClick={() => setScoreModalOpen(true)} className="cursor-pointer">
                    <LeadScoreBadge score={lead.score || 0} />
                  </button>
                </div>
              </div>

              {/* Tags */}
              {leadTags.length > 0 && (
                <>
                  <hr className="border-gray-200" />
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2">
                      Tags
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {leadTags.map((tag: any) => (
                        <TagBadge key={tag.id} tag={tag} size="sm" />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Custom Fields */}
              {customFieldsWithValues.length > 0 && (
                <>
                  <hr className="border-gray-200" />
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2">
                      Campos Customizados
                    </span>
                    <div className="space-y-1">
                      {customFieldsWithValues.map((field) => (
                        <CustomFieldDisplay
                          key={field.id}
                          field={field}
                          value={lead.customFields[field.id]}
                          mode="compact"
                          showLabel={true}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Dates */}
              <hr className="border-gray-200" />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock size={12} className="flex-shrink-0" />
                  <span>Criado em: {formatDate(lead.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock size={12} className="flex-shrink-0" />
                  <span>Atualizado em: {formatDate(lead.updatedAt)}</span>
                </div>
              </div>

              {/* Deals section */}
              <hr className="border-gray-200" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <Handshake size={12} />
                    Deals
                  </span>
                  <button
                    onClick={() => setDealFormOpen(true)}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    + Criar Deal
                  </button>
                </div>
                {leadDeals.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum deal associado</p>
                ) : (
                  <div className="space-y-2">
                    {leadDeals.map(deal => (
                      <button
                        key={deal.id}
                        onClick={() => navigate(`/app/deals/${deal.id}`)}
                        className="w-full text-left p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 truncate">{deal.name}</span>
                          <DealStageBadge stage={deal.stage} size="sm" />
                        </div>
                        <span className="text-sm font-bold text-gray-700">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(deal.value)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit button */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => navigate(`/app/leads/${id}/edit`)}
              >
                <Pencil size={14} />
                Editar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Score Breakdown Modal */}
      {id && (
        <ScoreBreakdownModal
          leadId={id}
          open={scoreModalOpen}
          onClose={() => setScoreModalOpen(false)}
        />
      )}

      {/* Deal Form Modal */}
      <DealForm
        open={dealFormOpen}
        onClose={() => setDealFormOpen(false)}
        onSave={async (data) => {
          await apiClient.createDeal(data);
          setDealFormOpen(false);
          fetchLeadDeals();
        }}
        defaultLeadId={id}
      />
    </div>
  );
}
