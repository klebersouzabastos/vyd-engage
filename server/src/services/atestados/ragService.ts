// Indexação e busca semântica (RAG) do conteúdo dos atestados (req 9, 12).
//
// Embeddings: OpenAI text-embedding-3-small (1536 dims — casa com a coluna
// vector(1536) de AtestadoChunk). Gated: se não houver provider OpenAI, a busca
// semântica DEGRADA para busca por palavra-chave sobre o texto extraído/objeto.
// Vetores são gravados/consultados via SQL bruto (pgvector), pois o tipo `vector`
// é Unsupported no Prisma Client.

import prisma from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { resolveProviderConfig } from '../aiProvider.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;
const CHUNK_SIZE = 900; // caracteres por chunk
const CHUNK_OVERLAP = 150;

export interface SemanticHit {
  atestadoId: string;
  score: number;
  trecho: string;
}

/** Embeddings só existem com provider OpenAI (Anthropic não tem API de embeddings). */
export function isEmbeddingEnabled(): boolean {
  const config = resolveProviderConfig();
  if (config?.provider === 'openai') return true;
  return Boolean(process.env.OPENAI_API_KEY);
}

function openaiKey(): string | null {
  const config = resolveProviderConfig();
  if (config?.provider === 'openai') return config.apiKey;
  return process.env.OPENAI_API_KEY || null;
}

/** Gera embeddings para uma lista de textos (batch). Retorna [] em falha. */
export async function embed(texts: string[]): Promise<number[][]> {
  const key = openaiKey();
  if (!key || texts.length === 0) return [];
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(`Embeddings falharam: ${res.status} ${body.slice(0, 200)}`);
      return [];
    }
    const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
    return (data.data ?? []).map((d) => d.embedding);
  } catch (err) {
    logger.warn('Embeddings lançaram exceção', err as Error);
    return [];
  }
}

/** Quebra um texto longo em chunks com sobreposição, em fronteiras de espaço. */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(' ', end);
      if (lastSpace > start + CHUNK_SIZE / 2) end = lastSpace;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter(Boolean);
}

function vecToSql(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * (Re)indexa um atestado: apaga chunks antigos, quebra o texto (objeto + texto
 * extraído), gera embeddings e grava os vetores. Marca Atestado.indexadoEm.
 * Nunca lança — degrada silenciosamente logando o erro (a busca por palavra-chave
 * continua funcionando sobre o texto).
 */
export async function indexAtestado(tenantId: string, atestadoId: string): Promise<number> {
  try {
    const atestado = await prisma.atestado.findFirst({
      where: { id: atestadoId, tenantId },
      select: { id: true, objeto: true, textoExtraido: true, docStatus: true },
    });
    if (!atestado) return 0;

    // Sempre limpa chunks antigos.
    await prisma.atestadoChunk.deleteMany({ where: { tenantId, atestadoId } });

    // Só indexa (participa da busca semântica) quando há texto UTILIZÁVEL do documento
    // (docStatus OK). Ilegível/pendente/sem-documento não entram na busca semântica
    // até ter texto — permanecem visíveis/filtráveis por docStatus (req 10 / caso extremo).
    if (atestado.docStatus !== 'OK' || !atestado.textoExtraido) return 0;

    const source = [atestado.objeto || '', atestado.textoExtraido || ''].join('\n').trim();
    const parts = chunkText(source);
    if (parts.length === 0) return 0;

    const vectors = isEmbeddingEnabled() ? await embed(parts) : [];

    for (let i = 0; i < parts.length; i++) {
      const chunk = await prisma.atestadoChunk.create({
        data: { tenantId, atestadoId, ordem: i, texto: parts[i] },
        select: { id: true },
      });
      const vec = vectors[i];
      if (vec && vec.length === EMBEDDING_DIMS) {
        await prisma.$executeRawUnsafe(
          'UPDATE "atestado_chunks" SET "embedding" = $1::vector WHERE "id" = $2',
          vecToSql(vec),
          chunk.id
        );
      }
    }
    await prisma.atestado.update({ where: { id: atestadoId }, data: { indexadoEm: new Date() } });
    return parts.length;
  } catch (err) {
    logger.error('Falha ao indexar atestado para RAG', err as Error);
    return 0;
  }
}

/** Busca por palavra-chave (fallback quando não há embeddings). */
async function keywordSearch(
  tenantId: string,
  query: string,
  opts: { limit: number; includeTerceiros: boolean }
): Promise<SemanticHit[]> {
  const tokens = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 4)
    .slice(0, 12);
  if (tokens.length === 0) return [];

  const atestados = await prisma.atestado.findMany({
    where: {
      tenantId,
      deletedAt: null,
      docStatus: 'OK', // só atestados com texto utilizável entram na busca (req 10)
      ...(opts.includeTerceiros ? {} : { origem: 'PROPRIO' }),
      OR: tokens.flatMap((t) => [
        { objeto: { contains: t, mode: 'insensitive' as const } },
        { textoExtraido: { contains: t, mode: 'insensitive' as const } },
        { contratante: { contains: t, mode: 'insensitive' as const } },
      ]),
    },
    select: { id: true, objeto: true, textoExtraido: true },
    take: 200,
  });

  const hits: SemanticHit[] = atestados.map((a) => {
    const hay = `${a.objeto} ${a.textoExtraido ?? ''}`.toLowerCase();
    const matched = tokens.filter((t) => hay.includes(t));
    return {
      atestadoId: a.id,
      score: matched.length / tokens.length,
      trecho: (a.objeto || a.textoExtraido || '').slice(0, 320),
    };
  });
  hits.sort((x, y) => y.score - x.score);
  return hits.slice(0, opts.limit);
}

