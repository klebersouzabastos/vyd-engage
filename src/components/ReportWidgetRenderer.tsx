import { ReportWidget } from "../types";
import { StatCard } from "./StatCard";
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
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { Users, TrendingUp, Clock, Target, CheckSquare, Zap, Mail } from "lucide-react";
import {
  getLeadsData,
  getPipelineData,
  getAutomationsData,
  getTasksData,
  getInteractionsData,
  getDefaultDateRange,
  ReportFilters,
} from "../utils/reportData";

interface ReportWidgetRendererProps {
  widget: ReportWidget;
  globalFilters?: ReportFilters;
}

export function ReportWidgetRenderer({ widget, globalFilters }: ReportWidgetRendererProps) {
  // Combinar filtros globais com filtros do widget
  const filters: ReportFilters = {
    ...globalFilters,
    ...widget.filters,
  };

  // Converter dateRange do widget para o formato esperado
  if (widget.dateRange) {
    if (widget.dateRange.type === "custom" && widget.dateRange.start && widget.dateRange.end) {
      filters.dateRange = {
        start: new Date(widget.dateRange.start),
        end: new Date(widget.dateRange.end),
      };
    } else if (widget.dateRange.type !== "all") {
      const dateRange = getDefaultDateRange(widget.dateRange.type);
      filters.dateRange = dateRange;
    }
  }

  // Buscar dados baseado na fonte de dados do widget
  const dataSource = widget.dataSource || "leads";
  let data: any = {};

  switch (dataSource) {
    case "leads":
      data = getLeadsData(filters);
      break;
    case "pipeline":
      data = getPipelineData(filters);
      break;
    case "automations":
      data = getAutomationsData(filters);
      break;
    case "tasks":
      data = getTasksData(filters);
      break;
    case "interactions":
      data = getInteractionsData(filters);
      break;
  }

  // Renderizar widget baseado no tipo
  switch (widget.type) {
    case "metric":
      return renderMetric(widget, data);
    case "chart":
      return renderChart(widget, data);
    case "table":
      return renderTable(widget, data);
    case "funnel":
      return renderFunnel(widget, data);
    default:
      return (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB]">
          <h3 className="text-[#1F2937]">{widget.title}</h3>
          <p className="text-sm text-[#6B7280] mt-2">Tipo de widget não suportado: {widget.type}</p>
        </div>
      );
  }
}

function renderMetric(widget: ReportWidget, data: any) {
  const metric = widget.metric || "total";
  let value: string | number = 0;
  let icon = Users;
  let trend: any = undefined;

  if (widget.dataSource === "leads") {
    switch (metric) {
      case "total":
        value = data.total || 0;
        icon = Users;
        break;
      case "conversionRate":
        value = `${data.conversionRate || 0}%`;
        icon = TrendingUp;
        break;
      case "avgResponseTime":
        value = `${data.avgResponseTime || 0}h`;
        icon = Clock;
        break;
      case "newLeads":
        value = data.newLeads || 0;
        icon = Users;
        break;
      case "closedLeads":
        value = data.closedLeads || 0;
        icon = Target;
        break;
    }
  } else if (widget.dataSource === "pipeline") {
    switch (metric) {
      case "conversionRate":
        value = `${data.conversionRate || 0}%`;
        icon = TrendingUp;
        break;
      case "totalLeads":
        value = data.totalLeads || 0;
        icon = Users;
        break;
    }
  } else if (widget.dataSource === "automations") {
    switch (metric) {
      case "total":
        value = data.total || 0;
        icon = Zap;
        break;
      case "active":
        value = data.active || 0;
        icon = Zap;
        break;
      case "successRate":
        value = `${data.successRate || 0}%`;
        icon = TrendingUp;
        break;
      case "totalSentMessages":
        value = data.totalSentMessages || 0;
        icon = Mail;
        break;
    }
  } else if (widget.dataSource === "tasks") {
    switch (metric) {
      case "total":
        value = data.total || 0;
        icon = CheckSquare;
        break;
      case "completionRate":
        value = `${data.completionRate || 0}%`;
        icon = TrendingUp;
        break;
      case "overdue":
        value = data.overdue || 0;
        icon = Clock;
        break;
      case "dueToday":
        value = data.dueToday || 0;
        icon = Clock;
        break;
    }
  } else if (widget.dataSource === "interactions") {
    switch (metric) {
      case "total":
        value = data.total || 0;
        icon = Users;
        break;
      case "avgPerLead":
        value = data.avgPerLead || 0;
        icon = TrendingUp;
        break;
    }
  }

  return (
    <StatCard
      key={widget.id}
      title={widget.title}
      value={value}
      icon={icon}
      trend={trend}
    />
  );
}

