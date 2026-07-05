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

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; body: any }> {
  await assertPublicHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timeout);
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
  // 1) BrasilAPI
  try {
    const r = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (r.ok && r.body?.razao_social) return mapBrasilApi(r.body);
    if (r.status === 404) {
      // BrasilAPI 404 = CNPJ inexistente; ainda tentamos o fallback antes de desistir.
      logger.info('BrasilAPI 404 para CNPJ — tentando ReceitaWS', { cnpj });
    }
  } catch (err) {
    logger.warn('BrasilAPI indisponível — tentando ReceitaWS', err);
  }

  // 2) ReceitaWS (fallback)
  try {
    const r = await fetchJson(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
    if (r.ok && r.body?.status !== 'ERROR' && r.body?.nome) return mapReceitaWs(r.body);
    if (r.body?.status === 'ERROR' || r.status === 404) {
      throw createError('CNPJ não encontrado nas bases públicas.', 404, 'CNPJ_NOT_FOUND');
    }
  } catch (err: any) {
    if (err?.statusCode === 404) throw err;
    logger.warn('ReceitaWS indisponível', err);
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
