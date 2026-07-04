import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQueryState } from 'nuqs';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { DataTable } from '../components/ui/data-table';
import { getDealColumns } from '../components/deals/dealColumns';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { DealStageBadge } from '../components/deals/DealStageBadge';
import { DealForm } from '../components/deals/DealForm';
import { MultiSaleDialog } from '../components/deals/MultiSaleDialog';
import { CelebrationModal } from '../components/deals/CelebrationModal';
import { DealPipelineBoard } from '../components/deals/DealPipelineBoard';
import { PageSkeleton } from '../components/PageSkeleton';
import { EmptyState } from '../components/EmptyState';
import { useDeals } from '../hooks/useDeals';
import { useDealsPipeline } from '../hooks/useDealsPipeline';
import { useSidePanel } from '../contexts/SidePanelContext';
import { Deal, DealStage } from '../types';
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
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { ExportButton } from '../components/ExportButton';
import { apiClient } from '../services/api/client';
import { useSavedViews } from '../hooks/useSavedViews';
import { SavedViewsBar } from '../components/filters/SavedViewsBar';
import {
  AdvancedFilterPanel,
  type FilterCondition,
  type FieldDefinition,
} from '../components/filters/AdvancedFilterPanel';
import { useQualificationConfig } from '../components/deals/QualificationStars';

// Filtro por qualificação (mínimo de estrelas) — lista e pipeline (Upgrade RD P0, req 1).
const QUALIFICATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Qualquer qualificação' },
  { value: '1', label: '1+ estrelas' },
  { value: '2', label: '2+ estrelas' },
  { value: '3', label: '3+ estrelas' },
  { value: '4', label: '4+ estrelas' },
  { value: '5', label: '5 estrelas' },
];

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Todos os Stages' },
  { value: 'QUALIFICATION', label: 'Qualificação' },
  { value: 'PROPOSAL', label: 'Proposta' },
  { value: 'NEGOTIATION', label: 'Negociação' },
  { value: 'CLOSING', label: 'Fechamento' },
  { value: 'WON', label: 'Ganho' },
  { value: 'LOST', label: 'Perdido' },
];

function formatDate(date: string | null | undefined): string {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('pt-BR');
}

