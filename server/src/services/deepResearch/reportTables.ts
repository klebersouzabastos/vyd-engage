// Tabelas GFM do relatório da Pesquisa Profunda → estrutura.
//
// O relatório é markdown gerado por um modelo: cabeçalhos reescritos, colunas
// reordenadas ou ausentes, negrito/links/citações dentro das células e, quando
// houve continuação, a mesma tabela repetida. Aqui tudo isso vira linhas limpas
// — sem inventar nada: linha sem os campos mínimos é descartada, nunca completada.
import { normalizeName } from '../atestados/normalize.js';

export interface GfmTable {
  headers: string[];
  rows: string[][];
}

// Linha separadora da tabela: |---|:---:|---:| (pipes nas pontas opcionais).
const SEPARATOR_RE = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** Divide uma linha de tabela em células, respeitando `\|` escapado. */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '|') {
      cur += '|';
      i++;
      continue;
    }
    if (ch === '|') {
      cells.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  // Pipes nas pontas geram célula vazia no início e no fim.
  if (cells.length && line.trimStart().startsWith('|') && cells[0].trim() === '') cells.shift();
  if (cells.length && line.trimEnd().endsWith('|') && cells[cells.length - 1].trim() === '') cells.pop();
  return cells.map((c) => c.trim());
}

/** Limpa uma célula: tira ênfase, links (mantém o texto), citações [n] e <sup>. */
export function cleanCell(raw: string): string {
  return (raw || '')
    .replace(/<sup>[\s\S]*?<\/sup>/gi, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\d+(?:[,;\s]*\d+)*\]/g, '')
    .replace(/\\\|/g, '|')
    .replace(/\*\*|__/g, '')
    .replace(/^[*_]+|[*_]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Todas as tabelas GFM do markdown, com células já limpas. */
export function extractGfmTables(markdown: string): GfmTable[] {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  const tables: GfmTable[] = [];
  let i = 0;
  while (i < lines.length) {
    const l0 = lines[i].trim();
    const l1 = (lines[i + 1] || '').trim();
    if (l0.includes('|') && SEPARATOR_RE.test(l1)) {
      const headers = splitRow(l0).map(cleanCell);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length) {
        const l = lines[j].trim();
        if (!l.includes('|') || SEPARATOR_RE.test(l)) break;
        rows.push(splitRow(l).map(cleanCell));
        j++;
      }
      tables.push({ headers, rows });
      i = j;
      continue;
    }
    i++;
  }
  return tables;
}

// ── Mapa de Stakeholders (cap. 7 da pesquisa de Empresa) ─────────────────────

export type SuggestedRole = 'DECISOR' | 'APROVADOR' | 'INFLUENCIADOR' | 'TECNICO';

export interface StakeholderRow {
  name: string;
  position?: string;
  area?: string;
  responsibilities?: string;
  contact?: string;
  email?: string;
  classification?: string;
  suggestedRole: SuggestedRole;
}

/**
 * Classificação textual → papel no desdobramento. Combinações pegam o papel
 * mais forte (decide > veta > influencia > técnico); sem classificação, o
 * gestor parte de INFLUENCIADOR e ajusta.
 */
export function mapClassificationToRole(text?: string): SuggestedRole {
  const t = normalizeName(text);
  if (/decid|decis/.test(t)) return 'DECISOR';
  if (/\bvet/.test(t)) return 'APROVADOR';
  if (/influenc/.test(t)) return 'INFLUENCIADOR';
  if (/tecnic/.test(t)) return 'TECNICO';
  return 'INFLUENCIADOR';
}

// Colunas reconhecidas pelo cabeçalho normalizado (sem acento, minúsculo).
const COLS: Record<Exclude<keyof StakeholderRow, 'email' | 'suggestedRole'>, RegExp> = {
  name: /^nome|^pessoa|^stakeholder/,
  position: /cargo|posicao|funcao/,
  area: /^area/,
  responsibilities: /responsab/,
  contact: /contato|e ?mail|linkedin|telefone/,
  classification: /classific|papel|decide/,
};

// Célula que o modelo usa para "não sei": vazia, travessão, n/d, "sem dados…".
const PLACEHOLDER_RE =
  /^(?:[-—–]+|n\/?d|n\.?d\.?|na|\?+|sem dados.*|nao (?:encontrad|informad|disponivel|identificad).*|desconhecid.*)$/;

function isEmptyCell(v: string): boolean {
  const n = normalizeName(v);
  return n === '' || PLACEHOLDER_RE.test(n);
}

function opt(v: string): string | undefined {
  return isEmptyCell(v) ? undefined : v;
}

function mapColumns(headers: string[]): Partial<Record<keyof typeof COLS, number>> {
  const cols: Partial<Record<keyof typeof COLS, number>> = {};
  headers.forEach((h, i) => {
    const n = normalizeName(h);
    for (const key of Object.keys(COLS) as Array<keyof typeof COLS>) {
      if (cols[key] === undefined && COLS[key].test(n)) {
        cols[key] = i;
        break;
      }
    }
  });
  return cols;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

/**
 * Decisores de todas as tabelas de stakeholders do relatório (nome + cargo ou
 * classificação). Tabelas repetidas pela continuação são unificadas por nome
 * normalizado; linhas-placeholder são descartadas.
 */
export function parseStakeholderTable(markdown: string): StakeholderRow[] {
  const out: StakeholderRow[] = [];
  const seen = new Set<string>();
  for (const table of extractGfmTables(markdown)) {
    const cols = mapColumns(table.headers);
    if (cols.name === undefined) continue;
    if (cols.position === undefined && cols.classification === undefined) continue;
    for (const cells of table.rows) {
      const get = (i?: number) => (i === undefined ? '' : (cells[i] ?? ''));
      const name = get(cols.name);
      if (isEmptyCell(name)) continue;
      const position = opt(get(cols.position));
      const classification = opt(get(cols.classification));
      if (!position && !classification) continue;
      const key = normalizeName(name);
      if (seen.has(key)) continue;
      seen.add(key);
      const contact = opt(get(cols.contact));
      const email = contact ? EMAIL_RE.exec(contact)?.[0]?.toLowerCase() : undefined;
      out.push({
        name,
        position,
        area: opt(get(cols.area)),
        responsibilities: opt(get(cols.responsibilities)),
        contact,
        email,
        classification,
        suggestedRole: mapClassificationToRole(classification),
      });
    }
  }
  return out;
}
