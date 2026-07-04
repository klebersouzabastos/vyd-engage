import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api/client';
import { FunnelConversionData } from '../types';

export interface UseFunnelConversionOptions {
  from?: string;
  to?: string;
  source?: string;
  assignedTo?: string;
  /** Upgrade RD P0 (req 5): filtros por fonte/campanha da negociação. */
  sourceId?: string;
  originCampaignId?: string;
}

export function useFunnelConversion(options?: UseFunnelConversionOptions) {
  const [data, setData] = useState<FunnelConversionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await apiClient.getFunnelConversion({
        from: options?.from,
        to: options?.to,
        source: options?.source,
        assignedTo: options?.assignedTo,
        sourceId: options?.sourceId,
        originCampaignId: options?.originCampaignId,
      });

      setData(result.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados do funil';
      setError(message);
      console.error('Erro ao carregar funil de conversão:', err);
    } finally {
      setLoading(false);
    }
  }, [
    options?.from,
    options?.to,
    options?.source,
    options?.assignedTo,
    options?.sourceId,
    options?.originCampaignId,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
