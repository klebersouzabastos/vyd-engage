import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api/client';

/**
 * Gating hook for the AI Sales Assistant (spec req 33).
 *
 * Calls `GET /api/v1/ai/status` once and caches it app-wide. When
 * `enabled === false` (AI_PROVIDER not configured), every AI component hides
 * itself and shows a setup-guidance message instead, making NO further AI calls.
 *
 * The status is treated as configuration-level data, so it is cached for the
 * whole session (no refetch on focus, long stale time).
 */
export function useAIStatus() {
  const query = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => apiClient.getAIStatus(),
    staleTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return {
    /** True only once the status resolved AND AI is enabled. */
    enabled: query.data?.enabled === true,
    /** True while the status call is still in flight. */
    loading: query.isLoading,
    /** True if the status endpoint itself failed. */
    error: query.isError,
  };
}
