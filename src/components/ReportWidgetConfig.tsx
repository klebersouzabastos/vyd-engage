import { useState, useEffect } from 'react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { ReportWidget } from '../types';
import { ReportFilters } from './ReportFilters';
import { Settings } from 'lucide-react';

interface ReportWidgetConfigProps {
  widget: ReportWidget;
  onChange: (updates: Partial<ReportWidget>) => void;
}

const DEFAULT_WIDGET_COLORS_EXAMPLE = '#3B82F6, #F59E0B, #16A34A'; // gate-allow: user color

const DATA_SOURCES = [
  { value: 'leads', label: 'Leads' },
  { value: 'pipeline', label: 'Pipeline/Funil' },
  { value: 'automations', label: 'Automações' },
  { value: 'tasks', label: 'Tarefas' },
  { value: 'interactions', label: 'Interações' },
];

const AGGREGATION_TYPES = [
  { value: 'sum', label: 'Soma' },
  { value: 'avg', label: 'Média' },
  { value: 'count', label: 'Contagem' },
  { value: 'min', label: 'Mínimo' },
  { value: 'max', label: 'Máximo' },
];

const CHART_TYPES = [
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Linha' },
  { value: 'pie', label: 'Pizza' },
  { value: 'area', label: 'Área' },
];

const METRIC_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  leads: [
    { value: 'total', label: 'Total de Leads' },
    { value: 'conversionRate', label: 'Taxa de Conversão' },
    { value: 'avgResponseTime', label: 'Tempo Médio de Resposta' },
    { value: 'newLeads', label: 'Novos Leads' },
    { value: 'closedLeads', label: 'Leads Fechados' },
    { value: 'byStatus', label: 'Por Status' },
    { value: 'bySource', label: 'Por Origem' },
  ],
  pipeline: [
    { value: 'conversionRate', label: 'Taxa de Conversão' },
    { value: 'totalLeads', label: 'Total de Leads' },
    { value: 'stages', label: 'Estágios do Funil' },
  ],
  automations: [
    { value: 'total', label: 'Total de Automações' },
    { value: 'active', label: 'Automações Ativas' },
    { value: 'successRate', label: 'Taxa de Sucesso' },
    { value: 'totalSentMessages', label: 'Mensagens Enviadas' },
    { value: 'totalLeadsEnrolled', label: 'Leads Inscritos' },
    { value: 'byType', label: 'Por Tipo' },
    { value: 'byStatus', label: 'Por Status' },
  ],
  tasks: [
    { value: 'total', label: 'Total de Tarefas' },
    { value: 'completionRate', label: 'Taxa de Conclusão' },
    { value: 'overdue', label: 'Tarefas Atrasadas' },
    { value: 'dueToday', label: 'Tarefas para Hoje' },
    { value: 'avgCompletionTime', label: 'Tempo Médio de Conclusão' },
    { value: 'byPriority', label: 'Por Prioridade' },
  ],
  interactions: [
    { value: 'total', label: 'Total de Interações' },
    { value: 'byType', label: 'Por Tipo' },
    { value: 'avgPerLead', label: 'Média por Lead' },
  ],
};

