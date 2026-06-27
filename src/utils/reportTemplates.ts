import { ReportTemplate, Report, ReportWidget } from '../types';
import { generateId } from './id';

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'leads-performance',
    name: 'Performance de Leads',
    description:
      'Análise completa de performance de leads com métricas de conversão, origem e status',
    category: 'leads',
    widgets: [
      {
        type: 'metric',
        title: 'Total de Leads',
        dataSource: 'leads',
        metric: 'total',
        config: {},
      },
      {
        type: 'metric',
        title: 'Taxa de Conversão',
        dataSource: 'leads',
        metric: 'conversionRate',
        config: {},
      },
      {
        type: 'metric',
        title: 'Tempo Médio de Resposta',
        dataSource: 'leads',
        metric: 'avgResponseTime',
        config: {},
      },
      {
        type: 'chart',
        title: 'Leads por Origem',
        dataSource: 'leads',
        chartType: 'pie',
        config: { dataSource: 'bySource' },
      },
      {
        type: 'chart',
        title: 'Leads por Status',
        dataSource: 'leads',
        chartType: 'bar',
        config: { dataSource: 'byStatus' },
      },
      {
        type: 'funnel',
        title: 'Funil de Conversão',
        dataSource: 'pipeline',
        config: {},
      },
    ],
    defaultFilters: {
      dateRange: {
        type: 'month',
      },
    },
  },
  {
    id: 'sales-funnel',
    name: 'Funil de Vendas',
    description: 'Visualização detalhada do funil de vendas com conversões por estágio',
    category: 'sales',
    widgets: [
      {
        type: 'funnel',
        title: 'Funil de Vendas',
        dataSource: 'pipeline',
        config: {},
      },
      {
        type: 'metric',
        title: 'Taxa de Conversão',
        dataSource: 'pipeline',
        metric: 'conversionRate',
        config: {},
      },
      {
        type: 'chart',
        title: 'Distribuição por Estágio',
        dataSource: 'pipeline',
        chartType: 'bar',
        config: { dataSource: 'stages' },
      },
      {
        type: 'table',
        title: 'Detalhes por Estágio',
        dataSource: 'pipeline',
        config: { columns: ['stage', 'count', 'conversionRate'] },
      },
    ],
    defaultFilters: {
      dateRange: {
        type: 'month',
      },
    },
  },
  {
    id: 'automations-report',
    name: 'Relatório de Automações',
    description: 'Performance e estatísticas das automações de marketing',
    category: 'automations',
    widgets: [
      {
        type: 'metric',
        title: 'Total de Automações',
        dataSource: 'automations',
        metric: 'total',
        config: {},
      },
      {
        type: 'metric',
        title: 'Automações Ativas',
        dataSource: 'automations',
        metric: 'active',
        config: {},
      },
      {
        type: 'metric',
        title: 'Taxa de Sucesso',
        dataSource: 'automations',
        metric: 'successRate',
        config: {},
      },
      {
        type: 'metric',
        title: 'Mensagens Enviadas',
        dataSource: 'automations',
        metric: 'totalSentMessages',
        config: {},
      },
      {
        type: 'chart',
        title: 'Automações por Tipo',
        dataSource: 'automations',
        chartType: 'pie',
        config: { dataSource: 'byType' },
      },
      {
        type: 'chart',
        title: 'Leads Inscritos',
        dataSource: 'automations',
        chartType: 'bar',
        config: { dataSource: 'leadsEnrolled' },
      },
    ],
    defaultFilters: {
      dateRange: {
        type: 'month',
      },
    },
  },
  {
    id: 'tasks-productivity',
    name: 'Produtividade de Tarefas',
    description: 'Análise de produtividade e conclusão de tarefas',
    category: 'tasks',
    widgets: [
      {
        type: 'metric',
        title: 'Total de Tarefas',
        dataSource: 'tasks',
        metric: 'total',
        config: {},
      },
      {
        type: 'metric',
        title: 'Taxa de Conclusão',
        dataSource: 'tasks',
        metric: 'completionRate',
        config: {},
      },
      {
        type: 'metric',
        title: 'Tarefas Atrasadas',
        dataSource: 'tasks',
        metric: 'overdue',
        config: {},
      },
      {
        type: 'metric',
        title: 'Tarefas para Hoje',
        dataSource: 'tasks',
        metric: 'dueToday',
        config: {},
      },
      {
        type: 'chart',
        title: 'Tarefas por Prioridade',
        dataSource: 'tasks',
        chartType: 'pie',
        config: { dataSource: 'byPriority' },
      },
      {
        type: 'chart',
        title: 'Status das Tarefas',
        dataSource: 'tasks',
        chartType: 'bar',
        config: { dataSource: 'status' },
      },
    ],
    defaultFilters: {
      dateRange: {
        type: 'month',
      },
    },
  },
  {
    id: 'executive-dashboard',
    name: 'Dashboard Executivo',
    description: 'Visão geral executiva com principais métricas do negócio',
    category: 'executive',
    widgets: [
      {
        type: 'metric',
        title: 'Total de Leads',
        dataSource: 'leads',
        metric: 'total',
        config: {},
      },
      {
        type: 'metric',
        title: 'Taxa de Conversão',
        dataSource: 'leads',
        metric: 'conversionRate',
        config: {},
      },
      {
        type: 'metric',
        title: 'Automações Ativas',
        dataSource: 'automations',
        metric: 'active',
        config: {},
      },
      {
        type: 'metric',
        title: 'Taxa de Conclusão de Tarefas',
        dataSource: 'tasks',
        metric: 'completionRate',
        config: {},
      },
      {
        type: 'funnel',
        title: 'Funil de Vendas',
        dataSource: 'pipeline',
        config: {},
      },
      {
        type: 'chart',
        title: 'Leads por Origem',
        dataSource: 'leads',
        chartType: 'pie',
        config: { dataSource: 'bySource' },
      },
    ],
    defaultFilters: {
      dateRange: {
        type: 'month',
      },
    },
  },
];

export function getTemplateById(templateId: string): ReportTemplate | undefined {
  return REPORT_TEMPLATES.find((t) => t.id === templateId);
}

export function getTemplatesByCategory(category: ReportTemplate['category']): ReportTemplate[] {
  return REPORT_TEMPLATES.filter((t) => t.category === category);
}

export function createReportFromTemplate(templateId: string, name?: string): Report {
  const template = getTemplateById(templateId);

  if (!template) {
    throw new Error(`Template não encontrado: ${templateId}`);
  }

  const reportId = generateId();
  const now = new Date().toISOString();

  // Criar widgets com IDs e posições
  const widgets: ReportWidget[] = template.widgets.map((widgetTemplate, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;

    return {
      ...widgetTemplate,
      id: generateId(),
      position: {
        x: col * 4,
        y: row * 3,
        w: 4,
        h: 3,
      },
    };
  });

  const report: Report = {
    id: reportId,
    name: name || template.name,
    description: template.description,
    type: template.category === 'executive' ? 'custom' : template.category,
    widgets,
    filters: template.defaultFilters,
    templateId: template.id,
    createdAt: now,
    updatedAt: now,
    createdBy: 'current-user',
  };

  return report;
}
