import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api/client';
import { ForecastData, TrendData } from '../types';

export interface UseForecastOptions {
  months?: number;
  assignedTo?: string;
  stage?: string;
}

export function useForecast(options?: UseForecastOptions) {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [forecastResult, trendResult] = await Promise.all([
        apiClient.getDealForecast({
          months: options?.months,
          assignedTo: options?.assignedTo,
          stage: options?.stage,
        }),
        apiClient.getDealTrend(options?.months),
      ]);

      setForecast(forecastResult.data);
      setTrend(trendResult.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados de forecast';
      setError(message);
      console.error('Erro ao carregar forecast:', err);
    } finally {
      setLoading(false);
    }
  }, [options?.months, options?.assignedTo, options?.stage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { forecast, trend, loading, error, refetch: fetchData };
}
