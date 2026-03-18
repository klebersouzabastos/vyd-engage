import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Header } from "../components/Header";
import { LeadModal } from "../components/LeadModal";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Users } from "lucide-react";
import { LeadImportModal } from "../components/leads/LeadImportModal";
import { LeadBulkActions } from "../components/leads/LeadBulkActions";
import { LeadFilters } from "../components/leads/LeadFilters";
import { LeadTable } from "../components/leads/LeadTable";
import { LeadMobileCards } from "../components/leads/LeadMobileCards";
import { Pagination } from "../components/Pagination";
import { ScoreBreakdownModal } from "../components/ScoreBreakdownModal";
import { useTags } from "../contexts/TagsContext";
import { useCustomFields } from "../contexts/CustomFieldsContext";
import { Lead } from "../types";
// excelExport is dynamically imported to avoid bundling ExcelJS eagerly
import { apiClient } from "../services/api/client";
import { useLeads } from "../hooks/useLeads";
import { mapStatusToBackend, mapSourceToBackend } from "../utils/leadEnums";
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

// --- Constants ---

interface Automation {
  id: number;
  name: string;
  type: "whatsapp" | "email";
  status: "active" | "paused";
}

const availableAutomations: Automation[] = [
  { id: 1, name: "Boas-vindas WhatsApp", type: "whatsapp", status: "active" },
  { id: 2, name: "Follow-up E-mail", type: "email", status: "active" },
  { id: 3, name: "Recuperação de Leads Perdidos", type: "whatsapp", status: "paused" },
];

const getAutomationById = (id: number): Automation | undefined => {
  return availableAutomations.find(automation => automation.id === id);
};

const getStatusLabel = (status: string) => {
  const statusMap: Record<string, string> = {
    novo: "Novo",
    contato: "Em Contato",
    fechado: "Fechado",
    perdido: "Perdido",
  };
  return statusMap[status] || status;
};

const getSourceLabel = (source: string) => {
  const sourceMap: Record<string, string> = {
    meta: "Meta Ads",
    google: "Google Ads",
    organico: "Orgânico",
    manual: "Manual",
  };
  return sourceMap[source] || source;
};

// --- Component ---

