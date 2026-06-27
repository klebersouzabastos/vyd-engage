import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { apiClient, ApiError } from '../../services/api/client';
import { useAIStatus } from '../../hooks/useAIStatus';
import type { DealAIScore as DealAIScoreData } from '../../types';

interface DealAIScoreFetchProps {
  /** Fetch mode (deal detail): compute/fetch the score on demand. */
  dealId: string;
  /** "sm" for the kanban card, "md" for the deal detail sidebar. */
  size?: 'sm' | 'md';
  value?: never;
}

interface DealAIScoreDisplayProps {
  /** Display-only mode (kanban card): render the stored score, no AI call. */
  value: number | null | undefined;
  factors?: DealAIScoreData['factors'] | null;
  size?: 'sm' | 'md';
  dealId?: never;
}

type DealAIScoreProps = DealAIScoreFetchProps | DealAIScoreDisplayProps;

type ErrorKind = 'rate_limit' | 'provider' | 'generic';

function classifyError(err: unknown): ErrorKind {
  if (err instanceof ApiError) {
    if (err.statusCode === 429) return 'rate_limit';
    if (err.statusCode === 503) return 'provider';
  }
  return 'generic';
}

const ERROR_MESSAGES: Record<ErrorKind, string> = {
  rate_limit: 'Limite atingido, tente em instantes.',
  provider: 'Score de IA indisponível no momento.',
  generic: 'Não foi possível calcular o score.',
};

/** Color band by score: red < 30, yellow 30-70, green > 70 (spec req 19). */
function bandColor(score: number): string {
  if (score < 30) return 'var(--color-error, #dc2626)';
  if (score <= 70) return 'var(--color-warning, #ca8a04)';
  return 'var(--color-success, #16a34a)';
}

function bandTextClass(score: number): string {
  if (score < 30) return 'text-red-600';
  if (score <= 70) return 'text-yellow-600';
  return 'text-green-600';
}

/** Small circular gauge rendered with SVG. */
function Gauge({ score, dim }: { score: number; dim: number }) {
  const stroke = dim <= 40 ? 4 : 5;
  const radius = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = bandColor(clamped);

  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="-rotate-90">
      <circle
        cx={dim / 2}
        cy={dim / 2}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={stroke}
      />
      <circle
        cx={dim / 2}
        cy={dim / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 400ms ease' }}
      />
    </svg>
  );
}

/**
 * Presentational gauge + factors popover, shared by both modes (no data fetch).
 * Keeps color bands (req 19) and the top-3 factors tooltip (req 20) identical
 * whether the score was fetched (detail) or read from the deal (kanban card).
 */
function ScoreGauge({
  score: rawScore,
  factors: rawFactors,
  size,
}: {
  score: number;
  factors: DealAIScoreData['factors'];
  size: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  /** Whether the popover was pinned open by a click (vs. transient hover). */
  const [pinned, setPinned] = useState(false);

  const dim = size === 'md' ? 56 : 36;
  const fontClass = size === 'md' ? 'text-sm font-bold' : 'text-[10px] font-bold';
  const score = Math.round(rawScore);
  const factors = (rawFactors || []).slice(0, 3);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPinned(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          // Stop propagation so clicking the gauge on a kanban card doesn't open
          // the deal or start a drag. Click toggles a "pinned" open state.
          onClick={(e) => {
            e.stopPropagation();
            const next = !pinned;
            setPinned(next);
            setOpen(next);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => {
            if (!pinned) setOpen(false);
          }}
          className="relative inline-flex items-center justify-center cursor-pointer"
          style={{ width: dim, height: dim }}
          aria-label={`Score de propensão IA: ${score}%`}
        >
          <Gauge score={score} dim={dim} />
          <span
            className={`absolute inset-0 flex items-center justify-center ${fontClass} ${bandTextClass(score)}`}
          >
            {score}%
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-64"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          if (!pinned) setOpen(false);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-purple-500" />
          <span className="text-sm font-semibold text-gray-900">Score de Propensão</span>
          <span className={`ml-auto text-sm font-bold ${bandTextClass(score)}`}>{score}%</span>
        </div>
        {factors.length > 0 ? (
          <ul className="space-y-1.5">
            {factors.map((factor, i) => {
              // API shape uses `impact`; stored deal factors use `detail`.
              const note = factor.impact ?? factor.detail;
              return (
                <li key={i} className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-gray-700">{factor.label}</span>
                  {note && <span className="text-gray-500 flex-shrink-0">{note}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-gray-400">Sem fatores detalhados disponíveis.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Fetch-mode gauge for the deal detail page: computes/fetches on demand. */
function DealAIScoreFetch({ dealId, size }: { dealId: string; size: 'sm' | 'md' }) {
  const [data, setData] = useState<DealAIScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiClient.getDealAIScore(dealId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(classifyError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const dim = size === 'md' ? 56 : 36;

  // Loading / error states — kept inline and non-blocking so the host page
  // never crashes (edge cases: provider 503, rate-limit 429).
  if (loading) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-gray-100 text-gray-400"
        style={{ width: dim, height: dim }}
        title="Calculando score..."
      >
        <Loader2 size={size === 'md' ? 18 : 14} className="animate-spin" />
      </span>
    );
  }

  if (error || !data) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-gray-100 text-gray-400"
        style={{ width: dim, height: dim }}
        title={error ? ERROR_MESSAGES[error] : 'Score indisponível'}
      >
        <AlertCircle size={size === 'md' ? 18 : 14} />
      </span>
    );
  }

  return <ScoreGauge score={data.score} factors={data.factors} size={size} />;
}

/**
 * Deal close-propensity gauge (spec AI-2.1, reqs 18-20 & 23).
 *
 * Two modes:
 * - Fetch mode (`dealId`, deal detail): computes/fetches the score on demand.
 * - Display-only mode (`value`/`factors`, kanban card): renders the STORED score
 *   already loaded with the deal — never triggers an AI call (perf: reqs 18, 35).
 *
 * Hidden — and makes no AI call — when AI is disabled (req 33).
 */
export function DealAIScore(props: DealAIScoreProps) {
  const { enabled } = useAIStatus();
  const size = props.size ?? 'sm';

  // AI disabled (req 33): render nothing inline.
  if (!enabled) return null;

  // Display-only mode (kanban card): use the stored score, no fetch.
  if (props.dealId === undefined) {
    // No stored score yet → neutral state (never compute from a card).
    if (props.value === null || props.value === undefined) return null;
    return <ScoreGauge score={props.value} factors={props.factors ?? []} size={size} />;
  }

  // Fetch mode (deal detail).
  return <DealAIScoreFetch dealId={props.dealId} size={size} />;
}
