import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import { formatCustomFieldValue } from './customFields';

/**
 * Converte uma imagem base64 para Buffer
 */
function base64ToBuffer(base64: string): Buffer {
  // Remove o prefixo data:image/...;base64, se existir
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * Obtém informações da empresa
 */
function getCompanyInfo() {
  return { logo: null, companyName: 'VYD Engage' };
}

/**
 * Adiciona o nome da aplicação e logo ao cabeçalho da planilha
 * Linha 1: Nome da aplicação
 * Linha 2: Logo
 */
async function addHeaderToWorksheet(
  worksheet: ExcelJS.Worksheet,
  logo: string | null,
  companyName: string
) {
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
      // Converter base64 para buffer
      const imageBuffer = base64ToBuffer(logo);

      // Adicionar imagem na célula A2
      const imageId = worksheet.workbook.addImage({
        buffer: imageBuffer,
        extension: logo.startsWith('data:image/png') ? 'png' : 'jpeg',
      });

      // Inserir imagem na linha 2 (row 1 porque é 0-indexed) com tamanho 80x80
      worksheet.addImage(imageId, {
        tl: { col: 0, row: 1 },
        ext: { width: 80, height: 80 },
      });

      // Ajustar altura da linha para acomodar a imagem
      worksheet.getRow(2).height = 80;
      worksheet.getColumn(1).width = 15; // Largura suficiente para a imagem
    } catch (error) {
      console.error('Erro ao adicionar logo:', error);
      // Se falhar, adicionar apenas inicial
      const cellA2 = worksheet.getCell('A2');
      cellA2.value = companyName.charAt(0).toUpperCase();
      cellA2.font = { size: 32, bold: true, color: { argb: 'FF2563EB' } };
      cellA2.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 80;
      worksheet.getColumn(1).width = 15;
    }
  } else {
    // Sem logo, adicionar apenas inicial
    const cellA2 = worksheet.getCell('A2');
    cellA2.value = companyName.charAt(0).toUpperCase();
    cellA2.font = { size: 32, bold: true, color: { argb: 'FF2563EB' } };
    cellA2.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(2).height = 80;
    worksheet.getColumn(1).width = 15;
  }
}

/**
 * Exporta logs de automação para Excel com logo
 */
