// Script para criar relatórios de exemplo para teste
import { Report } from "../types";
import { generateId } from "./id";

export function createSampleReports() {
  const sampleReports: Report[] = [
    {
      id: generateId(),
      name: "Relatório Semanal de Vendas",
      description: "Análise semanal de performance de vendas e conversões",
      type: "sales",
      widgets: [
        {
          id: generateId(),
          type: "metric",
          title: "Total de Vendas",
          config: { metric: "totalSales" },
          position: { x: 0, y: 0, w: 4, h: 2 },
        },
        {
          id: generateId(),
          type: "chart",
          title: "Vendas por Semana",
          config: { chartType: "bar", dataSource: "weeklySales" },
          position: { x: 4, y: 0, w: 8, h: 4 },
        },
      ],
      schedule: {
        enabled: true,
        frequency: "weekly",
        dayOfWeek: 1, // Segunda-feira
        time: "09:00",
        recipients: ["gerente@empresa.com"],
        format: "pdf",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
    },
    {
      id: generateId(),
      name: "Relatório de Leads Diário",
      description: "Acompanhamento diário de novos leads e conversões",
      type: "leads",
      widgets: [
        {
          id: generateId(),
          type: "metric",
          title: "Novos Leads Hoje",
          config: { metric: "newLeadsToday" },
          position: { x: 0, y: 0, w: 3, h: 2 },
        },
        {
          id: generateId(),
          type: "funnel",
          title: "Funil de Conversão",
          config: { dataSource: "conversionFunnel" },
          position: { x: 3, y: 0, w: 9, h: 4 },
        },
      ],
      schedule: {
        enabled: true,
        frequency: "daily",
        time: "18:00",
        recipients: ["equipe@empresa.com", "gerente@empresa.com"],
        format: "both",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
    },
  ];

  // Salvar no localStorage
  localStorage.setItem("reports", JSON.stringify(sampleReports));
  console.log("Relatórios de exemplo criados:", sampleReports.length);
  
  return sampleReports;
}


