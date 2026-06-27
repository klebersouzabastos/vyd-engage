import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { Filter, Percent } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { FunnelConversionData } from '../../types';
import { FunnelChart } from './FunnelChart';

export function FunnelWidget() {
  const [data, setData] = useState<FunnelConversionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getFunnelConversion()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const overallConversion = useMemo(() => {
    if (!data) return 0;
    const newStage = data.stages.find((s) => s.stage === 'NEW');
    const wonStage = data.stages.find((s) => s.stage === 'WON');
    const newCount = newStage?.count || 0;
    const wonCount = wonStage?.count || 0;
    return newCount > 0 ? Math.round((wonCount / newCount) * 1000) / 10 : 0;
  }, [data]);

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-300 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="space-y-2">
            <div className="h-6 bg-gray-200 rounded w-full" />
            <div className="h-6 bg-gray-200 rounded w-4/5" />
            <div className="h-6 bg-gray-200 rounded w-3/5" />
            <div className="h-6 bg-gray-200 rounded w-2/5" />
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.total === 0) return null;

  return (
    <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-300">
      <div className="p-6 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-900 font-semibold flex items-center gap-2">
            <Filter size={18} className="text-blue-600" />
            Funil de Conversão
          </h3>
          <Link to="/app/funnel" className="text-sm text-primary hover:underline">
            Ver detalhes
          </Link>
        </div>
      </div>
      <div className="p-6">
        {/* Overall conversion stat */}
        <div className="flex items-center gap-2 mb-4">
          <Percent size={14} className="text-green-500" />
          <span className="text-xs text-gray-500">Conversão geral:</span>
          <span className="text-sm font-bold text-gray-900">{overallConversion}%</span>
        </div>

        {/* Compact funnel */}
        <FunnelChart stages={data.stages} total={data.total} compact />
      </div>
    </div>
  );
}
