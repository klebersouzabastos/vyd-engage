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

function ano(r: Row): number | null {
  const d = r.dataConclusao ?? r.dataInicio;
  return d ? d.getUTCFullYear() : null;
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
  let objeto = compacta(r.objeto);
  if (objeto.length > OBJETO_MAX) objeto = `${objeto.slice(0, OBJETO_MAX - 1).trimEnd()}…`;
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
  const idsRelacionados = new Set(relacionados.map((r) => r.id));
  const recentes = rows
    .filter((r) => !idsRelacionados.has(r.id))
    .slice(0, Math.max(0, maxExemplos - relacionados.length));

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
