// Bloco "Experiências da consultoria" anexado ao prompt da Pesquisa Profunda.
// O cap. de Posicionamento pedia ao modelo para "relacionar com as experiências
// da TENAX" sem que o modelo soubesse quais são: este bloco traz o acervo real
// de Atestados Técnicos do tenant (só PROPRIO), em formato compacto e com teto.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';

vi.mock('../../utils/logger.js', () => ({
  __esModule: true,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
const { semanticSearchMock } = vi.hoisted(() => ({ semanticSearchMock: vi.fn() }));
vi.mock('../../services/atestados/ragService.js', () => ({
  __esModule: true,
  semanticSearch: semanticSearchMock,
}));

import {
  buildExperienceContext,
  EXPERIENCES_APPENDIX_TITLE,
} from '../../services/deepResearch/experienceContext.js';

type AtestadoRow = {
  id: string;
  contratante: string;
  objeto: string;
  dataInicio: Date | null;
  dataConclusao: Date | null;
  valorContrato: { toNumber(): number } | null;
  responsaveis: Array<{ funcoes: Array<{ funcao: string; categoria: string | null }> }>;
  quantitativos: Array<{ grandeza: string; valor: { toNumber(): number }; unidade: string }>;
};

function atestado(
  id: string,
  contratante: string,
  ano: number,
  objeto = `Projeto básico da planta ${id}`,
  extra: Partial<AtestadoRow> = {}
): AtestadoRow {
  return {
    id,
    contratante,
    objeto,
    dataInicio: new Date(`${ano - 1}-03-01T00:00:00Z`),
    dataConclusao: new Date(`${ano}-11-30T00:00:00Z`),
    valorContrato: { toNumber: () => 1_000_000 },
    responsaveis: [{ funcoes: [{ funcao: 'Coordenador', categoria: 'Engenharia de processo' }] }],
    quantitativos: [{ grandeza: 'Capacidade', valor: { toNumber: () => 1.5 }, unidade: 'Mtpa' }],
    ...extra,
  };
}

function mockAcervo(rows: AtestadoRow[]) {
  prismaMock.tenant.findUnique.mockResolvedValue({ name: 'TENAX' } as never);
  prismaMock.atestado.findMany.mockResolvedValue(rows as never);
}

/** Argumentos da consulta ao acervo, tipados de forma frouxa para inspeção. */
function argsDaConsulta() {
  const calls = prismaMock.atestado.findMany.mock.calls as unknown as Array<
    [{ where: Record<string, unknown> }]
  >;
  return calls[0][0];
}

beforeEach(() => {
  semanticSearchMock.mockResolvedValue([]);
  delete process.env.DEEP_RESEARCH_EXPERIENCES_ENABLED;
  delete process.env.DEEP_RESEARCH_EXPERIENCES_MAX_CHARS;
  delete process.env.DEEP_RESEARCH_EXPERIENCES_MAX_EXAMPLES;
});
afterEach(() => {
  delete process.env.DEEP_RESEARCH_EXPERIENCES_ENABLED;
  delete process.env.DEEP_RESEARCH_EXPERIENCES_MAX_CHARS;
  delete process.env.DEEP_RESEARCH_EXPERIENCES_MAX_EXAMPLES;
});

describe('buildExperienceContext', () => {
  it('kill-switch: DEEP_RESEARCH_EXPERIENCES_ENABLED=false devolve null sem consultar o banco', async () => {
    process.env.DEEP_RESEARCH_EXPERIENCES_ENABLED = 'false';

    const out = await buildExperienceContext('t1', 'lítio Minas Gerais');

    expect(out).toBeNull();
    expect(prismaMock.atestado.findMany).not.toHaveBeenCalled();
  });

  it('tenant sem atestados próprios devolve null (nada é anexado ao prompt)', async () => {
    mockAcervo([]);

    expect(await buildExperienceContext('t1', 'lítio')).toBeNull();
  });

  it('considera só atestados PROPRIO, tanto na listagem quanto na busca semântica', async () => {
    mockAcervo([atestado('a1', 'Vale', 2025)]);

    await buildExperienceContext('t1', 'lítio Minas Gerais');

    expect(argsDaConsulta().where).toMatchObject({ tenantId: 't1', origem: 'PROPRIO', deletedAt: null });
    const [, query, opts] = semanticSearchMock.mock.calls[0] as [string, string, { includeTerceiros?: boolean }?];
    expect(query).toBe('lítio Minas Gerais');
    expect(opts?.includeTerceiros ?? false).toBe(false);
  });

  it('abre com o título do apêndice + nome do tenant, a visão geral do acervo e a instrução anti-citação', async () => {
    mockAcervo([atestado('a1', 'Vale', 2025), atestado('a2', 'CSN', 2019)]);

    const out = (await buildExperienceContext('t1', 'lítio'))!;

    expect(out.startsWith(`## ${EXPERIENCES_APPENDIX_TITLE} (TENAX)`)).toBe(true);
    expect(out).toContain('2 atestados próprios');
    expect(out).toContain('2019–2025');
    expect(out).toContain('Engenharia de processo (2)');
    expect(out).toContain('Vale');
    expect(out).toMatch(/N[ÃA]O .*Fontes e Refer[êe]ncias/);
  });

  it('exemplos: os hits da busca semântica vêm primeiro e não se repetem entre os recentes', async () => {
    mockAcervo([
      atestado('a1', 'Contratante A1', 2025),
      atestado('a2', 'Contratante A2', 2020),
      atestado('a3', 'Contratante A3', 2024),
    ]);
    semanticSearchMock.mockResolvedValue([{ atestadoId: 'a2', score: 0.9, trecho: '' }]);

    const out = (await buildExperienceContext('t1', 'lítio'))!;

    // Só a parte de exemplos: a visão geral já cita os contratantes antes.
    const exemplos = out.slice(out.indexOf('**Experiências mais relacionadas'));
    const iA2 = exemplos.indexOf('- Contratante A2');
    const iA1 = exemplos.indexOf('- Contratante A1');
    expect(iA2).toBeGreaterThan(-1);
    expect(iA2).toBeLessThan(iA1);
    expect(exemplos.split('- Contratante A2').length - 1).toBe(1);
  });

  it('cada linha de exemplo traz contratante, objeto, ano, disciplina e quantitativo', async () => {
    mockAcervo([atestado('a1', 'Sigma Lithium', 2023, 'Projeto básico da planta de beneficiamento')]);

    const out = (await buildExperienceContext('t1', 'lítio'))!;

    expect(out).toContain(
      '- Sigma Lithium — Projeto básico da planta de beneficiamento (2023; Engenharia de processo; Capacidade 1,5 Mtpa)'
    );
  });

  it('respeita o teto de caracteres truncando por linha inteira', async () => {
    // A parte fixa (título + instrução + visão geral) tem ~700 chars e sempre
    // entra; o teto governa quantas linhas de exemplo cabem.
    process.env.DEEP_RESEARCH_EXPERIENCES_MAX_CHARS = '1200';
    mockAcervo(
      Array.from({ length: 40 }, (_, i) =>
        atestado(`a${i}`, `Contratante ${i}`, 2025 - (i % 10), `Objeto ${'x'.repeat(60)} ${i}`)
      )
    );

    const out = (await buildExperienceContext('t1', 'lítio'))!;

    expect(out.length).toBeLessThanOrEqual(1200);
    const linhas = out.split('\n').filter((l) => l.startsWith('- '));
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas.length).toBeLessThan(40); // houve truncamento de fato
    for (const l of linhas) expect(l.endsWith(')')).toBe(true);
  });
});
