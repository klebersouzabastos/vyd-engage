import { describe, it, expect } from 'vitest';
import { buildReportPages } from './useReportPages';
import { splitReportSections, type SplitReport } from './splitReportSections';

const mkSplit = (o: Partial<SplitReport>): SplitReport => ({
  h1: null,
  intro: '',
  sections: [],
  ...o,
});

describe('splitReportSections', () => {
  it('separa h1, intro e seções por ##', () => {
    const md = `# Título\n\nIntro aqui.\n\n## Seção A\n\nTexto A\n\n## Seção B\n\nTexto B`;
    const { h1, intro, sections } = splitReportSections(md);
    expect(h1).toBe('Título');
    expect(intro).toBe('Intro aqui.');
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('Seção A');
    expect(sections[0].markdown).toContain('## Seção A');
    expect(sections[1].title).toBe('Seção B');
  });

  it('ignora ## dentro de bloco de código', () => {
    const md = '## Real\n\n```\n## Falso\n```\n\ntexto';
    const { sections } = splitReportSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Real');
  });

  it('sem H2 retorna zero seções', () => {
    const { sections, intro } = splitReportSections('# T\n\nsó intro');
    expect(sections).toHaveLength(0);
    expect(intro).toBe('só intro');
  });
});

describe('buildReportPages', () => {
  it('só capa quando não há seções, intro nem fontes', () => {
    expect(buildReportPages(mkSplit({}), false)).toEqual([{ kind: 'cover' }]);
  });

  it('inclui "Visão geral" só com intro não vazia', () => {
    expect(buildReportPages(mkSplit({ intro: 'oi' }), false).map((p) => p.kind)).toEqual([
      'cover',
      'intro',
    ]);
    expect(buildReportPages(mkSplit({ intro: '   ' }), false).map((p) => p.kind)).toEqual([
      'cover',
    ]);
  });

  it('uma página por seção, na ordem', () => {
    const pages = buildReportPages(
      mkSplit({
        sections: [
          { key: 'sec-0', title: 'A', markdown: '## A' },
          { key: 'sec-1', title: 'B', markdown: '## B' },
        ],
      }),
      false
    );
    expect(pages.map((p) => p.kind)).toEqual(['cover', 'section', 'section']);
    expect(pages[1]).toMatchObject({ kind: 'section', title: 'A' });
  });

  it('inclui página de fontes só quando hasSources', () => {
    const sections = [{ key: 'sec-0', title: 'A', markdown: '## A' }];
    const withSrc = buildReportPages(mkSplit({ sections }), true);
    expect(withSrc[withSrc.length - 1]).toEqual({ kind: 'sources' });
    expect(buildReportPages(mkSplit({ sections }), false).some((p) => p.kind === 'sources')).toBe(
      false
    );
  });

  it('ordem completa: cover → intro → sections → sources', () => {
    const pages = buildReportPages(
      mkSplit({ intro: 'x', sections: [{ key: 'sec-0', title: 'A', markdown: '## A' }] }),
      true
    );
    expect(pages.map((p) => p.kind)).toEqual(['cover', 'intro', 'section', 'sources']);
  });
});
