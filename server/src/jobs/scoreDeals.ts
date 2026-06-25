import { Queue, Worker, Job } from 'bullmq';
import { logger } from '../utils/logger.js';
import prisma from '../config/database.js';
import { DealStage } from '@prisma/client';
import { dealScoringService } from '../services/dealScoringService.js';
import { isAIEnabled } from '../services/aiProvider.js';

/**
 * AI-2.1 — weekly batch recalculation of deal close-propensity scores (spec req 21).
 *
 * Gated by ENABLE_AUTOMATION_ENGINE (same pattern as billing/automation jobs) and
 * requires Redis. On-demand recalculation is also exposed via the deal endpoint
 * (dealScoringService.computeAndStore) and `enqueueScoreRecalc` below.
 */

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

const QUEUE_NAME = 'score-deals';
const WEEKLY_JOB_ID = 'weekly-deal-score-recalc';
const REPEAT_EVERY_MS = 7 * 24 * 60 * 60 * 1000; // weekly

export const scoreDealsQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

/** Recalculate AI scores for all open deals of every tenant. */
async function recalcAllOpenDeals(): Promise<{ scored: number; failed: number }> {
  if (!isAIEnabled()) {
    logger.warn('scoreDeals: AI provider not configured, skipping batch recalc');
    return { scored: 0, failed: 0 };
  }

  const openDeals = await prisma.deal.findMany({
    where: { deletedAt: null, stage: { notIn: [DealStage.WON, DealStage.LOST] } },
    select: { id: true, tenantId: true },
  });

  let scored = 0;
  let failed = 0;

  // Sequential to respect provider rate limits and avoid thundering-herd cost.
  for (const deal of openDeals) {
    try {
      await dealScoringService.computeAndStore(deal.tenantId, deal.id);
      scored++;
    } catch (error: any) {
      failed++;
      logger.warn('scoreDeals: failed to score deal', { dealId: deal.id, error: error?.message });
    }
  }

  logger.info('scoreDeals batch recalc complete', { total: openDeals.length, scored, failed });
  return { scored, failed };
}

export const scoreDealsWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    logger.info('Processing scoreDeals job', { jobId: job.id, name: job.name });
    return recalcAllOpenDeals();
  },
  { connection: redisConnection, concurrency: 1 }
);

scoreDealsWorker.on('completed', (job) => {
  logger.info('scoreDeals job completed', { jobId: job.id });
});

scoreDealsWorker.on('failed', (job, err) => {
  logger.error('scoreDeals job failed', err, { jobId: job?.id });
});

/** Enqueue an on-demand recalculation of all open deals' scores. */
export async function enqueueScoreRecalc(): Promise<void> {
  await scoreDealsQueue.add('on-demand-recalc', {});
}

/** Register the weekly repeatable job. Worker runs by importing this module. */
export async function initializeScoreDealsJob(): Promise<void> {
  await scoreDealsQueue.add(
    'weekly-recalc',
    {},
    { jobId: WEEKLY_JOB_ID, repeat: { every: REPEAT_EVERY_MS } }
  );
  logger.info('scoreDeals job initialized (weekly recalc)');
}
