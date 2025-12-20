import { generateId } from "./id";

export interface DashboardWidget {
  id: string;
  type: "stat" | "chart" | "table" | "funnel";
  title: string;
  config: Record<string, any>;
  position: { x: number; y: number; w: number; h: number };
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  isDefault?: boolean;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: generateId(),
    type: "stat",
    title: "Total de Leads",
    config: { metric: "totalLeads" },
    position: { x: 0, y: 0, w: 3, h: 2 },
  },
  {
    id: generateId(),
    type: "stat",
    title: "Taxa de Conversão",
    config: { metric: "conversionRate" },
    position: { x: 3, y: 0, w: 3, h: 2 },
  },
  {
    id: generateId(),
    type: "stat",
    title: "Tempo Médio de Resposta",
    config: { metric: "avgResponseTime" },
    position: { x: 6, y: 0, w: 3, h: 2 },
  },
  {
    id: generateId(),
    type: "stat",
    title: "Leads no Funil",
    config: { metric: "leadsInPipeline" },
    position: { x: 9, y: 0, w: 3, h: 2 },
  },
  {
    id: generateId(),
    type: "chart",
    title: "Funil de Vendas",
    config: { chartType: "bar", dataSource: "funnel" },
    position: { x: 0, y: 2, w: 6, h: 4 },
  },
  {
    id: generateId(),
    type: "chart",
    title: "Origem dos Leads",
    config: { chartType: "pie", dataSource: "sources" },
    position: { x: 6, y: 2, w: 6, h: 4 },
  },
];

export function getDashboardLayouts(): DashboardLayout[] {
  try {
    const stored = localStorage.getItem("dashboardLayouts");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Erro ao carregar layouts do dashboard:", error);
  }
  
  // Retornar layout padrão
  return [
    {
      id: "default",
      name: "Padrão",
      widgets: DEFAULT_WIDGETS,
      isDefault: true,
    },
  ];
}

export function saveDashboardLayouts(layouts: DashboardLayout[]) {
  localStorage.setItem("dashboardLayouts", JSON.stringify(layouts));
}

export function getCurrentLayout(): DashboardLayout {
  const layouts = getDashboardLayouts();
  const currentId = localStorage.getItem("currentDashboardLayout") || "default";
  return layouts.find((l) => l.id === currentId) || layouts[0];
}

export function setCurrentLayout(layoutId: string) {
  localStorage.setItem("currentDashboardLayout", layoutId);
}

export function addWidget(layoutId: string, widget: Omit<DashboardWidget, "id">): DashboardWidget {
  const layouts = getDashboardLayouts();
  const layout = layouts.find((l) => l.id === layoutId);
  
  if (!layout) {
    throw new Error("Layout não encontrado");
  }

  const newWidget: DashboardWidget = {
    ...widget,
    id: generateId(),
  };

  layout.widgets.push(newWidget);
  saveDashboardLayouts(layouts);
  
  return newWidget;
}

export function updateWidget(layoutId: string, widgetId: string, updates: Partial<DashboardWidget>) {
  const layouts = getDashboardLayouts();
  const layout = layouts.find((l) => l.id === layoutId);
  
  if (!layout) {
    throw new Error("Layout não encontrado");
  }

  const widget = layout.widgets.find((w) => w.id === widgetId);
  if (!widget) {
    throw new Error("Widget não encontrado");
  }

  Object.assign(widget, updates);
  saveDashboardLayouts(layouts);
}

export function removeWidget(layoutId: string, widgetId: string) {
  const layouts = getDashboardLayouts();
  const layout = layouts.find((l) => l.id === layoutId);
  
  if (!layout) {
    throw new Error("Layout não encontrado");
  }

  layout.widgets = layout.widgets.filter((w) => w.id !== widgetId);
  saveDashboardLayouts(layouts);
}








