import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { LeadModal } from '../components/LeadModal';
import { EmptyState } from '../components/EmptyState';
import { PageSkeleton } from '../components/PageSkeleton';
import { Users, UserCheck, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { LeadImportModal } from '../components/leads/LeadImportModal';
import { LeadBulkActions } from '../components/leads/LeadBulkActions';
import { LeadFilters } from '../components/leads/LeadFilters';
import { LeadTable } from '../components/leads/LeadTable';
import { LeadMobileCards } from '../components/leads/LeadMobileCards';
import { Pagination } from '../components/Pagination';
import { ScoreBreakdownModal } from '../components/ScoreBreakdownModal';
import { useTags } from '../contexts/TagsContext';
import { useCustomFields } from '../contexts/CustomFieldsContext';
import { useSidePanel } from '../contexts/SidePanelContext';
import { Lead } from '../types';
import { apiClient } from '../services/api/client';
import {
  handlePendingApproval,
  extractPendingApprovalFromBlob,
  notifyPendingApproval,
} from '../lib/approvalResponse';
import { useLeads } from '../hooks/useLeads';
import { mapStatusToBackend, mapSourceToBackend } from '../utils/leadEnums';
import { useSavedViews } from '../hooks/useSavedViews';
import { SavedViewsBar } from '../components/filters/SavedViewsBar';
import {
  AdvancedFilterPanel,
  type FilterCondition,
  type FieldDefinition,
} from '../components/filters/AdvancedFilterPanel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

// --- Constants ---

interface Automation {
  id: number;
  name: string;
  type: 'whatsapp' | 'email';
  status: 'active' | 'paused';
}

const availableAutomations: Automation[] = [
  { id: 1, name: 'Boas-vindas WhatsApp', type: 'whatsapp', status: 'active' },
  { id: 2, name: 'Follow-up E-mail', type: 'email', status: 'active' },
  { id: 3, name: 'Recuperação de Leads Perdidos', type: 'whatsapp', status: 'paused' },
];

const getAutomationById = (id: number): Automation | undefined => {
  return availableAutomations.find((automation) => automation.id === id);
};

// --- Component ---

type ViewTab = 'leads' | 'contacts' | 'all';

export function Leads() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getTagById, tags } = useTags();
  const { fields: customFields } = useCustomFields();
  const { openPanel } = useSidePanel();
  const {
    leads: leadsData,
    loading,
    pagination,
    deleteLead: deleteLeadAPI,
    fetchLeads,
    refetch,
  } = useLeads();
  const {
    views: savedViews,
    activeView,
    activeViewId,
    selectView: selectSavedView,
    saveView,
    updateView: updateSavedView,
    deleteView: deleteSavedView,
  } = useSavedViews('leads');

  // View tab state from URL
  const viewParam = searchParams.get('view');
  const activeTab: ViewTab =
    viewParam === 'contacts' ? 'contacts' : viewParam === 'all' ? 'all' : 'leads';

  // Convert/revert dialog state
  const [convertLeadId, setConvertLeadId] = useState<string | null>(null);
  const [revertLeadId, setRevertLeadId] = useState<string | null>(null);

  // Selection state
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterSource, setFilterSource] = useState<string[]>([]);
  const [filterAutomation, setFilterAutomation] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string[]>([]);
  const [filterCustomFields, setFilterCustomFields] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Advanced filter state
  const [advancedConditions, setAdvancedConditions] = useState<FilterCondition[]>([]);
  const [advancedLogic, setAdvancedLogic] = useState<'AND' | 'OR'>('AND');

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Server filter params ---

  const buildServerFilters = useCallback(
    (page: number = 1) => {
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
      // Apply isContact filter based on active tab
      if (activeTab === 'leads') {
        serverFilters.isContact = 'false';
      } else if (activeTab === 'contacts') {
        serverFilters.isContact = 'true';
      }
      return serverFilters;
    },
    [filterStatus, filterSource, debouncedSearch, filterTag, pagination.limit, activeTab]
  );

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

  // Fetch on filter change (including tab change)
  useEffect(() => {
    fetchLeads(buildServerFilters(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterSource, debouncedSearch, filterTag, activeTab]);

  // --- Client-side filtering ---

  const filteredLeads = leadsData.filter((lead: any) => {
    const matchesStatus = filterStatus.length <= 1 || filterStatus.includes(lead.status);
    const matchesSource = filterSource.length <= 1 || filterSource.includes(lead.source);
    const matchesTag =
      filterTag.length <= 1 ||
      (lead.tags && lead.tags.some((tagId: string) => filterTag.includes(tagId)));
    const matchesAutomation =
      filterAutomation.length === 0 ||
      filterAutomation.some((filter: string) => {
        if (filter === 'with') return lead.automations && lead.automations.length > 0;
        if (filter === 'without') return !lead.automations || lead.automations.length === 0;
        return lead.automations && lead.automations.includes(Number(filter));
      });
    const matchesCustomFields =
      Object.keys(filterCustomFields).length === 0 ||
      Object.entries(filterCustomFields).every(([fieldId, filterValue]) => {
        if (filterValue === null || filterValue === undefined || filterValue === '') return true;
        const leadValue = lead.customFields?.[fieldId];
        if (leadValue === null || leadValue === undefined || leadValue === '') return false;
        const field = customFields.find((f) => f.id === fieldId);
        if (!field) return true;
        switch (field.type) {
          case 'text':
          case 'textarea':
            return String(leadValue).toLowerCase().includes(String(filterValue).toLowerCase());
          case 'number':
            return Number(leadValue) === Number(filterValue);
          case 'date':
            return String(leadValue) === String(filterValue);
          case 'checkbox':
            return Boolean(leadValue) === Boolean(filterValue);
          case 'select':
            return String(leadValue) === String(filterValue);
          default:
            return String(leadValue) === String(filterValue);
        }
      });
    return matchesStatus && matchesSource && matchesAutomation && matchesTag && matchesCustomFields;
  });

  // --- Handlers ---

  const toggleLeadExpansion = (leadId: string) => {
    setExpandedLeads((prev) => {
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
    const filteredLeadIds = filteredLeads.map((l) => l.id);
    const allFilteredSelected = filteredLeadIds.every((id) => selectedLeads.includes(id));
    if (allFilteredSelected && filteredLeadIds.length > 0) {
      setSelectedLeads(selectedLeads.filter((id) => !filteredLeadIds.includes(id)));
    } else {
      setSelectedLeads([...new Set([...selectedLeads, ...filteredLeadIds])]);
    }
  };

  const handleSelectLead = (id: string) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter((l) => l !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  };

  // Export de leads via ENDPOINT DO SERVIDOR (Upgrade RD P1, req 15): passa pelo gate de
  // permissão/aprovação (requireApprovalFor.export) em vez de gerar o CSV no cliente (que
  // burlava o gate). Exporta os leads dos filtros ativos (o backend não escopa por IDs
  // avulsos); se o perfil exige aprovação, responde 202 → "enviado para aprovação".
  const handleServerExport = async (format: 'json' | 'csv' | 'xlsx' = 'csv') => {
    try {
      const filters: { status?: string; source?: string; search?: string; tagId?: string } = {};
      if (filterStatus.length === 1) filters.status = mapStatusToBackend(filterStatus[0]);
      if (filterSource.length === 1) filters.source = mapSourceToBackend(filterSource[0]);
      if (searchQuery) filters.search = searchQuery;
      if (filterTag.length === 1) filters.tagId = filterTag[0];

      toast.info('Exportando leads…');
      const blob = await apiClient.exportLeadsDownload(format, filters);
      const pending = await extractPendingApprovalFromBlob(blob);
      if (pending) {
        notifyPendingApproval();
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      toast.success('Leads exportados com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar leads:', error);
      toast.error('Erro ao exportar leads. Tente novamente.');
    }
  };

  // Upgrade RD P1, req 15: exportação de leads SEMPRE pelo servidor (passa pelo gate de
  // permissão/aprovação). As duas superfícies antigas (página atual / todos filtrados)
  // que geravam o arquivo no cliente foram redirecionadas para `handleServerExport`,
  // eliminando a geração client-side de CSV/XLSX de leads que burlava o gate.
  const handleExportLeads = () => handleServerExport('xlsx');
  const handleExportAllFiltered = () => handleServerExport('xlsx');

  const handleDeleteLead = async (leadId: string) => {
    try {
      await deleteLeadAPI(leadId);
      setSelectedLeads((prev) => prev.filter((id) => id !== leadId));
      if (selectedLead?.id === leadId) {
        setModalOpen(false);
        setSelectedLead(null);
      }
      setDeleteSingleLeadId(null);
    } catch (error) {
      console.error('Erro ao deletar lead:', error);
    }
  };

  const handleDeleteSelectedLeads = async () => {
    if (selectedLeads.length === 0) return;
    const leadToDeleteCount = selectedLeads.length;
    try {
      const res = await apiClient.bulkUpdateLeads(selectedLeads, 'delete');
      // Perfil exige aprovação (reqs 15/16): backend responde 202 e NÃO aplica.
      // Mostra "enviado para aprovação", mantém a seleção e NÃO recarrega como sucesso.
      if (handlePendingApproval(res)) {
        setDeleteDialogOpen(false);
        return;
      }
      if (selectedLead && selectedLeads.includes(selectedLead.id)) {
        setModalOpen(false);
        setSelectedLead(null);
      }
      setSelectedLeads([]);
      setDeleteDialogOpen(false);
      refetch();
      toast.success(`${leadToDeleteCount} lead(s) deletado(s) com sucesso!`);
    } catch (error) {
      console.error('Erro ao deletar leads:', error);
      toast.error('Erro ao deletar leads. Tente novamente.');
    }
  };

  const handleBulkChangeStatus = async (status: string) => {
    if (selectedLeads.length === 0) return;
    try {
      const res = await apiClient.bulkUpdateLeads(selectedLeads, 'change_status', { status });
      // 202 → enviado para aprovação: mantém a seleção e NÃO recarrega como sucesso.
      if (handlePendingApproval(res)) return;
      setSelectedLeads([]);
      refetch();
      toast.success(`Status atualizado para ${selectedLeads.length} lead(s)!`);
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status. Tente novamente.');
    }
  };

  const handleBulkAddTag = async (tagId: string) => {
    if (selectedLeads.length === 0) return;
    try {
      const res = await apiClient.bulkUpdateLeads(selectedLeads, 'add_tag', { tagId });
      // 202 → enviado para aprovação: mantém a seleção e NÃO recarrega como sucesso.
      if (handlePendingApproval(res)) return;
      setSelectedLeads([]);
      refetch();
      toast.success(`Tag adicionada a ${selectedLeads.length} lead(s)!`);
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
      toast.error('Erro ao adicionar tag. Tente novamente.');
    }
  };

  const handleBulkExportCSV = () => handleServerExport('csv');

  // --- Tab switching ---
  const handleTabChange = (tab: ViewTab) => {
    if (tab === 'leads') {
      setSearchParams({});
    } else {
      setSearchParams({ view: tab });
    }
    setSelectedLeads([]);
  };

  // --- Advanced Filter Fields ---
  const advancedFilterFields: FieldDefinition[] = [
    { key: 'name', label: 'Nome', type: 'text' },
    { key: 'email', label: 'E-mail', type: 'text' },
    { key: 'phone', label: 'Telefone', type: 'text' },
    { key: 'company', label: 'Empresa', type: 'text' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'NEW', label: 'Novo' },
        { value: 'CONTACTED', label: 'Em Contato' },
        { value: 'QUALIFIED', label: 'Qualificado' },
        { value: 'PROPOSAL', label: 'Proposta' },
        { value: 'NEGOTIATION', label: 'Negociacao' },
        { value: 'WON', label: 'Ganho' },
        { value: 'LOST', label: 'Perdido' },
      ],
    },
    {
      key: 'source',
      label: 'Origem',
      type: 'select',
      options: [
        { value: 'WEBSITE', label: 'Website' },
        { value: 'SOCIAL_MEDIA', label: 'Redes Sociais' },
        { value: 'REFERRAL', label: 'Indicacao' },
        { value: 'EMAIL', label: 'E-mail' },
        { value: 'PHONE', label: 'Telefone' },
        { value: 'OTHER', label: 'Outro' },
      ],
    },
    { key: 'score', label: 'Score', type: 'number' },
    { key: 'createdAt', label: 'Data de criacao', type: 'date' },
    { key: 'isContact', label: 'Contato', type: 'boolean' },
    ...customFields.map((cf) => ({
      key: `cf_${cf.id}`,
      label: cf.name,
      type: (cf.type === 'textarea'
        ? 'text'
        : cf.type === 'checkbox'
          ? 'boolean'
          : cf.type) as FieldDefinition['type'],
      options:
        cf.type === 'select' && cf.options
          ? (cf.options as { value: string; label: string }[])
          : undefined,
    })),
  ];

  // --- Saved Views ---
  const getCurrentFilters = useCallback(
    () => ({
      filterStatus,
      filterSource,
      filterAutomation,
      filterTag,
      filterCustomFields,
      searchQuery,
      advancedConditions,
      advancedLogic,
    }),
    [
      filterStatus,
      filterSource,
      filterAutomation,
      filterTag,
      filterCustomFields,
      searchQuery,
      advancedConditions,
      advancedLogic,
    ]
  );

  const applySavedViewFilters = useCallback((filters: Record<string, any>) => {
    setFilterStatus(filters.filterStatus || []);
    setFilterSource(filters.filterSource || []);
    setFilterAutomation(filters.filterAutomation || []);
    setFilterTag(filters.filterTag || []);
    setFilterCustomFields(filters.filterCustomFields || {});
    setSearchQuery(filters.searchQuery || '');
    setAdvancedConditions(filters.advancedConditions || []);
    setAdvancedLogic(filters.advancedLogic || 'AND');
  }, []);

  const handleSavedViewSelect = useCallback(
    (viewId: string | null) => {
      selectSavedView(viewId);
      if (viewId === null) {
        setFilterStatus([]);
        setFilterSource([]);
        setFilterAutomation([]);
        setFilterTag([]);
        setFilterCustomFields({});
        setSearchQuery('');
        setAdvancedConditions([]);
        setAdvancedLogic('AND');
      } else {
        const view = savedViews.find((v) => v.id === viewId);
        if (view) applySavedViewFilters(view.filters);
      }
    },
    [selectSavedView, savedViews, applySavedViewFilters]
  );

  const handleSaveCurrentView = useCallback(
    async (name: string, options?: { isDefault?: boolean; isShared?: boolean }) => {
      await saveView(name, getCurrentFilters(), options);
    },
    [saveView, getCurrentFilters]
  );

  const handleUpdateSavedView = useCallback(
    async (id: string, data: { name?: string; isDefault?: boolean; isShared?: boolean }) => {
      await updateSavedView(id, data);
    },
    [updateSavedView]
  );

  const handleDeleteSavedView = useCallback(
    async (id: string) => {
      await deleteSavedView(id);
    },
    [deleteSavedView]
  );

  // --- Convert / Revert ---
  const handleConvertToContact = async (leadId: string) => {
    try {
      await apiClient.convertToContact(leadId);
      toast.success('Lead convertido para Contato com sucesso!');
      setConvertLeadId(null);
      refetch();
    } catch (error) {
      console.error('Erro ao converter lead:', error);
      toast.error('Erro ao converter lead para contato.');
    }
  };

  const handleRevertToLead = async (leadId: string) => {
    try {
      await apiClient.revertToLead(leadId);
      toast.success('Contato revertido para Lead com sucesso!');
      setRevertLeadId(null);
      refetch();
    } catch (error) {
      console.error('Erro ao reverter contato:', error);
      toast.error('Erro ao reverter contato para lead.');
    }
  };

  // --- Render ---

  const headerTitle =
    activeTab === 'contacts' ? 'Contatos' : activeTab === 'all' ? 'Leads & Contatos' : 'Leads';
  const headerSubtitle =
    activeTab === 'contacts'
      ? 'Contatos qualificados convertidos de leads'
      : activeTab === 'all'
        ? 'Todos os leads e contatos em um só lugar'
        : 'Gerencie todos os seus leads em um só lugar';

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title={headerTitle} subtitle={headerSubtitle} />
        <PageSkeleton type="table" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title={headerTitle} subtitle={headerSubtitle} />

      <div className="p-4 md:p-8">
        {/* View Tabs + ação primária "Novo lead" */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => handleTabChange('leads')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'leads'
                  ? 'bg-card text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users size={16} />
              Leads
            </button>
            <button
              onClick={() => handleTabChange('contacts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'contacts'
                  ? 'bg-card text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserCheck size={16} />
              Contatos
            </button>
            <button
              onClick={() => handleTabChange('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-card text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Todos
            </button>
          </div>
          <Button onClick={() => navigate('/app/leads/new')} className="gap-2">
            <Plus size={16} />
            Novo lead
          </Button>
        </div>
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

        {/* Saved Views Bar */}
        <SavedViewsBar
          views={savedViews}
          activeViewId={activeViewId}
          onSelectView={handleSavedViewSelect}
          onSaveView={handleSaveCurrentView}
          onUpdateView={handleUpdateSavedView}
          onDeleteView={handleDeleteSavedView}
        />

        {/* Advanced Filter Panel */}
        <AdvancedFilterPanel
          conditions={advancedConditions}
          onConditionsChange={setAdvancedConditions}
          logic={advancedLogic}
          onLogicChange={setAdvancedLogic}
          fields={advancedFilterFields}
          onApply={() => fetchLeads(buildServerFilters(1))}
          onClear={() => {
            setAdvancedConditions([]);
            fetchLeads(buildServerFilters(1));
          }}
        />

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
          onExportServer={async (format) => {
            const filters: Record<string, string> = {};
            if (filterStatus.length === 1) filters.status = mapStatusToBackend(filterStatus[0]);
            if (filterSource.length === 1) filters.source = mapSourceToBackend(filterSource[0]);
            if (searchQuery) filters.search = searchQuery;
            if (filterTag.length === 1) filters.tagId = filterTag[0];
            return apiClient.exportLeadsDownload(format, filters);
          }}
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
              onRowClick={(id) => openPanel('lead', id)}
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
          <div className="bg-card rounded-lg shadow-sm border border-gray-300">
            <EmptyState
              icon={Users}
              title="Nenhum lead encontrado"
              description="Comece adicionando seu primeiro lead ou ajuste os filtros de busca"
              actionLabel="Adicionar Lead"
              onAction={() => navigate('/app/leads/new')}
            />
          </div>
        )}
      </div>

      <LeadModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedLead(null);
          refetch();
        }}
        lead={selectedLead || undefined}
      />

      {/* Delete Multiple Leads Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Leads Selecionados</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar {selectedLeads.length} lead
              {selectedLeads.length > 1 ? 's' : ''}? Esta ação não pode ser desfeita e os leads
              serão removidos permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelectedLeads}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single Lead Dialog */}
      <AlertDialog
        open={deleteSingleLeadId !== null}
        onOpenChange={(open) => !open && setDeleteSingleLeadId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este lead? Esta ação não pode ser desfeita e o lead
              será removido permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteSingleLeadId(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSingleLeadId !== null) handleDeleteLead(deleteSingleLeadId);
              }}
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
        leadId={scoreLeadId ?? ''}
        open={!!scoreLeadId}
        onClose={() => setScoreLeadId(null)}
      />

      {/* Convert to Contact Dialog */}
      <AlertDialog
        open={convertLeadId !== null}
        onOpenChange={(open) => !open && setConvertLeadId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Converter para Contato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja converter este lead para contato? O status sera alterado para
              WON e ele aparecera na aba "Contatos".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConvertLeadId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (convertLeadId) handleConvertToContact(convertLeadId);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Converter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert to Lead Dialog */}
      <AlertDialog
        open={revertLeadId !== null}
        onOpenChange={(open) => !open && setRevertLeadId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverter para Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja reverter este contato para lead? Ele deixara de aparecer na aba
              "Contatos".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRevertLeadId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revertLeadId) handleRevertToLead(revertLeadId);
              }}
            >
              Reverter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
