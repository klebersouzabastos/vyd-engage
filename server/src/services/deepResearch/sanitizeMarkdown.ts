// Limpeza determinística do markdown colado do ChatGPT (Deep Research).
//
// A UI do ChatGPT embute marcadores de citação que NÃO existem na API: tanto
// delimitadores invisíveis da Private Use Area quanto a forma textual
// `citeturn42search2turn42search4`. Removemos esses artefatos do corpo e
// capturamos os tokens como "fontes" para persistir em reportMeta.
//
// Espelha src/components/deepResearch/sanitizeReportMarkdown.ts (pacotes
// separados — a duplicacao e intencional).

// Delimitadores invisiveis (Private Use Area). Construido via new RegExp com
// escapes ASCII para nao inserir caracteres invisiveis no codigo-fonte.
const CITE_PUA = new RegExp('[\\uE200-\\uE20F\\uF8FF]', 'g');
// Token de citacao textual, ex.: citeturn42search2turn42search4
const CITE_TOKEN = /cite(?:turn\d+[a-z]+\d+)+/gi;
// Tokens de navegacao/arquivo soltos, ex.: navlist, filecite, turn0search0
const NAV_TOKEN =
  /\b(?:navlist|filecite|turn\d+(?:search|news|view|forecast|image|file)\d+)\b/gi;

export interface CleanedMarkdown {
  markdown: string;
  sources: string[];
}

/**
 * Remove os marcadores de citacao da UI do ChatGPT e captura os tokens
 * encontrados como fontes (deduplicadas).
 */
export function sanitizeMarkdown(raw: string): CleanedMarkdown {
  const sources: string[] = [];
  let md = (raw ?? '').replace(/\r\n/g, '\n');

  md = md.replace(CITE_PUA, '');
  md = md.replace(CITE_TOKEN, (match) => {
    sources.push(match);
    return '';
  });
  md = md.replace(NAV_TOKEN, '');

  // Limpa espacos orfaos deixados pela remocao dos tokens.
  md = md
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;:)])/g, '$1')
    .replace(/\n{3,}/g, '\n\n');

  return { markdown: md.trim(), sources: Array.from(new Set(sources)) };
}
