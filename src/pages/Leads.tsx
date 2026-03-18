import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { toast } from "sonner";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LeadStatusBadge } from "../components/LeadStatusBadge";
import { LeadSourceBadge } from "../components/LeadSourceBadge";
import { LeadModal } from "../components/LeadModal";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Plus, Download, Upload, Pencil, Trash2, Users, Mail, MessageSquare, X, Tag, ChevronDown, Copy } from "lucide-react";
import { LeadImportModal } from "../components/leads/LeadImportModal";
import { Checkbox } from "../components/ui/checkbox";
import { useTags } from "../contexts/TagsContext";
import { useCustomFields } from "../contexts/CustomFieldsContext";
import { TagBadge } from "../components/TagBadge";
import { CustomFieldDisplay } from "../components/CustomFieldDisplay";
import { LeadScoreBadge } from "../components/LeadScoreBadge";
import { ScoreBreakdownModal } from "../components/ScoreBreakdownModal";
import { Lead } from "../types";
import { exportLeadsToExcel } from "../utils/excelExport";
import { apiClient } from "../services/api/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useLeads } from "../hooks/useLeads";
import { mapStatusToBackend, mapSourceToBackend } from "../utils/leadEnums";
import { useFunnels } from "../hooks/useFunnels";
import { Pagination } from "../components/Pagination";
import { FilterPopover } from "../components/leads/FilterPopover";
import { CustomFieldsFilter } from "../components/leads/CustomFieldsFilter";
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

const DEFAULT_PIPELINE_COLUMNS = [
  { id: "novo", title: "Novo" },
  { id: "contato", title: "Em Contato" },
  { id: "fechado", title: "Fechado" },
];

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

