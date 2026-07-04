import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { apiClient } from '../services/api/client';
import {
  RefreshCw,
  AlertTriangle,
  Filter,
  ArrowRight,
  Users,
  Percent,
  TrendingDown,
} from 'lucide-react';
import { PageSkeleton } from '../components/PageSkeleton';
import { FunnelChart } from '../components/forecast/FunnelChart';
import { useFunnelConversion } from '../hooks/useFunnelConversion';

const STAGE_NAMES: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contato',
  QUALIFIED: 'Qualificado',
  PROPOSAL: 'Proposta',
  NEGOTIATION: 'Negociação',
  WON: 'Ganho',
  LOST: 'Perdido',
};

const SOURCE_OPTIONS = [
  { value: '', label: 'Todas as origens' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'SOCIAL_MEDIA', label: 'Redes Sociais' },
  { value: 'REFERRAL', label: 'Indicação' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'OTHER', label: 'Outro' },
];

type DatePreset = '7d' | '30d' | '90d' | 'all';

function getDateRange(preset: DatePreset): { from?: string; to?: string } {
  if (preset === 'all') return {};
  const now = new Date();
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  };
}

const PRESET_LABELS: Record<DatePreset, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  all: 'Tudo',
};

export function FunnelConversion() {
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [source, setSource] = useState('');
  // Filtros por fonte/campanha da negociação (upgrade-rd-parity, req 5).
  const [dealSourceId, setDealSourceId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  const { data: sourcesData } = useQuery({
    queryKey: ['deal-sources', 'active'],
    queryFn: () => apiClient.getDealSources(true),
    staleTime: 5 * 60 * 1000,
  });
  const { data: campaignsData } = useQuery({
    queryKey: ['origin-campaigns', 'active'],
    queryFn: () => apiClient.getOriginCampaigns(true),
    staleTime: 5 * 60 * 1000,
  });
  const dealSources = sourcesData?.data ?? [];
  const campaigns = campaignsData?.data ?? [];

  const { data, loading, error, refetch } = useFunnelConversion({
    from: dateRange.from,
    to: dateRange.to,
    source: source || undefined,
    sourceId: dealSourceId || undefined,
    originCampaignId: campaignId || undefined,
  });

  // Compute overall conversion rate (NEW -> WON)
  const overallStats = useMemo(() => {
    if (!data) return null;
    const newStage = data.stages.find((s) => s.stage === 'NEW');
    const wonStage = data.stages.find((s) => s.stage === 'WON');
    const lostStage = data.stages.find((s) => s.stage === 'LOST');
    const newCount = newStage?.count || 0;
    const wonCount = wonStage?.count || 0;
    const lostCount = lostStage?.count || 0;
    const overallConversion = newCount > 0 ? Math.round((wonCount / newCount) * 1000) / 10 : 0;

    // Find worst drop-off
    const activeFunnel = data.stages.filter(
      (s) => s.stage !== 'LOST' && s.stage !== 'WON' && s.dropOffRate !== null
    );
    const worstDropOff =
      activeFunnel.length > 0
        ? activeFunnel.reduce((worst, s) =>
            (s.dropOffRate || 0) > (worst.dropOffRate || 0) ? s : worst
          )
        : null;

    return {
      total: data.total,
      wonCount,
      lostCount,
      overallConversion,
      worstDropOff,
    };
  }, [data]);

  // Build conversion table data (stage -> next stage)
  const conversionTable = useMemo(() => {
    if (!data) return [];
    const chain = data.stages.filter((s) => s.stage !== 'LOST');
    const rows: Array<{
      from: string;
      to: string;
      fromCount: number;
      toCount: number;
      rate: number;
      dropOff: number;
    }> = [];

    for (let i = 0; i < chain.length - 1; i++) {
      const current = chain[i];
      const next = chain[i + 1];
      rows.push({
        from: STAGE_NAMES[current.stage] || current.stage,
        to: STAGE_NAMES[next.stage] || next.stage,
        fromCount: current.count,
        toCount: next.count,
        rate: current.conversionToNext ?? 0,
        dropOff: current.dropOffRate ?? 0,
      });
    }
    return rows;
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Funil de Conversão" subtitle="Carregando..." />
        <PageSkeleton type="dashboard" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Header title="Funil de Conversão" subtitle="Erro ao carregar" />
        <div className="flex flex-col items-center justify-center p-16 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Erro ao carregar dados do funil
          </h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Funil de Conversão"
        subtitle="Análise de conversão entre etapas do funil de leads"
      />

      <div className="p-4 md:p-8">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          {/* Date presets */}
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg p-1">
            {(Object.keys(PRESET_LABELS) as DatePreset[]).map((key) => (
              <button
                key={key}
                onClick={() => setDatePreset(key)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                  datePreset === key ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {PRESET_LABELS[key]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter size={14} />
              Filtros
            </Button>
            <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6 flex flex-wrap gap-4">
            <div>
              <label
                htmlFor="funnel-source-filter"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Origem
              </label>
              <select
                id="funnel-source-filter"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-card"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Fonte/campanha da negociação (upgrade-rd-parity, req 5) */}
            <div>
              <label
                htmlFor="funnel-deal-source-filter"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Fonte da negociação
              </label>
              <select
                id="funnel-deal-source-filter"
                value={dealSourceId}
                onChange={(e) => setDealSourceId(e.target.value)}
                className="text-sm border border-border rounded-md px-3 py-1.5 bg-card text-foreground"
              >
                <option value="">Todas as fontes</option>
                {dealSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name ?? s.label ?? ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="funnel-campaign-filter"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Campanha
              </label>
              <select
                id="funnel-campaign-filter"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="text-sm border border-border rounded-md px-3 py-1.5 bg-card text-foreground"
              >
                <option value="">Todas as campanhas</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.label ?? ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {overallStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <SummaryCard
              icon={<Users size={18} />}
              label="Total de Leads"
              value={String(overallStats.total)}
              color="blue"
            />
            <SummaryCard
              icon={<Percent size={18} />}
              label="Conversão Geral"
              value={`${overallStats.overallConversion}%`}
              subtext={`${overallStats.wonCount} ganhos de ${overallStats.total}`}
              color="green"
            />
            <SummaryCard
              icon={<TrendingDown size={18} />}
              label="Perdidos"
              value={String(overallStats.lostCount)}
              subtext={
                overallStats.total > 0
                  ? `${Math.round((overallStats.lostCount / overallStats.total) * 1000) / 10}% do total`
                  : ''
              }
              color="red"
            />
            {overallStats.worstDropOff && (
              <SummaryCard
                icon={<AlertTriangle size={18} />}
                label="Maior Drop-off"
                value={`${overallStats.worstDropOff.dropOffRate}%`}
                subtext={`em ${STAGE_NAMES[overallStats.worstDropOff.stage] || overallStats.worstDropOff.stage}`}
                color="orange"
              />
            )}
          </div>
        )}

        {/* Funnel Chart */}
        {data && (
          <div className="bg-card rounded-lg shadow-sm border border-gray-300 p-6 mb-8">
            <h3 className="text-sm font-semibold text-gray-900 mb-6">Funil de Leads</h3>
            <FunnelChart stages={data.stages} total={data.total} />
          </div>
        )}

        {/* Conversion Rate Table */}
        {conversionTable.length > 0 && (
          <div className="bg-card rounded-lg shadow-sm border border-gray-300 overflow-hidden mb-8">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Taxas de Conversão por Etapa</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                      Transição
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                      De
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                      Para
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                      Taxa de Conversão
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                      Drop-off
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {conversionTable.map((row) => (
                    <tr key={`${row.from}-${row.to}`} className="border-b border-gray-100">
                      <td className="py-2.5 px-4 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <span>{row.from}</span>
                          <ArrowRight size={14} className="text-gray-400" />
                          <span>{row.to}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-gray-600 text-right">
                        {row.fromCount}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-gray-600 text-right">
                        {row.toCount}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`text-sm font-medium ${
                            row.rate >= 70
                              ? 'text-green-600'
                              : row.rate >= 40
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}
                        >
                          {row.rate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`text-sm ${
                            row.dropOff <= 30
                              ? 'text-green-600'
                              : row.dropOff <= 60
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}
                        >
                          -{row.dropOff}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {data && data.total === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">Nenhum lead encontrado</h3>
            <p className="text-sm text-gray-500">
              Ajuste os filtros ou adicione leads para visualizar o funil.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-card rounded-lg shadow-sm border border-gray-300 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color] || colorClasses.blue}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
          {subtext && <p className="text-xs text-gray-400 truncate">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}
