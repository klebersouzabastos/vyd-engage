import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { Header } from "../components/Header";
import { DealStageBadge } from "../components/deals/DealStageBadge";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { PageSkeleton } from "../components/PageSkeleton";
import { Deal, DealStage } from "../types";
import {
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Zap,
  DollarSign,
  User,
  Clock,
  ChevronDown,
  Link as LinkIcon,
  Pencil,
  Sparkles,
} from "lucide-react";
import { apiClient } from "../services/api/client";
import { DealForm } from "../components/deals/DealForm";
import { NextActionCard } from "../components/NextActionCard";
import { AIDraftDialog } from "../components/ai/AIDraftDialog";
import { formatCurrency } from "../utils/format";
import { Timeline, TimelineItem } from "../components/ui/timeline";

const ITEMS_PER_PAGE = 10;

interface InteractionData {
  id: string;
  type: string;
  direction: string;
  subject?: string;
  content: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

function getInteractionIcon(type: string) {
  switch (type) {
    case "EMAIL": return <Mail size={16} />;
    case "WHATSAPP": return <MessageSquare size={16} />;
    case "CALL": return <Phone size={16} />;
    case "MEETING": return <Calendar size={16} />;
    case "NOTE": return <FileText size={16} />;
    case "STATUS_CHANGE": return <ArrowRightLeft size={16} />;
    case "AUTOMATION": return <Zap size={16} />;
    default: return <FileText size={16} />;
  }
}

function getInteractionIconStyle(type: string): string {
  const styles: Record<string, string> = {
    EMAIL: "bg-blue-100 text-blue-600",
    WHATSAPP: "bg-green-100 text-green-600",
    CALL: "bg-purple-100 text-purple-600",
    MEETING: "bg-orange-100 text-orange-600",
    NOTE: "bg-gray-100 text-gray-600",
    STATUS_CHANGE: "bg-yellow-100 text-yellow-600",
    AUTOMATION: "bg-indigo-100 text-indigo-600",
  };
  return styles[type] || "bg-gray-100 text-gray-600";
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    EMAIL: "E-mail", WHATSAPP: "WhatsApp", CALL: "Ligação",
    MEETING: "Reunião", NOTE: "Nota", STATUS_CHANGE: "Mudança de Status", AUTOMATION: "Automação",
  };
  return labels[type] || type;
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d atrás`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [interactions, setInteractions] = useState<InteractionData[]>([]);
  const [loadingDeal, setLoadingDeal] = useState(true);
  const [loadingInteractions, setLoadingInteractions] = useState(true);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchDeal = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingDeal(true);
      const result = await apiClient.getDeal(id);
      setDeal({ ...result, value: Number(result.value) });
    } catch {
      toast.error("Erro ao carregar deal");
      navigate("/app/deals");
    } finally {
      setLoadingDeal(false);
    }
  }, [id, navigate]);

  const fetchInteractions = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingInteractions(true);
      const result = await apiClient.getDealInteractions(id);
      setInteractions(Array.isArray(result) ? result : (result as any)?.interactions || []);
    } catch {
      // Silent fail — deal may have no interactions
    } finally {
      setLoadingInteractions(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDeal();
    fetchInteractions();
  }, [fetchDeal, fetchInteractions]);

  const handleDownloadPdf = async () => {
    if (!id) return;
    setDownloadingPdf(true);
    try {
      const url = `${apiClient.getApiUrl()}/api/v1/deals/${id}/proposal.pdf`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Erro ao gerar PDF');
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `proposta-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error('Erro ao exportar proposta');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim() || !id) return;
    try {
      setSavingNote(true);
      const newInteraction = await apiClient.createInteraction({
        dealId: id,
        type: "NOTE",
        direction: "OUTBOUND",
        content: noteContent.trim(),
      });
      setInteractions(prev => [newInteraction, ...prev]);
      setNoteContent("");
      setShowNoteForm(false);
      toast.success("Nota adicionada!");
    } catch {
      toast.error("Erro ao salvar nota");
    } finally {
      setSavingNote(false);
    }
  };

  const handleEditSave = async (data: any) => {
    if (!id) return;
    const result = await apiClient.updateDeal(id, data);
    setDeal({ ...result, value: Number(result.value) });
    toast.success("Deal atualizado!");
  };

  const visibleInteractions = useMemo(() => interactions.slice(0, visibleCount), [interactions, visibleCount]);
  const hasMore = visibleCount < interactions.length;

  if (loadingDeal) {
    return (
      <div className="min-h-screen">
        <Header title="Deal" />
        <PageSkeleton type="form" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen">
        <Header title="Deal não encontrado" />
        <div className="p-8 text-center">
          <p className="text-gray-600 mb-4">O deal solicitado não foi encontrado.</p>
          <Button onClick={() => navigate("/app/deals")}><ArrowLeft size={16} className="mr-2" />Voltar para Deals</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title={deal.name} subtitle="Detalhes do negócio" />

      <div className="p-8">
        <button onClick={() => navigate("/app/deals")} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors">
          <ArrowLeft size={16} /><span className="text-sm">Voltar para Deals</span>
        </button>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Timeline (70%) */}
          <div className="lg:w-[70%]">
            <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Atividades</h2>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowNoteForm(!showNoteForm)}>
                  <Plus size={14} />Adicionar nota
                </Button>
              </div>

              {showNoteForm && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <Textarea placeholder="Escreva uma nota sobre este deal..." value={noteContent} onChange={(e) => setNoteContent(e.target.value)} rows={3} className="mb-3" />
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => { setShowNoteForm(false); setNoteContent(""); }}>Cancelar</Button>
                    <Button size="sm" onClick={handleSaveNote} disabled={!noteContent.trim() || savingNote}>
                      {savingNote && <Loader2 size={14} className="mr-2 animate-spin" />}Salvar
                    </Button>
                  </div>
                </div>
              )}

              {loadingInteractions ? (
                <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
              ) : interactions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">Nenhuma atividade registrada.</p>
                  <p className="text-gray-400 text-xs mt-1">Adicione uma nota para iniciar o histórico.</p>
                </div>
              ) : (
                <div className="relative">
                  <Timeline>
                    {visibleInteractions.map((interaction) => (
                      <TimelineItem
                        key={interaction.id}
                        id={interaction.id}
                        title={getTypeLabel(interaction.type)}
                        subtitle={interaction.subject || undefined}
                        description={interaction.content}
                        date={formatRelativeTime(interaction.createdAt)}
                        icon={getInteractionIcon(interaction.type)}
                        iconClassName={getInteractionIconStyle(interaction.type)}
                      />
                    ))}
                  </Timeline>
                  {hasMore && (
                    <div className="flex justify-center pt-4">
                      <Button variant="outline" size="sm" onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)} className="gap-2">
                        <ChevronDown size={14} />Carregar mais ({interactions.length - visibleCount} restantes)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Info Sidebar (30%) */}
          <div className="lg:w-[30%]">
            {/* Next Action Card */}
            {id && (
              <div className="mb-4">
                <NextActionCard entityType="deal" entityId={id} />
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-6 space-y-6 sticky top-4">
              {/* Value highlight */}
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(deal.value)}</p>
              </div>

              {/* Stage and probability */}
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Stage</span>
                  <DealStageBadge stage={deal.stage} size="md" />
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Probabilidade</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${deal.probability}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{deal.probability}%</span>
                  </div>
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* Details */}
              <div className="space-y-3">
                {deal.expectedCloseDate && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-gray-500 block">Previsão de Fechamento</span>
                      <span className="text-gray-700">{new Date(deal.expectedCloseDate).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                )}
                {deal.lead && (
                  <div className="flex items-center gap-3 text-sm">
                    <LinkIcon size={14} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-gray-500 block">Lead Associado</span>
                      <button onClick={() => navigate(`/app/leads/${deal.lead!.id}`)} className="text-blue-600 hover:underline">
                        {deal.lead.name}
                      </button>
                    </div>
                  </div>
                )}
                {deal.assignedUser && (
                  <div className="flex items-center gap-3 text-sm">
                    <User size={14} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-gray-500 block">Responsável</span>
                      <span className="text-gray-700">{deal.assignedUser.name}</span>
                    </div>
                  </div>
                )}
              </div>

              {deal.notes && (
                <>
                  <hr className="border-gray-200" />
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Notas</span>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{deal.notes}</p>
                  </div>
                </>
              )}

              {deal.lostReason && (
                <>
                  <hr className="border-gray-200" />
                  <div>
                    <span className="text-xs font-medium text-red-500 uppercase tracking-wider block mb-1.5">Motivo da Perda</span>
                    <p className="text-sm text-red-600">{deal.lostReason}</p>
                  </div>
                </>
              )}

              <hr className="border-gray-200" />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock size={12} className="flex-shrink-0" />
                  <span>Criado em: {formatDate(deal.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock size={12} className="flex-shrink-0" />
                  <span>Atualizado em: {formatDate(deal.updatedAt)}</span>
                </div>
                {deal.closedAt && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <DollarSign size={12} className="flex-shrink-0" />
                    <span>Fechado em: {formatDate(deal.closedAt)}</span>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                {downloadingPdf
                  ? <Loader2 size={14} className="animate-spin" />
                  : <FileText size={14} />}
                Exportar Proposta
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={() => setAiDraftOpen(true)}
              >
                <Sparkles size={14} />Gerar Email
              </Button>

              <Button variant="outline" className="w-full gap-2" onClick={() => setEditFormOpen(true)}>
                <Pencil size={14} />Editar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DealForm open={editFormOpen} onClose={() => setEditFormOpen(false)} onSave={handleEditSave} deal={deal} />

      <AIDraftDialog
        open={aiDraftOpen}
        onClose={() => setAiDraftOpen(false)}
        dealId={id}
        leadId={deal?.leadId || undefined}
      />
    </div>
  );
}
