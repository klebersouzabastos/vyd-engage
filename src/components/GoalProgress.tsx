import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { apiClient } from "../services/api/client";
import { Progress } from "./ui/progress";
import { Skeleton } from "./ui/skeleton";
import { formatCurrency } from "../utils/format";

interface GoalProgressData {
  revenue: { current: number; target: number };
  deals: { current: number; target: number };
  leads: { current: number; target: number };
  hasGoal: boolean;
}

interface GoalProgressProps {
  userId?: string;
  month: number;
  year: number;
  compact?: boolean;
}

function pct(current: number, target: number): number {
  if (!target) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

function barColor(percentage: number): string {
  if (percentage >= 100) return "bg-green-500";
  if (percentage >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function badgeColor(percentage: number): string {
  if (percentage >= 100) return "bg-green-100 text-green-700";
  if (percentage >= 50) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

export function GoalProgress({ userId, month, year, compact = false }: GoalProgressProps) {
  const navigate = useNavigate();
  const params = new URLSearchParams({ month: String(month), year: String(year) });
  if (userId) params.set("userId", userId);

  const { data, isLoading } = useQuery<GoalProgressData>({
    queryKey: ["goals-progress", month, year, userId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/goals/progress?${params.toString()}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Falha ao carregar metas");
      const json = await response.json();
      return json.data ?? json;
    },
  });

  if (isLoading) {
    return (
      <div className={compact ? "space-y-2" : "space-y-4 p-4"}>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }

  if (!data || !data.hasGoal) {
    return (
      <div className={compact ? "py-2" : "p-4"}>
        <p className="text-sm text-gray-400 text-center">Sem meta definida</p>
        <div className="flex justify-center mt-2">
          <button
            className="text-xs text-gray-500 border border-gray-200 rounded px-3 py-1 hover:bg-gray-50 transition-colors"
            onClick={() => navigate("/app/settings?tab=goals")}
          >
            Definir meta
          </button>
        </div>
      </div>
    );
  }

  const metrics = [
    {
      key: "revenue",
      label: "Receita",
      current: data.revenue.current,
      target: data.revenue.target,
      format: (v: number) => formatCurrency(v),
    },
    {
      key: "deals",
      label: "Negócios",
      current: data.deals.current,
      target: data.deals.target,
      format: (v: number) => String(v),
    },
    {
      key: "leads",
      label: "Leads",
      current: data.leads.current,
      target: data.leads.target,
      format: (v: number) => String(v),
    },
  ];

  return (
    <div className={compact ? "space-y-2" : "space-y-4 p-4"}>
      {metrics.map((m) => {
        const percentage = pct(m.current, m.target);
        return (
          <div key={m.key} className="space-y-1">
            {!compact && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 font-medium">{m.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">
                    {m.format(m.current)} / {m.format(m.target)}
                  </span>
                  <span
                    className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badgeColor(percentage)}`}
                  >
                    {percentage}%
                  </span>
                </div>
              </div>
            )}
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${barColor(percentage)}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            {compact && (
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badgeColor(percentage)}`}
              >
                {percentage}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
