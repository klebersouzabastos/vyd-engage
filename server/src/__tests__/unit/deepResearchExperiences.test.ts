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
  anoDoPeriodo,
  EXPERIENCES_APPENDIX_TITLE,
} from '../../services/deepResearch/experienceContext.js';

type AtestadoRow = {
  id: string;
  contratante: string;
  objeto: string;
  dataInicio: Date | null;
  dataConclusao: Date | null;
  periodoTexto?: string | null;
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

// ── Acervo real (k2, 08/10/2026): 0 de 112 atestados com data estruturada, 111
// com `periodoTexto` livre em 22 formatos; 3 grupos repetidos (mesmo
// contratante + objeto). Sem estas regras o bloco saía sem ano, os "recentes"
// vinham na ordem de importação e linhas idênticas gastavam o teto.

/** Atestado sem datas estruturadas — só o período em texto livre, como no legado. */
function legado(id: string, contratante: string, periodoTexto: string | null, objeto = `Obra ${id}`) {
  return atestado(id, contratante, 2000, objeto, { dataInicio: null, dataConclusao: null, periodoTexto });
}

describe('anoDoPeriodo — ano de conclusão a partir do texto livre', () => {
  it.each([
    ['01/1982\na\n05/1987', 1987],
    ['17/08/1987\na\n04/12/1987', 1987],
    ['07/1989 a 07/1990', 1990],
    ['07/2013  a 11/2014', 2014],
    ['22/10/2014 a 30/10/2017', 2017],
    ['1989\na\n1991', 1991],
    ['1986-07-01', 1986],
    ['09/1977\na\n09/1979\n\n\n\n09/1979\na\n09/1980', 1980],
    ['Janeiro/73\na\nDezembro/74\ne\nJulho/73\na\nAgosto/76', 1976],
    ['16/12/1992\n120 DIAS', 1992],
  ])('%j → %i', (texto, esperado) => {
    expect(anoDoPeriodo(texto)).toBe(esperado);
  });

  it.each(['120 DIAS', '54 MESES', '***', 'Em execução', '', null, undefined, 'Projeto 120 dias\nSupervisão 360 dias'])(
    'sem ano reconhecível: %j → null',
    (texto) => {
      expect(anoDoPeriodo(texto)).toBeNull();
    }
  );
});

describe('buildExperienceContext — acervo legado (só periodoTexto)', () => {
  it('mostra o ano de conclusão na linha e a faixa de anos na visão geral', async () => {
    mockAcervo([
      legado('a1', 'CVRD', '01/1982\na\n05/1987', 'Ponte ferroviária sobre o Córrego do Ouro'),
      legado('a2', 'CBTU', '22/10/2014 a 30/10/2017', 'Supervisão do metrô'),
      legado('a3', 'DER-MG', '120 DIAS', 'Projeto rodoviário'),
    ]);

    const out = (await buildExperienceContext('t1', 'ferrovia'))!;

    expect(out).toContain('3 atestados próprios (1987–2017)');
    expect(out).toContain('- CVRD — Ponte ferroviária sobre o Córrego do Ouro (1987;');
    expect(out).toContain('- CBTU — Supervisão do metrô (2017;');
    // Sem ano reconhecível: a linha sai sem ano, sem inventar.
    expect(out).toContain('- DER-MG — Projeto rodoviário (Engenharia de processo;');
  });

  it('"recentes" ordenados pelo ano derivado do texto (mais recente primeiro; sem ano por último)', async () => {
    mockAcervo([
      legado('a1', 'Antigo', '01/1982\na\n05/1987'),
      legado('a2', 'SemAno', 'Em execução'),
      legado('a3', 'Novo', '07/2013  a 11/2014'),
      legado('a4', 'Meio', '1989\na\n1991'),
    ]);

    const out = (await buildExperienceContext('t1', ''))!;

    const ordem = ['- Novo', '- Meio', '- Antigo', '- SemAno'].map((m) => out.indexOf(m));
    expect(ordem.every((i) => i > -1)).toBe(true);
    expect([...ordem].sort((x, y) => x - y)).toEqual(ordem);
  });
});

describe('buildExperienceContext — exemplos sem repetição', () => {
  it('atestados com o mesmo contratante e objeto viram UMA linha (espaços e caixa não contam)', async () => {
    mockAcervo([
      legado('a1', 'CBTU', '2014', 'Gerenciamento e assistência técnica das obras civis'),
      legado('a2', 'cbtu ', '2014', 'Gerenciamento e  assistência técnica das obras civis'),
      legado('a3', 'CBTU', '2014', 'GERENCIAMENTO E ASSISTÊNCIA TÉCNICA DAS OBRAS CIVIS'),
      legado('a4', 'CVRD', '2010', 'Outro objeto'),
    ]);

    const out = (await buildExperienceContext('t1', ''))!;

    const exemplos = out.split('\n').filter((l) => l.startsWith('- '));
    expect(exemplos.filter((l) => /gerenciamento e +assist/i.test(l))).toHaveLength(1);
    expect(exemplos).toHaveLength(2);
    // A visão geral continua contando atestados (são documentos distintos).
    expect(out).toContain('4 atestados próprios');
  });

  // Caso real (CBTU/Natal, atestados 101, 103 e 112): o mesmo contrato
  // registrado 3 vezes, com objetos que só diferem DEPOIS do corte de 160
  // caracteres ("…Extremo" / "…Extremoz, utilizando a metodologia BIM" /
  // "…com as seguintes atividades: …"). No prompt as três linhas são idênticas.
  it('objetos que só diferem depois do corte exibido contam como repetição', async () => {
    const base =
      'Elaboração de Projeto de Engenharia para Recuperação de 56,2 km de linha férrea do Sistema de Trens Urbanos na Região Metropolitana de Natal, compreendendo os municípios de Natal, Parnamirim';
    mockAcervo([
      legado('a101', 'CBTU', '10/2014\na\n10/2016', `${base}, Ceará Mirim e Extremo`),
      legado('a112', 'CBTU', '22/10/2014 a 30/10/2017', `${base}, Ceará Mirim e Extremoz, utilizando a metodologia BIM`),
      legado('a103', 'CBTU', '10/2014\na\n10/2016', `${base}, com as seguintes atividades: * Estudos Topográficos`),
    ]);
    semanticSearchMock.mockResolvedValue([
      { atestadoId: 'a101', score: 0.9, trecho: '' },
      { atestadoId: 'a112', score: 0.8, trecho: '' },
    ]);

    const out = (await buildExperienceContext('t1', 'ferrovia'))!;

    expect(out.split('\n').filter((l) => l.includes('56,2 km'))).toHaveLength(1);
  });

  it('repetido entre "relacionados" e "recentes" (ids diferentes) aparece só nos relacionados', async () => {
    mockAcervo([
      legado('a1', 'CVRD', '2010', 'Projeto de pátio ferroviário'),
      legado('a2', 'CVRD', '2012', 'Projeto de pátio ferroviário'),
      legado('a3', 'Outro', '2011', 'Outra coisa'),
    ]);
    semanticSearchMock.mockResolvedValue([{ atestadoId: 'a1', score: 0.9, trecho: '' }]);

    const out = (await buildExperienceContext('t1', 'ferrovia'))!;

    expect(out.split('- CVRD — Projeto de pátio ferroviário').length - 1).toBe(1);
    expect(out.indexOf('- CVRD')).toBeLessThan(out.indexOf('**Outras experiências recentes:**'));
  });
});
