import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { AlertTriangle, ShieldAlert, Users, DollarSign, Target, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

type Period = '7d' | '30d' | '90d';

interface MemberPerformance {
  userId: string;
  name: string;
  email: string;
  dealsWon: number;
  revenueWon: number;
  dealsLost: number;
  winRate: number;
  avgCycleDays: number;
  pipelineValue: number;
  tasksDone: number;
}

interface TeamPerformanceResponse {
  members: MemberPerformance[];
  from: string;
  to: string;
}

type SortField = keyof Omit<MemberPerformance, 'userId' | 'email'>;
type SortDir = 'asc' | 'desc';

function getPeriodDates(period: Period): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (period === '7d') from.setDate(from.getDate() - 7);
  else if (period === '30d') from.setDate(from.getDate() - 30);
  else from.setDate(from.getDate() - 90);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

async function fetchTeamPerformance(period: Period): Promise<TeamPerformanceResponse> {
  const { from, to } = getPeriodDates(period);
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`${API_BASE}/api/v1/reports/team-performance?from=${from}&to=${to}`, {
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erro ao carregar performance do time');
  const data = await res.json();
  return data.data ?? data;
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
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-card rounded-lg shadow-sm border border-gray-300 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color] ?? colorClasses.blue}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: string;
  sortField: string;
  sortDir: SortDir;
}) {
  if (field !== sortField) return <span className="ml-1 text-gray-300">↕</span>;
  return <span className="ml-1 text-gray-700">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

export function TeamPerformance() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('30d');
  const [sortField, setSortField] = useState<SortField>('revenueWon');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data, isLoading, error } = useQuery<TeamPerformanceResponse>({
    queryKey: ['team-performance', period],
    queryFn: () => fetchTeamPerformance(period),
    staleTime: 5 * 60 * 1000,
  });

  const isAllowed =
    user?.role === 'ADMIN' ||
    user?.role === 'GESTOR' ||
    user?.role === 'admin' ||
    user?.role === 'gestor';

  const sortedMembers = useMemo(() => {
    if (!data?.members) return [];
    return [...data.members].sort((a, b) => {
      const av = a[sortField as keyof MemberPerformance] as number;
      const bv = b[sortField as keyof MemberPerformance] as number;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [data, sortField, sortDir]);

  const summary = useMemo(() => {
    if (!data?.members?.length) return null;
    const members = data.members;
    const totalRevenue = members.reduce((s, m) => s + m.revenueWon, 0);
    const totalPipeline = members.reduce((s, m) => s + m.pipelineValue, 0);
    const totalWon = members.reduce((s, m) => s + m.dealsWon, 0);
    const totalDeals = members.reduce((s, m) => s + m.dealsWon + m.dealsLost, 0);
    const teamWinRate = totalDeals > 0 ? Math.round((totalWon / totalDeals) * 100) : 0;
    const avgCycle = Math.round(members.reduce((s, m) => s + m.avgCycleDays, 0) / members.length);
    return { totalRevenue, totalPipeline, teamWinRate, avgCycle };
  }, [data]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const columns: { field: SortField; label: string; align: 'left' | 'right' }[] = [
    { field: 'name', label: 'Nome', align: 'left' },
    { field: 'dealsWon', label: 'Deals Ganhos', align: 'right' },
    { field: 'revenueWon', label: 'Receita Ganha', align: 'right' },
    { field: 'dealsLost', label: 'Deals Perdidos', align: 'right' },
    { field: 'winRate', label: 'Win Rate (%)', align: 'right' },
    { field: 'avgCycleDays', label: 'Ciclo Médio (dias)', align: 'right' },
    { field: 'pipelineValue', label: 'Pipeline', align: 'right' },
    { field: 'tasksDone', label: 'Tasks Concluídas', align: 'right' },
  ];

  if (!isAllowed) {
    return (
      <div className="min-h-screen">
        <Header title="Performance do Time" subtitle="Acesso restrito" />
        <div className="flex flex-col items-center justify-center p-16 text-center">
          <ShieldAlert className="h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Acesso negado</h2>
          <p className="text-gray-500">Esta página é restrita a Admins e Gestores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Performance do Time" subtitle="Análise de desempenho por vendedor" />

      <div className="p-4 md:p-8">
        {/* Period selector */}
        <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded-lg p-1 mb-6 w-fit">
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === p ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<DollarSign size={18} />}
              label="Receita Total Ganha"
              value={formatCurrency(summary.totalRevenue)}
              color="green"
            />
            <StatCard
              icon={<Users size={18} />}
              label="Pipeline Total"
              value={formatCurrency(summary.totalPipeline)}
              color="blue"
            />
            <StatCard
              icon={<Target size={18} />}
              label="Win Rate do Time"
              value={`${summary.teamWinRate}%`}
              color="purple"
            />
            <StatCard
              icon={<Clock size={18} />}
              label="Ciclo Médio"
              value={`${summary.avgCycle} dias`}
              color="orange"
            />
          </div>
        ) : null}

        {/* Table */}
        <div className="bg-card rounded-lg shadow-sm border border-gray-300 overflow-hidden">
          {error ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-500 mb-3" />
              <p className="text-sm text-gray-500">Erro ao carregar dados. Tente novamente.</p>
            </div>
          ) : isLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {columns.map((col) => (
                      <th
                        key={col.field}
                        className={`py-3 px-4 text-xs font-medium text-gray-500 uppercase ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {columns.map((col) => (
                        <td key={col.field} className="py-3 px-4">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : sortedMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <Users className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">
                Nenhum dado encontrado para o período selecionado.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {columns.map((col) => (
                      <th
                        key={col.field}
                        onClick={() => handleSort(col.field)}
                        className={`py-3 px-4 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700 whitespace-nowrap ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.label}
                        <SortIcon field={col.field} sortField={sortField} sortDir={sortDir} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member) => (
                    <tr
                      key={member.userId}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      {/* Name with avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {getInitials(member.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {member.name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 text-right">
                        {member.dealsWon}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-green-600 text-right">
                        {formatCurrency(member.revenueWon)}
                      </td>
                      <td className="py-3 px-4 text-sm text-red-500 text-right">
                        {member.dealsLost}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge
                          variant={member.winRate >= 50 ? 'default' : 'secondary'}
                          className={
                            member.winRate >= 50
                              ? 'bg-green-100 text-green-700 hover:bg-green-100'
                              : 'bg-red-50 text-red-600 hover:bg-red-50'
                          }
                        >
                          {member.winRate.toFixed(0)}%
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 text-right">
                        {member.avgCycleDays}
                      </td>
                      <td className="py-3 px-4 text-sm text-blue-600 text-right">
                        {formatCurrency(member.pipelineValue)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 text-right">
                        {member.tasksDone}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
