import { describe, it, expect } from 'vitest';
import { extractToc } from '../extractToc';

describe('extractToc', () => {
  it('extrai títulos H1-H3 com nível e texto', () => {
    const toc = extractToc('# Relatório\n\ntexto\n\n## Panorama\n\n### Detalhe');
    expect(toc).toEqual([
      { id: 'relatório', text: 'Relatório', level: 1 },
      { id: 'panorama', text: 'Panorama', level: 2 },
      { id: 'detalhe', text: 'Detalhe', level: 3 },
    ]);
  });

  it('ignora H4 e abaixo no sumário', () => {
    expect(extractToc('#### Pequeno\n\n##### Menor')).toEqual([]);
  });

  it('ignora títulos dentro de blocos de código', () => {
    const toc = extractToc('## Real\n\n```\n# Falso\n```\n\n## Outro');
    expect(toc.map((t) => t.text)).toEqual(['Real', 'Outro']);
  });

  it('gera slugs únicos para títulos duplicados', () => {
    const toc = extractToc('## Panorama\n\n## Panorama');
    expect(toc.map((t) => t.id)).toEqual(['panorama', 'panorama-1']);
  });

  it('remove formatação inline do texto do título', () => {
    const toc = extractToc('## **Negrito** e `code`');
    expect(toc[0].text).toBe('Negrito e code');
  });

  it('extrai o texto de um título em formato de link', () => {
    const toc = extractToc('## [Investimentos](#x) 2026');
    expect(toc[0].text).toBe('Investimentos 2026');
    expect(toc[0].id).toBe('investimentos-2026');
  });

  it('retorna lista vazia para markdown sem títulos', () => {
    expect(extractToc('apenas um parágrafo.')).toEqual([]);
  });
});
