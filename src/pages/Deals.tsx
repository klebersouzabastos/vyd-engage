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
import { DealStageBadge } from "../components/deals/DealStageBadge";
import { DealForm } from "../components/deals/DealForm";
import { DealPipelineBoard } from "../components/deals/DealPipelineBoard";
import { PageSkeleton } from "../components/PageSkeleton";
import { useDeals } from "../hooks/useDeals";
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
} from "lucide-react";

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "Todos os Stages" },
  { value: "QUALIFICATION", label: "Qualificação" },
  { value: "PROPOSAL", label: "Proposta" },
  { value: "NEGOTIATION", label: "Negociação" },
  { value: "CLOSING", label: "Fechamento" },
  { value: "WON", label: "Ganho" },
  { value: "LOST", label: "Perdido" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

export function Deals() {
  const navigate = useNavigate();
  const { deals, loading, pagination, fetchDeals, createDeal, updateDeal, deleteDeal } = useDeals();

  const [viewMode, setViewMode] = useState<"list" | "pipeline">("list");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);

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
      await createDeal(data);
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
  };

  const handleStageUpdate = async (dealId: string, newStage: DealStage) => {
    await updateDeal(dealId, { stage: newStage });
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
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar deals..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
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
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center border border-gray-300 rounded-lg p-1 bg-white">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded ${viewMode === "list" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}
                title="Lista"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode("pipeline")}
                className={`p-1.5 rounded ${viewMode === "pipeline" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}
                title="Pipeline"
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            <Button onClick={() => { setEditingDeal(null); setFormOpen(true); }} className="gap-2">
              <Plus size={16} />
              Novo Deal
            </Button>
          </div>
        </div>

        {/* Content */}
        {viewMode === "pipeline" ? (
          <DealPipelineBoard
            deals={deals}
            onStageChange={handleStageUpdate}
            onEdit={handleEdit}
            onClick={(deal) => navigate(`/app/deals/${deal.id}`)}
          />
        ) : (
          <>
            {/* Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-50">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Nome</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Valor</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Stage</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Prob.</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Fechamento</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Lead</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Responsável</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-gray-500">
                          Nenhum deal encontrado. Crie o primeiro!
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
                            {deal.lead?.name || "—"}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <User size={12} className="text-gray-400" />
                              {deal.assignedUser?.name || "—"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleEdit(deal)}
                                className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                                title="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => { setDealToDelete(deal); setDeleteDialogOpen(true); }}
                                className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
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
                    {pagination.total} deal{pagination.total !== 1 ? "s" : ""} • Página {pagination.page} de {pagination.totalPages}
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
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o deal "{dealToDelete?.name}"? Esta ação não pode ser desfeita.
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
    </div>
  );
}
