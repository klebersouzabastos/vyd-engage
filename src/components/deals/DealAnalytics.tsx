import { DealStats } from "../../types";
import { DollarSign, TrendingUp, Trophy, Percent } from "lucide-react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

const STAGE_LABELS: Record<string, string> = {
  QUALIFICATION: "Qualificação",
  PROPOSAL: "Proposta",
  NEGOTIATION: "Negociação",
  CLOSING: "Fechamento",
};

interface DealAnalyticsProps {
  stats: DealStats;
  compact?: boolean;
}

export function DealAnalytics({ stats, compact = false }: DealAnalyticsProps) {
  if (compact) {
    // Compact mode for Dashboard integration
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign size={18} />} label="Pipeline" value={formatCurrency(stats.totalPipelineValue)} color="blue" />
        <StatCard icon={<TrendingUp size={18} />} label="Forecast" value={formatCurrency(stats.weightedValue)} color="purple" />
        <StatCard icon={<Trophy size={18} />} label="Ganhos" value={formatCurrency(stats.wonValue)} color="green" />
        <StatCard icon={<Percent size={18} />} label="Win Rate" value={`${stats.winRate}%`} color="orange" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign size={18} />} label="Pipeline Total" value={formatCurrency(stats.totalPipelineValue)} color="blue" />
        <StatCard icon={<TrendingUp size={18} />} label="Forecast Ponderado" value={formatCurrency(stats.weightedValue)} color="purple" />
        <StatCard icon={<Trophy size={18} />} label="Valor Ganho" value={formatCurrency(stats.wonValue)} color="green" />
        <StatCard icon={<Percent size={18} />} label="Win Rate" value={`${stats.winRate}%`} color="orange" />
      </div>

      {/* Forecast by Stage Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Forecast por Stage</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Stage</th>
              <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Deals</th>
              <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Ponderado</th>
            </tr>
          </thead>
          <tbody>
            {stats.byStage.map((row) => (
              <tr key={row.stage} className="border-b border-gray-100">
                <td className="py-2.5 px-4 text-sm text-gray-900">{STAGE_LABELS[row.stage] || row.stage}</td>
                <td className="py-2.5 px-4 text-sm text-gray-600 text-right">{row.count}</td>
                <td className="py-2.5 px-4 text-sm text-gray-600 text-right">{formatCurrency(row.totalValue)}</td>
                <td className="py-2.5 px-4 text-sm font-medium text-gray-900 text-right">{formatCurrency(row.weightedValue)}</td>
              </tr>
            ))}
            {stats.byStage.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-6 text-gray-400 text-sm">Nenhum deal ativo</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Extra stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Tamanho Médio</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(stats.avgDealSize)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Ciclo Médio</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{stats.avgCycleTime} dias</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Deals Ativos</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{stats.activeDeals}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color] || colorClasses.blue}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
