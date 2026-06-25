import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  ChevronDown,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { apiClient, ApiError } from "../../services/api/client";
import { useAIStatus } from "../../hooks/useAIStatus";
import type { AISummary } from "../../types";

interface AISummaryCardProps {
  leadId: string;
}

/** 30 minutes, in milliseconds (spec req 5). */
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CachedSummary {
  summary: string;
  /** When the summary was cached locally (epoch ms). */
  cachedAt: number;
}

function cacheKey(leadId: string): string {
  return `ai-summary:${leadId}`;
}

/** Reads a still-valid cached summary, or null if absent/expired/corrupt. */
function readCache(leadId: string): CachedSummary | null {
  try {
    const raw = localStorage.getItem(cacheKey(leadId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSummary;
    if (
      !parsed ||
      typeof parsed.summary !== "string" ||
      typeof parsed.cachedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(leadId: string, summary: string): void {
  try {
    const payload: CachedSummary = { summary, cachedAt: Date.now() };
    localStorage.setItem(cacheKey(leadId), JSON.stringify(payload));
  } catch {
    // localStorage unavailable / quota — degrade silently, summary still shows.
  }
}

type ErrorKind = "rate_limit" | "provider" | "generic";

function classifyError(err: unknown): ErrorKind {
  if (err instanceof ApiError) {
    if (err.statusCode === 429) return "rate_limit";
    if (err.statusCode === 503) return "provider";
  }
  return "generic";
}

const ERROR_MESSAGES: Record<ErrorKind, string> = {
  rate_limit: "Limite atingido, tente em instantes.",
  provider: "O assistente de IA está indisponível no momento. Tente novamente.",
  generic: "Não foi possível gerar o resumo. Tente novamente.",
};

/**
 * "Resumo IA" card shown at the top of the Lead detail page (spec AI-1.1).
 *
 * - Collapsible, open by default, with an "IA" badge and an "Atualizar" button.
 * - Lazy: the summary is only fetched while the card is expanded; the fetch runs
 *   in its own effect and never blocks the page load.
 * - Cached 30 min per lead in localStorage; "Atualizar" forces a refresh that
 *   bypasses both the local cache and the server cache.
 * - Hidden entirely (with a setup message) when AI is not configured (req 33).
 */
export function AISummaryCard({ leadId }: AISummaryCardProps) {
  const { enabled, loading: statusLoading } = useAIStatus();

  const [expanded, setExpanded] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorKind | null>(null);
  /** Set once we've loaded (from cache or network) for the current lead. */
  const [loaded, setLoaded] = useState(false);

  const fetchSummary = useCallback(
    async (force: boolean) => {
      // Cache hit short-circuit (req 5) — unless the user forced a refresh (req 6).
      if (!force) {
        const cached = readCache(leadId);
        if (cached) {
          setSummary(cached.summary);
          setError(null);
          setLoaded(true);
          return;
        }
      }

      setLoading(true);
      setError(null);
      try {
        const result: AISummary = await apiClient.getLeadAISummary(leadId, force);
        setSummary(result.summary);
        writeCache(leadId, result.summary);
        setLoaded(true);
      } catch (err) {
        setError(classifyError(err));
      } finally {
        setLoading(false);
      }
    },
    [leadId],
  );

  // Reset state when the lead changes so a stale summary never leaks across leads.
  useEffect(() => {
    setSummary(null);
    setError(null);
    setLoaded(false);
  }, [leadId]);

  // Lazy fetch: only when AI is enabled AND the card is expanded AND not yet
  // loaded for this lead. This runs after render, so it never blocks page load.
  useEffect(() => {
    if (!enabled || !expanded || loaded || loading) return;
    void fetchSummary(false);
  }, [enabled, expanded, loaded, loading, fetchSummary]);

  // Still resolving the gate — render nothing to avoid a flash.
  if (statusLoading) return null;

  // AI disabled (req 33): hide the card, show setup guidance instead.
  if (!enabled) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-200 text-gray-500 flex-shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Assistente de IA</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure um provedor de IA (variável <code className="font-mono">AI_PROVIDER</code>)
              para habilitar resumos automáticos, score e chat.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-purple-200 mb-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-purple-50/60">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <Sparkles size={16} className="text-purple-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900">Resumo IA</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-700">
            IA
          </span>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={() => fetchSummary(true)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800 disabled:opacity-50 transition-colors"
          title="Forçar novo resumo"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 py-4">
          {loading ? (
            <div className="flex items-center gap-3 text-gray-500">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Gerando resumo...</span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 text-sm text-red-600">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <p>{ERROR_MESSAGES[error]}</p>
                <button
                  type="button"
                  onClick={() => fetchSummary(true)}
                  className="text-xs text-purple-600 hover:underline mt-1"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : summary ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {summary}
            </p>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock size={14} />
              <span>Aguardando geração do resumo.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