export function Leads() {
  const navigate = useNavigate();
  const { getTagById, tags } = useTags();
  const { fields: customFields } = useCustomFields();
  const { leads: leadsData, loading, pagination, deleteLead: deleteLeadAPI, fetchLeads, refetch } = useLeads();
  // Selection state
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterSource, setFilterSource] = useState<string[]>([]);
  const [filterAutomation, setFilterAutomation] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string[]>([]);
  const [filterCustomFields, setFilterCustomFields] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSingleLeadId, setDeleteSingleLeadId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [scoreLeadId, setScoreLeadId] = useState<string | null>(null);

  // Table expansion state
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Server filter params ---

  const buildServerFilters = useCallback((page: number = 1) => {
    const serverFilters: Record<string, string | number | undefined> = {
      page,
      limit: pagination.limit,
    };
    if (filterStatus.length === 1) {
      serverFilters.status = mapStatusToBackend(filterStatus[0]);
    }
    if (filterSource.length === 1) {
      serverFilters.source = mapSourceToBackend(filterSource[0]);
    }
    if (debouncedSearch) {
      serverFilters.search = debouncedSearch;
    }
    if (filterTag.length === 1) {
      serverFilters.tagId = filterTag[0];
    }
    return serverFilters;
  }, [filterStatus, filterSource, debouncedSearch, filterTag, pagination.limit]);

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // Fetch on filter change
  useEffect(() => {
    fetchLeads(buildServerFilters(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterSource, debouncedSearch, filterTag]);

  // --- Client-side filtering ---

  const filteredLeads = leadsData.filter((lead: any) => {
    const matchesStatus = filterStatus.length <= 1 || filterStatus.includes(lead.status);
    const matchesSource = filterSource.length <= 1 || filterSource.includes(lead.source);
    const matchesTag = filterTag.length <= 1 ||
      (lead.tags && lead.tags.some((tagId: string) => filterTag.includes(tagId)));
    const matchesAutomation = filterAutomation.length === 0 ||
      filterAutomation.some((filter: string) => {
        if (filter === "with") return lead.automations && lead.automations.length > 0;
        if (filter === "without") return !lead.automations || lead.automations.length === 0;
        return lead.automations && lead.automations.includes(Number(filter));
      });
    const matchesCustomFields = Object.keys(filterCustomFields).length === 0 ||
      Object.entries(filterCustomFields).every(([fieldId, filterValue]) => {
        if (filterValue === null || filterValue === undefined || filterValue === "") return true;
        const leadValue = lead.customFields?.[fieldId];
        if (leadValue === null || leadValue === undefined || leadValue === "") return false;
        const field = customFields.find(f => f.id === fieldId);
        if (!field) return true;
        switch (field.type) {
          case "text":
          case "textarea":
            return String(leadValue).toLowerCase().includes(String(filterValue).toLowerCase());
          case "number":
            return Number(leadValue) === Number(filterValue);
          case "date":
            return String(leadValue) === String(filterValue);
          case "checkbox":
            return Boolean(leadValue) === Boolean(filterValue);
          case "select":
            return String(leadValue) === String(filterValue);
          default:
            return String(leadValue) === String(filterValue);
        }
      });
    return matchesStatus && matchesSource && matchesAutomation && matchesTag && matchesCustomFields;
  });

  // --- Handlers ---

  const toggleLeadExpansion = (leadId: string) => {
    setExpandedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const filteredLeadIds = filteredLeads.map(l => l.id);
    const allFilteredSelected = filteredLeadIds.every(id => selectedLeads.includes(id));
    if (allFilteredSelected && filteredLeadIds.length > 0) {
      setSelectedLeads(selectedLeads.filter(id => !filteredLeadIds.includes(id)));
    } else {
      setSelectedLeads([...new Set([...selectedLeads, ...filteredLeadIds])]);
    }
  };

  const handleSelectLead = (id: string) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter(l => l !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  };

  const handleExportLeads = async () => {
    try {
      const { exportLeadsToExcel } = await import("../utils/excelExport");
      await exportLeadsToExcel(
        filteredLeads,
        { status: filterStatus, source: filterSource, automation: filterAutomation, tag: filterTag, searchQuery },
        getStatusLabel,
        getSourceLabel,
        getAutomationById,
        getTagById,
      );
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      toast.error('Erro ao exportar relatório. Tente novamente.');
    }
  };

  const handleExportAllFiltered = async () => {
    try {
      const filters: { status?: string; source?: string; search?: string; tagId?: string } = {};
      if (filterStatus.length === 1) filters.status = mapStatusToBackend(filterStatus[0]);
      if (filterSource.length === 1) filters.source = mapSourceToBackend(filterSource[0]);
      if (searchQuery) filters.search = searchQuery;
      if (filterTag.length === 1) filters.tagId = filterTag[0];

      toast.info("Exportando todos os leads filtrados...");
      const response = await apiClient.exportLeads(filters);
      const leads = response?.data || response || [];

      if (!Array.isArray(leads) || leads.length === 0) {
        toast.warning("Nenhum lead encontrado para exportar.");
        return;
      }

      const mapped = leads.map((lead: any) => ({
        id: lead.id,
        name: lead.name || "",
        phone: lead.phone || "",
        email: lead.email || "",
        status: lead.status || "",
        source: lead.source || "",
        date: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("pt-BR") : "",
        tags: lead.tags?.map((t: any) => t.tagId || t.tag?.id) || [],
        customFields: lead.customFields || {},
      }));

      toast.info(`Exportando ${mapped.length} leads...`);
      const { exportLeadsToExcel } = await import("../utils/excelExport");
      await exportLeadsToExcel(
        mapped,
        { status: filterStatus, source: filterSource, automation: filterAutomation, tag: filterTag, searchQuery },
        getStatusLabel,
        getSourceLabel,
        getAutomationById,
        getTagById,
      );
      toast.success(`${mapped.length} leads exportados com sucesso!`);
    } catch (error) {
      console.error("Erro ao exportar leads filtrados:", error);
      toast.error("Erro ao exportar leads. Tente novamente.");
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      await deleteLeadAPI(leadId);
      setSelectedLeads(prev => prev.filter(id => id !== leadId));
      if (selectedLead?.id === leadId) {
        setModalOpen(false);
        setSelectedLead(null);
      }
      setDeleteSingleLeadId(null);
    } catch (error) {
      console.error("Erro ao deletar lead:", error);
    }
  };

  const handleDeleteSelectedLeads = async () => {
    if (selectedLeads.length === 0) return;
    const leadToDeleteCount = selectedLeads.length;
    try {
      await apiClient.bulkUpdateLeads(selectedLeads, 'delete');
      if (selectedLead && selectedLeads.includes(selectedLead.id)) {
        setModalOpen(false);
        setSelectedLead(null);
      }
      setSelectedLeads([]);
      setDeleteDialogOpen(false);
      refetch();
      toast.success(`${leadToDeleteCount} lead(s) deletado(s) com sucesso!`);
    } catch (error) {
      console.error("Erro ao deletar leads:", error);
      toast.error("Erro ao deletar leads. Tente novamente.");
    }
  };

  const handleBulkChangeStatus = async (status: string) => {
    if (selectedLeads.length === 0) return;
    try {
      await apiClient.bulkUpdateLeads(selectedLeads, 'change_status', { status });
      setSelectedLeads([]);
      refetch();
      toast.success(`Status atualizado para ${selectedLeads.length} lead(s)!`);
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast.error("Erro ao alterar status. Tente novamente.");
    }
  };

  const handleBulkAddTag = async (tagId: string) => {
    if (selectedLeads.length === 0) return;
    try {
      await apiClient.bulkUpdateLeads(selectedLeads, 'add_tag', { tagId });
      setSelectedLeads([]);
      refetch();
      toast.success(`Tag adicionada a ${selectedLeads.length} lead(s)!`);
    } catch (error) {
      console.error("Erro ao adicionar tag:", error);
      toast.error("Erro ao adicionar tag. Tente novamente.");
    }
  };

  const handleBulkExportCSV = async () => {
    const selectedLeadData = filteredLeads.filter(l => selectedLeads.includes(l.id));
    if (selectedLeadData.length === 0) return;
    try {
      const { exportLeadsToExcel } = await import("../utils/excelExport");
      await exportLeadsToExcel(
        selectedLeadData,
        { status: filterStatus, source: filterSource, automation: filterAutomation, tag: filterTag, searchQuery },
        getStatusLabel,
        getSourceLabel,
        getAutomationById,
        getTagById,
      );
      toast.success(`${selectedLeadData.length} lead(s) exportado(s)!`);
    } catch (error) {
      console.error("Erro ao exportar leads:", error);
      toast.error("Erro ao exportar leads. Tente novamente.");
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Leads" subtitle="Gerencie todos os seus leads em um só lugar" />
        <PageSkeleton type="table" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Leads" subtitle="Gerencie todos os seus leads em um só lugar" />

      <div className="p-4 md:p-8">
        {/* Bulk Actions Bar */}
        {selectedLeads.length > 0 && (
          <LeadBulkActions
            selectedCount={selectedLeads.length}
            tags={tags}
            onClearSelection={() => setSelectedLeads([])}
            onChangeStatus={handleBulkChangeStatus}
            onAddTag={handleBulkAddTag}
            onExportCSV={handleBulkExportCSV}
            onDelete={() => setDeleteDialogOpen(true)}
          />
        )}

        {/* Filters Bar */}
        <LeadFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          filterSource={filterSource}
          onFilterSourceChange={setFilterSource}
          filterAutomation={filterAutomation}
          onFilterAutomationChange={setFilterAutomation}
          filterTag={filterTag}
          onFilterTagChange={setFilterTag}
          filterCustomFields={filterCustomFields}
          onFilterCustomFieldsChange={setFilterCustomFields}
          tags={tags}
          customFields={customFields}
          availableAutomations={availableAutomations}
          onImportClick={() => setImportModalOpen(true)}
          onExportCurrentPage={handleExportLeads}
          onExportAllFiltered={handleExportAllFiltered}
        />

        {/* Mobile Card View */}
        {filteredLeads.length > 0 && (
          <div className="block md:hidden">
            <LeadMobileCards
              leads={filteredLeads}
              selectedLeads={selectedLeads}
              onSelectLead={handleSelectLead}
              onDeleteLead={(id) => setDeleteSingleLeadId(id)}
              onScoreClick={(id) => setScoreLeadId(id)}
              getTagById={getTagById}
            />
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={(newPage) => fetchLeads(buildServerFilters(newPage))}
            />
          </div>
        )}

        {/* Desktop Table */}
        {filteredLeads.length > 0 ? (
          <div className="hidden md:block">
            <LeadTable
              leads={filteredLeads}
              selectedLeads={selectedLeads}
              customFields={customFields}
              expandedLeads={expandedLeads}
              onSelectAll={handleSelectAll}
              onSelectLead={handleSelectLead}
              onDeleteLead={(id) => setDeleteSingleLeadId(id)}
              onScoreClick={(id) => setScoreLeadId(id)}
              onToggleExpansion={toggleLeadExpansion}
              getTagById={getTagById}
              getAutomationById={getAutomationById}
            />
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={(newPage) => fetchLeads(buildServerFilters(newPage))}
            />
          </div>
        ) : null}

        {/* Empty State */}
        {filteredLeads.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-300">
            <EmptyState
              icon={Users}
              title="Nenhum lead encontrado"
              description="Comece adicionando seu primeiro lead ou ajuste os filtros de busca"
              actionLabel="Adicionar Lead"
              onAction={() => navigate("/app/leads/new")}
            />
          </div>
        )}
      </div>

      <LeadModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedLead(null); refetch(); }}
        lead={selectedLead || undefined}
      />

      {/* Delete Multiple Leads Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Leads Selecionados</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar {selectedLeads.length} lead{selectedLeads.length > 1 ? "s" : ""}?
              Esta ação não pode ser desfeita e os leads serão removidos permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelectedLeads} className="bg-red-600 hover:bg-red-700">Deletar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single Lead Dialog */}
      <AlertDialog open={deleteSingleLeadId !== null} onOpenChange={(open) => !open && setDeleteSingleLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este lead?
              Esta ação não pode ser desfeita e o lead será removido permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteSingleLeadId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteSingleLeadId !== null) handleDeleteLead(deleteSingleLeadId); }}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Modal */}
      <LeadImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportComplete={() => refetch()}
      />

      {/* Score Breakdown Modal */}
      <ScoreBreakdownModal
        leadId={scoreLeadId ?? ""}
        open={!!scoreLeadId}
        onClose={() => setScoreLeadId(null)}
      />
    </div>
  );
}
