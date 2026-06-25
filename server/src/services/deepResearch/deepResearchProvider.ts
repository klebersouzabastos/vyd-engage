// Mantido para compatibilidade. A implementação foi modularizada em ./providers/
// (um provider por motor: openai, perplexity, openrouter) com seleção por env.
export { extractOutput } from './providers/openai.js';
export { getProvider, isDeepResearchApiEnabled } from './providers/index.js';
export type { ProviderResult, ResearchProvider, ResearchSource } from './providers/types.js';
