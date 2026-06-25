import { Queue, Worker, Job } from 'bullmq';
import { logger } from '../utils/logger.js';
import prisma from '../config/database.js';
import { emailMessagingService } from '../services/emailMessagingService.js';
import { blocksToHtml, applyMergeTags, rewriteLinksForTracking, type MergeTagContext } from '../services/campaignService.js';

// ============================================================================
// campaignSender — BullMQ job that sends an Email Campaign in batches.
//
// Gated by ENABLE_AUTOMATION_ENGINE (+ Redis). The queue is created lazily so
// that importing this module never opens a Redis connection when the engine is
// off (keeps the Redis-unavailable -> 503 edge case clean for the API).
//
// Rate limiting (req 10): max 100 emails/minute PER TENANT. We enforce this by
// processing recipients in batches of BATCH_SIZE (=100) and re-enqueuing the
// next batch with a 60s delay, so a single campaign never exceeds 100/min.
// ============================================================================

const BATCH_SIZE = 100; // emails per minute per tenant (req 10)
const BATCH_INTERVAL_MS = 60_000;
const MAX_RECIPIENT_RETRIES = 3; // edge case: don't reprocess a recipient > 3x

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

export interface CampaignSendJobData {
  campaignId: string;
  tenantId: string;
}

let _queue: Queue<CampaignSendJobData> | null = null;

/**
 * Lazily create (or return) the campaign-sender queue. Only call this when you
 * intend to use Redis — it opens the connection. Throws if Redis is not
 * reachable so callers can map it to a 503.
 */
