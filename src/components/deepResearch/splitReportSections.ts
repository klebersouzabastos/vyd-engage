export interface ReportSection {
  /** Chave estável para navegação por índice (não é âncora do DOM). */
  key: string;
  title: string;
  markdown: string;
}

export interface SplitReport {
  /** Texto do título principal (H1), se houver. */
  h1: string | null;
  /** Conteúdo após o H1 e antes do 1º H2 (resumo/introdução), sem o H1. */
  intro: string;
  /** Uma seção por título de nível 2. */
  sections: ReportSection[];
}

/** Limpa marcações inline de um título (links/ênfase) para uso como rótulo. */
function cleanTitle(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
}

/**
 * Divide o markdown do relatório em seções por título de nível 2 (`## `). O H1 é
 * separado (vira o título da capa) e o que vem entre o H1 e o primeiro H2 fica em
 * `intro`. Ignora `#`/`##` dentro de blocos de código. Alimenta o modo
 * "Apresentação" (paginado) — o modo "Leitura" renderiza o markdown inteiro.
 */
export function splitReportSections(markdown: string): SplitReport {
  const lines = (markdown || '').split('\n');
  let h1: string | null = null;
  const intro: string[] = [];
  const sections: ReportSection[] = [];
  let current: { title: string; lines: string[] } | null = null;
  let inFence = false;
  let i = 0;

  const flush = () => {
    if (current) {
      sections.push({
        key: `sec-${i++}`,
        title: current.title,
        markdown: current.lines.join('\n').trim(),
      });
      current = null;
    }
  };

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;

    const h2 = !inFence ? /^##\s+(.+?)\s*#*\s*$/.exec(line) : null;
    const h1m = !inFence && !current ? /^#\s+(.+?)\s*#*\s*$/.exec(line) : null;

    if (h2) {
      flush();
      current = { title: cleanTitle(h2[1]), lines: [line] };
    } else if (h1m && h1 === null && sections.length === 0) {
      h1 = cleanTitle(h1m[1]);
    } else if (current) {
      current.lines.push(line);
    } else {
      intro.push(line);
    }
  }
  flush();

  return { h1, intro: intro.join('\n').trim(), sections };
}
