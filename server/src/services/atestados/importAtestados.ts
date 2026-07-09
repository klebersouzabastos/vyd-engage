// Importação da planilha de atestados (req 28) — carrega os 112 atestados com seus
// responsáveis/funções/categorias, consolida profissionais por nome normalizado e
// mapeia categorias/funções para a taxonomia (req 37). Idempotente (não duplica) e
// com relatório. Usa ExcelJS (.xlsx) — mesmo parser dos demais imports.

import ExcelJS from 'exceljs';
import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { atestadoService } from './atestadoService.js';
import { taxonomiaService } from './taxonomiaService.js';
import { collapseSpaces } from './normalize.js';

interface RawFuncao {
  funcao: string;
  categoria: string | null;
}
interface RawResponsavel {
  nome: string;
  funcoes: RawFuncao[];
}
interface RawAtestado {
  numero: string;
  caixa: string | null;
  cat: string | null;
  contratante: string;
  contrato: string | null;
  periodo: string | null;
  objeto: string;
  responsaveis: RawResponsavel[];
}

export interface ImportReport {
  batchId: string;
  totalRows: number;
  created: number;
  skipped: number;
  errors: Array<{ numero: string; motivo: string }>;
}

/** Coerção robusta de uma célula ExcelJS para texto trimado. */
function cellText(cell: ExcelJS.Cell): string {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const obj = v as { richText?: Array<{ text: string }>; text?: string; result?: unknown };
    if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text).join('').trim();
    if (typeof obj.text === 'string') return obj.text.trim();
    if (obj.result != null) return String(obj.result).trim();
  }
  return String(v).trim();
}

/** Faz o parse da planilha na estrutura hierárquica (1 atestado → N responsáveis). */
export function parseAtestadosWorkbook(worksheet: ExcelJS.Worksheet): RawAtestado[] {
  const atestados: RawAtestado[] = [];
  let cur: RawAtestado | null = null;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // cabeçalho
    const g = (c: number) => {
      const t = cellText(row.getCell(c));
      return t === '' ? null : t;
    };
    const numero = g(1);
    if (numero) {
      cur = {
        numero,
        caixa: g(2),
        cat: g(3),
        contratante: g(4) ?? '',
        contrato: g(5),
        periodo: g(6),
        objeto: g(7) ?? '',
        responsaveis: [],
      };
      atestados.push(cur);
    }
    const nome = g(8);
    const funcao = g(9);
    const categoria = g(10);
    if (cur && (nome || funcao || categoria)) {
      if (nome) cur.responsaveis.push({ nome, funcoes: [] });
      const last = cur.responsaveis[cur.responsaveis.length - 1];
      if (last && funcao) last.funcoes.push({ funcao, categoria: categoria ?? null });
    }
  });

  return atestados;
}

export const importAtestadosService = {
  /**
   * Importa a planilha de atestados (.xlsx). Idempotente: pula atestados cujo número
   * já existe (por tenant, origem PRÓPRIO). Consolida profissionais e taxonomia.
   */
  async importBuffer(tenantId: string, userId: string, buffer: Buffer): Promise<ImportReport> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Planilha vazia ou ilegível');
    }

    const rows = parseAtestadosWorkbook(worksheet);

    const batch = await prisma.importBatch.create({
      data: { tenantId, userId, type: 'ATESTADOS', status: 'PROCESSING', totalRows: rows.length },
    });

    const report: ImportReport = { batchId: batch.id, totalRows: rows.length, created: 0, skipped: 0, errors: [] };
    const categorias = new Set<string>();
    const funcoes = new Set<string>();

    for (const raw of rows) {
      try {
        const numero = collapseSpaces(raw.numero);
        const existing = await prisma.atestado.findFirst({
          where: { tenantId, origem: 'PROPRIO', numero, deletedAt: null },
          select: { id: true },
        });
        if (existing) {
          report.skipped++;
          continue;
        }

        const created = await atestadoService.create(tenantId, {
          numero,
          caixa: raw.caixa,
          contratante: raw.contratante || 'Não informado',
          contrato: raw.contrato,
          objeto: raw.objeto || raw.contratante || numero,
          periodoTexto: raw.periodo,
          catNumero: raw.cat,
          origem: 'PROPRIO',
          responsaveis: raw.responsaveis.map((r) => ({
            nome: r.nome,
            funcoes: r.funcoes.map((f) => ({ funcao: f.funcao, categoria: f.categoria })),
          })),
        });
        await prisma.atestado.update({ where: { id: created.id }, data: { importBatchId: batch.id } });
        report.created++;

        for (const r of raw.responsaveis) {
          for (const f of r.funcoes) {
            if (f.categoria) categorias.add(f.categoria);
            if (f.funcao) funcoes.add(f.funcao);
          }
        }
      } catch (err) {
        report.errors.push({ numero: raw.numero, motivo: (err as Error).message });
      }
    }

    // Popula a taxonomia controlada a partir dos textos livres (req 37).
    for (const c of categorias) await taxonomiaService.mapOrCreate(tenantId, 'CATEGORIA', c).catch(() => null);
    for (const f of funcoes) await taxonomiaService.mapOrCreate(tenantId, 'SERVICO', f).catch(() => null);

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: 'COMPLETED',
        importedRows: report.created,
        skippedRows: report.skipped,
        errorRows: report.errors.length,
        errorLog: report.errors.length ? (report.errors.slice(0, 100) as unknown as object) : undefined,
      },
    });

    logger.info(
      `Import de atestados: ${report.created} criados, ${report.skipped} pulados, ${report.errors.length} erros`
    );
    return report;
  },
};
