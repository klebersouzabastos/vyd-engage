import * as Sentry from '@sentry/node';
import { logger } from './logger.js';

let sentryInitialized = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: undefined }),
        new Sentry.Integrations.Prisma({ client: undefined }),
      ],
    });

    sentryInitialized = true;
    logger.info('Sentry initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Sentry', error);
  }
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (!sentryInitialized) {
    logger.error('Exception (Sentry not initialized):', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) {
  if (!sentryInitialized) {
    logger.info(`Message (Sentry not initialized): ${message}`, context);
    return;
  }

  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

export function setUser(user: { id: string; email: string; tenantId?: string }) {
  if (sentryInitialized) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    });
  }
}

export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  if (sentryInitialized) {
    Sentry.addBreadcrumb(breadcrumb);
  }
}







