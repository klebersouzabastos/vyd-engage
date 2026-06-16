import { PostHog } from 'posthog-node';
import { logger } from './logger.js';

let client: PostHog | null = null;
let initialized = false;

/** Lazily creates the PostHog client. Returns null (no-op) unless POSTHOG_KEY is set. */
function getClient(): PostHog | null {
  if (initialized) return client;
  initialized = true;
  const key = process.env.POSTHOG_KEY;
  if (!key) return null;
  client = new PostHog(key, {
    host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    flushAt: 20,
    flushInterval: 10_000,
  });
  return client;
}

interface CaptureArgs {
  distinctId: string;
  event: string;
  /** Tenant id — set as the PostHog group so analytics stay isolated per tenant. */
  tenantId?: string;
  properties?: Record<string, unknown>;
}

/**
 * Captures a product-analytics event. No-op unless POSTHOG_KEY is configured.
 * Always attaches the tenant group (when available) to prevent cross-tenant mixing.
 */
export function captureEvent({ distinctId, event, tenantId, properties }: CaptureArgs): void {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.capture({
      distinctId,
      event,
      properties,
      groups: tenantId ? { tenant: tenantId } : undefined,
    });
  } catch (err) {
    logger.warn('PostHog capture failed', err);
  }
}

/** Flushes pending events; call on graceful shutdown. No-op if not configured. */
export async function shutdownAnalytics(): Promise<void> {
  if (!client) return;
  try {
    await client.shutdown();
  } catch {
    /* ignore */
  }
}
