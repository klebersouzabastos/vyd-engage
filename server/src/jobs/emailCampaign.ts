import { Queue, Worker, Job } from 'bullmq';
import { logger } from '../utils/logger.js';
import { emailMessagingService } from '../services/emailMessagingService.js';

// Redis connection configuration
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

// Create email campaign queue
export const emailCampaignQueue = new Queue('email-campaign', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export interface ScheduledCampaignData {
  tenantId: string;
  configId: string;
  recipients: Array<{
    email: string;
    leadId?: string;
    variables?: Record<string, string>;
  }>;
  subject: string;
  html: string;
  text?: string;
  campaignId: string;
}

// Worker to process scheduled email campaigns
export const emailCampaignWorker = new Worker(
  'email-campaign',
  async (job: Job<ScheduledCampaignData>) => {
    const { tenantId, configId, recipients, subject, html, text, campaignId } = job.data;

    logger.info('Processing scheduled email campaign', {
      campaignId,
      tenantId,
      recipientCount: recipients.length,
      jobId: job.id,
    });

    try {
      const result = await emailMessagingService.sendBulk(tenantId, {
        configId,
        recipients,
        subject,
        html,
        text,
      });

      logger.info('Scheduled email campaign completed', {
        campaignId,
        sent: result.sent,
        failed: result.failed,
      });

      return result;
    } catch (error: any) {
      logger.error('Scheduled email campaign failed', {
        campaignId,
        error: error.message,
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

// Helper to schedule a campaign
export async function scheduleCampaign(
  data: ScheduledCampaignData,
  scheduledAt: Date,
): Promise<string> {
  const delay = scheduledAt.getTime() - Date.now();

  if (delay <= 0) {
    throw new Error('Scheduled time must be in the future');
  }

  const job = await emailCampaignQueue.add(
    `campaign-${data.campaignId}`,
    data,
    {
      delay,
      jobId: `campaign-${data.campaignId}`,
    },
  );

  logger.info('Email campaign scheduled', {
    campaignId: data.campaignId,
    scheduledAt: scheduledAt.toISOString(),
    delayMs: delay,
    jobId: job.id,
  });

  return job.id!;
}

// Helper to cancel a scheduled campaign
export async function cancelScheduledCampaign(campaignId: string): Promise<boolean> {
  const jobId = `campaign-${campaignId}`;

  try {
    const job = await emailCampaignQueue.getJob(jobId);

    if (!job) {
      return false;
    }

    const state = await job.getState();

    if (state === 'delayed' || state === 'waiting') {
      await job.remove();
      logger.info('Scheduled campaign cancelled', { campaignId, jobId });
      return true;
    }

    // Already processing or completed
    return false;
  } catch (error: any) {
    logger.error('Failed to cancel scheduled campaign', { campaignId, error: error.message });
    return false;
  }
}

// Get scheduled campaign status
export async function getScheduledCampaignStatus(campaignId: string) {
  const jobId = `campaign-${campaignId}`;
  const job = await emailCampaignQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();

  return {
    campaignId,
    jobId: job.id,
    state,
    data: job.data,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    delay: job.opts.delay,
  };
}
