import { Report } from "../types";
import { prepareImageForExcel } from "./imageUtils";
import ExcelJS from 'exceljs';
import {
  getLeadsData,
  getPipelineData,
  getAutomationsData,
  getTasksData,
  getInteractionsData,
  getDefaultDateRange,
} from "./reportData";

/**
 * Converte uma imagem base64 para Buffer
 */
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * Obtém informações da empresa do localStorage
 */
function getCompanyInfoForExport() {
  const logo = localStorage.getItem("companyLogo");
  const companyName = localStorage.getItem("companyName") || "FlowCRM";
  return { logo, companyName };
}

/**
 * Adiciona o nome da aplicação e logo ao cabeçalho da planilha
 * Linha 1: Nome da aplicação
 * Linha 2: Logo
 */
async function addLogoToReportWorksheet(worksheet: ExcelJS.Worksheet, logo: string | null, companyName: string) {
  // Linha 1: Nome da aplicação
  const cellA1 = worksheet.getCell('A1');
  cellA1.value = companyName;
  cellA1.font = { size: 24, bold: true, color: { argb: 'FF1F2937' } };
  cellA1.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 30;
  worksheet.mergeCells('A1:D1'); // Mesclar células para o nome
  
  // Linha 2: Logo
  if (logo) {
    try {
      const imageBuffer = base64ToBuffer(logo);
      const imageId = worksheet.workbook.addImage({
        buffer: imageBuffer,
        extension: logo.startsWith('data:image/png') ? 'png' : 'jpeg',
      });
      
      // Inserir imagem na linha 2 (row 1 porque é 0-indexed)
      worksheet.addImage(imageId, {
        tl: { col: 0, row: 1 },
        ext: { width: 80, height: 80 },
      });
      
      worksheet.getRow(2).height = 80;
      worksheet.getColumn(1).width = 15;
    } catch (error) {
      console.error('Erro ao adicionar logo:', error);
      const cellA2 = worksheet.getCell('A2');
      cellA2.value = companyName.charAt(0).toUpperCase();
      cellA2.font = { size: 32, bold: true, color: { argb: 'FF2563EB' } };
      cellA2.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 80;
      worksheet.getColumn(1).width = 15;
    }
  } else {
    const cellA2 = worksheet.getCell('A2');
    cellA2.value = companyName.charAt(0).toUpperCase();
    cellA2.font = { size: 32, bold: true, color: { argb: 'FF2563EB' } };
    cellA2.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(2).height = 80;
    worksheet.getColumn(1).width = 15;
  }
}

// Função auxiliar para obter logo e nome da empresa do localStorage (usado apenas para PDF)
function getCompanyInfo() {
  const logo = localStorage.getItem("companyLogo");
  const companyName = localStorage.getItem("companyName") || "FlowCRM";
  return { logo, companyName };
}

// Função auxiliar para obter dados reais baseado no widget
function getWidgetData(widget: any, filters?: any) {
  const dataSource = widget.dataSource || "leads";
  
  // Converter filtros do widget para o formato esperado
  let reportFilters: any = filters || {};
  if (widget.dateRange) {
    if (widget.dateRange.type === "custom" && widget.dateRange.start && widget.dateRange.end) {
      reportFilters.dateRange = {
        start: new Date(widget.dateRange.start),
        end: new Date(widget.dateRange.end),
      };
    } else if (widget.dateRange.type !== "all") {
      reportFilters.dateRange = getDefaultDateRange(widget.dateRange.type);
    }
  }
  
  switch (dataSource) {
    case "leads":
      return getLeadsData(reportFilters);
    case "pipeline":
      return getPipelineData(reportFilters);
    case "automations":
      return getAutomationsData(reportFilters);
    case "tasks":
      return getTasksData(reportFilters);
    case "interactions":
      return getInteractionsData(reportFilters);
    default:
      return getLeadsData(reportFilters);
  }
}

