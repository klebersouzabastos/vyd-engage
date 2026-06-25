// Provider Perplexity Sonar Deep Research (API async: submit + poll). Assíncrono.
// Deep research real (dezenas de buscas + citações), sem verificação de org.
import { logger } from '../../../utils/logger.js';
import type { ProviderResult, ResearchProvider, ResearchSource } from './types.js';

const PPLX_BASE = 'https://api.perplexity.ai';

function model(): string {
  return process.env.PERPLEXITY_DEEP_RESEARCH_MODEL || 'sonar-deep-research';
}

function apiKey(): string {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error('PERPLEXITY_API_KEY ausente');
  return key;
}

/** Extrai markdown + fontes do payload de uma resposta concluída. */
export function parsePerplexity(data: any): {
  markdown: string;
  sources: string[];
  searchResults: ResearchSource[];
} {
  const choices = data?.choices || data?.response?.choices;
  const markdown = String(choices?.[0]?.message?.content || '').trim();
  const citations: string[] = Array.isArray(data?.citations)
    ? data.citations
    : Array.isArray(data?.response?.citations)
      ? data.response.citations
      : [];
  const sr = Array.isArray(data?.search_results)
    ? data.search_results
    : Array.isArray(data?.response?.search_results)
      ? data.response.search_results
      : [];
  const searchResults: ResearchSource[] = sr
    .map((s: any) => ({ title: s?.title, url: s?.url, date: s?.date }))
    .filter((s: ResearchSource) => !!s.url);
  const sources = searchResults.length ? searchResults.map((s) => s.url) : citations;
  return { markdown, sources: Array.from(new Set(sources)), searchResults };
}

export const perplexityProvider: ResearchProvider = {
  name: 'perplexity',
  isAsync: true,

  enabled() {
    return !!process.env.PERPLEXITY_API_KEY;
  },

  async start(prompt: string): Promise<string> {
    const res = await fetch(`${PPLX_BASE}/async/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request: { model: model(), messages: [{ role: 'user', content: prompt }] },
      }),
    });
    if (!res.ok) {
      const b = await res.text().catch(() => '');
      throw new Error(`Perplexity submit ${res.status}: ${b.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    const id = data?.id || data?.request_id;
    if (!id) throw new Error('Perplexity não retornou um id');
    logger.info('Deep Research iniciado (perplexity)', { id, model: model() });
    return String(id);
  },

  async poll(jobId: string): Promise<ProviderResult> {
    const res = await fetch(`${PPLX_BASE}/async/chat/completions/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
    });
    if (!res.ok) {
      const b = await res.text().catch(() => '');
      return { status: 'failed', error: `Perplexity poll ${res.status}: ${b.slice(0, 200)}` };
    }
    const data = (await res.json()) as any;
    const st = String(data?.status || '').toUpperCase();
    if (st === 'COMPLETED') {
      const { markdown, sources, searchResults } = parsePerplexity(data?.response || data);
      if (!markdown) return { status: 'failed', error: 'Concluído sem conteúdo.' };
      return { status: 'completed', markdown, sources, searchResults };
    }
    if (['FAILED', 'ERROR', 'CANCELLED', 'EXPIRED'].includes(st)) {
      return { status: 'failed', error: String(data?.error_message || data?.error || `status ${st}`) };
    }
    return { status: 'pending' };
  },
};
