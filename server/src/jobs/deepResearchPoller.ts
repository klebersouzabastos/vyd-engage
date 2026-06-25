import prisma from '../config/database.js';
import { DeepResearchStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';
import {
  isDeepResearchApiEnabled,
  pollDeepResearch,
} from '../services/deepResearch/deepResearchProvider.js';
import { deepResearchService } from '../services/deepResearchService.js';

/**
 * Poller do Deep Research (OpenAI). Acompanha as pesquisas RESEARCHING que têm
 * um response em background e publica o resultado quando concluído. Job leve
 * (setInterval, sem Redis), no padrão do taskNotificationChecker.
 */

const POLL_INTERVAL_MS = process.env.DEEP_RESEARCH_POLL_INTERVAL_MS
  ? parseInt(process.env.DEEP_RESEARCH_POLL_INTERVAL_MS)
  : 30 * 1000; // 30s

async function pollPending() {
  if (!isDeepResearchApiEnabled()) return;
  try {
    const pending = await prisma.deepResearch.findMany({
      where: {
        status: DeepResearchStatus.RESEARCHING,
        providerResponseId: { not: null },
      },
      select: { id: true, providerResponseId: true },
      take: 20,
    });

    for (const r of pending) {
      try {
        const result = await pollDeepResearch(r.providerResponseId!);
        if (result.status === 'completed') {
          await deepResearchService.applyProviderResult(r.id, {
            markdown: result.markdown,
            sources: result.sources,
          });
          logger.info('Deep Research concluído', { id: r.id });
        } else if (result.status === 'failed') {
          await deepResearchService.applyProviderResult(r.id, {
            failed: true,
            error: result.error,
          });
          logger.warn('Deep Research falhou', { id: r.id, error: result.error });
        }
        // pending → aguarda o próximo ciclo
      } catch (err) {
        logger.error('Erro ao consultar Deep Research', err as Error);
      }
    }
  } catch (error) {
    logger.error('Deep Research poller falhou', error as Error);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function initializeDeepResearchPoller() {
  pollPending();
  intervalId = setInterval(pollPending, POLL_INTERVAL_MS);
  logger.info(`Deep Research poller initialized (interval: ${POLL_INTERVAL_MS}ms)`);
}

export function stopDeepResearchPoller() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
