import { useMemo } from 'react';
import { splitReportSections, type SplitReport } from './splitReportSections';

/** Uma "página" do modo Apresentação. */
export type ReportPage =
  | { kind: 'cover' }
  | { kind: 'intro'; markdown: string }
  | { kind: 'section'; key: string; title: string; markdown: string }
  | { kind: 'sources' };

/**
 * Monta o modelo ordenado de páginas a partir do relatório dividido:
 * capa → "Visão geral" (só se houver intro) → uma por seção → "Fontes" (só se
 * houver fontes). Função pura — testável isoladamente.
 */
export function buildReportPages(split: SplitReport, hasSources: boolean): ReportPage[] {
  const pages: ReportPage[] = [{ kind: 'cover' }];
  if (split.intro.trim()) pages.push({ kind: 'intro', markdown: split.intro });
  for (const s of split.sections) {
    pages.push({ kind: 'section', key: s.key, title: s.title, markdown: s.markdown });
  }
  if (hasSources) pages.push({ kind: 'sources' });
  return pages;
}

/** Rótulo curto de uma página para o índice e o indicador de posição. */
export function pageLabel(page: ReportPage): string {
  switch (page.kind) {
    case 'cover':
      return 'Capa';
    case 'intro':
      return 'Visão geral';
    case 'section':
      return page.title;
    case 'sources':
      return 'Fontes';
  }
}

/** Divide o markdown e monta as páginas, memoizado por (markdown, hasSources). */
export function useReportPages(markdown: string, hasSources: boolean) {
  return useMemo(() => {
    const split = splitReportSections(markdown);
    const pages = buildReportPages(split, hasSources);
    return { split, pages };
  }, [markdown, hasSources]);
}