export function Deals() {
  const navigate = useNavigate();
  const { openPanel } = useSidePanel();
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

  const {
    views: savedViews,
    activeViewId: dealsActiveViewId,
    selectView: selectDealView,
    saveView,
    updateView: updateSavedView,
    deleteView: deleteSavedView,
  } = useSavedViews('deals');

  // Advanced filter state for deals
  const [advancedConditions, setAdvancedConditions] = useState<FilterCondition[]>([]);
  const [advancedLogic, setAdvancedLogic] = useState<'AND' | 'OR'>('AND');

  const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');
  // Filtros refletidos na URL (view filtrada compartilhável/bookmarkável)
  const [search, setSearch] = useQueryState('q', { defaultValue: '' });
  const [stageFilter, setStageFilter] = useQueryState('stage', { defaultValue: 'ALL' });
  // Filtros P0 (reqs 1 e 6): qualificação mínima (N+ estrelas), fonte e campanha
  // — enviados ao servidor; total/paginação refletem o filtro.
  const [qualFilter, setQualFilter] = useQueryState('qual', { defaultValue: 'ALL' });
  const [sourceFilter, setSourceFilter] = useQueryState('fonte', { defaultValue: 'ALL' });
  const [campaignFilter, setCampaignFilter] = useQueryState('campanha', { defaultValue: 'ALL' });

  // Config de qualificação (nomes dos níveis) + fontes/campanhas do tenant.
  const { data: qualConfig } = useQualificationConfig();
  const { data: dealSources = [] } = useQuery({
    queryKey: ['deal-sources', 'active'],
    queryFn: () => apiClient.getDealSources(true).then((r) => r.data || []),
    staleTime: 5 * 60 * 1000,
  });
  const { data: originCampaigns = [] } = useQuery({
    queryKey: ['origin-campaigns', 'active'],
    queryFn: () => apiClient.getOriginCampaigns(true).then((r) => r.data || []),
    staleTime: 5 * 60 * 1000,
  });

  // Flags do tenant p/ multi-vendas (req 4) e comemoração (req 11) — mesmas do DealDetail.
  const { data: salesFlags } = useQuery({
    queryKey: ['sales-flags'],
    queryFn: () => apiClient.getSalesFlags().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const celebrationEnabled = salesFlags?.celebrationEnabled ?? true;
  const multiSalesEnabled = salesFlags?.multiSalesEnabled ?? false;

  // Fluxo de fechamento pelo formulário de edição (reqs 3, 12): guarda o deal
  // recém-fechado para encadear celebração (GANHO) → multi-venda.
  const [closedDeal, setClosedDeal] = useState<Deal | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [multiSaleOpen, setMultiSaleOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);

  // Pipeline funnel management state
  const [createFunnelOpen, setCreateFunnelOpen] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState('');
  const [deleteFunnelId, setDeleteFunnelId] = useState<string | null>(null);
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);
  const [editingFunnelName, setEditingFunnelName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Filtros da visão pipeline (req 37) — aplicados client-side sobre as colunas do funil.
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [pipelineAssignee, setPipelineAssignee] = useState('ALL');
  const [pipelineStatus, setPipelineStatus] = useState('ALL');
  const [pipelineSort, setPipelineSort] = useState('default');
  // Qualificação mínima no pipeline (Upgrade RD P0, req 1).
  const [pipelineQualification, setPipelineQualification] = useState('ALL');
  // Fonte/campanha no pipeline (Upgrade RD P0, req 5) — client-side sobre as
  // colunas do funil (o pipeline carrega todos os deals do funil).
  const [pipelineSource, setPipelineSource] = useState('ALL');
  const [pipelineCampaign, setPipelineCampaign] = useState('ALL');

  const pipelineAssignees = useMemo(() => {
    const map = new Map<string, string>();
    dealColumns.forEach((col) =>
      col.deals.forEach((d) => {
        if (d.assignedUser?.id) map.set(d.assignedUser.id, d.assignedUser.name);
      })
    );
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [dealColumns]);

  const filteredDealColumns = useMemo(() => {
    const q = pipelineSearch.trim().toLowerCase();
    return dealColumns.map((col) => {
      let ds = col.deals;
      if (q) {
        ds = ds.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            (d.lead?.name || '').toLowerCase().includes(q) ||
            (d.lead?.company || '').toLowerCase().includes(q)
        );
      }
      if (pipelineAssignee !== 'ALL') {
        ds = ds.filter((d) =>
          pipelineAssignee === 'NONE'
            ? !d.assignedUser
            : d.assignedUser?.id === pipelineAssignee
        );
      }
      if (pipelineStatus !== 'ALL') {
        ds = ds.filter((d) => (d.status || 'OPEN') === pipelineStatus);
      }
      if (pipelineQualification !== 'ALL') {
        const min = Number(pipelineQualification);
        ds = ds.filter((d) => (d.qualification || 0) >= min);
      }
      if (pipelineSource !== 'ALL') {
        ds = ds.filter(
          (d) => (d as unknown as Record<string, unknown>).sourceId === pipelineSource
        );
      }
      if (pipelineCampaign !== 'ALL') {
        ds = ds.filter(
          (d) => (d as unknown as Record<string, unknown>).originCampaignId === pipelineCampaign
        );
      }
      if (pipelineSort !== 'default') {
        ds = [...ds].sort((a, b) => {
          switch (pipelineSort) {
            case 'value_desc':
              return Number(b.value) - Number(a.value);
            case 'value_asc':
              return Number(a.value) - Number(b.value);
            case 'qualification_desc':
              return (b.qualification || 0) - (a.qualification || 0);
            case 'created_desc':
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            case 'created_asc':
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            default:
              return 0;
          }
        });
      }
      return { ...col, deals: ds };
    });
  }, [
    dealColumns,
    pipelineSearch,
    pipelineAssignee,
    pipelineStatus,
    pipelineSort,
    pipelineQualification,
    pipelineSource,
    pipelineCampaign,
  ]);

  // Monta os filtros server-side da lista (reqs 1, 6): busca + stage + qualificação
  // (N+ estrelas, semântica gte no backend) + fonte + campanha. `page` sempre explícito.
  const buildListFilters = useCallback(
    (page: number): Record<string, string | number> => {
      const filters: Record<string, string | number> = { page };
      if (search.trim()) filters.search = search.trim();
      if (stageFilter !== 'ALL') filters.stage = stageFilter;
      if (qualFilter !== 'ALL') filters.qualification = Number(qualFilter);
      if (sourceFilter !== 'ALL') filters.sourceId = sourceFilter;
      if (campaignFilter !== 'ALL') filters.originCampaignId = campaignFilter;
      return filters;
    },
    [search, stageFilter, qualFilter, sourceFilter, campaignFilter]
  );

  const handleSearch = useCallback(() => {
    fetchDeals(buildListFilters(1));
  }, [fetchDeals, buildListFilters]);

  const handleStageChange = useCallback(
    (value: string) => {
      setStageFilter(value);
      const filters = buildListFilters(1);
      // buildListFilters usa o stageFilter anterior; sobrescreve com o novo valor.
      if (value !== 'ALL') filters.stage = value;
      else delete filters.stage;
      fetchDeals(filters);
    },
    [fetchDeals, buildListFilters, setStageFilter]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      fetchDeals(buildListFilters(page));
    },
    [fetchDeals, buildListFilters]
  );

  // Filtrar ao digitar (busca) OU ao trocar qualquer filtro server-side da lista:
  // refaz a busca (server-side) com debounce, resetando para a página 1.
  useEffect(() => {
    const t = setTimeout(() => fetchDeals(buildListFilters(1)), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, qualFilter, sourceFilter, campaignFilter]);

  const handleSave = async (data: any) => {
    if (editingDeal) {
      // Detecta transição de etapa para GANHO/PERDA (reqs 3, 12).
      const prevStage = editingDeal.stage;
      const newStage = data.stage as DealStage | undefined;
      const closingWon = newStage === 'WON' && prevStage !== 'WON';
      const closingLost = newStage === 'LOST' && prevStage !== 'LOST';
      const updated = await updateDeal(editingDeal.id, data);
      // Após salvar com sucesso, encadeia celebração/multi-venda (reusa os
      // componentes do DealDetail). GANHO: celebração (se habilitada) → multi-venda;
      // PERDA: multi-venda direto (se habilitada).
      const closedFor = (updated as Deal) ?? { ...editingDeal, ...data };
      if (closingWon) {
        setClosedDeal(closedFor);
        if (celebrationEnabled) setCelebrationOpen(true);
        else if (multiSalesEnabled) setMultiSaleOpen(true);
      } else if (closingLost && multiSalesEnabled) {
        setClosedDeal(closedFor);
        setMultiSaleOpen(true);
      }
    } else {
      // When in pipeline view, auto-assign to current funnel
      const saveData = { ...data };
      if (viewMode === 'pipeline' && currentDealFunnelId && !saveData.funnelId) {
        saveData.funnelId = currentDealFunnelId;
      }
      await createDeal(saveData);
    }
    // Refresh pipeline view
    if (viewMode === 'pipeline' && currentDealFunnelId) {
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
    if (viewMode === 'pipeline' && currentDealFunnelId) {
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
    const duplicate = dealFunnels.find((f) => f.name.toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
      setErrorMessage(`Já existe um pipeline com o nome "${duplicate.name}".`);
      return;
    }
    setErrorMessage('');
    try {
      const newFunnel = await createDealFunnel(trimmedName);
      setNewFunnelName('');
      setCreateFunnelOpen(false);
      if (newFunnel) {
        switchDealFunnel(newFunnel.id);
      }
    } catch {
      setErrorMessage('Erro ao criar pipeline.');
    }
  };

  const handleDeleteFunnel = async () => {
    if (!deleteFunnelId) return;
    const funnel = dealFunnels.find((f) => f.id === deleteFunnelId);
    if (!funnel) return;
    if (funnel.isDefault) {
      setErrorMessage('Não é possível deletar o pipeline padrão.');
      setDeleteFunnelId(null);
      return;
    }
    try {
      await deleteDealFunnel(deleteFunnelId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao deletar pipeline.');
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
    setErrorMessage('');
    try {
      await updateDealFunnel(editingFunnelId, { name: trimmedName });
    } catch {
      setErrorMessage('Erro ao renomear pipeline.');
    }
    setEditingFunnelId(null);
    setEditingFunnelName('');
  };

  const handleCancelEditFunnel = () => {
    setEditingFunnelId(null);
    setEditingFunnelName('');
    setErrorMessage('');
  };

  // Advanced filter field definitions for deals
  const dealFilterFields: FieldDefinition[] = [
    { key: 'name', label: 'Nome', type: 'text' },
    { key: 'value', label: 'Valor', type: 'number' },
    {
      key: 'stage',
      label: 'Stage',
      type: 'select',
      options: STAGE_OPTIONS.filter((o) => o.value !== 'ALL'),
    },
    { key: 'probability', label: 'Probabilidade (%)', type: 'number' },
    { key: 'expectedCloseDate', label: 'Data de Fechamento', type: 'date' },
    { key: 'notes', label: 'Notas', type: 'text' },
  ];

  // Saved Views helpers
  const getCurrentDealFilters = useCallback(
    () => ({
      search,
      stageFilter,
      advancedConditions,
      advancedLogic,
    }),
    [search, stageFilter, advancedConditions, advancedLogic]
  );

  const applyDealSavedViewFilters = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- deps manuais [fetchDeals] são intencionais; setSearch/setStageFilter (setters estáveis) são omitidos de propósito
    (filters: Record<string, any>) => {
      setSearch(filters.search || '');
      setStageFilter(filters.stageFilter || 'ALL');
      setAdvancedConditions(filters.advancedConditions || []);
      setAdvancedLogic(filters.advancedLogic || 'AND');
      const newFilters: any = { page: 1 };
      if (filters.search?.trim()) newFilters.search = filters.search.trim();
      if (filters.stageFilter && filters.stageFilter !== 'ALL')
        newFilters.stage = filters.stageFilter;
      fetchDeals(newFilters);
    },
    [fetchDeals]
  );

  const handleDealViewSelect = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- deps manuais são intencionais; setSearch/setStageFilter (setters estáveis) são omitidos de propósito
    (viewId: string | null) => {
      selectDealView(viewId);
      if (viewId === null) {
        setSearch('');
        setStageFilter('ALL');
        setAdvancedConditions([]);
        setAdvancedLogic('AND');
        fetchDeals({ page: 1 });
      } else {
        const view = savedViews.find((v) => v.id === viewId);
        if (view) applyDealSavedViewFilters(view.filters);
      }
    },
    [selectDealView, savedViews, applyDealSavedViewFilters, fetchDeals]
  );

  const handleSaveDealView = useCallback(
    async (name: string, options?: { isDefault?: boolean; isShared?: boolean }) => {
      await saveView(name, getCurrentDealFilters(), options);
    },
    [saveView, getCurrentDealFilters]
  );

  const handleUpdateDealView = useCallback(
    async (id: string, data: { name?: string; isDefault?: boolean; isShared?: boolean }) => {
      await updateSavedView(id, data);
    },
    [updateSavedView]
  );

  const handleDeleteDealView = useCallback(
    async (id: string) => {
      await deleteSavedView(id);
    },
    [deleteSavedView]
  );

  // Column defs for the deals list table (handlers use stable setters)
  const dealTableColumns = useMemo(
    () =>
      getDealColumns(
        {
          onEdit: handleEdit,
          onDelete: (deal: Deal) => {
            setDealToDelete(deal);
            setDeleteDialogOpen(true);
          },
        },
        qualConfig?.levels
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers usam setters estáveis
    [qualConfig?.levels]
  );

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
            {viewMode === 'list' && (
              <>
                <div className="relative flex-1 max-w-sm">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    aria-hidden="true"
                  />
                  <Input
                    placeholder="Buscar deals..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                    aria-label="Buscar deals"
                  />
                </div>
                <Select value={stageFilter} onValueChange={handleStageChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={qualFilter} onValueChange={setQualFilter}>
                  <SelectTrigger className="w-[190px]" aria-label="Filtrar por qualificação">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALIFICATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[170px]" aria-label="Filtrar por fonte">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas as fontes</SelectItem>
                    {dealSources.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                  <SelectTrigger className="w-[190px]" aria-label="Filtrar por campanha">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas as campanhas</SelectItem>
                    {originCampaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
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
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                title="Lista"
                aria-label="Visualização em lista"
                aria-pressed={viewMode === 'list'}
              >
                <List size={16} aria-hidden="true" />
              </button>
              <button
                onClick={() => setViewMode('pipeline')}
                className={`p-1.5 rounded ${viewMode === 'pipeline' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                title="Pipeline"
                aria-label="Visualização em pipeline"
                aria-pressed={viewMode === 'pipeline'}
              >
                <LayoutGrid size={16} aria-hidden="true" />
              </button>
            </div>

            {viewMode === 'list' && (
              <ExportButton
                onExport={async (format) => {
                  const filters: Record<string, string> = {};
                  if (search.trim()) filters.search = search.trim();
                  if (stageFilter !== 'ALL') filters.stage = stageFilter;
                  return apiClient.exportDealsDownload(format, filters);
                }}
                filename="deals-export"
                label="Exportar"
              />
            )}

            <Button
              onClick={() => {
                setEditingDeal(null);
                setFormOpen(true);
              }}
              className="gap-2"
            >
              <Plus size={16} />
              Novo Deal
            </Button>
          </div>
        </div>

        {/* Saved Views Bar */}
        {viewMode === 'list' && (
          <SavedViewsBar
            views={savedViews}
            activeViewId={dealsActiveViewId}
            onSelectView={handleDealViewSelect}
            onSaveView={handleSaveDealView}
            onUpdateView={handleUpdateDealView}
            onDeleteView={handleDeleteDealView}
          />
        )}

        {/* Advanced Filter Panel */}
        {viewMode === 'list' && (
          <AdvancedFilterPanel
            conditions={advancedConditions}
            onConditionsChange={setAdvancedConditions}
            logic={advancedLogic}
            onLogicChange={setAdvancedLogic}
            fields={dealFilterFields}
            onApply={handleSearch}
            onClear={() => {
              setAdvancedConditions([]);
              handleSearch();
            }}
          />
        )}

        {/* Pipeline Funnel Selector (shown only in pipeline view) */}
        {viewMode === 'pipeline' && (
          <div className="mb-6 bg-card rounded-lg p-4 shadow-sm border border-gray-300">
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
                          setErrorMessage('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditFunnel();
                          if (e.key === 'Escape') handleCancelEditFunnel();
                        }}
                        className={`h-8 text-sm flex-1 ${errorMessage ? 'border-red-500' : ''}`}
                        // eslint-disable-next-line jsx-a11y/no-autofocus -- foco inicial intencional ao entrar em modo de edição inline
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveEditFunnel}
                        className="h-8 w-8 p-0"
                      >
                        <Check size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEditFunnel}
                        className="h-8 w-8 p-0"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <select
                        value={currentDealFunnelId || ''}
                        onChange={(e) => switchDealFunnel(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        {dealFunnels.map((funnel) => (
                          <option key={funnel.id} value={funnel.id}>
                            {funnel.name} {funnel.isDefault ? '(Padrão)' : ''}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleStartEditFunnel(currentDealFunnelId!, currentDealFunnel?.name || '')
                        }
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

        {/* Filtros da visão pipeline (req 37) — responsável, status, ordenação e busca */}
        {viewMode === 'pipeline' && (
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar no funil..."
                value={pipelineSearch}
                onChange={(e) => setPipelineSearch(e.target.value)}
                className="pl-10"
                aria-label="Buscar negociações no funil"
              />
            </div>
            <Select value={pipelineAssignee} onValueChange={setPipelineAssignee}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos responsáveis</SelectItem>
                <SelectItem value="NONE">Sem responsável</SelectItem>
                {pipelineAssignees.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={pipelineStatus} onValueChange={setPipelineStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="OPEN">Em andamento</SelectItem>
                <SelectItem value="WON">Ganho</SelectItem>
                <SelectItem value="LOST">Perdido</SelectItem>
                <SelectItem value="PAUSED">Pausado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pipelineQualification} onValueChange={setPipelineQualification}>
              <SelectTrigger className="w-[190px]" aria-label="Filtrar por qualificação">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALIFICATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={pipelineSource} onValueChange={setPipelineSource}>
              <SelectTrigger className="w-[170px]" aria-label="Filtrar por fonte">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as fontes</SelectItem>
                {dealSources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={pipelineCampaign} onValueChange={setPipelineCampaign}>
              <SelectTrigger className="w-[190px]" aria-label="Filtrar por campanha">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as campanhas</SelectItem>
                {originCampaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={pipelineSort} onValueChange={setPipelineSort}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Ordem padrão</SelectItem>
                <SelectItem value="value_desc">Maior valor</SelectItem>
                <SelectItem value="value_asc">Menor valor</SelectItem>
                <SelectItem value="qualification_desc">Maior qualificação</SelectItem>
                <SelectItem value="created_desc">Mais recentes</SelectItem>
                <SelectItem value="created_asc">Mais antigas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Content */}
        {viewMode === 'pipeline' ? (
          pipelineLoading ? (
            <PageSkeleton type="table" />
          ) : (
            <DealPipelineBoard
              deals={deals}
              onStageChange={handleStageUpdate}
              onEdit={handleEdit}
              onClick={(deal) => navigate(`/app/deals/${deal.id}`)}
              funnelColumns={filteredDealColumns}
              onMoveDeal={moveDealInPipeline}
            />
          )
        ) : (
          <>
            {/* Table */}
            <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-300 overflow-hidden">
              <div className="overflow-x-auto">
                <DataTable
                  columns={dealTableColumns}
                  data={deals}
                  onRowClick={(deal) => openPanel('deal', deal.id)}
                  emptyState={
                    <EmptyState
                      icon={Handshake}
                      title={
                        search.trim() ||
                        stageFilter !== 'ALL' ||
                        qualFilter !== 'ALL' ||
                        sourceFilter !== 'ALL' ||
                        campaignFilter !== 'ALL'
                          ? 'Nenhum deal encontrado'
                          : 'Nenhum deal criado'
                      }
                      description={
                        search.trim() ||
                        stageFilter !== 'ALL' ||
                        qualFilter !== 'ALL' ||
                        sourceFilter !== 'ALL' ||
                        campaignFilter !== 'ALL'
                          ? 'Tente ajustar os filtros ou termos de busca'
                          : 'Comece adicionando seu primeiro deal para gerenciar seu pipeline de vendas'
                      }
                      actionLabel="Novo Deal"
                      onAction={() => {
                        setEditingDeal(null);
                        setFormOpen(true);
                      }}
                    />
                  }
                />
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <span className="text-sm text-gray-600">
                    {pagination.total} deal{pagination.total !== 1 ? 's' : ''} &bull; Página{' '}
                    {pagination.page} de {pagination.totalPages}
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
        onClose={() => {
          setFormOpen(false);
          setEditingDeal(null);
        }}
        onSave={handleSave}
        deal={editingDeal}
        defaultFunnelId={viewMode === 'pipeline' ? currentDealFunnelId || undefined : undefined}
      />

      {/* Delete Deal Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o deal &quot;{dealToDelete?.name}&quot;? Esta ação não
              pode ser desfeita.
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
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader className="text-left space-y-0 pb-4">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Criar Novo Pipeline
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="new-funnel-name"
                className="text-sm font-medium text-gray-900 mb-2 block"
              >
                Nome do Pipeline
              </label>
              <Input
                id="new-funnel-name"
                value={newFunnelName}
                onChange={(e) => {
                  setNewFunnelName(e.target.value);
                  setErrorMessage('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFunnel();
                }}
                placeholder="Ex: Enterprise Sales"
                className={errorMessage && !editingFunnelId ? 'border-red-500' : ''}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- foco inicial intencional ao abrir o diálogo de criação de pipeline
                autoFocus
              />
              {errorMessage && !editingFunnelId && (
                <p className="text-xs text-red-600 mt-2">{errorMessage}</p>
              )}
              <p className="text-xs text-gray-600 mt-2">
                O pipeline será criado com colunas padrão (Qualificação, Proposta, Negociação,
                Fechamento, Ganho, Perdido).
              </p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setCreateFunnelOpen(false);
                setNewFunnelName('');
                setErrorMessage('');
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
      <AlertDialog
        open={deleteFunnelId !== null}
        onOpenChange={(open) => !open && setDeleteFunnelId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFunnelId &&
                (() => {
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
            <AlertDialogCancel onClick={() => setDeleteFunnelId(null)}>Cancelar</AlertDialogCancel>
            {deleteFunnelId &&
              (() => {
                const funnel = dealFunnels.find((f) => f.id === deleteFunnelId);
                return (
                  funnel &&
                  !funnel.isDefault && (
                    <AlertDialogAction
                      onClick={handleDeleteFunnel}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Deletar
                    </AlertDialogAction>
                  )
                );
              })()}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fechamento pelo formulário (reqs 3, 11, 12) — celebração encadeia multi-venda */}
      <CelebrationModal
        open={celebrationOpen}
        onClose={() => {
          setCelebrationOpen(false);
          if (multiSalesEnabled) setMultiSaleOpen(true);
        }}
      />
      {closedDeal && (
        <MultiSaleDialog
          open={multiSaleOpen}
          onClose={() => setMultiSaleOpen(false)}
          deal={closedDeal}
        />
      )}
    </div>
  );
}
