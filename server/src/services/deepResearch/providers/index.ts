// Registry dos provedores de Deep Research. Seleção por env:
//   ENABLE_DEEP_RESEARCH_API=true  (gate geral)
//   DEEP_RESEARCH_PROVIDER=openrouter|perplexity|openai  (default: openrouter)
// Cada provider só é usado se estiver habilitado (chave presente).
import type { ResearchProvider } from './types.js';
import { openaiProvider } from './openai.js';
import { perplexityProvider } from './perplexity.js';
import { openrouterProvider } from './openrouter.js';

const PROVIDERS: Record<string, ResearchProvider> = {
  openai: openaiProvider,
  perplexity: perplexityProvider,
  openrouter: openrouterProvider,
};

/** Provider ativo, ou null se a integração estiver desligada/sem chave. */
export function getProvider(): ResearchProvider | null {
  if (process.env.ENABLE_DEEP_RESEARCH_API !== 'true') return null;
  const name = (process.env.DEEP_RESEARCH_PROVIDER || 'openrouter').toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider || !provider.enabled()) return null;
  return provider;
}

export function isDeepResearchApiEnabled(): boolean {
  return getProvider() !== null;
}

export type { ProviderResult, ResearchProvider, ResearchSource } from './types.js';
