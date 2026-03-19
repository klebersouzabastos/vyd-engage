import { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Settings, Download, Calendar, AlertTriangle, RefreshCw, Users, CheckSquare } from "lucide-react";
import { DashboardWidget } from "../components/DashboardWidget";
import { getCurrentLayout, removeWidget, DashboardLayout } from "../utils/dashboard";
import { LeadStatusBadge } from "../components/LeadStatusBadge";
import { LeadSourceBadge } from "../components/LeadSourceBadge";
import { PageSkeleton } from "../components/PageSkeleton";
import { DealAnalytics } from "../components/deals/DealAnalytics";
import { ForecastWidget } from "../components/forecast/ForecastWidget";
import { useDashboard, DateRange } from "../hooks/useDashboard";
import { CHART_COLORS } from "../utils/designTokens";
// Helper function to format time ago
function formatTimeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "agora";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min atrás`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hora${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''} atrás`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} dia${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''} atrás`;
  return `${Math.floor(diffInSeconds / 604800)} semana${Math.floor(diffInSeconds / 604800) > 1 ? 's' : ''} atrás`;
}

type RangePreset = "7d" | "30d" | "90d" | "all";

function getDateRange(preset: RangePreset): DateRange {
  if (preset === "all") return { from: null, to: null };
  const now = new Date();
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to: now };
}

const RANGE_LABELS: Record<RangePreset, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  all: "Tudo",
};

export function Dashboard() {
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [rangePreset, setRangePreset] = useState<RangePreset>("30d");
  const dateRange = useMemo(() => getDateRange(rangePreset), [rangePreset]);
  const { stats, loading: dashboardLoading, error: dashboardError, refetch } = useDashboard(dateRange);

  useEffect(() => {
    setLayout(getCurrentLayout());
  }, []);

  // Transform stats for charts
  const funnelData = useMemo(() => {
    const statusMap: Record<string, string> = {
      new: "Novo",
      contacted: "Em Contato",
      qualified: "Qualificado",
      proposal: "Proposta",
      negotiation: "Negociação",
      won: "Fechado",
      lost: "Perdido",
    };

    return Object.entries(stats.leadsByStatus)
      .map(([status, value]) => ({
        name: statusMap[status] || status,
        value,
        color: status === "won" ? CHART_COLORS.green : status === "new" ? CHART_COLORS.blue : CHART_COLORS.yellow,
      }))
      .filter((item) => item.value > 0);
  }, [stats.leadsByStatus]);

  const sourceData = useMemo(() => {
    const sourceMap: Record<string, string> = {
      website: "Website",
      social_media: "Redes Sociais",
      referral: "Indicação",
      email: "E-mail",
      phone: "Telefone",
      other: "Outro",
    };

    return Object.entries(stats.leadsBySource)
      .map(([source, value]) => ({
        name: sourceMap[source] || source,
        value,
        color: source === "website" ? CHART_COLORS.blue : source === "social_media" ? CHART_COLORS.red : CHART_COLORS.green,
      }))
      .filter((item) => item.value > 0);
  }, [stats.leadsBySource]);

  const handleExportCSV = useCallback(() => {
    const rows: string[][] = [
      ["Metrica", "Valor"],
      ["Total de Leads", String(stats.totalLeads)],
      ["Total de Tarefas", String(stats.totalTasks)],
      ["Tarefas Vencidas", String(stats.overdueTasks)],
      ["Vencendo Hoje", String(stats.tasksDueToday)],
      ["Tarefas Concluidas", String(stats.completedTasks)],
      [],
      ["Status do Lead", "Quantidade"],
      ...Object.entries(stats.leadsByStatus).map(([k, v]) => [k, String(v)]),
      [],
      ["Origem do Lead", "Quantidade"],
      ...Object.entries(stats.leadsBySource).map(([k, v]) => [k, String(v)]),
      [],
      ["Leads Recentes", "Email", "Status", "Origem", "Criado em"],
      ...stats.recentLeads.map(l => [l.name, l.email || "", l.status, l.source, l.createdAt || ""]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-${rangePreset}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stats, rangePreset]);

  const handleRemoveWidget = (widgetId: string) => {
    if (!layout) return;
    removeWidget(layout.id, widgetId);
    setLayout(getCurrentLayout());
  };

  if (!layout || dashboardLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Dashboard" subtitle="Carregando..." />
        <PageSkeleton type="dashboard" />
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen">
        <Header title="Dashboard" subtitle="Erro ao carregar dados" />
        <div className="flex flex-col items-center justify-center p-16 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar o dashboard</h2>
          <p className="text-gray-500 mb-4">{dashboardError}</p>
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
      <Header title="Dashboard" subtitle="Visão geral do seu CRM" />
      
      <div className="p-4 md:p-8">
        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg p-1 overflow-x-auto max-w-full">
            <Calendar size={14} className="text-gray-400 ml-2 mr-1 flex-shrink-0" />
            {(Object.keys(RANGE_LABELS) as RangePreset[]).map(key => (
              <button
                key={key}
                onClick={() => setRangePreset(key)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                  rangePreset === key
                    ? "bg-primary text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {RANGE_LABELS[key]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportCSV} className="gap-2">
              <Download size={16} /> <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsEditing(!isEditing)}
              className="gap-2"
            >
              <Settings size={16} />
              <span className="hidden sm:inline">{isEditing ? "Concluir Edição" : "Personalizar"}</span>
            </Button>
          </div>
        </div>

        {/* Widgets Grid */}
        <div data-tour="dashboard-stats" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {layout.widgets
            .filter((w) => w.type === "stat")
            .map((widget) => (
              <DashboardWidget
                key={widget.id}
                widget={widget}
                isEditing={isEditing}
                onRemove={() => handleRemoveWidget(widget.id)}
                stats={stats}
              />
            ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {layout.widgets
            .filter((w) => w.type === "chart")
            .map((widget) => (
              <DashboardWidget
                key={widget.id}
                widget={widget}
                isEditing={isEditing}
                onRemove={() => handleRemoveWidget(widget.id)}
                funnelData={funnelData}
                sourceData={sourceData}
              />
            ))}
        </div>

        {/* Deal Stats */}
        {stats.dealStats && (
          <div className="mb-8">
            <h3 className="text-gray-900 font-semibold mb-4">Deals</h3>
            <DealAnalytics stats={stats.dealStats} compact />
          </div>
        )}

        {/* Forecast Widget */}
        <div className="mb-8">
          <ForecastWidget />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Leads */}
          <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-300">
            <div className="p-6 border-b border-gray-300">
              <h3 className="text-gray-900">Últimos Leads Capturados</h3>
            </div>
            {dashboardLoading ? (
              <div className="p-6 text-center text-gray-600">Carregando...</div>
            ) : stats.recentLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <Users size={24} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">Nenhum lead capturado</p>
                <p className="text-xs text-gray-500 mt-1">Seus leads mais recentes aparecerão aqui</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-300">
                {stats.recentLeads.map((lead) => {
                  const timeAgo = lead.createdAt ? formatTimeAgo(lead.createdAt) : "";
                  return (
                    <div key={lead.id} className="p-4 hover:bg-gray-100 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{lead.name}</p>
                          {lead.phone && <p className="text-sm text-gray-600">{lead.phone}</p>}
                        </div>
                        <LeadStatusBadge status={lead.status} />
                      </div>
                      <div className="flex items-center justify-between">
                        <LeadSourceBadge source={lead.source} />
                        {timeAgo && <span className="text-xs text-gray-600">{timeAgo}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Task Summary */}
          <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-300">
            <div className="p-6 border-b border-gray-300">
              <h3 className="text-gray-900">Resumo de Tarefas</h3>
            </div>
            {dashboardLoading ? (
              <div className="p-6 text-center text-gray-600">Carregando...</div>
            ) : stats.totalTasks === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <CheckSquare size={24} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">Nenhuma tarefa criada</p>
                <p className="text-xs text-gray-500 mt-1">Crie tarefas para acompanhar suas atividades</p>
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-900">Total de Tarefas</span>
                    <span className="font-semibold text-gray-900">{stats.totalTasks}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-900">Tarefas Vencidas</span>
                    <span className="font-semibold text-red-600">{stats.overdueTasks}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-900">Vencendo Hoje</span>
                    <span className="font-semibold text-yellow-600">{stats.tasksDueToday}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-900">Concluídas</span>
                    <span className="font-semibold text-green-600">{stats.completedTasks}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
