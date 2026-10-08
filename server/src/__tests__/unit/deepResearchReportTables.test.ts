// Parser de tabelas GFM do relatório da Pesquisa Profunda — o cap. 7 da pesquisa
// de Empresa (Mapa de Stakeholders) sai como markdown; para virar decisores no
// Desdobramento, precisa virar estrutura. O modelo reescreve cabeçalhos, reordena
// colunas, põe negrito/links/citações nas células e, nas continuações, repete a
// tabela: o parser tem que aguentar tudo isso sem inventar linha.
import { describe, it, expect } from 'vitest';
import {
  extractGfmTables,
  cleanCell,
  parseStakeholderTable,
  mapClassificationToRole,
} from '../../services/deepResearch/reportTables.js';

const CANONICA = `## Capítulo 7 — Mapa de Stakeholders (situação em 2026)

Texto introdutório.

| Nome | Cargo | Área (Engenharia/Projetos/Suprimentos/Diretoria) | Responsabilidades | Contato institucional público | Classificação (decide/influencia/veta) |
|------|-------|------|------|------|------|
| **Ana Souza** | Diretora de Engenharia | Engenharia | Aprova projetos de capital | ana.souza@acme.com.br | decide |
| [Carlos Lima](https://linkedin.com/in/carlos) | Gerente de Suprimentos[12] | Suprimentos | Contratação de serviços | LinkedIn: Carlos Lima | influencia / veta |
| Bruno Reis | Coordenador de Projetos<sup>3</sup> | Projetos | Fiscalização de EPCM | sem dados públicos suficientes | influencia |

Texto de fechamento.`;

describe('extractGfmTables', () => {
  it('reconhece tabela com linha separadora e devolve cabeçalhos e linhas limpos', () => {
    const t = extractGfmTables('| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |');
    expect(t).toHaveLength(1);
    expect(t[0].headers).toEqual(['A', 'B']);
    expect(t[0].rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('aceita alinhamento (:---:) e linhas sem pipe nas pontas', () => {
    const t = extractGfmTables('A | B\n:---|---:\nx | y');
    expect(t[0].headers).toEqual(['A', 'B']);
    expect(t[0].rows).toEqual([['x', 'y']]);
  });

  it('ignora bloco de pipes sem separador (não é tabela) e devolve [] sem tabela', () => {
    expect(extractGfmTables('| só | uma | linha |\n| outra | linha | aqui |')).toEqual([]);
    expect(extractGfmTables('texto sem tabela')).toEqual([]);
  });

  it('separa duas tabelas no mesmo documento', () => {
    const md = '| A |\n|---|\n| 1 |\n\nTexto.\n\n| B |\n|---|\n| 2 |';
    expect(extractGfmTables(md).map((t) => t.headers)).toEqual([['A'], ['B']]);
  });
});

describe('cleanCell', () => {
  it('remove negrito, link (mantém o texto), citações [n], <sup> e pipe escapado', () => {
    expect(cleanCell('**Ana Souza**')).toBe('Ana Souza');
    expect(cleanCell('[Carlos Lima](https://linkedin.com/in/carlos)')).toBe('Carlos Lima');
    expect(cleanCell('Gerente[12] de Suprimentos[3][4]')).toBe('Gerente de Suprimentos');
    expect(cleanCell('Coordenador<sup>3</sup>')).toBe('Coordenador');
    expect(cleanCell('Engenharia \\| Projetos')).toBe('Engenharia | Projetos');
    expect(cleanCell('  espaços   múltiplos ')).toBe('espaços múltiplos');
  });
});

describe('mapClassificationToRole', () => {
  it('decide → DECISOR; veta → APROVADOR; influencia → INFLUENCIADOR; técnico → TECNICO', () => {
    expect(mapClassificationToRole('decide')).toBe('DECISOR');
    expect(mapClassificationToRole('Decisor final')).toBe('DECISOR');
    expect(mapClassificationToRole('veta')).toBe('APROVADOR');
    expect(mapClassificationToRole('influencia')).toBe('INFLUENCIADOR');
    expect(mapClassificationToRole('parecer técnico')).toBe('TECNICO');
  });

  it('combinação pega o papel mais forte; sem classificação cai em INFLUENCIADOR', () => {
    expect(mapClassificationToRole('influencia / veta')).toBe('APROVADOR');
    expect(mapClassificationToRole('decide e influencia')).toBe('DECISOR');
    expect(mapClassificationToRole(undefined)).toBe('INFLUENCIADOR');
    expect(mapClassificationToRole('')).toBe('INFLUENCIADOR');
  });
});

describe('parseStakeholderTable', () => {
  it('extrai os decisores da tabela canônica do cap. 7, com e-mail e papel sugerido', () => {
    const rows = parseStakeholderTable(CANONICA);
    expect(rows.map((r) => r.name)).toEqual(['Ana Souza', 'Carlos Lima', 'Bruno Reis']);

    const ana = rows[0];
    expect(ana).toMatchObject({
      position: 'Diretora de Engenharia',
      area: 'Engenharia',
      responsibilities: 'Aprova projetos de capital',
      email: 'ana.souza@acme.com.br',
      classification: 'decide',
      suggestedRole: 'DECISOR',
    });

    const carlos = rows[1];
    expect(carlos.position).toBe('Gerente de Suprimentos');
    expect(carlos.email).toBeUndefined();
    expect(carlos.suggestedRole).toBe('APROVADOR');

    const bruno = rows[2];
    expect(bruno.position).toBe('Coordenador de Projetos');
    expect(bruno.contact).toBeUndefined(); // "sem dados públicos suficientes" é vazio
  });

  it('tolera colunas reordenadas e ausentes (exige nome + cargo ou classificação)', () => {
    const md = '| Cargo | Nome | Papel |\n|---|---|---|\n| CEO | Dora Nunes | decide |\n| | Sem Nome | — |';
    const rows = parseStakeholderTable(md);
    // "Sem Nome" tem nome, mas nem cargo nem classificação válida → fora.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Dora Nunes', position: 'CEO', suggestedRole: 'DECISOR' });
  });

  it('descarta linhas-placeholder ("sem dados", "—", "n/d") e linhas só com nome', () => {
    const md = [
      '| Nome | Cargo | Classificação |',
      '|---|---|---|',
      '| sem dados públicos suficientes | — | — |',
      '| — | Diretor | decide |',
      '| n/d | Gerente | veta |',
      '| Eva Prado | | |',
      '| Fábio Melo | Gerente | influencia |',
    ].join('\n');
    expect(parseStakeholderTable(md).map((r) => r.name)).toEqual(['Fábio Melo']);
  });

  it('tabela repetida pela continuação é unificada, sem duplicar pessoas', () => {
    const tabela =
      '| Nome | Cargo | Classificação |\n|---|---|---|\n| Ana Souza | Diretora | decide |\n| Gil Costa | Gerente | influencia |';
    const md = `${tabela}\n\nTexto cortado…\n\n${tabela}\n| Hélio Dias | Analista | técnico |`;
    const rows = parseStakeholderTable(md);
    expect(rows.map((r) => r.name)).toEqual(['Ana Souza', 'Gil Costa', 'Hélio Dias']);
  });

  it('ignora tabelas que não são de stakeholders (ex.: investimentos) e devolve [] sem cap. 7', () => {
    const md = '| Projeto | CAPEX | Ano |\n|---|---|---|\n| Mina X | 100 | 2026 |';
    expect(parseStakeholderTable(md)).toEqual([]);
    expect(parseStakeholderTable('')).toEqual([]);
  });
});
