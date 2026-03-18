import { Response } from 'express';
import prisma from '../config/database.js';
import ExcelJS from 'exceljs';

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export type ExportFormat = 'json' | 'csv' | 'xlsx';

interface ExportFilters {
  status?: string;
  source?: string;
  search?: string;
  tagId?: string;
  assignedTo?: string;
  // Deal-specific
  stage?: string;
  minValue?: number;
  maxValue?: number;
  leadId?: string;
  // Task-specific
  priority?: string;
  startDate?: string;
  endDate?: string;
}

const MAX_EXPORT_ROWS = 50_000;

// ────────────────────────────────────────────────────────────────────
// CSV helpers
// ────────────────────────────────────────────────────────────────────

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If the value contains a comma, double-quote, newline, or starts/ends with whitespace, wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str !== str.trim()) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(',') + '\r\n';
}

function formatDateISO(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// ────────────────────────────────────────────────────────────────────
// Lead Export
// ────────────────────────────────────────────────────────────────────

export async function exportLeads(
  tenantId: string,
  filters: ExportFilters,
  format: ExportFormat,
  res: Response,
) {
  // Build where clause
  const where: any = { tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.source) where.source = filters.source;
  if (filters.assignedTo) where.assignedTo = filters.assignedTo;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { company: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.tagId) {
    where.tags = { some: { tagId: filters.tagId } };
  }

  // Safety limit check
  const count = await prisma.lead.count({ where });
  if (count > MAX_EXPORT_ROWS) {
    res.status(400).json({
      status: 400,
      error: `Export limit exceeded. Found ${count} records, maximum is ${MAX_EXPORT_ROWS}.`,
    });
    return;
  }

  // JSON — backward compatible
  if (format === 'json') {
    const leads = await prisma.lead.findMany({
      where,
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });
    res.json({ status: 200, data: leads });
    return;
  }

  // Fetch custom fields for dynamic columns
  const customFieldDefs = await prisma.customField.findMany({
    where: { tenantId, active: true },
    orderBy: { order: 'asc' },
  });

  // Fetch data with relations
  const leads = await prisma.lead.findMany({
    where,
    include: {
      tags: { include: { tag: true } },
      assignedUser: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_EXPORT_ROWS,
  });

  // Build column definitions
  const staticHeaders = [
    'Nome', 'Email', 'Telefone', 'Empresa', 'Cargo', 'Status',
    'Fonte', 'Score', 'Responsavel', 'Tags', 'Data Criacao', 'Data Atualizacao',
  ];
  const dynamicHeaders = customFieldDefs.map((cf: any) => cf.label || cf.name);
  const allHeaders = [...staticHeaders, ...dynamicHeaders];

  // Map rows
  const rows = leads.map((lead: any) => {
    const tagStr = lead.tags?.map((lt: any) => lt.tag?.name).filter(Boolean).join(', ') || '';
    const assignedName = lead.assignedUser?.name || '';
    const staticValues = [
      lead.name || '',
      lead.email || '',
      lead.phone || '',
      lead.company || '',
      lead.position || '',
      lead.status || '',
      lead.source || '',
      lead.score ?? 0,
      assignedName,
      tagStr,
      formatDateISO(lead.createdAt),
      formatDateISO(lead.updatedAt),
    ];
    const dynamicValues = customFieldDefs.map((cf: any) => {
      const cfData = lead.customFields as Record<string, any> | null;
      return cfData?.[cf.name] ?? cfData?.[cf.id] ?? '';
    });
    return [...staticValues, ...dynamicValues];
  });

  if (format === 'csv') {
    return streamCsv(res, 'leads', allHeaders, rows);
  }

  return streamXlsx(res, 'leads', 'Leads', allHeaders, rows);
}

// ────────────────────────────────────────────────────────────────────
// Deal Export
// ────────────────────────────────────────────────────────────────────

export async function exportDeals(
  tenantId: string,
  filters: ExportFilters,
  format: ExportFormat,
  res: Response,
) {
  const where: any = { tenantId };
  if (filters.stage) where.stage = filters.stage;
  if (filters.assignedTo) where.assignedTo = filters.assignedTo;
  if (filters.leadId) where.leadId = filters.leadId;
  if (filters.search) {
    where.OR = [{ name: { contains: filters.search, mode: 'insensitive' } }];
  }
  if (filters.minValue !== undefined) {
    where.value = { ...where.value, gte: filters.minValue };
  }
  if (filters.maxValue !== undefined) {
    where.value = { ...where.value, lte: filters.maxValue };
  }

  const count = await prisma.deal.count({ where });
  if (count > MAX_EXPORT_ROWS) {
    res.status(400).json({
      status: 400,
      error: `Export limit exceeded. Found ${count} records, maximum is ${MAX_EXPORT_ROWS}.`,
    });
    return;
  }

  if (format === 'json') {
    const deals = await prisma.deal.findMany({
      where,
      include: {
        lead: { select: { name: true } },
        assignedUser: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });
    res.json({ status: 200, data: deals });
    return;
  }

  const deals = await prisma.deal.findMany({
    where,
    include: {
      lead: { select: { name: true } },
      assignedUser: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_EXPORT_ROWS,
  });

  const headers = [
    'Nome', 'Valor', 'Estagio', 'Probabilidade', 'Data Prevista Fechamento',
    'Lead Associado', 'Responsavel', 'Notas', 'Data Criacao', 'Data Fechamento',
  ];

  const rows = deals.map((deal: any) => [
    deal.name || '',
    Number(deal.value) || 0,
    deal.stage || '',
    deal.probability ?? 0,
    formatDateISO(deal.expectedCloseDate),
    deal.lead?.name || '',
    deal.assignedUser?.name || '',
    deal.notes || '',
    formatDateISO(deal.createdAt),
    formatDateISO(deal.closedAt),
  ]);

  if (format === 'csv') {
    return streamCsv(res, 'deals', headers, rows);
  }

  return streamXlsx(res, 'deals', 'Deals', headers, rows);
}

// ────────────────────────────────────────────────────────────────────
// Task Export
// ────────────────────────────────────────────────────────────────────

export async function exportTasks(
  tenantId: string,
  filters: ExportFilters,
  format: ExportFormat,
  res: Response,
) {
  const where: any = { tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.assignedTo) where.assignedTo = filters.assignedTo;
  if (filters.leadId) where.leadId = filters.leadId;
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.startDate && filters.endDate) {
    where.dueDate = {
      gte: new Date(filters.startDate),
      lte: new Date(new Date(filters.endDate).setHours(23, 59, 59, 999)),
    };
  }

  const count = await prisma.task.count({ where });
  if (count > MAX_EXPORT_ROWS) {
    res.status(400).json({
      status: 400,
      error: `Export limit exceeded. Found ${count} records, maximum is ${MAX_EXPORT_ROWS}.`,
    });
    return;
  }

  if (format === 'json') {
    const tasks = await prisma.task.findMany({
      where,
      include: {
        lead: { select: { name: true } },
        deal: { select: { name: true } },
        assignedUser: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });
    res.json({ status: 200, data: tasks });
    return;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      lead: { select: { name: true } },
      deal: { select: { name: true } },
      assignedUser: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_EXPORT_ROWS,
  });

  const headers = [
    'Titulo', 'Descricao', 'Status', 'Prioridade', 'Responsavel',
    'Lead Associado', 'Deal Associado', 'Data Vencimento', 'Data Conclusao', 'Data Criacao',
  ];

  const rows = tasks.map((task: any) => [
    task.title || '',
    task.description || '',
    task.status || '',
    task.priority || '',
    task.assignedUser?.name || '',
    task.lead?.name || '',
    task.deal?.name || '',
    formatDateISO(task.dueDate),
    formatDateISO(task.completedAt),
    formatDateISO(task.createdAt),
  ]);

  if (format === 'csv') {
    return streamCsv(res, 'tasks', headers, rows);
  }

  return streamXlsx(res, 'tasks', 'Tasks', headers, rows);
}

// ────────────────────────────────────────────────────────────────────
// Streaming helpers
// ────────────────────────────────────────────────────────────────────

function streamCsv(
  res: Response,
  entityName: string,
  headers: string[],
  rows: unknown[][],
) {
  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${entityName}-export-${dateStr}.csv"`);

  // Write BOM for Excel UTF-8 compatibility
  res.write('\uFEFF');
  // Write header
  res.write(csvRow(headers));
  // Write rows
  for (const row of rows) {
    res.write(csvRow(row));
  }
  res.end();
}

async function streamXlsx(
  res: Response,
  entityName: string,
  sheetName: string,
  headers: string[],
  rows: unknown[][],
) {
  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${entityName}-export-${dateStr}.xlsx"`);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  // Header row — bold
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  });

  // Data rows
  for (const row of rows) {
    sheet.addRow(row);
  }

  // Auto-width columns based on content
  sheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const cellValue = cell.value ? String(cell.value) : '';
      maxLength = Math.max(maxLength, Math.min(cellValue.length + 2, 50));
    });
    column.width = maxLength;
  });

  await workbook.xlsx.write(res);
  res.end();
}