export async function exportAutomationLogsToExcel(
  logs: Array<{
    id: number;
    lead: string;
    automation: string;
    step: number;
    channel: 'whatsapp' | 'email';
    status: 'sent' | 'error' | 'pending';
    datetime: string;
    errorMessage?: string;
  }>,
  fileName?: string
) {
  const { logo, companyName } = getCompanyInfo();

  // Criar workbook e worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Logs de Automação');

  // Adicionar cabeçalho: nome na linha 1, logo na linha 2
  await addHeaderToWorksheet(worksheet, logo, companyName);

  // Adicionar título do relatório (linha 3)
  const cellA3 = worksheet.getCell('A3');
  cellA3.value = 'Logs de Automação';
  cellA3.font = { size: 18, bold: true, color: { argb: 'FF1F2937' } };
  worksheet.getRow(3).height = 25;
  worksheet.mergeCells('A3:D3');

  // Data de geração (linha 4)
  const cellA4 = worksheet.getCell('A4');
  cellA4.value = `Relatório gerado em ${new Date().toLocaleString('pt-BR')}`;
  cellA4.font = { size: 12, color: { argb: 'FF9CA3AF' } };
  worksheet.getRow(4).height = 20;
  worksheet.mergeCells('A4:D4');

  // Adicionar informações resumidas (linha 6)
  const sentCount = logs.filter((l) => l.status === 'sent').length;
  const errorCount = logs.filter((l) => l.status === 'error').length;
  const pendingCount = logs.filter((l) => l.status === 'pending').length;

  worksheet.getCell('A6').value = 'Total de Registros';
  worksheet.getCell('B6').value = logs.length;
  worksheet.getCell('A6').font = { size: 11, color: { argb: 'FF6B7280' } };
  worksheet.getCell('B6').font = { size: 14, bold: true };

  worksheet.getCell('A7').value = 'Enviados';
  worksheet.getCell('B7').value = sentCount;
  worksheet.getCell('A7').font = { size: 11, color: { argb: 'FF6B7280' } };
  worksheet.getCell('B7').font = { size: 14, bold: true, color: { argb: 'FF16A34A' } };

  worksheet.getCell('A8').value = 'Erros';
  worksheet.getCell('B8').value = errorCount;
  worksheet.getCell('A8').font = { size: 11, color: { argb: 'FF6B7280' } };
  worksheet.getCell('B8').font = { size: 14, bold: true, color: { argb: 'FFDC2626' } };

  worksheet.getCell('A9').value = 'Pendentes';
  worksheet.getCell('B9').value = pendingCount;
  worksheet.getCell('A9').font = { size: 11, color: { argb: 'FF6B7280' } };
  worksheet.getCell('B9').font = { size: 14, bold: true, color: { argb: 'FFEA580C' } };

  // Adicionar tabela de logs
  const headerRow = 11;
  const headers = [
    'ID',
    'Lead',
    'Automação',
    'Step',
    'Canal',
    'Status',
    'Data/Hora',
    'Mensagem de Erro',
  ];

  // Estilizar cabeçalho
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E40AF' } },
      left: { style: 'thin', color: { argb: 'FF1E40AF' } },
      bottom: { style: 'thin', color: { argb: 'FF1E40AF' } },
      right: { style: 'thin', color: { argb: 'FF1E40AF' } },
    };
  });

  // Adicionar dados
  logs.forEach((log, index) => {
    const row = headerRow + 1 + index;
    const channelLabel = log.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail';
    const statusLabel =
      log.status === 'sent' ? 'Enviado' : log.status === 'error' ? 'Erro' : 'Pendente';

    worksheet.getCell(row, 1).value = log.id;
    worksheet.getCell(row, 2).value = log.lead;
    worksheet.getCell(row, 3).value = log.automation;
    worksheet.getCell(row, 4).value = `Step ${log.step}`;
    worksheet.getCell(row, 5).value = channelLabel;
    worksheet.getCell(row, 6).value = statusLabel;
    worksheet.getCell(row, 7).value = log.datetime;
    worksheet.getCell(row, 8).value = log.errorMessage || '-';

    // Colorir status
    const statusCell = worksheet.getCell(row, 6);
    if (log.status === 'sent') {
      statusCell.font = { color: { argb: 'FF16A34A' }, bold: true };
    } else if (log.status === 'error') {
      statusCell.font = { color: { argb: 'FFDC2626' }, bold: true };
    } else {
      statusCell.font = { color: { argb: 'FFEA580C' }, bold: true };
    }

    // Colorir canal
    const channelCell = worksheet.getCell(row, 5);
    if (log.channel === 'whatsapp') {
      channelCell.font = { color: { argb: 'FF16A34A' } };
    } else {
      channelCell.font = { color: { argb: 'FF2563EB' } };
    }

    // Adicionar bordas
    for (let col = 1; col <= headers.length; col++) {
      const cell = worksheet.getCell(row, col);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };

      // Alternar cor de fundo
      if (index % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
      }
    }

    // Estilizar mensagem de erro se houver
    if (log.errorMessage) {
      const errorCell = worksheet.getCell(row, 8);
      errorCell.font = { color: { argb: 'FFDC2626' }, italic: true, size: 11 };
    }
  });

  // Ajustar largura das colunas
  worksheet.columns.forEach((column, index) => {
    if (index === 0)
      column.width = 8; // ID
    else if (index === 1)
      column.width = 20; // Lead
    else if (index === 2)
      column.width = 25; // Automação
    else if (index === 3)
      column.width = 10; // Step
    else if (index === 4)
      column.width = 12; // Canal
    else if (index === 5)
      column.width = 12; // Status
    else if (index === 6)
      column.width = 18; // Data/Hora
    else if (index === 7) column.width = 30; // Mensagem de Erro
  });

  // Adicionar rodapé
  const footerRow = headerRow + logs.length + 2;
  worksheet.mergeCells(`A${footerRow}:H${footerRow}`);
  const footerCell = worksheet.getCell(`A${footerRow}`);
  footerCell.value = `${companyName} - Sistema de Gestão de Leads | Relatório gerado em ${new Date().toLocaleString('pt-BR')}`;
  footerCell.font = { size: 11, color: { argb: 'FF6B7280' } };
  footerCell.alignment = { horizontal: 'center' };

  // Gerar arquivo e fazer download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  link.download = fileName || `Logs_Automacao_${companyName.replace(/\s+/g, '_')}_${dateStr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Exporta leads para Excel com logo
 */