export function ReportWidgetConfig({ widget, onChange }: ReportWidgetConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Detectar fonte de dados automaticamente se não estiver definida
  useEffect(() => {
    if (!widget.dataSource && widget.type === 'metric') {
      // Tentar detectar baseado na métrica
      if (widget.metric) {
        const metricToSource: Record<string, ReportWidget['dataSource']> = {
          total: 'leads',
          conversionRate: 'leads',
          avgResponseTime: 'leads',
          newLeads: 'leads',
          closedLeads: 'leads',
          byStatus: 'leads',
          bySource: 'leads',
        };

        const detectedSource = metricToSource[widget.metric];
        if (detectedSource) {
          onChange({ dataSource: detectedSource });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.metric, widget.type]);

  const handleDataSourceChange = (value: string) => {
    onChange({
      dataSource: value as ReportWidget['dataSource'],
      // Reset metric when data source changes
      metric: undefined,
    });
  };

  const handleMetricChange = (value: string) => {
    onChange({ metric: value });
  };

  const handleChartTypeChange = (value: string) => {
    onChange({
      chartType: value as ReportWidget['chartType'],
      config: { ...widget.config, chartType: value },
    });
  };

  const handleAggregationChange = (value: string) => {
    onChange({ aggregation: value as ReportWidget['aggregation'] });
  };

  const handleFilterChange = (filters: any) => {
    onChange({ filters });
  };

  const currentMetrics = widget.dataSource ? METRIC_OPTIONS[widget.dataSource] || [] : [];

  return (
    <div className="space-y-4">
      {/* Título */}
      <div>
        <Label>Título do Widget</Label>
        <Input
          value={widget.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="mt-1.5"
          placeholder="Nome do widget"
        />
      </div>

      {/* Tipo de Widget */}
      <div>
        <Label>Tipo</Label>
        <Select
          value={widget.type}
          onValueChange={(value) => onChange({ type: value as ReportWidget['type'] })}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="metric">Métrica</SelectItem>
            <SelectItem value="chart">Gráfico</SelectItem>
            <SelectItem value="table">Tabela</SelectItem>
            <SelectItem value="funnel">Funil</SelectItem>
            <SelectItem value="line">Linha Temporal</SelectItem>
            <SelectItem value="comparison">Comparação</SelectItem>
            <SelectItem value="topn">Top N</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Fonte de Dados */}
      <div>
        <Label>Fonte de Dados</Label>
        <Select value={widget.dataSource || ''} onValueChange={handleDataSourceChange}>
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Selecione a fonte" />
          </SelectTrigger>
          <SelectContent>
            {DATA_SOURCES.map((source) => (
              <SelectItem key={source.value} value={source.value}>
                {source.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Métrica (para widgets de métrica) */}
      {widget.type === 'metric' && widget.dataSource && currentMetrics.length > 0 && (
        <div>
          <Label>Métrica</Label>
          <Select value={widget.metric || ''} onValueChange={handleMetricChange}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Selecione a métrica" />
            </SelectTrigger>
            <SelectContent>
              {currentMetrics.map((metric) => (
                <SelectItem key={metric.value} value={metric.value}>
                  {metric.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tipo de Gráfico (para widgets de gráfico) */}
      {widget.type === 'chart' && (
        <div>
          <Label>Tipo de Gráfico</Label>
          <Select value={widget.chartType || 'bar'} onValueChange={handleChartTypeChange}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHART_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Agregação */}
      {(widget.type === 'chart' || widget.type === 'table') && (
        <div>
          <Label>Agregação</Label>
          <Select value={widget.aggregation || 'count'} onValueChange={handleAggregationChange}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGGREGATION_TYPES.map((agg) => (
                <SelectItem key={agg.value} value={agg.value}>
                  {agg.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Filtros - Apenas em modo avançado */}
      {showAdvanced && widget.dataSource && (
        <div>
          <Label>Filtros</Label>
          <div className="mt-1.5 border border-gray-300 rounded-lg p-4">
            <ReportFilters
              filters={widget.filters}
              onChange={handleFilterChange}
              dataSource={widget.dataSource}
            />
          </div>
        </div>
      )}

      {/* Configurações Avançadas */}
      <div className="pt-4 border-t border-gray-300">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="gap-2"
        >
          <Settings size={14} />
          {showAdvanced ? 'Ocultar' : 'Mostrar'} configurações avançadas
        </Button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 border-t border-gray-300 pt-4">
            {/* Período de Data */}
            <div>
              <Label>Período de Análise</Label>
              <Select
                value={widget.dateRange?.type || 'month'}
                onValueChange={(value) =>
                  onChange({
                    dateRange: {
                      type: value as any,
                      start: widget.dateRange?.start,
                      end: widget.dateRange?.end,
                    },
                  })
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Últimos 7 dias</SelectItem>
                  <SelectItem value="month">Último mês</SelectItem>
                  <SelectItem value="quarter">Último trimestre</SelectItem>
                  <SelectItem value="year">Último ano</SelectItem>
                  <SelectItem value="all">Todo o período</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cores personalizadas (para gráficos) */}
            {widget.type === 'chart' && (
              <div>
                <Label>Cores (separadas por vírgula)</Label>
                <Input
                  value={widget.colors?.join(', ') || ''}
                  onChange={(e) =>
                    onChange({
                      colors: e.target.value
                        .split(',')
                        .map((c) => c.trim())
                        .filter((c) => c),
                    })
                  }
                  className="mt-1.5"
                  placeholder={DEFAULT_WIDGET_COLORS_EXAMPLE}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
