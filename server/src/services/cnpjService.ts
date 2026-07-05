/**
 * cnpjService — enriquecimento de empresa por CNPJ (Upgrade RD P2, req 20).
 *
 * Consulta a BrasilAPI (pública/gratuita) e cai para a ReceitaWS quando a
 * primeira falha. Normaliza o CNPJ (só dígitos, 14), valida, e devolve um DIFF
 * campo a campo comparando o valor atual da empresa com o sugerido pela consulta.
 * NUNCA grava — o apply é o `PUT /companies/:id` normal com os campos escolhidos.
 *
 * SEGURANÇA: chamadas externas passam por `assertPublicHttpUrl` (anti-SSRF) +
 * timeout (AbortController). BrasilAPI/ReceitaWS são hosts públicos.
 *
 * Erros: CNPJ inválido → 400; não encontrado → 404; provedores fora/timeout → 502.
 */
import { CompanySize } from '@prisma/client';
import prisma from '../config/database.js';
import { createError } from '../middleware/errorHandler.js';
import { assertPublicHttpUrl } from '../utils/safeFetch.js';
import { logger } from '../utils/logger.js';

const REQUEST_TIMEOUT_MS = 12000;

// Rate limit / backoff outbound (req 20). BrasilAPI e ReceitaWS são gratuitas e
// impõem limites baixos (ReceitaWS ~3 req/min). Serializamos por PROVEDOR com um
// espaçamento mínimo entre chamadas e aplicamos backoff em HTTP 429/Retry-After,
// sem dependência nova.
const MIN_INTERVAL_MS = 1000; // espaçamento mínimo entre chamadas do MESMO provedor
const MAX_RETRIES_429 = 2; // tentativas extras ao receber 429
const DEFAULT_BACKOFF_MS = 2000; // backoff quando não há Retry-After
const MAX_BACKOFF_MS = 15000; // teto do backoff (evita prender a request)

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Erro tipado para 429 (rate limit do provedor). NÃO é mascarado como 502: quem
 * chama pode decidir propagar um 429 claro ao cliente.
 */
export class RateLimitError extends Error {
  statusCode = 429;
  code = 'CNPJ_RATE_LIMITED';
  retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Limiter simples por provedor: uma fila serial que garante um intervalo mínimo
 * entre chamadas consecutivas ao mesmo host. Sem dependência externa (mutex/fila
 * caseiros via encadeamento de Promises).
 */
class ProviderLimiter {
  private chain: Promise<void> = Promise.resolve();
  private lastAt = 0;
  constructor(private readonly minIntervalMs: number) {}

  /** Serializa `task`, respeitando o espaçamento mínimo desde a última execução. */
  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.chain.then(async () => {
      const wait = this.lastAt + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await task();
      } finally {
        this.lastAt = Date.now();
      }
    });
    // Mantém a corrente viva mesmo se `task` rejeitar (não trava o próximo da fila).
    this.chain = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

const limiters: Record<string, ProviderLimiter> = {
  brasilapi: new ProviderLimiter(MIN_INTERVAL_MS),
  receitaws: new ProviderLimiter(MIN_INTERVAL_MS),
};

/** Lê o Retry-After (segundos ou data HTTP) → ms. Undefined quando ausente/ inválido. */
function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const secs = Number(header);
  if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, MAX_BACKOFF_MS);
  const when = Date.parse(header);
  if (!Number.isNaN(when)) return Math.min(Math.max(when - Date.now(), 0), MAX_BACKOFF_MS);
  return undefined;
}

export interface EnrichFieldDiff {
  key: string;
  label: string;
  current: string | null;
  suggested: string | null;
}

export interface EnrichResult {
  fields: EnrichFieldDiff[];
}

/** Dados normalizados extraídos de qualquer provedor. */
interface NormalizedCompany {
  name: string | null; // razão social
  fantasyName: string | null; // nome fantasia
  address: string | null; // endereço formatado
  industry: string | null; // CNAE principal (descrição)
  size: CompanySize | null; // porte mapeado
}

