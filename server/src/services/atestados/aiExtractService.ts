// Extração assistida por IA para o módulo de Atestados (reqs 15, 17, 18, 29).
//   - extractEditalRequirements: exigências de habilitação técnica de um edital.
//   - suggestAtestadoFields: sugestão de campos a partir do texto de um documento.
//   - classifyMatch: classifica o atendimento de uma exigência por um atestado.
// Todas são GATED (retornam null quando a IA não está configurada) e usam
// generateObject sem tipos (cast) para não estourar a memória do tsc (AI SDK v6).

import { z } from 'zod';
import { generateObject } from 'ai';
import { getActiveModel, isAIEnabled, logAiUsage, resolveProviderConfig } from '../aiProvider.js';
import { logger } from '../../utils/logger.js';

const exigenciaSchema = z.object({
  exigencias: z.array(
    z.object({
      descricao: z.string().describe('Texto da exigência técnica exigida no edital'),
      acervo: z
        .enum(['OPERACIONAL', 'PROFISSIONAL', 'INDEFINIDO'])
        .describe('OPERACIONAL = exigência da empresa; PROFISSIONAL = do responsável técnico'),
      grandeza: z.string().nullable().describe('Grandeza do quantitativo mínimo, ex.: extensão de rede'),
      quantMinimo: z.number().nullable().describe('Valor numérico mínimo exigido, se houver'),
      unidade: z.string().nullable().describe('Unidade do quantitativo, ex.: km, m³, m²'),
      permiteSomatorio: z.boolean().describe('true se o edital permite somar atestados para atingir o mínimo'),
    })
  ),
});

const suggestSchema = z.object({
  contratante: z.string().nullable(),
  objeto: z.string().nullable(),
  contrato: z.string().nullable(),
  artNumero: z.string().nullable(),
  catNumero: z.string().nullable(),
  conselho: z.string().nullable(),
  conselhoUF: z.string().nullable(),
  dataInicioISO: z.string().nullable(),
  dataConclusaoISO: z.string().nullable(),
  valorContrato: z.number().nullable(),
  responsaveis: z.array(
    z.object({
      nome: z.string(),
      funcoes: z.array(z.object({ funcao: z.string(), categoria: z.string().nullable() })),
    })
  ),
  quantitativos: z.array(z.object({ grandeza: z.string(), valor: z.number(), unidade: z.string() })),
});

const matchSchema = z.object({
  status: z.enum(['ATENDE', 'ATENDE_PARCIAL', 'NAO_ATENDE', 'REVISAR']),
  confianca: z.number().min(0).max(1),
  trecho: z.string().nullable().describe('Trecho do atestado que comprova (ou vazio)'),
});

export interface EditalExigencia {
  descricao: string;
  acervo: 'OPERACIONAL' | 'PROFISSIONAL' | 'INDEFINIDO';
  grandeza: string | null;
  quantMinimo: number | null;
  unidade: string | null;
  permiteSomatorio: boolean;
}

export interface AtestadoSuggestion {
  contratante: string | null;
  objeto: string | null;
  contrato: string | null;
  artNumero: string | null;
  catNumero: string | null;
  conselho: string | null;
  conselhoUF: string | null;
  dataInicioISO: string | null;
  dataConclusaoISO: string | null;
  valorContrato: number | null;
  responsaveis: Array<{ nome: string; funcoes: Array<{ funcao: string; categoria: string | null }> }>;
  quantitativos: Array<{ grandeza: string; valor: number; unidade: string }>;
}

export interface MatchClassification {
  status: 'ATENDE' | 'ATENDE_PARCIAL' | 'NAO_ATENDE' | 'REVISAR';
  confianca: number;
  trecho: string | null;
}

export function isAiExtractEnabled(): boolean {
  return isAIEnabled();
}

async function runObject<T>(
  feature: string,
  tenantId: string,
  schema: z.ZodTypeAny,
  system: string,
  prompt: string
): Promise<T | null> {
  const model = getActiveModel();
  if (!model) return null;
  const startedAt = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (generateObject as any)({ model, schema, system, prompt, temperature: 0.1 });
    logAiUsage({
      feature,
      tenantId,
      latencyMs: Date.now() - startedAt,
      tokens: result.usage?.totalTokens,
      promptTokens: result.usage?.inputTokens,
      completionTokens: result.usage?.outputTokens,
      provider: resolveProviderConfig()?.provider,
    });
    return result.object as T;
  } catch (err) {
    logger.warn(`IA (${feature}) falhou`, err as Error);
    return null;
  }
}

/** Extrai exigências de habilitação técnica de um edital. null se IA indisponível. */
export async function extractEditalRequirements(
  tenantId: string,
  editalTexto: string
): Promise<EditalExigencia[] | null> {
  const system =
    'Você é um especialista em habilitação técnica de licitações no Brasil. ' +
    'Extraia APENAS as exigências de QUALIFICAÇÃO TÉCNICA do edital. ' +
    'Distinga técnico-OPERACIONAL (atestado da empresa) de técnico-PROFISSIONAL (acervo do RT). ' +
    'Capture quantitativos mínimos (grandeza, valor, unidade) quando houver. ' +
    'Use SOMENTE o texto fornecido; nunca invente exigências.';
  const prompt = `Edital (trecho de habilitação técnica):\n\n${editalTexto.slice(0, 16000)}`;
  const out = await runObject<{ exigencias: EditalExigencia[] }>(
    'atestado-edital',
    tenantId,
    exigenciaSchema,
    system,
    prompt
  );
  return out?.exigencias ?? null;
}

/** Sugere campos de um atestado a partir do texto do documento. null se IA indisponível. */
export async function suggestAtestadoFields(
  tenantId: string,
  texto: string
): Promise<AtestadoSuggestion | null> {
  const system =
    'Você extrai metadados de um atestado técnico / CAT a partir do texto do documento. ' +
    'Responda com os campos que conseguir identificar; use null quando não houver. ' +
    'Nunca invente dados que não estejam no texto.';
  const prompt = `Texto do documento:\n\n${texto.slice(0, 16000)}`;
  return runObject<AtestadoSuggestion>('atestado-sugestao', tenantId, suggestSchema, system, prompt);
}

/** Classifica se um atestado atende uma exigência. null se IA indisponível. */
export async function classifyMatch(
  tenantId: string,
  exigencia: string,
  atestadoResumo: string
): Promise<MatchClassification | null> {
  const system =
    'Você avalia se um atestado técnico atende uma exigência de edital. ' +
    'Responda ATENDE, ATENDE_PARCIAL, NAO_ATENDE ou REVISAR (quando incerto). ' +
    'confianca entre 0 e 1. Extraia o trecho do atestado que comprova, se houver. ' +
    'Baseie-se SOMENTE nos textos fornecidos.';
  const prompt = `Exigência:\n${exigencia}\n\nAtestado:\n${atestadoResumo.slice(0, 6000)}`;
  return runObject<MatchClassification>('atestado-match', tenantId, matchSchema, system, prompt);
}

export const aiExtractService = {
  isAiExtractEnabled,
  extractEditalRequirements,
  suggestAtestadoFields,
  classifyMatch,
};
