// Bloco "Experiências da consultoria" anexado ao prompt da Pesquisa Profunda.
//
// O template de Segmento pedia ao modelo para relacionar o processo produtivo
// "com as experiências da TENAX" — mas o modelo não conhece a TENAX. Este módulo
// monta, a partir do acervo de Atestados Técnicos do tenant (só PROPRIO), um
// resumo compacto: visão geral do acervo + os atestados mais relacionados à
// pesquisa (busca semântica do módulo de Atestados) + os mais recentes. Vai como
// apêndice do prompt (ver APPENDIX_TITLES), com instrução explícita de uso:
// relacionar/posicionar, nunca citar como fato de mercado nem listar em Fontes.
//
// Vale para TODOS os templates (Segmento e Empresa), sem marcador no texto:
// ensureBuiltins não atualiza templates já criados, e templates custom perderiam
// o bloco em silêncio. Kill-switch por env.
import type { Prisma } from '@prisma/client';
import prisma from '../../config/database.js';
import { semanticSearch } from '../atestados/ragService.js';
import { normalizeName } from '../atestados/normalize.js';
import { logger } from '../../utils/logger.js';
import { APPENDIX_TITLES } from './promptUtils.js';

export const EXPERIENCES_APPENDIX_TITLE = APPENDIX_TITLES[1];

// ≈2,5k tokens. O bloco viaja no prompt inicial E em cada continuação. O teto
// governa os EXEMPLOS: título, instrução e visão geral (~700 chars) sempre entram.
const DEFAULT_MAX_CHARS = 10_000;
const DEFAULT_MAX_EXAMPLES = 20;
// Teto de leitura do acervo: acima disso, só os mais recentes entram na conta.
const MAX_ACERVO = 1000;
const OBJETO_MAX = 160;