export async function exportLeadsToExcel(
  leads: Array<{
    id: number;
    name: string;
    phone: string;
    email: string;
    status: string;
    source: string;
    date: string;
    automations?: number[];
    tags?: string[];
    customFields?: Record<string, any>;
  }>,
  filters: {
    status?: string[];
    source?: string[];
    automation?: string[];
    tag?: string[];
    searchQuery?: string;
  },
  getStatusLabel: (status: string) => string,
  getSourceLabel: (source: string) => string,
  getAutomationById: (id: number) => { name: string } | undefined,
  getTagById: (id: string) => { name: string } | undefined | null,
  fileName?: string
) {
  const { logo, companyName } = getCompanyInfo();

  // Criar workbook e worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Leads');

  // Adicionar cabeçalho: nome na linha 1, logo na linha 2
  await addHeaderToWorksheet(worksheet, logo, companyName);

  // Custom fields now come from API — pass empty array as fallback
  const customFields: any[] = [];

  // Função auxiliar para calcular letra da coluna
  const getColumnLetter = (colNum: number): string => {
    let result = '';
    while (colNum > 0) {
      colNum--;
      result = String.fromCharCode(65 + (colNum % 26)) + result;
      colNum = Math.floor(colNum / 26);
    }
    return result;
  };

  // Adicionar título do relatório (linha 3)
  const cellA3 = worksheet.getCell('A3');
  cellA3.value = 'Relatório de Leads';
  cellA3.font = { size: 18, bold: true, color: { argb: 'FF1F2937' } };
  worksheet.getRow(3).height = 25;
  const totalColumns3 = 8 + customFields.length;
  const lastColumn3 = getColumnLetter(totalColumns3);
  worksheet.mergeCells(`A3:${lastColumn3}3`);

  // Informações do relatório (linha 4)
  const currentDate = new Date().toLocaleDateString('pt-BR');
  const currentTime = new Date().toLocaleTimeString('pt-BR');
  const cellA4 = worksheet.getCell('A4');
  cellA4.value = `Relatório gerado em ${currentDate} às ${currentTime}`;
  cellA4.font = { size: 12, color: { argb: 'FF9CA3AF' } };
  worksheet.getRow(4).height = 20;
  const totalColumns4 = 8 + customFields.length;
  const lastColumn4 = getColumnLetter(totalColumns4);
  worksheet.mergeCells(`A4:${lastColumn4}4`);

  // Informações resumidas (linha 6)
  worksheet.getCell('A6').value = 'Total de Leads';
  worksheet.getCell('B6').value = leads.length;
  worksheet.getCell('A6').font = { size: 11, color: { argb: 'FF6B7280' } };
  worksheet.getCell('B6').font = { size: 14, bold: true };

  // Filtros aplicados (linha 7)
  let filterText = 'Filtros Aplicados: ';
  const filterParts: string[] = [];
  if (filters.status && filters.status.length > 0) {
    filterParts.push(`Status: ${filters.status.map((s) => getStatusLabel(s)).join(', ')}`);
  }
  if (filters.source && filters.source.length > 0) {
    filterParts.push(`Origem: ${filters.source.map((s) => getSourceLabel(s)).join(', ')}`);
  }
  if (filters.automation && filters.automation.length > 0) {
    filterParts.push(
      `Automação: ${filters.automation
        .map((a) => {
          if (a === 'with') return 'Com automações';
          if (a === 'without') return 'Sem automações';
          const automation = getAutomationById(Number(a));
          return automation?.name || '';
        })
        .filter(Boolean)
        .join(', ')}`
    );
  }
  if (filters.tag && filters.tag.length > 0 && getTagById) {
    filterParts.push(
      `Tags: ${filters.tag
        .map((t) => {
          const tag = getTagById(t);
          return tag?.name || t;
        })
        .join(', ')}`
    );
  }
  if (filters.searchQuery) {
    filterParts.push(`Busca: "${filters.searchQuery}"`);
  }

  filterText += filterParts.length > 0 ? filterParts.join('; ') : 'Nenhum';

  worksheet.getCell('A7').value = filterText;
  worksheet.getCell('A7').font = { size: 11, color: { argb: 'FF6B7280' } };
  const totalColumns7 = 8 + customFields.length;
  const lastColumn7 = getColumnLetter(totalColumns7);
  worksheet.mergeCells(`A7:${lastColumn7}7`);
  worksheet.getRow(7).height = 20;

  // Adicionar tabela de leads
  const headerRow = 9;
  const headers = [
    'ID',
    'Nome',
    'Telefone',
    'E-mail',
    'Status',
    'Origem',
    'Automações',
    'Data de Criação',
  ];

  // Adicionar cabeçalhos dos campos customizados
  customFields.forEach((field) => {
    headers.push(field.name);
  });

  // Estilizar cabeçalho
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E40AF' } },
      left: { style: 'thin', color: { argb: 'FF1E40AF' } },
      bottom: { style: 'thin', color: { argb: 'FF1E40AF' } },
      right: { style: 'thin', color: { argb: 'FF1E40AF' } },
    };
  });

  // Adicionar dados
  leads.forEach((lead, index) => {
    const row = headerRow + 1 + index;

    const automationsList =
      lead.automations && lead.automations.length > 0
        ? lead.automations.map((id) => getAutomationById(id)?.name || `ID: ${id}`).join(', ')
        : 'Nenhuma';

    worksheet.getCell(row, 1).value = lead.id;
    worksheet.getCell(row, 2).value = lead.name;
    worksheet.getCell(row, 3).value = lead.phone;
    worksheet.getCell(row, 4).value = lead.email;
    worksheet.getCell(row, 5).value = getStatusLabel(lead.status);
    worksheet.getCell(row, 6).value = getSourceLabel(lead.source);
    worksheet.getCell(row, 7).value = automationsList;
    worksheet.getCell(row, 8).value = lead.date;

    // Adicionar valores dos campos customizados
    customFields.forEach((field, fieldIndex) => {
      const value = lead.customFields?.[field.id];
      const formattedValue = formatCustomFieldValue(field, value);
      worksheet.getCell(row, 9 + fieldIndex).value = formattedValue || '-';
    });

    // Colorir status
    const statusCell = worksheet.getCell(row, 5);
    if (lead.status === 'novo') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      statusCell.font = { color: { argb: 'FF1E40AF' }, bold: true };
    } else if (lead.status === 'contato') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      statusCell.font = { color: { argb: 'FF92400E' }, bold: true };
    } else if (lead.status === 'fechado') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      statusCell.font = { color: { argb: 'FF065F46' }, bold: true };
    } else if (lead.status === 'perdido') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      statusCell.font = { color: { argb: 'FF991B1B' }, bold: true };
    }

    // Adicionar bordas
    for (let col = 1; col <= headers.length; col++) {
      const cell = worksheet.getCell(row, col);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };

      // Alternar cor de fundo
      if (index % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
      }
    }
  });

  // Ajustar largura das colunas
  worksheet.columns.forEach((column, index) => {
    if (index === 0)
      column.width = 8; // ID
    else if (index === 1)
      column.width = 25; // Nome
    else if (index === 2)
      column.width = 18; // Telefone
    else if (index === 3)
      column.width = 30; // E-mail
    else if (index === 4)
      column.width = 15; // Status
    else if (index === 5)
      column.width = 15; // Origem
    else if (index === 6)
      column.width = 35; // Automações
    else if (index === 7)
      column.width = 15; // Data
    else if (index >= 8 && index < 8 + customFields.length) {
      // Campos customizados - ajustar largura baseado no nome do campo
      const fieldIndex = index - 8;
      const field = customFields[fieldIndex];
      column.width = Math.max(15, Math.min(30, field.name.length + 5));
    }
  });

  // Adicionar rodapé
  const footerRow = headerRow + leads.length + 2;
  const totalColumns = 8 + customFields.length;
  const lastColumn = getColumnLetter(totalColumns);
  worksheet.mergeCells(`A${footerRow}:${lastColumn}${footerRow}`);
  const footerCell = worksheet.getCell(`A${footerRow}`);
  footerCell.value = `${companyName} - Sistema de Gestão de Leads | Relatório gerado em ${currentDate} às ${currentTime}`;
  footerCell.font = { size: 11, color: { argb: 'FF6B7280' } };
  footerCell.alignment = { horizontal: 'center' };

  // Gerar arquivo e fazer download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  link.download = fileName || `Leads_${companyName.replace(/\s+/g, '_')}_${dateStr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
