import { DashboardWidget as WidgetType } from '../utils/dashboard';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { StatCard } from './StatCard';
import { Users, TrendingUp, Clock, Target } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { DashboardStats } from '../hooks/useDashboard';

interface DashboardWidgetProps {
  widget: WidgetType;
  onRemove?: () => void;
  isEditing?: boolean;
  stats?: DashboardStats;
  funnelData?: Array<{ name: string; value: number; color: string }>;
  sourceData?: Array<{ name: string; value: number; color: string }>;
}

export function DashboardWidget({
  widget,
  onRemove,
  isEditing,
  stats,
  funnelData = [],
  sourceData = [],
}: DashboardWidgetProps) {
  const renderWidget = () => {
    switch (widget.type) {
      case 'stat': {
        if (!stats) {
          return (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
              <h3 className="text-gray-900">{widget.title}</h3>
              <p className="text-sm text-gray-600 mt-2">Carregando...</p>
            </div>
          );
        }

        const statConfig: Record<string, { icon: any; value: string | number; trend?: any }> = {
          totalLeads: {
            icon: Users,
            value: stats.totalLeads,
            trend: undefined, // Could calculate trend if we had historical data
          },
          conversionRate: {
            icon: TrendingUp,
            value:
              stats.totalLeads > 0
                ? `${(((stats.leadsByStatus.won || 0) / stats.totalLeads) * 100).toFixed(1)}%`
                : '0%',
            trend: undefined,
          },
          avgResponseTime: {
            icon: Clock,
            value: 'N/A', // Would need interaction data
            trend: undefined,
          },
          leadsInPipeline: {
            icon: Target,
            value: Object.values(stats.leadsByStatus).reduce((sum, count) => sum + count, 0),
          },
        };

        const config = statConfig[widget.config.metric] || statConfig.totalLeads;
        return (
          <StatCard
            title={widget.title}
            value={config.value}
            icon={config.icon}
            trend={config.trend}
          />
        );
      }

      case 'chart': {
        if (widget.config.chartType === 'pie') {
          const dataToUse = widget.config.dataSource === 'sources' ? sourceData : funnelData;
          return (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300 h-full">
              <h3 className="text-gray-900 mb-4">{widget.title}</h3>
              {dataToUse.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-gray-600">
                  Nenhum dado disponível
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={dataToUse}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {dataToUse.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        }

        const barDataToUse = widget.config.dataSource === 'funnel' ? funnelData : sourceData;
        return (
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300 h-full">
            <h3 className="text-gray-900 mb-4">{widget.title}</h3>
            {barDataToUse.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-gray-600">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barDataToUse}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {barDataToUse.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      }

      default:
        return (
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300 h-full">
            <h3 className="text-gray-900">{widget.title}</h3>
            <p className="text-sm text-gray-600 mt-2">Widget não implementado</p>
          </div>
        );
    }
  };

  return (
    <div className="relative group">
      {isEditing && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onRemove}
          >
            <X size={14} />
          </Button>
        </div>
      )}
      {renderWidget()}
    </div>
  );
}
