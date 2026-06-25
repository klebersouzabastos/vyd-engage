import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

/**
 * Shared AI provider resolution for the AI Sales Assistant.
 *
 * Spec mandates env vars `AI_PROVIDER` and `AI_API_KEY`. We mirror the
 * reconciliation already used by aiDraftService: prefer AI_PROVIDER/AI_API_KEY,
 * then fall back to OPENAI_API_KEY / ANTHROPIC_API_KEY so pre-existing setups
 * keep working. No keys are ever embedded in code.
 */

export interface ProviderConfig {
  provider: string;
  apiKey: string;
  model?: string;
}

/** Resolve the configured AI provider, or null when none is configured. */
export function resolveProviderConfig(): ProviderConfig | null {
  const provider = process.env.AI_PROVIDER;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (provider && apiKey) {
    return { provider, apiKey, model };
  }

  // Fallback to legacy individual env vars (keeps existing deployments working)
  if (process.env.OPENAI_API_KEY) {
    return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY, model };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY, model };
  }

  return null;
}

/**
 * Whether AI features are enabled. Per req 33/spec, the frontend hides all AI
 * UI when AI_PROVIDER is not configured — this is the single source of truth.
 */
export function isAIEnabled(): boolean {
  return resolveProviderConfig() !== null;
}

/** Resolve a Vercel AI SDK language model for the configured provider (Claude-first). */
export function getModel(provider: string, apiKey: string, model?: string): LanguageModel | null {
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(model || 'claude-sonnet-4-20250514');
    case 'openai':
      return createOpenAI({ apiKey })(model || 'gpt-4o-mini');
    default:
      return null;
  }
}

/** Resolve a model from the active provider config, or null if AI is disabled. */
export function getActiveModel(): LanguageModel | null {
  const config = resolveProviderConfig();
  if (!config) return null;
  return getModel(config.provider, config.apiKey, config.model);
}

/** Convert provider/timeout errors into a friendly HTTP 503 (edge case). */
export function aiUnavailableError(): ReturnType<typeof createError> {
  return createError(
    'O serviço de IA está temporariamente indisponível. Tente novamente em instantes.',
    503,
    'AI_PROVIDER_UNAVAILABLE'
  );
}

/**
 * Log AI call metadata only — tokens, latency, lead_id (reqs 34 & 36).
 * NEVER pass response content here: this helper deliberately accepts no text body.
 */
export function logAiUsage(meta: {
  feature: string;
  tenantId: string;
  leadId?: string;
  dealId?: string;
  latencyMs: number;
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  provider?: string;
}): void {
  logger.info('AI call', {
    feature: meta.feature,
    tenantId: meta.tenantId,
    leadId: meta.leadId,
    dealId: meta.dealId,
    latencyMs: meta.latencyMs,
    tokens: meta.tokens,
    promptTokens: meta.promptTokens,
    completionTokens: meta.completionTokens,
    provider: meta.provider,
  });
}
