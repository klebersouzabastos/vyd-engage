import { useState, useEffect, useMemo } from "react";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Settings } from "lucide-react";
import { DashboardWidget } from "../components/DashboardWidget";
import { getCurrentLayout, removeWidget, DashboardLayout } from "../utils/dashboard";
import { LeadStatusBadge } from "../components/LeadStatusBadge";
import { LeadSourceBadge } from "../components/LeadSourceBadge";
import { PageSkeleton } from "../components/PageSkeleton";
import { useDashboard } from "../hooks/useDashboard";
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

export function Dashboard() {
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { stats, loading: dashboardLoading } = useDashboard();

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
        color: status === "won" ? "#16A34A" : status === "new" ? "#3B82F6" : "#F59E0B",
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
        color: source === "website" ? "#3B82F6" : source === "social_media" ? "#DC2626" : "#16A34A",
      }))
      .filter((item) => item.value > 0);
  }, [stats.leadsBySource]);

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

  return (
    <div className="min-h-screen">
      <Header title="Dashboard" subtitle="Visão geral do seu CRM" />
      
      <div className="p-8">
        {/* Actions */}
        <div className="flex items-center justify-end mb-6">
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
            className="gap-2"
          >
            <Settings size={16} />
            {isEditing ? "Concluir Edição" : "Personalizar"}
          </Button>
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

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Leads */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-300">
            <div className="p-6 border-b border-gray-300">
              <h3 className="text-gray-900">Últimos Leads Capturados</h3>
            </div>
            {dashboardLoading ? (
              <div className="p-6 text-center text-gray-600">Carregando...</div>
            ) : stats.recentLeads.length === 0 ? (
              <div className="p-6 text-center text-gray-600">Nenhum lead encontrado</div>
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-300">
            <div className="p-6 border-b border-gray-300">
              <h3 className="text-gray-900">Resumo de Tarefas</h3>
            </div>
            {dashboardLoading ? (
              <div className="p-6 text-center text-gray-600">Carregando...</div>
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