/** Remove tudo que não é dígito e valida o comprimento (14). */
export function normalizeCnpj(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length !== 14) {
    throw createError('CNPJ inválido — informe 14 dígitos.', 400, 'INVALID_CNPJ');
  }
  return digits;
}

/** Mapeia o "porte" textual do provedor para o enum CompanySize. */
function mapPorte(porte: string | undefined | null): CompanySize | null {
  const p = String(porte ?? '')
    .toUpperCase()
    .trim();
  if (!p) return null;
  if (p.includes('MEI') || p.includes('MICRO')) return CompanySize.MICRO;
  if (p.includes('PEQUEN') || p.includes('EPP') || p.includes('SMALL')) return CompanySize.SMALL;
  if (p.includes('MEDI')) return CompanySize.MEDIUM;
  if (p.includes('GRANDE') || p.includes('LARGE')) return CompanySize.LARGE;
  if (p.includes('DEMAIS')) return CompanySize.MEDIUM; // "DEMAIS" (BrasilAPI) → médio
  return null;
}

/** Uma única requisição HTTP (timeout + anti-SSRF), sem limiter/backoff. */
async function doFetch(
  url: string
): Promise<{ ok: boolean; status: number; body: any; retryAfterMs?: number }> {
  await assertPublicHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const retryAfterMs = parseRetryAfterMs(res.headers.get('retry-after'));
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body, retryAfterMs };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Requisição por provedor: serializada pelo limiter (espaçamento mínimo) e com
 * backoff em HTTP 429 (respeitando Retry-After). Esgotadas as tentativas em 429,
 * lança RateLimitError (NÃO mascara como 502 — o 429 é distinguível).
 */
async function fetchJson(
  provider: 'brasilapi' | 'receitaws',
  url: string
): Promise<{ ok: boolean; status: number; body: any }> {
  const limiter = limiters[provider];
  for (let attempt = 0; ; attempt++) {
    const r = await limiter.run(() => doFetch(url));
    if (r.status !== 429) return { ok: r.ok, status: r.status, body: r.body };

    // 429: backoff e retry, até o limite.
    if (attempt >= MAX_RETRIES_429) {
      throw new RateLimitError(
        `Provedor ${provider} retornou 429 (rate limit) após ${attempt + 1} tentativas.`,
        r.retryAfterMs
      );
    }
    const backoff = Math.min(r.retryAfterMs ?? DEFAULT_BACKOFF_MS, MAX_BACKOFF_MS);
    logger.warn('CNPJ provider 429 — backoff', { provider, attempt, backoffMs: backoff });
    await sleep(backoff);
  }
}

function joinAddress(parts: (string | null | undefined)[]): string | null {
  const cleaned = parts
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter((p) => p.length > 0);
  return cleaned.length > 0 ? cleaned.join(', ') : null;
}

/** BrasilAPI: https://brasilapi.com.br/api/cnpj/v1/{cnpj} */
function mapBrasilApi(body: any): NormalizedCompany {
  return {
    name: body?.razao_social ?? null,
    fantasyName: body?.nome_fantasia ?? null,
    address: joinAddress([
      body?.descricao_tipo_de_logradouro,
      body?.logradouro,
      body?.numero,
      body?.bairro,
      body?.municipio,
      body?.uf,
      body?.cep,
    ]),
    industry: body?.cnae_fiscal_descricao ?? null,
    size: mapPorte(body?.porte),
  };
}

/** ReceitaWS: https://receitaws.com.br/v1/cnpj/{cnpj} */
function mapReceitaWs(body: any): NormalizedCompany {
  const atividade = Array.isArray(body?.atividade_principal) ? body.atividade_principal[0] : null;
  return {
    name: body?.nome ?? null,
    fantasyName: body?.fantasia ?? null,
    address: joinAddress([
      body?.logradouro,
      body?.numero,
      body?.bairro,
      body?.municipio,
      body?.uf,
      body?.cep,
    ]),
    industry: atividade?.text ?? null,
    size: mapPorte(body?.porte),
  };
}

/**
 * Consulta a BrasilAPI e, em falha, a ReceitaWS. Lança erro claro quando nenhum
 * provedor responde ou o CNPJ não é encontrado.
 */
