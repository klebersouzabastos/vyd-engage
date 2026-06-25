// Provider OpenAI Deep Research (Responses API, modo background). Assíncrono.
// Serve aos modelos *-deep-research (exigem organização verificada na OpenAI).
import { logger } from '../../../utils/logger.js';
import type { ProviderResult, ResearchProvider } from './types.js';

const OPENAI_BASE = 'https://api.openai.com/v1';

function model(): string {
  return process.env.DEEP_RESEARCH_MODEL || 'o4-mini-deep-research';
}

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY ausente');
  return key;
}

/** Extrai markdown e fontes (url_citation) do output da Responses API. */
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

export const openaiProvider: ResearchProvider = {
  name: 'openai',
  isAsync: true,

  enabled() {
    return !!process.env.OPENAI_API_KEY;
  },

  async start(prompt: string): Promise<string> {
    const res = await fetch(`${OPENAI_BASE}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model(),
        input: prompt,
        background: true,
        tools: [{ type: 'web_search_preview' }],
      }),
    });
    if (!res.ok) {
      const b = await res.text().catch(() => '');
      throw new Error(`OpenAI responses ${res.status}: ${b.slice(0, 300)}`);
    }
    const data = (await res.json()) as { id?: string };
    if (!data.id) throw new Error('OpenAI não retornou um id de response');
    logger.info('Deep Research iniciado (openai)', { responseId: data.id, model: model() });
    return data.id;
  },

  async poll(jobId: string): Promise<ProviderResult> {
    const res = await fetch(`${OPENAI_BASE}/responses/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
    });
    if (!res.ok) {
      const b = await res.text().catch(() => '');
      return { status: 'failed', error: `OpenAI poll ${res.status}: ${b.slice(0, 200)}` };
    }
    const data = (await res.json()) as any;
    const status = data.status;
    if (status === 'completed') {
      const { markdown, sources } = extractOutput(data);
      if (!markdown) return { status: 'failed', error: 'Resposta concluída sem conteúdo.' };
      return { status: 'completed', markdown, sources };
    }
    if (['failed', 'cancelled', 'expired', 'incomplete'].includes(status)) {
      const err = data.error?.message || data.incomplete_details?.reason || `status ${status}`;
      return { status: 'failed', error: String(err) };
    }
    return { status: 'pending' };
  },
};
