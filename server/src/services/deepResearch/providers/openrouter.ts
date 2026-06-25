// Provider OpenRouter. Síncrono via streaming (mantém a conexão aberta durante a
// pesquisa de minutos, evitando timeout). Acessa perplexity/sonar-deep-research
// (e outros) com a chave OpenRouter — sem verificação de organização.
import { logger } from '../../../utils/logger.js';
import type { ProviderResult, ResearchProvider, ResearchSource } from './types.js';

const OR_BASE = 'https://openrouter.ai/api/v1';

function model(): string {
  return process.env.OPENROUTER_DEEP_RESEARCH_MODEL || 'perplexity/sonar-deep-research';
}

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY ausente');
  return key;
}

/** Parseia um chunk SSE da OpenRouter, acumulando conteúdo e fontes. */
export function applyChunk(
  json: any,
  acc: { markdown: string; citations: string[]; searchResults: ResearchSource[] },
): void {
  const delta = json?.choices?.[0]?.delta;
  if (typeof delta?.content === 'string') acc.markdown += delta.content;
  if (Array.isArray(json?.citations)) acc.citations = json.citations;
  const sr = json?.search_results || json?.choices?.[0]?.message?.search_results;
  if (Array.isArray(sr)) {
    acc.searchResults = sr
      .map((s: any) => ({ title: s?.title, url: s?.url, date: s?.date }))
      .filter((s: ResearchSource) => !!s.url);
  }
}

export const openrouterProvider: ResearchProvider = {
  name: 'openrouter',
  isAsync: false,

  enabled() {
    return !!process.env.OPENROUTER_API_KEY;
  },

  async run(prompt: string): Promise<ProviderResult> {
    const res = await fetch(`${OR_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.FRONTEND_URL || 'https://engage.vydhub.com',
        'X-Title': 'VYD Engage - Inteligencia de Mercado',
      },
      body: JSON.stringify({
        model: model(),
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const b = await res.text().catch(() => '');
      return { status: 'failed', error: `OpenRouter ${res.status}: ${b.slice(0, 300)}` };
    }

    const acc = { markdown: '', citations: [] as string[], searchResults: [] as ResearchSource[] };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          applyChunk(JSON.parse(payload), acc);
        } catch {
          /* chunk parcial — ignora */
        }
      }
    }

    const markdown = acc.markdown.trim();
    if (!markdown) return { status: 'failed', error: 'OpenRouter retornou conteúdo vazio.' };
    const sources = acc.searchResults.length
      ? acc.searchResults.map((s) => s.url)
      : acc.citations;
    logger.info('Deep Research concluído (openrouter)', {
      chars: markdown.length,
      fontes: sources.length,
    });
    return {
      status: 'completed',
      markdown,
      sources: Array.from(new Set(sources)),
      searchResults: acc.searchResults,
    };
  },
};