function renderChart(widget: ReportWidget, data: any) {
  const chartType = widget.chartType || "bar";
  let chartData: any[] = [];

  if (widget.dataSource === "leads") {
    if (widget.config?.dataSource === "bySource" || chartType === "pie") {
      chartData = Object.entries(data.bySource || {}).map(([name, value]) => ({
        name: name === "meta" ? "Meta Ads" : name === "google" ? "Google Ads" : name === "organico" ? "Orgânico" : "Manual",
        value: value as number,
        color: name === "meta" ? "#3B82F6" : name === "google" ? "#DC2626" : name === "organico" ? "#16A34A" : "#6B7280",
      }));
    } else {
      chartData = Object.entries(data.byStatus || {}).map(([name, value]) => ({
        name: name === "novo" ? "Novo" : name === "contato" ? "Em Contato" : name === "fechado" ? "Fechado" : "Perdido",
        value: value as number,
      }));
    }
  } else if (widget.dataSource === "pipeline") {
    chartData = (data.stages || []).map((stage: any) => ({
      name: stage.name,
      value: stage.count,
      color: stage.color,
    }));
  } else if (widget.dataSource === "automations") {
    if (widget.config?.dataSource === "byType") {
      chartData = Object.entries(data.byType || {}).map(([name, value]) => ({
        name: name === "whatsapp" ? "WhatsApp" : "E-mail",
        value: value as number,
        color: name === "whatsapp" ? "#16A34A" : "#3B82F6",
      }));
    } else {
      chartData = Object.entries(data.byStatus || {}).map(([name, value]) => ({
        name: name === "active" ? "Ativo" : "Pausado",
        value: value as number,
      }));
    }
  } else if (widget.dataSource === "tasks") {
    chartData = Object.entries(data.byPriority || {}).map(([name, value]) => ({
      name: name === "low" ? "Baixa" : name === "medium" ? "Média" : "Alta",
      value: value as number,
      color: name === "low" ? "#16A34A" : name === "medium" ? "#F59E0B" : "#DC2626",
    }));
  } else if (widget.dataSource === "interactions") {
    chartData = Object.entries(data.byType || {}).map(([name, value]) => ({
      name: name === "note" ? "Nota" : name === "call" ? "Chamada" : name === "email" ? "E-mail" : name === "whatsapp" ? "WhatsApp" : name,
      value: value as number,
    }));
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB]">
        <h3 className="text-[#1F2937] mb-4">{widget.title}</h3>
        <p className="text-sm text-[#6B7280]">Nenhum dado disponível</p>
      </div>
    );
  }

  if (chartType === "pie") {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB]">
        <h3 className="text-[#1F2937] mb-4">{widget.title}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || "#3B82F6"} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 justify-center mt-4">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color || "#3B82F6" }}
              />
              <span className="text-sm text-[#6B7280]">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (chartType === "line") {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB]">
        <h3 className="text-[#1F2937] mb-4">{widget.title}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "area") {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB]">
        <h3 className="text-[#1F2937] mb-4">{widget.title}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#2563EB" fill="#2563EB" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Bar chart (default)
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB]">
      <h3 className="text-[#1F2937] mb-4">{widget.title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || "#3B82F6"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function renderTable(widget: ReportWidget, data: any) {
  let tableData: any[] = [];

  if (widget.dataSource === "leads") {
    if (widget.config?.dataSource === "bySource") {
      tableData = Object.entries(data.bySource || {}).map(([name, value]) => ({
        name: name === "meta" ? "Meta Ads" : name === "google" ? "Google Ads" : name === "organico" ? "Orgânico" : "Manual",
        value,
        status: "Ativo",
      }));
    } else {
      tableData = Object.entries(data.byStatus || {}).map(([name, value]) => ({
        name: name === "novo" ? "Novo" : name === "contato" ? "Em Contato" : name === "fechado" ? "Fechado" : "Perdido",
        value,
        status: "Ativo",
      }));
    }
  } else if (widget.dataSource === "automations") {
    tableData = Object.entries(data.byType || {}).map(([name, value]) => ({
      name: name === "whatsapp" ? "WhatsApp" : "E-mail",
      value,
      status: "Ativo",
    }));
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB]">
      <h3 className="text-[#1F2937] mb-4">{widget.title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-[#6B7280] uppercase">Nome</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[#6B7280] uppercase">Valor</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-[#6B7280] uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {tableData.map((item, index) => (
              <tr key={index}>
                <td className="px-4 py-2 text-sm text-[#1F2937]">{item.name}</td>
                <td className="px-4 py-2 text-sm text-[#6B7280]">{item.value}</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderFunnel(widget: ReportWidget, data: any) {
  const stages = data.stages || [];
  const maxValue = Math.max(...stages.map((s: any) => s.count || 0), 1);

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB]">
      <h3 className="text-[#1F2937] mb-4">{widget.title}</h3>
      <div className="space-y-4">
        {stages.map((stage: any, index: number) => {
          const percentage = maxValue > 0 ? (stage.count / maxValue) * 100 : 0;
          return (
            <div key={index} className="flex items-center gap-4">
              <div className="w-24 text-sm text-[#6B7280]">{stage.name}</div>
              <div className="flex-1 bg-[#E5E7EB] rounded-full h-8 relative overflow-hidden">
                <div
                  className="h-full rounded-full flex items-center justify-end pr-4"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: stage.color || "#3B82F6",
                  }}
                >
                  <span className="text-white text-sm font-medium">{stage.count}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