export function exportReportToPDF(report: Report) {
  const { logo, companyName } = getCompanyInfo();
  
  // Criar conteúdo HTML formatado para PDF
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${report.name}</title>
      <style>
        @media print {
          @page {
            margin: 2cm;
          }
        }
        body {
          font-family: Arial, sans-serif;
          color: #1F2937;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 20px;
          border-bottom: 3px solid #2563EB;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .logo-container {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #E5E7EB;
          border-radius: 8px;
          background-color: #F9FAFB;
          flex-shrink: 0;
        }
        .logo-container img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .header-text {
          flex: 1;
        }
        h1 {
          color: #1F2937;
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 14px;
          margin: 0;
        }
        .meta-info {
          display: flex;
          gap: 30px;
          margin: 20px 0;
          padding: 15px;
          background-color: #F9FAFB;
          border-radius: 8px;
        }
        .meta-item {
          flex: 1;
        }
        .meta-label {
          font-size: 12px;
          color: #6B7280;
          margin-bottom: 5px;
        }
        .meta-value {
          font-size: 14px;
          color: #1F2937;
          font-weight: 600;
        }
        .widget {
          margin: 30px 0;
          padding: 20px;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          page-break-inside: avoid;
        }
        .widget-title {
          font-size: 18px;
          font-weight: 600;
          color: #1F2937;
          margin-bottom: 15px;
          border-bottom: 2px solid #E5E7EB;
          padding-bottom: 10px;
        }
        .metric-value {
          font-size: 32px;
          font-weight: bold;
          color: #2563EB;
          margin: 10px 0;
        }
        .metric-label {
          font-size: 14px;
          color: #6B7280;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        th {
          background-color: #2563EB;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 600;
        }
        td {
          padding: 10px 12px;
          border-bottom: 1px solid #E5E7EB;
        }
        tr:hover {
          background-color: #F9FAFB;
        }
        .funnel-stage {
          margin: 15px 0;
        }
        .funnel-label {
          font-size: 14px;
          color: #6B7280;
          margin-bottom: 5px;
        }
        .funnel-bar {
          height: 30px;
          background-color: #E5E7EB;
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }
        .funnel-fill {
          height: 100%;
          background-color: #2563EB;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 10px;
          color: white;
          font-weight: 600;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #E5E7EB;
          text-align: center;
          font-size: 12px;
          color: #6B7280;
        }
      </style>
    </head>
    <body>
      <!-- Linha 1: Nome da aplicação -->
      <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #E5E7EB;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #1F2937;">${companyName}</h1>
      </div>
      
      <!-- Linha 2: Logo -->
      <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 3px solid #2563EB;">
        ${logo ? `
          <div style="width: 80px; height: 80px; border: 2px solid #E5E7EB; border-radius: 8px; background-color: #F9FAFB; display: inline-flex; align-items: center; justify-content: center; padding: 5px;">
            <img src="${logo}" alt="${companyName}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>
        ` : `
          <div style="width: 80px; height: 80px; border: 2px solid #E5E7EB; border-radius: 8px; background-color: #F9FAFB; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; color: #2563EB;">
            ${companyName.charAt(0).toUpperCase()}
          </div>
        `}
      </div>
      
      <!-- Linha 3: Título do relatório -->
      <div style="margin-bottom: 10px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: bold; color: #1F2937;">${report.name}</h2>
        ${report.description ? `<p class="subtitle" style="margin: 5px 0 0 0; font-size: 14px; color: #6B7280;">${report.description}</p>` : ""}
      </div>

      <div class="meta-info">
        <div class="meta-item">
          <div class="meta-label">Tipo</div>
          <div class="meta-value">${report.type.charAt(0).toUpperCase() + report.type.slice(1)}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Widgets</div>
          <div class="meta-value">${report.widgets.length}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Data de Criação</div>
          <div class="meta-value">${new Date(report.createdAt).toLocaleDateString('pt-BR')}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Última Atualização</div>
          <div class="meta-value">${new Date(report.updatedAt).toLocaleDateString('pt-BR')}</div>
        </div>
      </div>
  `;

  // Renderizar widgets com dados reais
  report.widgets.forEach((widget) => {
    htmlContent += `<div class="widget">`;
    htmlContent += `<div class="widget-title">${widget.title}</div>`;

    const data = getWidgetData(widget, report.filters);

    switch (widget.type) {
      case "metric":
        const metric = widget.metric || "total";
        let metricValue: string | number = "N/A";
        
        if (widget.dataSource === "leads") {
          switch (metric) {
            case "total":
              metricValue = data.total || 0;
              break;
            case "conversionRate":
              metricValue = `${data.conversionRate || 0}%`;
              break;
            case "avgResponseTime":
              metricValue = `${data.avgResponseTime || 0}h`;
              break;
            case "newLeads":
              metricValue = data.newLeads || 0;
              break;
            case "closedLeads":
              metricValue = data.closedLeads || 0;
              break;
          }
        } else if (widget.dataSource === "pipeline") {
          metricValue = metric === "conversionRate" ? `${data.conversionRate || 0}%` : data.totalLeads || 0;
        } else if (widget.dataSource === "automations") {
          switch (metric) {
            case "total":
              metricValue = data.total || 0;
              break;
            case "active":
              metricValue = data.active || 0;
              break;
            case "successRate":
              metricValue = `${data.successRate || 0}%`;
              break;
            case "totalSentMessages":
              metricValue = data.totalSentMessages || 0;
              break;
          }
        } else if (widget.dataSource === "tasks") {
          switch (metric) {
            case "total":
              metricValue = data.total || 0;
              break;
            case "completionRate":
              metricValue = `${data.completionRate || 0}%`;
              break;
            case "overdue":
              metricValue = data.overdue || 0;
              break;
            case "dueToday":
              metricValue = data.dueToday || 0;
              break;
          }
        }
        
        htmlContent += `
          <div class="metric-value">${metricValue}</div>
          <div class="metric-label">${widget.title}</div>
        `;
        break;

      case "chart":
        let chartData: any[] = [];
        if (widget.dataSource === "leads") {
          if (widget.config?.dataSource === "bySource" || widget.chartType === "pie") {
            chartData = Object.entries(data.bySource || {}).map(([name, value]) => ({
              name: name === "meta" ? "Meta Ads" : name === "google" ? "Google Ads" : name === "organico" ? "Orgânico" : "Manual",
              value: value as number,
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
          }));
        }
        
        if (chartData.length > 0) {
          htmlContent += `<table>`;
          htmlContent += `<thead><tr><th>Nome</th><th>Valor</th><th>Percentual</th></tr></thead><tbody>`;
          const total = chartData.reduce((sum, item) => sum + item.value, 0);
          chartData.forEach((item) => {
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
            htmlContent += `<tr><td>${item.name}</td><td>${item.value}</td><td>${percentage}%</td></tr>`;
          });
          htmlContent += `</tbody></table>`;
        }
        break;

      case "funnel":
        const stages = data.stages || [];
        const maxValue = Math.max(...stages.map((s: any) => s.count || 0), 1);
        htmlContent += `<div class="funnel-container">`;
        stages.forEach((stage: any) => {
          const percentage = maxValue > 0 ? (stage.count / maxValue) * 100 : 0;
          htmlContent += `
            <div class="funnel-stage">
              <div class="funnel-label">${stage.name}: ${stage.count}</div>
              <div class="funnel-bar">
                <div class="funnel-fill" style="width: ${percentage}%">${stage.count}</div>
              </div>
            </div>
          `;
        });
        htmlContent += `</div>`;
        break;

      case "table":
        let tableData: any[] = [];
        if (widget.dataSource === "leads") {
          tableData = Object.entries(data.bySource || {}).map(([name, value]) => ({
            name: name === "meta" ? "Meta Ads" : name === "google" ? "Google Ads" : name === "organico" ? "Orgânico" : "Manual",
            value,
          }));
        }
        
        if (tableData.length > 0) {
          htmlContent += `<table>`;
          htmlContent += `<thead><tr><th>Nome</th><th>Valor</th><th>Status</th></tr></thead><tbody>`;
          tableData.forEach((item) => {
            htmlContent += `<tr><td>${item.name}</td><td>${item.value}</td><td>Ativo</td></tr>`;
          });
          htmlContent += `</tbody></table>`;
        }
        break;
    }

    htmlContent += `</div>`;
  });
  
  // Adicionar informações sobre filtros aplicados
  if (report.filters) {
    htmlContent += `
      <div class="meta-info" style="margin-top: 30px;">
        <div class="meta-label" style="font-weight: bold; margin-bottom: 10px;">Filtros Aplicados</div>
        ${report.filters.dateRange ? `<div class="meta-item"><div class="meta-label">Período</div><div class="meta-value">${report.filters.dateRange.type || "Customizado"}</div></div>` : ""}
        ${report.filters.status && report.filters.status.length > 0 ? `<div class="meta-item"><div class="meta-label">Status</div><div class="meta-value">${report.filters.status.join(", ")}</div></div>` : ""}
        ${report.filters.source && report.filters.source.length > 0 ? `<div class="meta-item"><div class="meta-label">Origem</div><div class="meta-value">${report.filters.source.join(", ")}</div></div>` : ""}
      </div>
    `;
  }

  htmlContent += `
      <div class="footer">
        <p>Relatório gerado em ${new Date().toLocaleString('pt-BR')}</p>
        <p>FlowCRM - Sistema de Gestão de Leads</p>
      </div>
    </body>
    </html>
  `;

  // Abrir em nova janela para impressão
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }
}

export async function exportReportToExcel(report: Report) {
  const { logo, companyName } = getCompanyInfoForExport();
  
  // Usar ExcelJS para exportação com suporte a imagens
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(report.name);
    
    // Adicionar cabeçalho: nome na linha 1, logo na linha 2
    await addLogoToReportWorksheet(worksheet, logo, companyName);
    
    // Adicionar título do relatório (linha 3)
    const cellA3 = worksheet.getCell('A3');
    cellA3.value = report.name;
    cellA3.font = { size: 18, bold: true, color: { argb: 'FF1F2937' } };
    worksheet.getRow(3).height = 25;
    worksheet.mergeCells('A3:D3');
    
    // Descrição (linha 4)
    let currentRow = 4;
    if (report.description) {
      currentRow = 4;
      const cellA4 = worksheet.getCell('A4');
      cellA4.value = report.description;
      cellA4.font = { size: 14, color: { argb: 'FF6B7280' } };
      worksheet.getRow(4).height = 20;
      worksheet.mergeCells('A4:D4');
      currentRow = 6;
    } else {
      currentRow = 6;
    }
    
    // Adicionar informações do relatório
    worksheet.getCell(`A${currentRow}`).value = 'Tipo';
    worksheet.getCell(`B${currentRow}`).value = report.type.charAt(0).toUpperCase() + report.type.slice(1);
    currentRow++;
    
    worksheet.getCell(`A${currentRow}`).value = 'Data de Criação';
    worksheet.getCell(`B${currentRow}`).value = new Date(report.createdAt).toLocaleDateString('pt-BR');
    currentRow++;
    
    worksheet.getCell(`A${currentRow}`).value = 'Última Atualização';
    worksheet.getCell(`B${currentRow}`).value = new Date(report.updatedAt).toLocaleDateString('pt-BR');
    currentRow++;
    
    worksheet.getCell(`A${currentRow}`).value = 'Total de Widgets';
    worksheet.getCell(`B${currentRow}`).value = report.widgets.length;
    currentRow += 2;
    
    // Adicionar widgets com dados reais
    report.widgets.forEach((widget, index) => {
      const widgetRow = currentRow;
      worksheet.getCell(`A${widgetRow}`).value = `Widget ${index + 1}: ${widget.title}`;
      worksheet.getCell(`A${widgetRow}`).font = { size: 16, bold: true };
      currentRow++;
      
      worksheet.getCell(`A${currentRow}`).value = 'Tipo';
      worksheet.getCell(`B${currentRow}`).value = widget.type;
      currentRow++;
      
      const data = getWidgetData(widget, report.filters);
      
      if (widget.type === 'metric') {
        const metric = widget.metric || "total";
        let metricValue: string | number = "N/A";
        
        if (widget.dataSource === "leads") {
          switch (metric) {
            case "total":
              metricValue = data.total || 0;
              break;
            case "conversionRate":
              metricValue = `${data.conversionRate || 0}%`;
              break;
            case "avgResponseTime":
              metricValue = `${data.avgResponseTime || 0}h`;
              break;
            case "newLeads":
              metricValue = data.newLeads || 0;
              break;
            case "closedLeads":
              metricValue = data.closedLeads || 0;
              break;
          }
        } else if (widget.dataSource === "pipeline") {
          metricValue = metric === "conversionRate" ? `${data.conversionRate || 0}%` : data.totalLeads || 0;
        } else if (widget.dataSource === "automations") {
          switch (metric) {
            case "total":
              metricValue = data.total || 0;
              break;
            case "active":
              metricValue = data.active || 0;
              break;
            case "successRate":
              metricValue = `${data.successRate || 0}%`;
              break;
            case "totalSentMessages":
              metricValue = data.totalSentMessages || 0;
              break;
          }
        } else if (widget.dataSource === "tasks") {
          switch (metric) {
            case "total":
              metricValue = data.total || 0;
              break;
            case "completionRate":
              metricValue = `${data.completionRate || 0}%`;
              break;
            case "overdue":
              metricValue = data.overdue || 0;
              break;
            case "dueToday":
              metricValue = data.dueToday || 0;
              break;
          }
        }
        
        worksheet.getCell(`A${currentRow}`).value = 'Métrica';
        worksheet.getCell(`B${currentRow}`).value = metric;
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'Valor';
        worksheet.getCell(`B${currentRow}`).value = metricValue;
      } else if (widget.type === 'chart' || widget.type === 'table') {
        let tableData: any[] = [];
        if (widget.dataSource === "leads") {
          if (widget.config?.dataSource === "bySource") {
            tableData = Object.entries(data.bySource || {}).map(([name, value]) => ({
              name: name === "meta" ? "Meta Ads" : name === "google" ? "Google Ads" : name === "organico" ? "Orgânico" : "Manual",
              value,
            }));
          } else {
            tableData = Object.entries(data.byStatus || {}).map(([name, value]) => ({
              name: name === "novo" ? "Novo" : name === "contato" ? "Em Contato" : name === "fechado" ? "Fechado" : "Perdido",
              value,
            }));
          }
        } else if (widget.dataSource === "pipeline") {
          tableData = (data.stages || []).map((stage: any) => ({
            name: stage.name,
            value: stage.count,
          }));
        }
        
        if (tableData.length > 0) {
          worksheet.getCell(`A${currentRow}`).value = 'Dados';
          worksheet.getCell(`A${currentRow}`).font = { bold: true };
          currentRow++;
          worksheet.getCell(`A${currentRow}`).value = 'Nome';
          worksheet.getCell(`B${currentRow}`).value = 'Valor';
          worksheet.getRow(currentRow).font = { bold: true };
          currentRow++;
          
          tableData.forEach((item) => {
            worksheet.getCell(`A${currentRow}`).value = item.name;
            worksheet.getCell(`B${currentRow}`).value = item.value;
            currentRow++;
          });
        }
      } else if (widget.type === 'funnel') {
        const stages = data.stages || [];
        worksheet.getCell(`A${currentRow}`).value = 'Estágios do Funil';
        worksheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'Estágio';
        worksheet.getCell(`B${currentRow}`).value = 'Quantidade';
        worksheet.getRow(currentRow).font = { bold: true };
        currentRow++;
        
        stages.forEach((stage: any) => {
          worksheet.getCell(`A${currentRow}`).value = stage.name;
          worksheet.getCell(`B${currentRow}`).value = stage.count || 0;
          currentRow++;
        });
      }
      
      currentRow += 2;
    });
    
    // Adicionar informações sobre filtros aplicados
    if (report.filters) {
      worksheet.getCell(`A${currentRow}`).value = 'Filtros Aplicados';
      worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true };
      currentRow++;
      
      if (report.filters.dateRange) {
        worksheet.getCell(`A${currentRow}`).value = 'Período';
        worksheet.getCell(`B${currentRow}`).value = report.filters.dateRange.type || "Customizado";
        currentRow++;
      }
      if (report.filters.status && report.filters.status.length > 0) {
        worksheet.getCell(`A${currentRow}`).value = 'Status';
        worksheet.getCell(`B${currentRow}`).value = report.filters.status.join(", ");
        currentRow++;
      }
      if (report.filters.source && report.filters.source.length > 0) {
        worksheet.getCell(`A${currentRow}`).value = 'Origem';
        worksheet.getCell(`B${currentRow}`).value = report.filters.source.join(", ");
        currentRow++;
      }
      currentRow++;
    }
    
    // Ajustar largura das colunas
    worksheet.getColumn(1).width = 20;
    worksheet.getColumn(2).width = 30;
    
    // Adicionar rodapé
    const footerRow = currentRow + 1;
    worksheet.mergeCells(`A${footerRow}:B${footerRow}`);
    const footerCell = worksheet.getCell(`A${footerRow}`);
    footerCell.value = `${companyName} - Sistema de Gestão de Leads | Relatório gerado em ${new Date().toLocaleString('pt-BR')}`;
    footerCell.font = { size: 11, color: { argb: 'FF6B7280' } };
    footerCell.alignment = { horizontal: 'center' };
    
    // Gerar arquivo e fazer download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return;
  } catch (error) {
    console.error('Erro ao exportar com ExcelJS, usando método HTML:', error);
    // Fallback para método HTML antigo se houver erro
  }
  
  // Método HTML antigo como fallback (sem imagem)
  const { logo: logoHtml, companyName: companyNameHtml } = getCompanyInfoForExport();
  
  // Criar conteúdo HTML para Excel
  let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40" xmlns:v="urn:schemas-microsoft-com:vml">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
        </o:OfficeDocumentSettings>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Arial, sans-serif; }
        .header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 3px solid #2563EB;
        }
        .logo-container {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #E5E7EB;
          border-radius: 8px;
          background-color: #F9FAFB;
        }
        .logo-container img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .header-text {
          flex: 1;
        }
        h1 { color: #1F2937; margin-bottom: 10px; font-size: 24px; margin: 0; }
        h2 { color: #6B7280; font-size: 16px; margin-bottom: 20px; margin-top: 5px; }
        .info-section { margin-bottom: 30px; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th { background-color: #2563EB; color: white; padding: 12px; text-align: left; font-weight: bold; border: 1px solid #1E40AF; }
        td { padding: 10px; border: 1px solid #E5E7EB; }
        tr:nth-child(even) { background-color: #F9FAFB; }
        .widget-section { margin-top: 30px; page-break-after: always; }
        .widget-title { font-size: 18px; font-weight: bold; color: #1F2937; margin-bottom: 15px; }
      </style>
    </head>
    <body>
      <!-- Linha 1: Nome da aplicação -->
      <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #E5E7EB;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #1F2937;">${companyNameHtml}</h1>
      </div>
      
      <!-- Linha 2: Logo -->
      <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 3px solid #2563EB;">
        ${logoHtml ? `
          <div style="width: 80px; height: 80px; border: 2px solid #E5E7EB; border-radius: 8px; background-color: #F9FAFB; display: inline-flex; align-items: center; justify-content: center; padding: 5px;">
            <img src="${logoHtml}" alt="${companyNameHtml}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>
        ` : `
          <div style="width: 80px; height: 80px; border: 2px solid #E5E7EB; border-radius: 8px; background-color: #F9FAFB; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; color: #2563EB;">
            ${companyNameHtml.charAt(0).toUpperCase()}
          </div>
        `}
      </div>
      
      <!-- Linha 3: Título do relatório -->
      <div style="margin-bottom: 10px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: bold; color: #1F2937;">${report.name}</h2>
        ${report.description ? `<h3 style="margin: 5px 0 0 0; font-size: 14px; color: #6B7280;">${report.description}</h3>` : ""}
      </div>
      
      <div class="info-section">
        <table>
          <tr>
            <th>Campo</th>
            <th>Valor</th>
          </tr>
          <tr>
            <td>Tipo</td>
            <td>${report.type}</td>
          </tr>
          <tr>
            <td>Data de Criação</td>
            <td>${new Date(report.createdAt).toLocaleString('pt-BR')}</td>
          </tr>
          <tr>
            <td>Última Atualização</td>
            <td>${new Date(report.updatedAt).toLocaleString('pt-BR')}</td>
          </tr>
          <tr>
            <td>Total de Widgets</td>
            <td>${report.widgets.length}</td>
          </tr>
        </table>
      </div>
  `;

  // Adicionar dados dos widgets
  report.widgets.forEach((widget, index) => {
    htmlContent += `
      <div class="widget-section">
        <div class="widget-title">Widget ${index + 1}: ${widget.title}</div>
        <table>
          <tr>
            <th>Propriedade</th>
            <th>Valor</th>
          </tr>
          <tr>
            <td>Tipo</td>
            <td>${widget.type}</td>
          </tr>
          <tr>
            <td>Título</td>
            <td>${widget.title}</td>
          </tr>
    `;

    // Adicionar dados específicos baseado no tipo
    const data = getWidgetData(widget, report.filters);
    
    if (widget.type === "metric") {
      const metric = widget.metric || "total";
      let metricValue: string | number = "N/A";
      
      if (widget.dataSource === "leads") {
        switch (metric) {
          case "total":
            metricValue = data.total || 0;
            break;
          case "conversionRate":
            metricValue = `${data.conversionRate || 0}%`;
            break;
          case "avgResponseTime":
            metricValue = `${data.avgResponseTime || 0}h`;
            break;
          case "newLeads":
            metricValue = data.newLeads || 0;
            break;
          case "closedLeads":
            metricValue = data.closedLeads || 0;
            break;
        }
      } else if (widget.dataSource === "pipeline") {
        metricValue = metric === "conversionRate" ? `${data.conversionRate || 0}%` : data.totalLeads || 0;
      } else if (widget.dataSource === "automations") {
        switch (metric) {
          case "total":
            metricValue = data.total || 0;
            break;
          case "active":
            metricValue = data.active || 0;
            break;
          case "successRate":
            metricValue = `${data.successRate || 0}%`;
            break;
          case "totalSentMessages":
            metricValue = data.totalSentMessages || 0;
            break;
        }
      } else if (widget.dataSource === "tasks") {
        switch (metric) {
          case "total":
            metricValue = data.total || 0;
            break;
          case "completionRate":
            metricValue = `${data.completionRate || 0}%`;
            break;
          case "overdue":
            metricValue = data.overdue || 0;
            break;
          case "dueToday":
            metricValue = data.dueToday || 0;
            break;
        }
      }
      
      htmlContent += `
        <tr>
          <td>Métrica</td>
          <td>${metric}</td>
        </tr>
        <tr>
          <td>Valor</td>
          <td>${metricValue}</td>
        </tr>
      `;
    } else if (widget.type === "chart") {
      htmlContent += `
        <tr>
          <td>Tipo de Gráfico</td>
          <td>${widget.config.chartType || "bar"}</td>
        </tr>
        <tr>
          <td>Fonte de Dados</td>
          <td>${widget.config.dataSource || "default"}</td>
        </tr>
      `;
    }

    htmlContent += `</table></div>`;
  });

  htmlContent += `
      <div style="margin-top: 50px; text-align: center; color: #6B7280; font-size: 12px;">
        <p>Relatório gerado em ${new Date().toLocaleString('pt-BR')}</p>
        <p>FlowCRM - Sistema de Gestão de Leads</p>
      </div>
    </body>
    </html>
  `;

  // Criar blob e fazer download
  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

