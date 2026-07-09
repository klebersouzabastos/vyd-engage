// Testes unitários (sem DB) da lógica de parsing/normalização do módulo de
// Atestados. Mocka o singleton Prisma para não abrir conexão real (padrão do repo).
import { describe, it, expect, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

vi.mock('../../config/database.js', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

import { normalizeName, collapseSpaces, parseBrNumber, parseBrDate } from '../../services/atestados/normalize.js';
import { chunkText } from '../../services/atestados/ragService.js';
import { parseAtestadosWorkbook } from '../../services/atestados/importAtestados.js';

describe('normalize', () => {
  it('normaliza nome removendo acentos e colapsando espaços', () => {
    expect(normalizeName('  José   da  Silva ')).toBe('jose da silva');
    expect(normalizeName('Projeto Metrô    Projeto Edificação')).toBe('projeto metro projeto edificacao');
  });

  it('dedup: nomes equivalentes geram a mesma chave', () => {
    expect(normalizeName('José de Miranda')).toBe(normalizeName('Jose  de   Miranda'));
  });

  it('collapseSpaces preserva acentos e caixa', () => {
    expect(collapseSpaces('  Projeto   Hidráulico ')).toBe('Projeto Hidráulico');
  });

  it('parseBrNumber tolera as duas formas (BR e SheetJS)', () => {
    expect(parseBrNumber('25.350,29')).toBe(25350.29);
    expect(parseBrNumber('25350.29')).toBe(25350.29);
    expect(parseBrNumber('')).toBeUndefined();
  });

  it('parseBrDate entende DD/MM/AAAA e MM/AAAA', () => {
    expect(parseBrDate('05/11/1982')?.getFullYear()).toBe(1982);
    expect(parseBrDate('10/1986')?.getMonth()).toBe(9); // outubro (0-index)
    expect(parseBrDate('***')).toBeUndefined();
  });
});

describe('chunkText', () => {
  it('retorna [] para texto vazio', () => {
    expect(chunkText('   ')).toEqual([]);
  });
  it('quebra texto longo em múltiplos chunks', () => {
    const chunks = chunkText('palavra '.repeat(400));
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('parseAtestadosWorkbook', () => {
  it('agrupa responsáveis e funções por atestado (1 atestado → N responsáveis)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('TENAX');
    // Cabeçalho
    ws.addRow(['Número', 'Caixa', 'CAT', 'Contratante', 'Contrato', 'Período', 'Objeto', 'Responsáveis', 'Função', 'Categoria']);
    // Atestado 1 com 2 responsáveis; o 1º tem 2 funções
    ws.addRow([1, 'CX001', '001/94', 'ALBRAS', 'AB-1', '150 DIAS', 'Projeto X', 'Sinval Silva', 'Hidráulico', 'Saneamento']);
    ws.addRow([null, null, null, null, null, null, null, null, 'Elétrico', null]);
    ws.addRow([null, null, null, null, null, null, null, 'Maurício Noce', 'Estrutural', 'Rodoviário']);
    // Atestado 2
    ws.addRow([2, 'CX002', '002/94', 'CEF', 'X', '***', 'Projeto Y', 'Antonio B', 'Arquitetônico', 'Edificação']);

    const parsed = parseAtestadosWorkbook(ws);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].numero).toBe('1');
    expect(parsed[0].contratante).toBe('ALBRAS');
    expect(parsed[0].responsaveis).toHaveLength(2);
    expect(parsed[0].responsaveis[0].nome).toBe('Sinval Silva');
    expect(parsed[0].responsaveis[0].funcoes).toHaveLength(2);
    expect(parsed[0].responsaveis[0].funcoes[1].funcao).toBe('Elétrico');
    expect(parsed[0].responsaveis[1].nome).toBe('Maurício Noce');
    expect(parsed[1].numero).toBe('2');
    expect(parsed[1].responsaveis[0].nome).toBe('Antonio B');
  });
});
