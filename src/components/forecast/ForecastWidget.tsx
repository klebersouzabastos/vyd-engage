import { useState, useEffect } from "react";
import { Link } from "react-router";
import { TrendingUp, DollarSign, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { apiClient } from "../../services/api/client";
import { ForecastData } from "../../types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${monthNames[Number(m) - 1]}/${year.slice(2)}`;
}

export function ForecastWidget() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getDealForecast({ months: 3 })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-300 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const chartData = data.monthly.map((m) => ({
    name: formatMonthLabel(m.month),
    value: Math.round(m.weightedValue),
  }));

  return (
    <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-300">
      <div className="p-6 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-900 font-semibold flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-600" />
            Forecast de Receita
          </h3>
          <Link
            to="/app/forecast"
            className="text-sm text-primary hover:underline"
          >
            Ver detalhes
          </Link>
        </div>
      </div>
      <div className="p-6">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <DollarSign size={14} className="text-blue-500" />
            </div>
            <p className="text-xs text-gray-500">Pipeline</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(data.summary.totalPipelineValue)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <TrendingUp size={14} className="text-purple-500" />
            </div>
            <p className="text-xs text-gray-500">Forecast</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(data.summary.totalWeightedForecast)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Target size={14} className="text-green-500" />
            </div>
            <p className="text-xs text-gray-500">Ticket Médio</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(data.summary.avgDealSize)}</p>
          </div>
        </div>

        {/* Mini bar chart */}
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Forecast"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[120px] text-sm text-gray-400">
            Nenhum deal com data prevista
          </div>
        )}
      </div>
    </div>
  );
}
