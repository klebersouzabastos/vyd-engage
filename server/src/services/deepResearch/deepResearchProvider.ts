// Integração com a OpenAI Deep Research API (Responses API, modo background).
//
// O Deep Research é demorado (minutos), então disparamos em background e um job
// (deepResearchPoller) acompanha até concluir. Gated por ENABLE_DEEP_RESEARCH_API
// + OPENAI_API_KEY para evitar custos acidentais. Usa fetch (Node 18+), sem
// dependência nova.

import { logger } from '../../utils/logger.js';

const OPENAI_BASE = 'https://api.openai.com/v1';

/** A integração só roda quando explicitamente habilitada e com chave. */
export function isDeepResearchApiEnabled(): boolean {
  return process.env.ENABLE_DEEP_RESEARCH_API === 'true' && !!process.env.OPENAI_API_KEY;
}

function deepResearchModel(): string {
  return process.env.DEEP_RESEARCH_MODEL || 'o4-mini-deep-research';
}

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY ausente');
  return key;
}

/**
 * Dispara uma pesquisa em background. Retorna o id do response da OpenAI, que o
 * poller usa para acompanhar. Deep Research exige uma ferramenta de busca.
 */
export async function startDeepResearch(prompt: string): Promise<string> {
  const model = deepResearchModel();
  // Os modelos *-deep-research buscam na web autonomamente. Modelos GA (gpt-4o,
  // gpt-4.1) só buscam se forçados — então instruímos e forçamos a 1ª ação como
  // web search, garantindo dados atuais e fontes citadas.
  const isDeepResearch = /deep-research/i.test(model);
  const input = isDeepResearch
    ? prompt
    : `Pesquise na web por informações atuais (2026) e cite as fontes. Use os resultados para elaborar o relatório a seguir.\n\n${prompt}`;

  const body: Record<string, unknown> = {
    model,
    input,
    background: true,
    tools: [{ type: 'web_search_preview' }],
    // Sem `reasoning.summary`: exige organização verificada e não agrega ao relatório.
  };
  if (!isDeepResearch) {
    body.tool_choice = { type: 'web_search_preview' };
  }

  const res = await fetch(`${OPENAI_BASE}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI responses ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error('OpenAI não retornou um id de response');
  logger.info('Deep Research iniciado', { responseId: data.id, model: deepResearchModel() });
  return data.id;
}

export interface PollResult {
  status: 'pending' | 'completed' | 'failed';
  markdown?: string;
  sources?: string[];
  error?: string;
}

/** Consulta o status de um response em background. */
export async function pollDeepResearch(responseId: string): Promise<PollResult> {
  const res = await fetch(`${OPENAI_BASE}/responses/${responseId}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { status: 'failed', error: `OpenAI poll ${res.status}: ${body.slice(0, 200)}` };
  }

  const data = (await res.json()) as any;
  const status = data.status;

  if (status === 'completed') {
    const { markdown, sources } = extractOutput(data);
    if (!markdown) return { status: 'failed', error: 'Resposta concluída sem conteúdo.' };
    return { status: 'completed', markdown, sources };
  }

  if (['failed', 'cancelled', 'expired', 'incomplete'].includes(status)) {
    const err =
      data.error?.message || data.incomplete_details?.reason || `status ${status}`;
    return { status: 'failed', error: String(err) };
  }

  // queued | in_progress
  return { status: 'pending' };
}

/**
 * Extrai o markdown e as fontes (url_citation) do output da Responses API.
 * Exportado para teste.
 */
export function extractOutput(response: any): { markdown: string; sources: string[] } {
  const output = Array.isArray(response?.output) ? response.output : [];
  let markdown = '';
  const sources: string[] = [];
  for (const item of output) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if ((c?.type === 'output_text' || c?.type === 'text') && typeof c.text === 'string') {
          markdown += c.text;
          for (const ann of c.annotations || []) {
            if (ann?.type === 'url_citation' && ann.url) sources.push(ann.url);
          }
        }
      }
    }
  }
  return { markdown: markdown.trim(), sources: Array.from(new Set(sources)) };
}
