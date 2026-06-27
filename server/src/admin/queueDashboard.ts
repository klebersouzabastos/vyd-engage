import type { Express, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Constant-time string comparison to avoid leaking credential length/content via timing.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * HTTP Basic Auth gate. The Bull Board UI is a browser-accessed SPA, so the
 * app's header-based JWT auth doesn't fit — Basic Auth with dedicated env
 * credentials is the correct guard for this ops dashboard.
 */
function basicAuth(expectedUser: string, expectedPass: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      const user = decoded.slice(0, idx);
      const pass = decoded.slice(idx + 1);
      if (safeEqual(user, expectedUser) && safeEqual(pass, expectedPass)) {
        return next();
      }
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Queue Dashboard"');
    return res.status(401).send('Authentication required');
  };
}

/**
 * Mounts the Bull Board queue dashboard at /admin/queues, gated by Basic Auth.
 *
 * Fail-closed: only mounts when QUEUE_DASHBOARD_USER/PASS are set. The dashboard
 * exposes lead/billing job payloads (PII), so it must never be public. Queues are
 * imported dynamically so this never opens Redis connections beyond what the app
 * already does (emailCampaign is always live; automation/billing only when their
 * feature flags are enabled).
 */
export async function mountQueueDashboard(app: Express): Promise<void> {
  const user = process.env.QUEUE_DASHBOARD_USER;
  const pass = process.env.QUEUE_DASHBOARD_PASS;
  if (!user || !pass) {
    logger.warn(
      'Queue dashboard disabled: set QUEUE_DASHBOARD_USER and QUEUE_DASHBOARD_PASS to enable'
    );
    return;
  }

  try {
    const { createBullBoard } = await import('@bull-board/api');
    const { BullMQAdapter } = await import('@bull-board/api/bullMQAdapter');
    const { ExpressAdapter } = await import('@bull-board/express');

    const adapters: InstanceType<typeof BullMQAdapter>[] = [];

    // Email campaign queue is always instantiated (routes/email.ts imports it).
    try {
      const { emailCampaignQueue } = await import('../jobs/emailCampaign.js');
      adapters.push(new BullMQAdapter(emailCampaignQueue));
    } catch {
      logger.warn('Queue dashboard: email campaign queue unavailable');
    }

    if (process.env.ENABLE_AUTOMATION_ENGINE === 'true') {
      const { automationQueue, automationDLQ } = await import('../jobs/automationEngine.js');
      adapters.push(new BullMQAdapter(automationQueue), new BullMQAdapter(automationDLQ));

      // Campaign sender shares the automation-engine gate (Redis required).
      try {
        const { getCampaignSenderQueue } = await import('../jobs/campaignSender.js');
        adapters.push(new BullMQAdapter(getCampaignSenderQueue()));
      } catch {
        logger.warn('Queue dashboard: campaign sender queue unavailable');
      }
    }

    if (process.env.ENABLE_BILLING_JOBS === 'true') {
      const { billingQueue } = await import('../jobs/billing.js');
      adapters.push(new BullMQAdapter(billingQueue));
    }

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    createBullBoard({ queues: adapters, serverAdapter });

    app.use('/admin/queues', basicAuth(user, pass), serverAdapter.getRouter());
    logger.info(`Queue dashboard mounted at /admin/queues (${adapters.length} queues)`);
  } catch (error) {
    logger.error('Failed to mount queue dashboard', error);
  }
}
