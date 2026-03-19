import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { FunnelConversionStage } from "../../types";

const STAGE_NAMES: Record<string, string> = {
  NEW: "Novo",
  CONTACTED: "Contato",
  QUALIFIED: "Qualificado",
  PROPOSAL: "Proposta",
  NEGOTIATION: "Negociação",
  WON: "Ganho",
  LOST: "Perdido",
};

const STAGE_COLORS: Record<string, string> = {
  NEW: "#6B7280",
  CONTACTED: "#3B82F6",
  QUALIFIED: "#8B5CF6",
  PROPOSAL: "#F59E0B",
  NEGOTIATION: "#F97316",
  WON: "#16A34A",
  LOST: "#DC2626",
};

interface FunnelChartProps {
  stages: FunnelConversionStage[];
  total: number;
  compact?: boolean;
}

export function FunnelChart({ stages, total, compact = false }: FunnelChartProps) {
  // Exclude LOST from the visual funnel (shown separately)
  const funnelStages = useMemo(
    () => stages.filter((s) => s.stage !== "LOST"),
    [stages]
  );

  const lostStage = useMemo(
    () => stages.find((s) => s.stage === "LOST"),
    [stages]
  );

  const chartData = useMemo(
    () =>
      funnelStages.map((s) => ({
        name: STAGE_NAMES[s.stage] || s.stage,
        stage: s.stage,
        count: s.count,
        pctOfTotal: total > 0 ? Math.round((s.count / total) * 1000) / 10 : 0,
        conversionToNext: s.conversionToNext,
        dropOffRate: s.dropOffRate,
      })),
    [funnelStages, total]
  );

  if (compact) {
    return <CompactFunnel stages={funnelStages} total={total} />;
  }

  return (
    <div className="space-y-6">
      {/* Horizontal bar funnel */}
      <div className="space-y-2">
        {chartData.map((item, idx) => {
          const maxCount = chartData[0]?.count || 1;
          const widthPct = maxCount > 0 ? Math.max((item.count / maxCount) * 100, 8) : 8;

          return (
            <div key={item.stage} className="group">
              {/* Stage bar */}
              <div className="flex items-center gap-3">
                <div className="w-24 md:w-28 text-right">
                  <span className="text-sm font-medium text-gray-700">
                    {item.name}
                  </span>
                </div>
                <div className="flex-1 relative">
                  <div
                    className="h-10 rounded-md flex items-center px-3 transition-all duration-300"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: STAGE_COLORS[item.stage] || "#6B7280",
                      minWidth: "80px",
                    }}
                  >
                    <span className="text-white text-sm font-semibold">
                      {item.count}
                    </span>
                    <span className="text-white/80 text-xs ml-2">
                      ({item.pctOfTotal}%)
                    </span>
                  </div>
                </div>
                {/* Conversion arrow */}
                {item.conversionToNext !== null && idx < chartData.length - 1 && (
                  <div className="w-20 md:w-24 text-left flex flex-col items-start">
                    <span className="text-xs font-medium text-green-600">
                      {item.conversionToNext}%
                    </span>
                    {item.dropOffRate !== null && item.dropOffRate > 0 && (
                      <span className="text-xs text-red-500">
                        -{item.dropOffRate}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Drop-off connector */}
              {item.conversionToNext !== null && idx < chartData.length - 1 && (
                <div className="flex items-center gap-3 my-0.5">
                  <div className="w-24 md:w-28" />
                  <div className="flex-1 flex items-center pl-2">
                    <div className="h-3 w-px bg-gray-300 ml-4" />
                    <svg className="w-3 h-3 text-gray-300 -ml-[7px] mt-1" viewBox="0 0 12 12">
                      <path d="M6 0 L12 6 L6 12" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* LOST badge */}
      {lostStage && lostStage.count > 0 && (
        <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
          <div className="w-24 md:w-28 text-right">
            <span className="text-sm font-medium text-red-600">Perdidos</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-8 rounded-md flex items-center px-3"
              style={{ backgroundColor: "#DC2626", minWidth: "60px" }}
            >
              <span className="text-white text-sm font-semibold">
                {lostStage.count}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              ({total > 0 ? Math.round((lostStage.count / total) * 1000) / 10 : 0}% do total)
            </span>
          </div>
        </div>
      )}

      {/* Recharts bar chart version (below, for a different visual) */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-600 mb-3">Distribuição por Etapa</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 30, bottom: 0, left: 80 }}
          >
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              width={75}
            />
            <Tooltip
              formatter={(value: number, _name: string, props: any) => {
                const item = props.payload;
                return [
                  `${value} leads (${item.pctOfTotal}%)`,
                  item.name,
                ];
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.stage}
                  fill={STAGE_COLORS[entry.stage] || "#6B7280"}
                />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                style={{ fontSize: 11, fill: "#374151" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Compact version for dashboard widget */
function CompactFunnel({
  stages,
  total,
}: {
  stages: FunnelConversionStage[];
  total: number;
}) {
  // Show top 4 stages for compact
  const topStages = stages.slice(0, 4);

  return (
    <div className="space-y-1.5">
      {topStages.map((s, idx) => {
        const maxCount = topStages[0]?.count || 1;
        const widthPct = maxCount > 0 ? Math.max((s.count / maxCount) * 100, 12) : 12;

        return (
          <div key={s.stage} className="flex items-center gap-2">
            <div className="w-16 text-right">
              <span className="text-xs text-gray-600">
                {STAGE_NAMES[s.stage] || s.stage}
              </span>
            </div>
            <div className="flex-1 relative">
              <div
                className="h-6 rounded flex items-center px-2 transition-all"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: STAGE_COLORS[s.stage] || "#6B7280",
                  minWidth: "40px",
                }}
              >
                <span className="text-white text-xs font-medium">{s.count}</span>
              </div>
            </div>
            {s.conversionToNext !== null && idx < topStages.length - 1 && (
              <span className="text-xs text-green-600 w-10 text-right">
                {s.conversionToNext}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