export function getCampaignSenderQueue(): Queue<CampaignSendJobData> {
  if (!_queue) {
    _queue = new Queue<CampaignSendJobData>('campaign-sender', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return _queue;
}

/**
 * Enqueue a campaign send. `runAt` (optional) schedules it via delay (req 16).
 * Returns the job id. Throws if Redis is unavailable (caller -> 503).
 */
export async function enqueueCampaignSend(
  campaignId: string,
  tenantId: string,
  runAt?: Date | null
): Promise<string> {
  const queue = getCampaignSenderQueue();
  const delay = runAt ? Math.max(0, runAt.getTime() - Date.now()) : 0;
  const job = await queue.add(
    'send-campaign',
    { campaignId, tenantId },
    {
      jobId: `campaign-send-${campaignId}`,
      ...(delay > 0 ? { delay } : {}),
    }
  );
  logger.info('Campaign send enqueued', { campaignId, tenantId, delayMs: delay, jobId: job.id });
  return job.id!;
}

/** Cancel a scheduled (delayed/waiting) campaign send. */
export async function cancelCampaignSend(campaignId: string): Promise<boolean> {
  const queue = getCampaignSenderQueue();
  const job = await queue.getJob(`campaign-send-${campaignId}`);
  if (!job) return false;
  const state = await job.getState();
  if (state === 'delayed' || state === 'waiting') {
    await job.remove();
    logger.info('Scheduled campaign send cancelled', { campaignId });
    return true;
  }
  return false;
}

// ----------------------------------------------------------------------------
// Batch processor
// ----------------------------------------------------------------------------

async function processCampaignBatch(job: Job<CampaignSendJobData>): Promise<void> {
  const { campaignId, tenantId } = job.data;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId },
  });
  if (!campaign) {
    logger.warn('Campaign send: campaign not found', { campaignId, tenantId });
    return;
  }

  // Respect lifecycle: only SCHEDULED/SENDING campaigns send. PAUSED/CANCELLED stop.
  if (campaign.status === 'PAUSED' || campaign.status === 'CANCELLED' || campaign.status === 'SENT') {
    logger.info('Campaign send: status halts processing', { campaignId, status: campaign.status });
    return;
  }

  // Flip to SENDING on first batch.
  if (campaign.status !== 'SENDING') {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'SENDING' } });
  }

  if (!campaign.configId) {
    logger.error('Campaign send: no email config configured', { campaignId });
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });
    return;
  }

  // Pull the next batch of pending/error recipients (skip those exhausted retries).
  const batch = await prisma.campaignRecipient.findMany({
    where: {
      campaignId,
      tenantId,
      status: { in: ['PENDING', 'ERROR'] },
      errorCount: { lt: MAX_RECIPIENT_RETRIES },
    },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  });

  if (batch.length === 0) {
    // Nothing left to send — finalize.
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'SENT', sentAt: campaign.sentAt ?? new Date() },
    });
    logger.info('Campaign send completed', { campaignId, tenantId });
    return;
  }

  const baseUrl = undefined; // resolved inside rewriteLinksForTracking

  for (const recipient of batch) {
    // Re-check unsubscribe at send time (LGPD — req 14).
    const lead = await prisma.lead.findFirst({
      where: { id: recipient.leadId, tenantId },
      select: { name: true, email: true, company: true, unsubscribed: true },
    });

    if (!lead || lead.unsubscribed || !lead.email) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: 'UNSUBSCRIBED', lastError: lead?.unsubscribed ? 'unsubscribed' : 'no email/lead' },
      });
      continue;
    }

    const ctx: MergeTagContext = { name: lead.name, company: lead.company, email: lead.email };
    const subject = applyMergeTags(campaign.subject, ctx);
    const bodyHtml = blocksToHtml(campaign.blocks, ctx);
    const trackedHtml = rewriteLinksForTracking(bodyHtml, recipient.token, baseUrl);

    try {
      // No leadId here on purpose: passing it makes emailMessagingService inject
      // its own open pixel + link rewriting (interaction tracking). Campaign HTML
      // already carries our recipient-token pixel + rewritten links, so we skip
      // that path to avoid a double pixel / conflicting trackers.
      await emailMessagingService.sendEmail(tenantId, {
        configId: campaign.configId,
        to: lead.email,
        subject,
        html: trackedHtml,
      });

      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: 'SENT', sentAt: new Date(), lastError: null },
      });
    } catch (error: any) {
      // Per-recipient error handling (edge case): record + increment counter.
      const errorCount = recipient.errorCount + 1;
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'ERROR',
          errorCount,
          lastError: String(error?.message || 'send failed').slice(0, 500),
        },
      });
      logger.warn('Campaign recipient send failed', {
        campaignId,
        recipientId: recipient.id,
        errorCount,
        error: error?.message,
      });
    }
  }

  // More to send? Re-enqueue the next batch ~60s later (rate limit, req 10).
  const remaining = await prisma.campaignRecipient.count({
    where: {
      campaignId,
      tenantId,
      status: { in: ['PENDING', 'ERROR'] },
      errorCount: { lt: MAX_RECIPIENT_RETRIES },
    },
  });

  if (remaining > 0) {
    await getCampaignSenderQueue().add(
      'send-campaign',
      { campaignId, tenantId },
      { jobId: `campaign-send-${campaignId}-${Date.now()}`, delay: BATCH_INTERVAL_MS }
    );
    logger.info('Campaign batch sent, next batch scheduled', { campaignId, remaining });
  } else {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'SENT', sentAt: campaign.sentAt ?? new Date() },
    });
    logger.info('Campaign send completed', { campaignId, tenantId });
  }
}

// ----------------------------------------------------------------------------
// Worker — only started when the automation engine is enabled.
// ----------------------------------------------------------------------------

let _worker: Worker<CampaignSendJobData> | null = null;

export async function initializeCampaignSender(): Promise<void> {
  if (_worker) return;
  // Ensure the queue exists (so producers and the dashboard share the instance).
  getCampaignSenderQueue();
  _worker = new Worker<CampaignSendJobData>(
    'campaign-sender',
    async (job) => {
      await processCampaignBatch(job);
    },
    {
      connection: redisConnection,
      concurrency: 2,
    }
  );

  _worker.on('failed', (job, err) => {
    logger.error('Campaign send job failed', err, { jobId: job?.id, attempts: job?.attemptsMade });
  });

  logger.info('Campaign sender worker initialized');
}