async function lookup(cnpj: string): Promise<NormalizedCompany> {
  // Um 429 esgotado em qualquer provedor é lembrado para virar erro claro no
  // fim (em vez de mascarar como 502 "indisponível").
  let rateLimited: RateLimitError | null = null;

  // 1) BrasilAPI
  try {
    const r = await fetchJson('brasilapi', `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (r.ok && r.body?.razao_social) return mapBrasilApi(r.body);
    if (r.status === 404) {
      // BrasilAPI 404 = CNPJ inexistente; ainda tentamos o fallback antes de desistir.
      logger.info('BrasilAPI 404 para CNPJ — tentando ReceitaWS', { cnpj });
    }
  } catch (err) {
    if (err instanceof RateLimitError) rateLimited = err;
    logger.warn('BrasilAPI indisponível — tentando ReceitaWS', err);
  }

  // 2) ReceitaWS (fallback)
  try {
    const r = await fetchJson('receitaws', `https://receitaws.com.br/v1/cnpj/${cnpj}`);
    if (r.ok && r.body?.status !== 'ERROR' && r.body?.nome) return mapReceitaWs(r.body);
    if (r.body?.status === 'ERROR' || r.status === 404) {
      throw createError('CNPJ não encontrado nas bases públicas.', 404, 'CNPJ_NOT_FOUND');
    }
  } catch (err: any) {
    if (err?.statusCode === 404) throw err;
    if (err instanceof RateLimitError) rateLimited = err;
    logger.warn('ReceitaWS indisponível', err);
  }

  // Rate limit distinguível → 429 claro (com Retry-After quando disponível).
  if (rateLimited) {
    throw createError(
      'Consulta de CNPJ temporariamente limitada pelo provedor. Tente novamente em instantes.',
      429,
      'CNPJ_RATE_LIMITED',
      rateLimited.retryAfterMs ? { retryAfterMs: rateLimited.retryAfterMs } : undefined
    );
  }

  throw createError(
    'Não foi possível consultar o CNPJ agora. Tente novamente em instantes.',
    502,
    'CNPJ_PROVIDER_UNAVAILABLE'
  );
}

export const cnpjService = {
  normalizeCnpj,

  /**
   * Enriquece a partir de um CNPJ. Se `companyId` for informado, compara com a
   * empresa atual (do tenant) para montar o diff `current` vs `suggested`. NÃO grava.
   */
  async enrich(tenantId: string, rawCnpj: string, companyId?: string): Promise<EnrichResult> {
    const cnpj = normalizeCnpj(rawCnpj);

    let current: {
      name: string | null;
      fantasyName: string | null;
      address: string | null;
      industry: string | null;
      size: CompanySize | null;
    } = { name: null, fantasyName: null, address: null, industry: null, size: null };

    if (companyId) {
      const company = await prisma.company.findFirst({
        where: { id: companyId, tenantId },
        select: { name: true, fantasyName: true, address: true, industry: true, size: true },
      });
      if (!company) throw createError('Empresa não encontrada.', 404, 'COMPANY_NOT_FOUND');
      current = company;
    }

    const suggested = await lookup(cnpj);

    const fields: EnrichFieldDiff[] = [
      { key: 'name', label: 'Razão social', current: current.name, suggested: suggested.name },
      {
        key: 'fantasyName',
        label: 'Nome fantasia',
        current: current.fantasyName,
        suggested: suggested.fantasyName,
      },
      { key: 'address', label: 'Endereço', current: current.address, suggested: suggested.address },
      {
        key: 'industry',
        label: 'Segmento (CNAE)',
        current: current.industry,
        suggested: suggested.industry,
      },
      {
        // `size` carrega o VALOR do enum (MICRO|SMALL|...) — aplicável direto via
        // PUT /companies/:id. A tradução para rótulo humano fica no frontend.
        key: 'size',
        label: 'Porte',
        current: current.size ?? null,
        suggested: suggested.size ?? null,
      },
    ];

    // Só devolve campos com sugestão (evita ruído de campos vazios).
    return { fields: fields.filter((f) => f.suggested != null && f.suggested !== '') };
  },
};