export function Leads() {
  const navigate = useNavigate();
  const { getTagById } = useTags();
  const { fields: customFields } = useCustomFields();
  const { leads: leadsData, loading, pagination, deleteLead: deleteLeadAPI, fetchLeads, refetch } = useLeads();
  const { currentFunnel } = useFunnels();
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterSource, setFilterSource] = useState<string[]>([]);
  const [filterAutomation, setFilterAutomation] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string[]>([]);
  const [filterCustomFields, setFilterCustomFields] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const pipelineColumns = currentFunnel?.columns?.map(c => ({ id: c.id, title: c.title })) || DEFAULT_PIPELINE_COLUMNS;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSingleLeadId, setDeleteSingleLeadId] = useState<string | null>(null);
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [scoreLeadId, setScoreLeadId] = useState<string | null>(null);

  const { tags } = useTags();

  // Debounced search value for server-side filtering
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build server-side filter params from current state
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

  // Debounce search input — 400ms delay before sending to server
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // Send filters to server whenever they change — reset to page 1
  useEffect(() => {
    fetchLeads(buildServerFilters(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterSource, debouncedSearch, filterTag]);

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

  const hasCustomFields = (lead: Lead): boolean => {
    return lead.customFields && Object.keys(lead.customFields).length > 0 &&
           Object.values(lead.customFields).some(v => v !== null && v !== undefined && v !== "");
  };

  // Client-side filtering is only needed for filters the server doesn't support:
  // - Multiple status/source values (server only accepts one)
  // - Automation filter (not a server param)
  // - Custom fields filter (not a server param)
  // When a single value is selected for status/source/tag/search, the server already filters.
  const filteredLeads = leadsData.filter((lead: any) => {
    // Status: if multiple selected, filter client-side (server can't handle multi-status)
    const matchesStatus = filterStatus.length <= 1 || filterStatus.includes(lead.status);
    // Source: same logic
    const matchesSource = filterSource.length <= 1 || filterSource.includes(lead.source);
    // Tag: if multiple tags selected, filter client-side
    const matchesTag = filterTag.length <= 1 ||
      (lead.tags && lead.tags.some((tagId: string) => filterTag.includes(tagId)));
    // Automation: always client-side (server doesn't support)
    const matchesAutomation = filterAutomation.length === 0 ||
      filterAutomation.some(filter => {
        if (filter === "with") return lead.automations && lead.automations.length > 0;
        if (filter === "without") return !lead.automations || lead.automations.length === 0;
        return lead.automations && lead.automations.includes(Number(filter));
      });
    // Custom fields: always client-side (server doesn't support)
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

      // Map server data to the format expected by exportLeadsToExcel
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

      <div className="p-8">
        {/* Bulk Actions Bar */}
        {selectedLeads.length > 0 && (
          <div className="bg-primary text-white rounded-lg p-4 shadow-sm border border-primary mb-4" role="status" aria-live="polite">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="font-medium">
                  {selectedLeads.length} lead{selectedLeads.length > 1 ? "s" : ""} selecionado{selectedLeads.length > 1 ? "s" : ""}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLeads([])}
                  className="text-white hover:bg-white/20 h-8 px-2"
                >
                  <X size={14} />
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" className="gap-1">
                      Status <ChevronDown size={14} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkChangeStatus("NEW")}>Novo</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkChangeStatus("CONTACTED")}>Contatado</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkChangeStatus("QUALIFIED")}>Qualificado</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkChangeStatus("PROPOSAL")}>Proposta</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkChangeStatus("NEGOTIATION")}>Negociacao</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkChangeStatus("WON")}>Ganho</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkChangeStatus("LOST")}>Perdido</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Tag Dropdown */}
                {tags.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="sm" className="gap-1">
                        <Tag size={14} /> Tag <ChevronDown size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {tags.map(tag => (
                        <DropdownMenuItem key={tag.id} onClick={() => handleBulkAddTag(tag.id)}>
                          <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Export CSV */}
                <Button variant="secondary" size="sm" className="gap-1" onClick={handleBulkExportCSV}>
                  <Download size={14} /> Exportar CSV
                </Button>

                {/* Delete */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="bg-red-600 hover:bg-red-700 gap-1"
                >
                  <Trash2 size={14} />
                  Deletar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Actions Bar with Filters */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-300 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por nome, telefone ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <FilterPopover
              filterId="status"
              label="Filtrar por Status"
              allLabel="Todos os status"
              countSuffix="status"
              options={[
                { value: "novo", label: "Novo" },
                { value: "contato", label: "Em Contato" },
                { value: "fechado", label: "Fechado" },
                { value: "perdido", label: "Perdido" },
              ]}
              selected={filterStatus}
              onChange={setFilterStatus}
            />

            <FilterPopover
              filterId="source"
              label="Filtrar por Origem"
              allLabel="Todas as origens"
              countSuffix="origem(s)"
              options={[
                { value: "meta", label: "Meta Ads" },
                { value: "google", label: "Google Ads" },
                { value: "organico", label: "Orgânico" },
                { value: "manual", label: "Manual" },
              ]}
              selected={filterSource}
              onChange={setFilterSource}
            />

            <FilterPopover
              filterId="automation"
              label="Filtrar por Automação"
              allLabel="Todas as automações"
              countSuffix="automação(ões)"
              options={[
                { value: "with", label: "Com automações" },
                { value: "without", label: "Sem automações" },
                ...availableAutomations.map(a => ({ value: a.id.toString(), label: a.name }))
              ]}
              selected={filterAutomation}
              onChange={setFilterAutomation}
              showSelectAll={false}
            />

            <FilterPopover
              filterId="tag"
              label="Filtrar por Tag"
              allLabel="Todas as tags"
              countSuffix="tag(s)"
              options={tags.map(t => ({ value: t.id, label: t.name }))}
              selected={filterTag}
              onChange={setFilterTag}
            />

            <CustomFieldsFilter
              customFields={customFields}
              filterCustomFields={filterCustomFields}
              onFilterChange={setFilterCustomFields}
            />

            <Button variant="outline" className="gap-2" onClick={() => navigate("/app/leads/duplicates")}>
              <Copy size={16} />
              Duplicados
            </Button>

            <Button variant="outline" className="gap-2" onClick={() => setImportModalOpen(true)}>
              <Upload size={16} />
              Importar
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download size={16} />
                  Exportar
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportLeads}>
                  Exportar Pagina Atual
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportAllFiltered}>
                  Exportar Todos (Filtrados)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              className="bg-primary hover:bg-primary-dark gap-2"
              onClick={() => navigate("/app/leads/new")}
            >
              <Plus size={16} />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Table */}
        {filteredLeads.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Lista de leads">
                <thead className="bg-gray-100 border-b border-gray-300">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left">
                      <Checkbox
                        checked={filteredLeads.length > 0 && filteredLeads.every(lead => selectedLeads.includes(lead.id))}
                        onCheckedChange={handleSelectAll}
                        aria-label="Selecionar todos os leads"
                      />
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Nome</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden md:table-cell">Telefone</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden md:table-cell">E-mail</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Score</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden lg:table-cell">Origem</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden lg:table-cell">Tags</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden xl:table-cell">Automações</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden lg:table-cell">Data</th>
                    {customFields.length > 0 && (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden xl:table-cell">Campos Customizados</th>
                    )}
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {filteredLeads.map((lead) => (
                    <React.Fragment key={lead.id}>
                      <tr className="hover:bg-gray-100 transition-colors">
                        <td className="px-6 py-4">
                          <Checkbox checked={selectedLeads.includes(lead.id)} onCheckedChange={() => handleSelectLead(lead.id)} aria-label={`Selecionar ${lead.name}`} />
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            to={`/app/leads/${lead.id}`}
                            className="font-medium text-gray-900 hover:text-primary hover:underline transition-colors"
                          >
                            {lead.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-gray-600 hidden md:table-cell">{lead.phone}</td>
                        <td className="px-6 py-4 text-gray-600 hidden md:table-cell">{lead.email}</td>
                        <td className="px-6 py-4">
                          <button type="button" onClick={() => setScoreLeadId(lead.id)} className="cursor-pointer">
                            <LeadScoreBadge score={lead.score || 0} />
                          </button>
                        </td>
                        <td className="px-6 py-4"><LeadStatusBadge status={lead.status} /></td>
                        <td className="px-6 py-4 hidden lg:table-cell"><LeadSourceBadge source={lead.source} /></td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          {lead.tags && lead.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {lead.tags.slice(0, 3).map((tagId: string) => {
                                const tag = getTagById(tagId);
                                if (!tag) return null;
                                return <TagBadge key={tagId} tag={tag} size="sm" />;
                              })}
                              {lead.tags.length > 3 && (
                                <span className="text-xs text-gray-600">+{lead.tags.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 hidden xl:table-cell">
                          {lead.automations && lead.automations.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {lead.automations.slice(0, 2).map((automationId: number) => {
                                const automation = getAutomationById(automationId);
                                if (!automation) return null;
                                return (
                                  <div
                                    key={automationId}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                                      automation.type === "whatsapp"
                                        ? "bg-green-50 text-green-700 border border-green-200"
                                        : "bg-blue-50 text-blue-700 border border-blue-200"
                                    }`}
                                    title={automation.name}
                                  >
                                    {automation.type === "whatsapp" ? <MessageSquare size={12} className="flex-shrink-0" /> : <Mail size={12} className="flex-shrink-0" />}
                                    <span className="whitespace-nowrap">
                                      {automation.name.length > 15 ? automation.name.substring(0, 15) + "..." : automation.name}
                                    </span>
                                  </div>
                                );
                              })}
                              {lead.automations.length > 2 && (
                                <div className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200" title={`Mais ${lead.automations.length - 2} automação(ões)`}>
                                  +{lead.automations.length - 2}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 hidden lg:table-cell">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('pt-BR') : '-'}</td>
                        {customFields.length > 0 && (
                          <td className="px-6 py-4 hidden xl:table-cell">
                            {hasCustomFields(lead) ? (
                              <div className="flex items-center gap-2">
                                <div className="flex flex-wrap gap-1.5 max-w-xs">
                                  {customFields.slice(0, 2).map((field) => {
                                    const value = lead.customFields?.[field.id];
                                    if (!value || value === "" || value === null || value === undefined) return null;
                                    return (
                                      <div key={field.id} className="text-xs px-2 py-1 bg-gray-100 border border-gray-300 rounded text-gray-600" title={`${field.name}: ${value}`}>
                                        <span className="font-medium">{field.name}:</span>{" "}
                                        <span className="text-gray-900">
                                          {typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value).substring(0, 15)}
                                          {String(value).length > 15 ? "..." : ""}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {customFields.filter(f => {
                                    const value = lead.customFields?.[f.id];
                                    return value && value !== "" && value !== null && value !== undefined;
                                  }).length > 2 && (
                                    <button
                                      onClick={() => toggleLeadExpansion(lead.id)}
                                      className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                                    >
                                      {expandedLeads.has(lead.id) ? "Ocultar" : "Ver mais"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/app/leads/${lead.id}/edit`); }}
                              className="p-1.5 hover:bg-gray-300 rounded transition-colors"
                              type="button"
                              aria-label={`Editar ${lead.name}`}
                            >
                              <Pencil size={16} className="text-gray-600" />
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteSingleLeadId(lead.id); }}
                              className="p-1.5 hover:bg-red-50 rounded transition-colors"
                              type="button"
                              aria-label={`Deletar ${lead.name}`}
                            >
                              <Trash2 size={16} className="text-error" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedLeads.has(lead.id) && hasCustomFields(lead) && (
                        <tr className="bg-gray-100">
                          <td colSpan={customFields.length > 0 ? 12 : 11} className="px-6 py-4">
                            <div className="space-y-3">
                              <h4 className="text-sm font-medium text-gray-900 mb-2">Campos Customizados</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {customFields.map((field) => {
                                  const value = lead.customFields?.[field.id];
                                  if (!value && value !== false && value !== 0) return null;
                                  return <CustomFieldDisplay key={field.id} field={field} value={value} mode="full" showLabel={true} />;
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={(newPage) => fetchLeads(buildServerFilters(newPage))}
            />
          </div>
        ) : (
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
