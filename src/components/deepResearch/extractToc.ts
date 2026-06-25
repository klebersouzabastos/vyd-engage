import GithubSlugger from 'github-slugger';

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Extrai os titulos H1-H3 do markdown e gera o sumario. Usa o mesmo
 * github-slugger que o rehype-slug (deduped na arvore de deps), garantindo que
 * os `id` do sumario batam 1:1 com os `id` dos titulos no DOM — inclusive o
 * sufixo numerico em titulos duplicados.
 */
export function extractToc(markdown: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let inFence = false;

  for (const line of (markdown || '').split('\n')) {
    // Ignora titulos dentro de blocos de codigo (```...```).
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // Captura H1-H6 para manter o contador de duplicados do slugger em sincronia
    // com o rehype-slug (que processa todos os niveis), mas lista so H1-H3.
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;

    const text = m[2]
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [texto](url) -> texto
      .replace(/[*_`~]/g, '') // remove enfase/codigo inline
      .trim();
    if (!text) continue;

    const level = m[1].length;
    const id = slugger.slug(text); // sempre consome o slugger (sincronia 1:1)
    if (level <= 3) items.push({ id, level, text });
  }

  return items;
}
