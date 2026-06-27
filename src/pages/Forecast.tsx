import { useState, useMemo } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import {
  RefreshCw,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Target,
  Clock,
  Percent,
} from 'lucide-react';
import { PageSkeleton } from '../components/PageSkeleton';
import { useForecast } from '../hooks/useForecast';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  const monthNames = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  return `${monthNames[Number(m) - 1]}/${year.slice(2)}`;
}

type MonthsFilter = 3 | 6 | 12;

export function Forecast() {
  const [months, setMonths] = useState<MonthsFilter>(6);
  const { forecast, trend, loading, error, refetch } = useForecast({ months });

  const hasScenarios = useMemo(() => {
    if (!forecast) return false;
    return forecast.monthly.some(
      (m: any) => m.conservativeValue != null || m.optimisticValue != null
    );
  }, [forecast]);

  const forecastChartData = useMemo(() => {
    if (!forecast) return [];
    return forecast.monthly.map((m: any) => ({
      name: formatMonthLabel(m.month),
      totalValue: Math.round(m.totalValue),
      weightedValue: Math.round(m.weightedValue),
      dealCount: m.dealCount,
      conservativeValue: m.conservativeValue != null ? Math.round(m.conservativeValue) : undefined,
      optimisticValue: m.optimisticValue != null ? Math.round(m.optimisticValue) : undefined,
    }));
  }, [forecast]);

  const scenarioTotals = useMemo(() => {
    if (!forecast || !hasScenarios) return null;
    return forecast.monthly.reduce(
      (acc: any, m: any) => ({
        conservative: acc.conservative + (m.conservativeValue || 0),
        weighted: acc.weighted + (m.weightedValue || 0),
        optimistic: acc.optimistic + (m.optimisticValue || 0),
      }),
      { conservative: 0, weighted: 0, optimistic: 0 }
    );
  }, [forecast, hasScenarios]);

  const trendChartData = useMemo(() => {
    if (!trend) return [];
    return trend.months.map((m) => ({
      name: formatMonthLabel(m.month),
      wonValue: Math.round(m.won.value),
      lostValue: Math.round(m.lost.value),
      wonCount: m.won.count,
      lostCount: m.lost.count,
    }));
  }, [trend]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Previsão de Receita" subtitle="Carregando..." />
        <PageSkeleton type="dashboard" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Header title="Previsão de Receita" subtitle="Erro ao carregar" />
        <div className="flex flex-col items-center justify-center p-16 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar forecast</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const summary = forecast?.summary;

  return (
    <div className="min-h-screen">
      <Header title="Previsão de Receita" subtitle="Forecast baseado no pipeline de deals" />

      <div className="p-4 md:p-8">
        {/* Period filter */}
        <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg p-1 mb-6 w-fit">
          {([3, 6, 12] as MonthsFilter[]).map((n) => (
            <button
              key={n}
              onClick={() => setMonths(n)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                months === n ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {n} meses
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <StatCard
              icon={<DollarSign size={18} />}
              label="Pipeline Total"
              value={formatCurrency(summary.totalPipelineValue)}
              color="blue"
            />
            <StatCard
              icon={<TrendingUp size={18} />}
              label="Forecast Ponderado"
              value={formatCurrency(summary.totalWeightedForecast)}
              color="purple"
            />
            <StatCard
              icon={<Target size={18} />}
              label="Ticket Médio"
              value={formatCurrency(summary.avgDealSize)}
              color="green"
            />
            <StatCard
              icon={<Percent size={18} />}
              label="Win Rate"
              value={`${summary.winRate}%`}
              color="orange"
            />
            <StatCard
              icon={<Clock size={18} />}
              label="Ciclo Médio"
              value={`${summary.avgCloseTimeDays} dias`}
              color="gray"
            />
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Forecast Bar Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Forecast Ponderado por Mês</h3>
            {/* Scenario summary cards when data available */}
            {hasScenarios && scenarioTotals && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium mb-0.5">Conservador</p>
                  <p className="text-sm font-bold text-blue-700">
                    {formatCurrency(scenarioTotals.conservative)}
                  </p>
                </div>
                <div className="rounded-lg bg-purple-50 p-3 text-center">
                  <p className="text-xs text-purple-600 font-medium mb-0.5">Esperado</p>
                  <p className="text-sm font-bold text-purple-700">
                    {formatCurrency(scenarioTotals.weighted)}
                  </p>
                </div>
                <div className="rounded-lg bg-green-50 p-3 text-center">
                  <p className="text-xs text-green-600 font-medium mb-0.5">Otimista</p>
                  <p className="text-sm font-bold text-green-700">
                    {formatCurrency(scenarioTotals.optimistic)}
                  </p>
                </div>
              </div>
            )}
            {forecastChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={forecastChartData}
                  margin={{ top: 5, right: 20, bottom: 5, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => (v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`)}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        weightedValue: 'Esperado',
                        totalValue: 'Valor Total',
                        conservativeValue: 'Conservador',
                        optimisticValue: 'Otimista',
                      };
                      return [formatCurrency(value), labels[name] || name];
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend
                    formatter={(value) => {
                      const labels: Record<string, string> = {
                        weightedValue: 'Esperado',
                        totalValue: 'Valor Total',
                        conservativeValue: 'Conservador',
                        optimisticValue: 'Otimista',
                      };
                      return labels[value] || value;
                    }}
                  />
                  {hasScenarios ? (
                    <>
                      <Bar
                        dataKey="conservativeValue"
                        fill="#60A5FA"
                        radius={[4, 4, 0, 0]}
                        name="conservativeValue"
                      />
                      <Bar
                        dataKey="weightedValue"
                        fill="#8B5CF6"
                        radius={[4, 4, 0, 0]}
                        name="weightedValue"
                      />
                      <Bar
                        dataKey="optimisticValue"
                        fill="#4ADE80"
                        radius={[4, 4, 0, 0]}
                        name="optimisticValue"
                      />
                    </>
                  ) : (
                    <>
                      <Bar
                        dataKey="totalValue"
                        fill="#93C5FD"
                        radius={[4, 4, 0, 0]}
                        name="totalValue"
                      />
                      <Bar
                        dataKey="weightedValue"
                        fill="#8B5CF6"
                        radius={[4, 4, 0, 0]}
                        name="weightedValue"
                      />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                Nenhum deal com data prevista de fechamento
              </div>
            )}
          </div>

          {/* Won vs Lost Line Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Tendência: Ganhos vs Perdidos
            </h3>
            {trendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={trendChartData}
                  margin={{ top: 5, right: 20, bottom: 5, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => (v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`)}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const label = name === 'wonValue' ? 'Ganhos' : 'Perdidos';
                      return [formatCurrency(value), label];
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend formatter={(value) => (value === 'wonValue' ? 'Ganhos' : 'Perdidos')} />
                  <Line
                    type="monotone"
                    dataKey="wonValue"
                    stroke="#16A34A"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="wonValue"
                  />
                  <Line
                    type="monotone"
                    dataKey="lostValue"
                    stroke="#DC2626"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="lostValue"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                Nenhum deal fechado no período
              </div>
            )}
          </div>
        </div>

        {/* Detailed Table */}
        {forecast && forecast.monthly.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden mb-8">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Detalhamento Mensal</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                      Mês
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                      Deals
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                      Valor Total
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                      Ponderado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.monthly.map((row) => (
                    <tr key={row.month} className="border-b border-gray-100">
                      <td className="py-2.5 px-4 text-sm text-gray-900">
                        {formatMonthLabel(row.month)}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-gray-600 text-right">
                        {row.dealCount}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-gray-600 text-right">
                        {formatCurrency(row.totalValue)}
                      </td>
                      <td className="py-2.5 px-4 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(row.weightedValue)}
                      </td>
                    </tr>
                  ))}
                  {/* No-date bucket */}
                  {forecast.noDateBucket.dealCount > 0 && (
                    <tr className="border-b border-gray-100 bg-amber-50">
                      <td className="py-2.5 px-4 text-sm text-amber-700 font-medium">
                        Sem previsão
                      </td>
                      <td className="py-2.5 px-4 text-sm text-amber-600 text-right">
                        {forecast.noDateBucket.dealCount}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-amber-600 text-right">
                        {formatCurrency(forecast.noDateBucket.totalValue)}
                      </td>
                      <td className="py-2.5 px-4 text-sm font-medium text-amber-700 text-right">
                        {formatCurrency(forecast.noDateBucket.weightedValue)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Won vs Lost Trend Table */}
        {trend && trend.months.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Tendência Won vs Lost</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                      Mês
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-green-600 uppercase">
                      Ganhos (qtd)
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-green-600 uppercase">
                      Ganhos (R$)
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-red-600 uppercase">
                      Perdidos (qtd)
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-red-600 uppercase">
                      Perdidos (R$)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trend.months.map((row) => (
                    <tr key={row.month} className="border-b border-gray-100">
                      <td className="py-2.5 px-4 text-sm text-gray-900">
                        {formatMonthLabel(row.month)}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-green-600 text-right">
                        {row.won.count}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-green-600 text-right">
                        {formatCurrency(row.won.value)}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-red-600 text-right">
                        {row.lost.count}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-red-600 text-right">
                        {formatCurrency(row.lost.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    gray: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color] || colorClasses.blue}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}