function enabled(): boolean {
  return (process.env.DEEP_RESEARCH_EXPERIENCES_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
}

function envInt(name: string, fallback: number): number {
  const raw = parseInt(process.env[name] || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

const select = {
  id: true,
  contratante: true,
  objeto: true,
  dataInicio: true,
  dataConclusao: true,
  periodoTexto: true,
  valorContrato: true,
  responsaveis: { select: { funcoes: { select: { funcao: true, categoria: true } } } },
  quantitativos: { select: { grandeza: true, valor: true, unidade: true }, take: 2 },
} as const;

type Row = Prisma.AtestadoGetPayload<{ select: typeof select }>;

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Decimal do Prisma (ou qualquer valor com toNumber) → number. */
function dec(v: unknown): number {
  if (v && typeof v === 'object' && 'toNumber' in v && typeof (v as { toNumber: unknown }).toNumber === 'function') {
    return (v as { toNumber(): number }).toNumber();
  }
  return Number(v);
}

const ANO_4_DIGITOS = /\b(?:19|20)\d{2}\b/g;
// "Janeiro/73", "Dez/74": mês por extenso (ou abreviado) + ano com 2 dígitos.
const MES_ANO_2_DIGITOS = /\b(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\/(\d{2})\b/gi;

/**
 * Ano de CONCLUSÃO a partir do período em texto livre do acervo legado — o
 * maior ano citado. O legado tem 22 formatos ("01/1982 a 05/1987",
 * "17/08/1987…", "Janeiro/73 a Agosto/76", "1986-07-01"); duração pura ("120
 * DIAS", "54 MESES"), "Em execução" e "***" não têm ano → null (nunca inventa).
 */
export function anoDoPeriodo(texto: string | null | undefined): number | null {
  const t = texto || '';
  const anos = (t.match(ANO_4_DIGITOS) || []).map(Number);
  const seculoAtual = new Date().getFullYear() % 100;
  for (const m of t.matchAll(MES_ANO_2_DIGITOS)) {
    const yy = Number(m[1]);
    anos.push(yy <= seculoAtual ? 2000 + yy : 1900 + yy);
  }
  return anos.length ? Math.max(...anos) : null;
}

/** Ano de conclusão: data estruturada quando existe; senão, o texto livre. */
function ano(r: Row): number | null {
  const d = r.dataConclusao ?? r.dataInicio;
  return d ? d.getUTCFullYear() : anoDoPeriodo(r.periodoTexto);
}

/** Objeto como aparece no prompt: espaços colapsados e cortado em OBJETO_MAX. */
function objetoExibido(r: Row): string {
  const objeto = compacta(r.objeto);
  return objeto.length > OBJETO_MAX ? `${objeto.slice(0, OBJETO_MAX - 1).trimEnd()}…` : objeto;
}

/**
 * Identidade de uma linha de exemplo = o que o MODELO vê (contratante + objeto
 * exibido). O legado registra o mesmo contrato várias vezes, com objetos que só
 * diferem depois do corte (caso real CBTU/Natal: "…Extremo", "…Extremoz,
 * utilizando a metodologia BIM", "…com as seguintes atividades") — no prompt
 * seriam linhas idênticas, então valem uma só.
 */
function chaveExemplo(r: Row): string {
  return `${normalizeName(r.contratante)}|${normalizeName(objetoExibido(r))}`;
}

/** Mantém a primeira ocorrência de cada chave, ignorando as já usadas. */
function semRepeticao(itens: Row[], usadas: Set<string>): Row[] {
  const out: Row[] = [];
  for (const r of itens) {
    const k = chaveExemplo(r);
    if (usadas.has(k)) continue;
    usadas.add(k);
    out.push(r);
  }
  return out;
}

function compacta(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}

/** Disciplinas (categoria; cai para a função) únicas do atestado, no máx. 2. */
function disciplinas(r: Row): string[] {
  const out: string[] = [];
  for (const resp of r.responsaveis) {
    for (const f of resp.funcoes) {
      const d = compacta(f.categoria || f.funcao);
      if (d && !out.includes(d)) out.push(d);
      if (out.length >= 2) return out;
    }
  }
  return out;
}

function linhaExemplo(r: Row): string {
  const objeto = objetoExibido(r);
  const partes: string[] = [];
  const a = ano(r);
  if (a) partes.push(String(a));
  const disc = disciplinas(r);
  if (disc.length) partes.push(disc.join(', '));
  const q = r.quantitativos[0];
  if (q) partes.push(`${compacta(q.grandeza)} ${numero.format(dec(q.valor))} ${compacta(q.unidade)}`);
  const base = `- ${compacta(r.contratante)} — ${objeto}`;
  return partes.length ? `${base} (${partes.join('; ')})` : base;
}

function topN(contagem: Map<string, number>, n: number): string {
  return [...contagem.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .slice(0, n)
    .map(([k, v]) => `${k} (${v})`)
    .join(', ');
}

function visaoGeral(rows: Row[]): string {
  const anos = rows.map(ano).filter((a): a is number => a !== null);
  const faixa =
    anos.length === 0
      ? ''
      : Math.min(...anos) === Math.max(...anos)
        ? ` (${Math.min(...anos)})`
        : ` (${Math.min(...anos)}–${Math.max(...anos)})`;

  let valor = 0;
  let comValor = 0;
  const porContratante = new Map<string, number>();
  const porDisciplina = new Map<string, number>();
  for (const r of rows) {
    if (r.valorContrato !== null) {
      valor += dec(r.valorContrato);
      comValor++;
    }
    const c = compacta(r.contratante);
    if (c) porContratante.set(c, (porContratante.get(c) || 0) + 1);
    for (const d of disciplinas(r)) porDisciplina.set(d, (porDisciplina.get(d) || 0) + 1);
  }

  const frases = [`${rows.length} atestados próprios${faixa}`];
  if (comValor > 0) frases.push(`valor contratual somado: ${moeda.format(valor)} (quando informado)`);
  let texto = `**Visão geral do acervo:** ${frases.join('; ')}.`;
  if (porContratante.size) texto += ` Principais contratantes: ${topN(porContratante, 8)}.`;
  if (porDisciplina.size) texto += ` Principais disciplinas: ${topN(porDisciplina, 8)}.`;
  return texto;
}

/**
 * Monta o bloco de experiências do tenant para a consulta (valores preenchidos
 * pelo usuário: segmento + região, ou empresa + setor). Devolve `null` quando
 * desligado por env ou quando o tenant não tem atestados próprios.
 */
export async function buildExperienceContext(tenantId: string, query: string): Promise<string | null> {
  if (!enabled()) return null;

  const [tenant, rows] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    prisma.atestado.findMany({
      where: { tenantId, origem: 'PROPRIO', deletedAt: null },
      select,
      orderBy: [{ dataConclusao: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: MAX_ACERVO,
    }),
  ]);
  if (rows.length === 0) return null;

  // Mais relacionados à pesquisa: busca semântica do acervo (cai para
  // palavra-chave sozinha quando não há embeddings). Falha aqui não pode
  // derrubar a pesquisa — segue só com os recentes.
  const maxExemplos = envInt('DEEP_RESEARCH_EXPERIENCES_MAX_EXAMPLES', DEFAULT_MAX_EXAMPLES);
  let relacionados: Row[] = [];
  if (query.trim()) {
    try {
      const hits = await semanticSearch(tenantId, query, { limit: maxExemplos });
      const porId = new Map(rows.map((r) => [r.id, r]));
      relacionados = hits
        .map((h) => porId.get(h.atestadoId))
        .filter((r): r is Row => !!r);
    } catch (err) {
      logger.warn('Experiências: busca semântica falhou; seguindo só com os recentes', err as Error);
    }
  }
  const usadas = new Set<string>();
  relacionados = semRepeticao(relacionados, usadas);

  // "Recentes" pelo ano de conclusão DERIVADO (mais recente primeiro; sem ano
  // por último): no legado não há data estruturada, e a ordem do banco seria a
  // de importação. Array.prototype.sort é estável — empates mantêm a ordem.
  const porRecencia = [...rows].sort((a, b) => (ano(b) ?? -Infinity) - (ano(a) ?? -Infinity));
  const recentes = semRepeticao(porRecencia, usadas).slice(
    0,
    Math.max(0, maxExemplos - relacionados.length)
  );

  const nomeTenant = compacta(tenant?.name || '') || 'a consultoria';
  const maxChars = envInt('DEEP_RESEARCH_EXPERIENCES_MAX_CHARS', DEFAULT_MAX_CHARS);

  const partes: string[] = [
    `## ${EXPERIENCES_APPENDIX_TITLE} (${nomeTenant})`,
    'Use este bloco APENAS para relacionar o que foi pesquisado com o que a consultoria já executou — no capítulo de Posicionamento / Proposta de Valor e ao recomendar escopo. NÃO cite estas experiências como fato de mercado, NÃO as liste em Fontes e Referências e NÃO atribua à consultoria capacidades que não estejam aqui.',
    '',
    visaoGeral(rows),
  ];
  let tamanho = partes.join('\n').length;

  // Orçamento: acrescenta linha a linha enquanto couber — nunca corta uma linha
  // no meio. Um título de seção sem nenhuma linha abaixo é removido.
  const secao = (titulo: string, itens: Row[]) => {
    if (itens.length === 0) return;
    const cabecalho = ['', titulo];
    const custoCabecalho = cabecalho.join('\n').length + 1;
    if (tamanho + custoCabecalho > maxChars) return;
    partes.push(...cabecalho);
    tamanho += custoCabecalho;
    let adicionadas = 0;
    for (const r of itens) {
      const linha = linhaExemplo(r);
      if (tamanho + linha.length + 1 > maxChars) break;
      partes.push(linha);
      tamanho += linha.length + 1;
      adicionadas++;
    }
    if (adicionadas === 0) {
      partes.splice(partes.length - cabecalho.length, cabecalho.length);
      tamanho -= custoCabecalho;
    }
  };

  secao(`**Experiências mais relacionadas a «${compacta(query)}»:**`, relacionados);
  secao('**Outras experiências recentes:**', recentes);

  return partes.join('\n');
}