/**
 * Busca semântica sobre o acervo. Usa pgvector quando há embeddings; caso contrário
 * degrada para busca por palavra-chave. Sempre filtra por tenant; opcionalmente inclui
 * atestados de terceiros. Agrega por atestado pelo melhor chunk.
 */
export async function semanticSearch(
  tenantId: string,
  query: string,
  opts: { limit?: number; includeTerceiros?: boolean } = {}
): Promise<SemanticHit[]> {
  const limit = opts.limit ?? 20;
  const includeTerceiros = opts.includeTerceiros ?? false;

  if (!isEmbeddingEnabled()) {
    return keywordSearch(tenantId, query, { limit, includeTerceiros });
  }

  const [queryVec] = await embed([query]);
  if (!queryVec) {
    return keywordSearch(tenantId, query, { limit, includeTerceiros });
  }

  try {
    const origemFilter = includeTerceiros ? '' : `AND a."origem" = 'PROPRIO'`;
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT c."atestadoId" AS "atestadoId", c."texto" AS "texto",
              1 - (c."embedding" <=> $1::vector) AS "score"
         FROM "atestado_chunks" c
         JOIN "atestados" a ON a."id" = c."atestadoId"
        WHERE c."tenantId" = $2
          AND c."embedding" IS NOT NULL
          AND a."deletedAt" IS NULL
          AND a."docStatus" = 'OK'
          ${origemFilter}
        ORDER BY c."embedding" <=> $1::vector
        LIMIT $3`,
      vecToSql(queryVec),
      tenantId,
      limit * 4
    )) as Array<{ atestadoId: string; texto: string; score: number }>;

    // Agrega por atestado, mantendo o melhor chunk.
    const best = new Map<string, SemanticHit>();
    for (const r of rows) {
      const cur = best.get(r.atestadoId);
      if (!cur || r.score > cur.score) {
        best.set(r.atestadoId, {
          atestadoId: r.atestadoId,
          score: r.score,
          trecho: (r.texto || '').slice(0, 320),
        });
      }
    }
    return [...best.values()].sort((x, y) => y.score - x.score).slice(0, limit);
  } catch (err) {
    logger.warn('Busca vetorial falhou; usando fallback por palavra-chave', err as Error);
    return keywordSearch(tenantId, query, { limit, includeTerceiros });
  }
}

export const ragService = {
  isEmbeddingEnabled,
  embed,
  chunkText,
  indexAtestado,
  semanticSearch,
};
