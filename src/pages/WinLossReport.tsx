import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { Skeleton } from '../components/ui/skeleton';
import { AlertTriangle, TrendingUp, TrendingDown, Percent, DollarSign } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS } from '@/utils/designTokens';

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

type Period = '30d' | '90d' | '180d' | 'all';

interface LossReason {
  reason: string;
  count: number;
  percentage: number;
}

interface Competitor {
  name: string;
  count: number;
  percentageOfLosses: number;
}

interface MonthlyBar {
  month: string;
  won: number;
  lost: number;
}

interface WinLossData {
  wonCount: number;
  wonValue: number;
  lostCount: number;
  lostValue: number;
  winRate: number;
  avgDealValue: number;
  lossReasons: LossReason[];
  monthly: MonthlyBar[];
  competitors: Competitor[];
}

function getPeriodDates(period: Period): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (period === '30d') from.setDate(from.getDate() - 30);
  else if (period === '90d') from.setDate(from.getDate() - 90);
  else if (period === '180d') from.setDate(from.getDate() - 180);
  else from.setFullYear(from.getFullYear() - 10);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

async function fetchWinLoss(period: Period): Promise<WinLossData> {
  const { from, to } = getPeriodDates(period);
  const token = localStorage.getItem('accessToken');
  const params = period === 'all' ? '' : `?from=${from}&to=${to}`;
  const res = await fetch(`${API_BASE}/api/v1/reports/win-loss${params}`, {
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erro ao carregar relatório win/loss');
  const data = await res.json();
  return data.data ?? data;
}

const PIE_COLORS = [
  CHART_COLORS.red,
  CHART_COLORS.orange,
  CHART_COLORS.yellow,
  CHART_COLORS.purple,
  CHART_COLORS.blue,
  CHART_COLORS.pink,
  CHART_COLORS.indigo,
  CHART_COLORS.green,
];

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

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-500',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-card rounded-lg shadow-sm border border-gray-300 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color] ?? colorClasses.blue}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export function WinLossReport() {
  const [period, setPeriod] = useState<Period>('90d');

  const { data, isLoading, error } = useQuery<WinLossData>({
    queryKey: ['win-loss-report', period],
    queryFn: () => fetchWinLoss(period),
    staleTime: 5 * 60 * 1000,
  });

  const barChartData = useMemo(() => {
    if (!data?.monthly) return [];
    return data.monthly.map((m) => ({
      name: formatMonthLabel(m.month),
      Ganhos: m.won,
      Perdidos: m.lost,
    }));
  }, [data]);

  const pieData = useMemo(() => {
    if (!data?.lossReasons?.length) return [];
    return data.lossReasons.map((r) => ({
      name: r.reason || 'Não informado',
      value: r.count,
    }));
  }, [data]);

  const PERIODS: { value: Period; label: string }[] = [
    { value: '30d', label: '30 dias' },
    { value: '90d', label: '90 dias' },
    { value: '180d', label: '180 dias' },
    { value: 'all', label: 'Tudo' },
  ];

  const isEmpty = !isLoading && !error && data && data.wonCount === 0 && data.lostCount === 0;

  return (
    <div className="min-h-screen">
      <Header title="Relatório Win/Loss" subtitle="Análise de deals ganhos e perdidos" />

      <div className="p-4 md:p-8">
        {/* Period selector */}
        <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg p-1 mb-6 w-fit">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === p.value ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
            <p className="text-gray-500">Erro ao carregar relatório. Tente novamente.</p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <TrendingUp className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500">Nenhum deal fechado no período selecionado.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))
              ) : data ? (
                <>
                  <StatCard
                    icon={<TrendingUp size={18} />}
                    label="Deals Ganhos"
                    value={String(data.wonCount)}
                    sub={formatCurrency(data.wonValue)}
                    color="green"
                  />
                  <StatCard
                    icon={<TrendingDown size={18} />}
                    label="Deals Perdidos"
                    value={String(data.lostCount)}
                    sub={formatCurrency(data.lostValue)}
                    color="red"
                  />
                  <StatCard
                    icon={<Percent size={18} />}
                    label="Win Rate"
                    value={`${data.winRate.toFixed(1)}%`}
                    color="blue"
                  />
                  <StatCard
                    icon={<DollarSign size={18} />}
                    label="Ticket Médio"
                    value={formatCurrency(data.avgDealValue)}
                    color="purple"
                  />
                </>
              ) : null}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Pie chart — loss reasons */}
              <div className="bg-card rounded-lg shadow-sm border border-gray-300 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Motivos de Perda</h3>
                {isLoading ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : pieData.length === 0 ? (
                  <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
                    Nenhum motivo de perda registrado
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {pieData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [value, 'Deals']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Bar chart — won vs lost per month */}
              <div className="bg-card rounded-lg shadow-sm border border-gray-300 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Ganhos vs Perdidos por Mês
                </h3>
                {isLoading ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : barChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
                    Dados insuficientes para o gráfico
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={barChartData}
                      margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--vyd-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend />
                      <Bar dataKey="Ganhos" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Perdidos" fill={CHART_COLORS.red} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Competitors table */}
            {(isLoading || (data?.competitors && data.competitors.length > 0)) && (
              <div className="bg-card rounded-lg shadow-sm border border-gray-300 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">Concorrentes Mencionados</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                          Concorrente
                        </th>
                        <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                          Ocorrências
                        </th>
                        <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">
                          % das Perdas
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading
                        ? Array.from({ length: 4 }).map((_, i) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="py-2.5 px-4">
                                <Skeleton className="h-4 w-40" />
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <Skeleton className="h-4 w-8 ml-auto" />
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <Skeleton className="h-4 w-12 ml-auto" />
                              </td>
                            </tr>
                          ))
                        : data?.competitors.map((comp) => (
                            <tr
                              key={comp.name}
                              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                            >
                              <td className="py-2.5 px-4 text-sm text-gray-900 font-medium">
                                {comp.name}
                              </td>
                              <td className="py-2.5 px-4 text-sm text-gray-600 text-right">
                                {comp.count}
                              </td>
                              <td className="py-2.5 px-4 text-sm text-red-500 text-right">
                                {comp.percentageOfLosses.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
