import { Queue, Worker, Job } from 'bullmq';
import { logger } from '../utils/logger.js';
import prisma from '../config/database.js';
import { paymentService } from '../services/paymentService.js';
import { subscriptionService } from '../services/subscriptionService.js';

// Redis connection configuration
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

// Create billing queue
export const billingQueue = new Queue('billing', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Worker to process billing jobs
export const billingWorker = new Worker(
  'billing',
  async (job: Job) => {
    const { subscriptionId } = job.data;
    
    logger.info('Processing billing job', { subscriptionId, jobId: job.id });

    try {
      // Get subscription
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          plan: true,
          tenant: true,
        },
      });

      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      // Check if subscription is active
      if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL') {
        logger.info('Subscription not active, skipping billing', { 
          subscriptionId, 
          status: subscription.status 
        });
        return;
      }

      // Check if renewal date has passed
      if (subscription.renewalDate && subscription.renewalDate > new Date()) {
        logger.info('Renewal date not reached yet', { subscriptionId });
        return;
      }

      // Calculate amount based on plan and billing cycle
      const amount = subscription.billingCycle === 'yearly'
        ? subscription.plan.yearlyPrice
        : subscription.plan.monthlyPrice;

      // Get first admin user from tenant
      const adminUser = await prisma.user.findFirst({
        where: {
          tenantId: subscription.tenantId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      if (!adminUser) {
        logger.warn('No admin user found for subscription', { subscriptionId });
        return;
      }

      // Get plan type
      const planType = subscription.plan.type;

      // Create payment intent
      const paymentIntent = await paymentService.createPaymentIntent(
        subscription.tenantId,
        adminUser.id,
        {
          planId: subscription.planId,
          planType: planType,
          amount,
          method: 'credit_card', // Default method
          billingCycle: subscription.billingCycle,
        }
      );

      logger.info('Payment intent created for subscription', {
        subscriptionId,
        paymentIntentId: paymentIntent.payment.id,
      });

      // Note: The actual subscription renewal will happen when payment is approved via webhook
      // This job just creates the payment intent. The webhook handler will:
      // 1. Update subscription status to ACTIVE
      // 2. Set new renewal date
      // 3. Schedule next billing job

      logger.info('Billing job completed successfully', { subscriptionId });
    } catch (error: any) {
      logger.error('Error processing billing job', error, { subscriptionId });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

// Schedule a billing job for a subscription
export async function scheduleBillingJob(
  subscriptionId: string,
  renewalDate: Date
): Promise<void> {
  const delay = renewalDate.getTime() - Date.now();
  
  if (delay <= 0) {
    // If renewal date has passed, process immediately
    await billingQueue.add('process-billing', { subscriptionId });
  } else {
    // Schedule for renewal date
    await billingQueue.add(
      'process-billing',
      { subscriptionId },
      {
        delay,
      }
    );
  }

  logger.info('Billing job scheduled', { subscriptionId, renewalDate });
}

// Initialize billing jobs for all active subscriptions
export async function initializeBillingJobs(): Promise<void> {
  try {
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'TRIAL'],
        },
        renewalDate: {
          not: null,
        },
      },
    });

    logger.info('Initializing billing jobs', { count: activeSubscriptions.length });

    for (const subscription of activeSubscriptions) {
      if (subscription.renewalDate) {
        await scheduleBillingJob(subscription.id, subscription.renewalDate);
      }
    }

    logger.info('Billing jobs initialized successfully');
  } catch (error: any) {
    logger.error('Error initializing billing jobs', error);
  }
}

// Process overdue subscriptions
export async function processOverdueSubscriptions(): Promise<void> {
  try {
    const overdueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'PAST_DUE',
        renewalDate: {
          lte: new Date(),
        },
      },
      include: {
        plan: true,
        tenant: true,
      },
    });

    logger.info('Processing overdue subscriptions', { count: overdueSubscriptions.length });

    for (const subscription of overdueSubscriptions) {
      // Try to charge again
      await billingQueue.add('process-billing', { subscriptionId: subscription.id });
    }
  } catch (error: any) {
    logger.error('Error processing overdue subscriptions', error);
  }
}

// Start worker event listeners
billingWorker.on('completed', (job) => {
  logger.info('Billing job completed', { jobId: job.id });
});

billingWorker.on('failed', (job, err) => {
  logger.error('Billing job failed', err, { jobId: job?.id });
});

