import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { DealStageBadge } from "../components/deals/DealStageBadge";
import { DealForm } from "../components/deals/DealForm";
import { DealPipelineBoard } from "../components/deals/DealPipelineBoard";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { useDeals } from "../hooks/useDeals";
import { useDealsPipeline } from "../hooks/useDealsPipeline";
import { Deal, DealStage } from "../types";
import {
  Plus,
  Search,
  List,
  LayoutGrid,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Handshake,
  Funnel as FunnelIcon,
  Edit2,
  X,
  Check,
} from "lucide-react";
import { formatCurrency } from "../utils/format";
import { ExportButton } from "../components/ExportButton";
import { apiClient } from "../services/api/client";

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "Todos os Stages" },
  { value: "QUALIFICATION", label: "Qualificação" },
  { value: "PROPOSAL", label: "Proposta" },
  { value: "NEGOTIATION", label: "Negociação" },
  { value: "CLOSING", label: "Fechamento" },
  { value: "WON", label: "Ganho" },
  { value: "LOST", label: "Perdido" },
];

function formatDate(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("pt-BR");
}

export function Deals() {
  const navigate = useNavigate();
  const { deals, loading, pagination, fetchDeals, createDeal, updateDeal, deleteDeal } = useDeals();
  const {
    funnels: dealFunnels,
    currentFunnel: currentDealFunnel,
    currentFunnelId: currentDealFunnelId,
    columns: dealColumns,
    loading: pipelineLoading,
    switchFunnel: switchDealFunnel,
    createFunnel: createDealFunnel,
    updateFunnel: updateDealFunnel,
    deleteFunnel: deleteDealFunnel,
    loadFunnelWithDeals,
    moveDeal: moveDealInPipeline,
  } = useDealsPipeline();

  const [viewMode, setViewMode] = useState<"list" | "pipeline">("list");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);

  // Pipeline funnel management state
  const [createFunnelOpen, setCreateFunnelOpen] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState("");
  const [deleteFunnelId, setDeleteFunnelId] = useState<string | null>(null);
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);
  const [editingFunnelName, setEditingFunnelName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSearch = useCallback(() => {
    const filters: any = { page: 1 };
    if (search.trim()) filters.search = search.trim();
    if (stageFilter !== "ALL") filters.stage = stageFilter;
    fetchDeals(filters);
  }, [search, stageFilter, fetchDeals]);

  const handleStageChange = useCallback((value: string) => {
    setStageFilter(value);
    const filters: any = { page: 1 };
    if (search.trim()) filters.search = search.trim();
    if (value !== "ALL") filters.stage = value;
    fetchDeals(filters);
  }, [search, fetchDeals]);

  const handlePageChange = useCallback((page: number) => {
    const filters: any = { page };
    if (search.trim()) filters.search = search.trim();
    if (stageFilter !== "ALL") filters.stage = stageFilter;
    fetchDeals(filters);
  }, [search, stageFilter, fetchDeals]);

  const handleSave = async (data: any) => {
    if (editingDeal) {
      await updateDeal(editingDeal.id, data);
    } else {
      // When in pipeline view, auto-assign to current funnel
      const saveData = { ...data };
      if (viewMode === "pipeline" && currentDealFunnelId && !saveData.funnelId) {
        saveData.funnelId = currentDealFunnelId;
      }
      await createDeal(saveData);
    }
    // Refresh pipeline view
    if (viewMode === "pipeline" && currentDealFunnelId) {
      loadFunnelWithDeals(currentDealFunnelId);
    }
  };

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!dealToDelete) return;
    await deleteDeal(dealToDelete.id);
    setDeleteDialogOpen(false);
    setDealToDelete(null);
    if (viewMode === "pipeline" && currentDealFunnelId) {
      loadFunnelWithDeals(currentDealFunnelId);
    }
  };

  const handleStageUpdate = async (dealId: string, newStage: DealStage) => {
    await updateDeal(dealId, { stage: newStage });
  };

  // Funnel management handlers
  const handleCreateFunnel = async () => {
    if (!newFunnelName.trim()) return;
    const trimmedName = newFunnelName.trim();
    const duplicate = dealFunnels.find(
      (f) => f.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setErrorMessage(`Já existe um pipeline com o nome "${duplicate.name}".`);
      return;
    }
    setErrorMessage("");
    try {
      const newFunnel = await createDealFunnel(trimmedName);
      setNewFunnelName("");
      setCreateFunnelOpen(false);
      if (newFunnel) {
        switchDealFunnel(newFunnel.id);
      }
    } catch {
      setErrorMessage("Erro ao criar pipeline.");
    }
  };

  const handleDeleteFunnel = async () => {
    if (!deleteFunnelId) return;
    const funnel = dealFunnels.find((f) => f.id === deleteFunnelId);
    if (!funnel) return;
    if (funnel.isDefault) {
      setErrorMessage("Não é possível deletar o pipeline padrão.");
      setDeleteFunnelId(null);
      return;
    }
    try {
      await deleteDealFunnel(deleteFunnelId);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao deletar pipeline.");
    }
    setDeleteFunnelId(null);
  };

  const handleStartEditFunnel = (funnelId: string, currentName: string) => {
    setEditingFunnelId(funnelId);
    setEditingFunnelName(currentName);
  };

  const handleSaveEditFunnel = async () => {
    if (!editingFunnelId || !editingFunnelName.trim()) return;
    const trimmedName = editingFunnelName.trim();
    const duplicate = dealFunnels.find(
      (f) => f.id !== editingFunnelId && f.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setErrorMessage(`Já existe um pipeline com o nome "${duplicate.name}".`);
      return;
    }
    setErrorMessage("");
    try {
      await updateDealFunnel(editingFunnelId, { name: trimmedName });
    } catch {
      setErrorMessage("Erro ao renomear pipeline.");
    }
    setEditingFunnelId(null);
    setEditingFunnelName("");
  };

  const handleCancelEditFunnel = () => {
    setEditingFunnelId(null);
    setEditingFunnelName("");
    setErrorMessage("");
  };

  if (loading && deals.length === 0) {
    return (
      <div className="min-h-screen">
        <Header title="Deals" subtitle="Gerenciamento de negócios" />
        <PageSkeleton type="table" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Deals" subtitle="Gerenciamento de negócios" />

      <div className="p-8">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
            {viewMode === "list" && (
              <>
                <div className="relative flex-1 max-w-sm">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <Input
                    placeholder="Buscar deals..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-9"
                    aria-label="Buscar deals"
                  />
                </div>
                <Select value={stageFilter} onValueChange={handleStageChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center border border-gray-300 rounded-lg p-1 bg-gray-50">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded ${viewMode === "list" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}
                title="Lista"
                aria-label="Visualização em lista"
                aria-pressed={viewMode === "list"}
              >
                <List size={16} aria-hidden="true" />
              </button>
              <button
                onClick={() => setViewMode("pipeline")}
                className={`p-1.5 rounded ${viewMode === "pipeline" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}
                title="Pipeline"
                aria-label="Visualização em pipeline"
                aria-pressed={viewMode === "pipeline"}
              >
                <LayoutGrid size={16} aria-hidden="true" />
              </button>
            </div>

            {viewMode === "list" && (
              <ExportButton
                onExport={async (format) => {
                  const filters: Record<string, string> = {};
                  if (search.trim()) filters.search = search.trim();
                  if (stageFilter !== "ALL") filters.stage = stageFilter;
                  return apiClient.exportDealsDownload(format, filters);
                }}
                filename="deals-export"
                label="Exportar"
              />
            )}

            <Button onClick={() => { setEditingDeal(null); setFormOpen(true); }} className="gap-2">
              <Plus size={16} />
              Novo Deal
            </Button>
          </div>
        </div>

        {/* Pipeline Funnel Selector (shown only in pipeline view) */}
        {viewMode === "pipeline" && (
          <div className="mb-6 bg-white rounded-lg p-4 shadow-sm border border-gray-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <FunnelIcon size={20} className="text-gray-600" />
                <div className="flex items-center gap-2 flex-1">
                  {editingFunnelId !== null && editingFunnelId === currentDealFunnelId ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingFunnelName}
                        onChange={(e) => {
                          setEditingFunnelName(e.target.value);
                          setErrorMessage("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEditFunnel();
                          if (e.key === "Escape") handleCancelEditFunnel();
                        }}
                        className={`h-8 text-sm flex-1 ${errorMessage ? "border-red-500" : ""}`}
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" onClick={handleSaveEditFunnel} className="h-8 w-8 p-0">
                        <Check size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEditFunnel} className="h-8 w-8 p-0">
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <select
                        value={currentDealFunnelId || ""}
                        onChange={(e) => switchDealFunnel(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        {dealFunnels.map((funnel) => (
                          <option key={funnel.id} value={funnel.id}>
                            {funnel.name} {funnel.isDefault ? "(Padrão)" : ""}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStartEditFunnel(currentDealFunnelId!, currentDealFunnel?.name || "")}
                        className="h-8 w-8 p-0 hover:bg-gray-200"
                        title="Renomear pipeline"
                      >
                        <Edit2 size={14} className="text-gray-600" />
                      </Button>
                      {currentDealFunnel && !currentDealFunnel.isDefault && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteFunnelId(currentDealFunnelId!)}
                          className="h-8 w-8 p-0 hover:bg-gray-200"
                          title="Deletar pipeline"
                        >
                          <Trash2 size={14} className="text-gray-600" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
                {errorMessage && editingFunnelId && (
                  <p className="text-xs text-red-600">{errorMessage}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="border-2 border-primary text-primary hover:bg-primary hover:text-white gap-2"
                  onClick={() => setCreateFunnelOpen(true)}
                >
                  <Plus size={16} />
                  Novo Pipeline
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {viewMode === "pipeline" ? (
          pipelineLoading ? (
            <PageSkeleton type="table" />
          ) : (
            <DealPipelineBoard
              deals={deals}
              onStageChange={handleStageUpdate}
              onEdit={handleEdit}
              onClick={(deal) => navigate(`/app/deals/${deal.id}`)}
              funnelColumns={dealColumns}
              onMoveDeal={moveDealInPipeline}
            />
          )
        ) : (
          <>
            {/* Table */}
            <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Lista de deals">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-50">
                      <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Nome</th>
                      <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Valor</th>
                      <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Stage</th>
                      <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Probabilidade</th>
                      <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Fechamento</th>
                      <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Lead</th>
                      <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Responsável</th>
                      <th scope="col" className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <EmptyState
                            icon={Handshake}
                            title={search.trim() || stageFilter !== "ALL" ? "Nenhum deal encontrado" : "Nenhum deal criado"}
                            description={
                              search.trim() || stageFilter !== "ALL"
                                ? "Tente ajustar os filtros ou termos de busca"
                                : "Comece adicionando seu primeiro deal para gerenciar seu pipeline de vendas"
                            }
                            actionLabel="Novo Deal"
                            onAction={() => { setEditingDeal(null); setFormOpen(true); }}
                          />
                        </td>
                      </tr>
                    ) : (
                      deals.map((deal) => (
                        <tr
                          key={deal.id}
                          className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/app/deals/${deal.id}`)}
                        >
                          <td className="py-3 px-4">
                            <span className="font-medium text-gray-900">{deal.name}</span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700 font-medium">
                            {formatCurrency(deal.value)}
                          </td>
                          <td className="py-3 px-4">
                            <DealStageBadge stage={deal.stage} />
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {deal.probability}%
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} className="text-gray-400" />
                              {formatDate(deal.expectedCloseDate)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {deal.lead?.name || "\u2014"}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <User size={12} className="text-gray-400" />
                              {deal.assignedUser?.name || "\u2014"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleEdit(deal)}
                                className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                                aria-label={`Editar deal ${deal.name}`}
                              >
                                <Pencil size={14} aria-hidden="true" />
                              </button>
                              <button
                                onClick={() => { setDealToDelete(deal); setDeleteDialogOpen(true); }}
                                className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"
                                aria-label={`Excluir deal ${deal.name}`}
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <span className="text-sm text-gray-600">
                    {pagination.total} deal{pagination.total !== 1 ? "s" : ""} &bull; Página {pagination.page} de {pagination.totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => handlePageChange(pagination.page - 1)}
                    >
                      <ChevronLeft size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => handlePageChange(pagination.page + 1)}
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Deal Form Modal */}
      <DealForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingDeal(null); }}
        onSave={handleSave}
        deal={editingDeal}
        defaultFunnelId={viewMode === "pipeline" ? currentDealFunnelId || undefined : undefined}
      />

      {/* Delete Deal Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o deal &quot;{dealToDelete?.name}&quot;? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Pipeline Dialog */}
      <Dialog open={createFunnelOpen} onOpenChange={setCreateFunnelOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader className="text-left space-y-0 pb-4">
            <DialogTitle className="text-lg font-semibold text-gray-900">Criar Novo Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">
                Nome do Pipeline
              </label>
              <Input
                value={newFunnelName}
                onChange={(e) => {
                  setNewFunnelName(e.target.value);
                  setErrorMessage("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFunnel();
                }}
                placeholder="Ex: Enterprise Sales"
                className={errorMessage && !editingFunnelId ? "border-red-500" : ""}
                autoFocus
              />
              {errorMessage && !editingFunnelId && (
                <p className="text-xs text-red-600 mt-2">{errorMessage}</p>
              )}
              <p className="text-xs text-gray-600 mt-2">
                O pipeline será criado com colunas padrão (Qualificação, Proposta, Negociação, Fechamento, Ganho, Perdido).
              </p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setCreateFunnelOpen(false);
                setNewFunnelName("");
                setErrorMessage("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateFunnel}
              disabled={!newFunnelName.trim()}
              className="bg-primary hover:bg-primary-dark"
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Pipeline Alert Dialog */}
      <AlertDialog open={deleteFunnelId !== null} onOpenChange={(open) => !open && setDeleteFunnelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFunnelId && (() => {
                const funnel = dealFunnels.find((f) => f.id === deleteFunnelId);
                if (funnel?.isDefault) {
                  return (
                    <span className="text-red-600">
                      Não é possível deletar o pipeline padrão.
                    </span>
                  );
                }
                return `Tem certeza que deseja deletar o pipeline "${funnel?.name}"?`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteFunnelId(null)}>
              Cancelar
            </AlertDialogCancel>
            {deleteFunnelId && (() => {
              const funnel = dealFunnels.find((f) => f.id === deleteFunnelId);
              return funnel && !funnel.isDefault && (
                <AlertDialogAction
                  onClick={handleDeleteFunnel}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Deletar
                </AlertDialogAction>
              );
            })()}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
