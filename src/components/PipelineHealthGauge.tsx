import { useQuery } from '@tanstack/react-query';
import { Skeleton } from './ui/skeleton';

interface HealthFactor {
  name: string;
  score: number;
  maxScore: number;
}

interface PipelineHealthData {
  score: number;
  factors: HealthFactor[];
}

interface PipelineHealthGaugeProps {
  tenantId?: string;
  compact?: boolean;
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'Saudável';
  if (score >= 40) return 'Atenção';
  return 'Crítico';
}

function scoreRingColor(score: number): string {
  if (score >= 70) return 'border-green-500';
  if (score >= 40) return 'border-yellow-500';
  return 'border-red-500';
}

function scoreBadgeColor(score: number): string {
  if (score >= 70) return 'bg-green-100 text-green-700';
  if (score >= 40) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

function scoreTextColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

export function PipelineHealthGauge({ compact = false }: PipelineHealthGaugeProps) {
  const { data, isLoading } = useQuery<PipelineHealthData>({
    queryKey: ['pipeline-health'],
    queryFn: async () => {
      const response = await fetch('/api/v1/reports/pipeline-health', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Falha ao carregar saúde do pipeline');
      const json = await response.json();
      return json.data ?? json;
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className={compact ? 'flex items-center gap-3' : 'p-4 space-y-4'}>
        <Skeleton
          className={compact ? 'h-12 w-12 rounded-full' : 'h-24 w-24 rounded-full mx-auto'}
        />
        {!compact && (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        )}
      </div>
    );
  }

  const score = data?.score ?? 0;
  const factors = data?.factors ?? [];
  const label = scoreLabel(score);
  const ringColor = scoreRingColor(score);
  const badgeColor = scoreBadgeColor(score);
  const textColor = scoreTextColor(score);

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center justify-center rounded-full border-4 h-12 w-12 shrink-0 ${ringColor}`}
        >
          <span className={`text-sm font-bold ${textColor}`}>{score}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Saúde do Pipeline</span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full self-start ${badgeColor}`}
          >
            {label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Gauge */}
      <div className="flex flex-col items-center gap-2">
        <div
          className={`flex items-center justify-center rounded-full border-8 h-24 w-24 ${ringColor}`}
        >
          <span className={`text-2xl font-bold ${textColor}`}>{score}</span>
        </div>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${badgeColor}`}>
          {label}
        </span>
        <span className="text-xs text-gray-400">Score de 0 a 100</span>
      </div>

      {/* Factors */}
      {factors.length > 0 && (
        <div className="space-y-2">
          {factors.map((factor) => {
            const factorPct = factor.maxScore
              ? Math.min(Math.round((factor.score / factor.maxScore) * 100), 100)
              : 0;
            return (
              <div key={factor.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{factor.name}</span>
                  <span>
                    {factor.score}/{factor.maxScore}
                  </span>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${factorPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
