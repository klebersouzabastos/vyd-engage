import express from 'express';
import { createServer } from 'http';
import { pathToFileURL } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';
import { logger, baseLogger } from './utils/logger.js';
import { apiLimiter, authLimiter, passwordResetLimiter } from './middleware/rateLimit.js';
import { csrfProtection } from './middleware/csrf.js';
import { initSentry } from './utils/sentry.js';
import { requestLogger } from './middleware/requestLogger.js';
import { initSocketIO } from './services/socketService.js';

// Load environment variables
dotenv.config();

// Initialize Sentry (if configured)
initSentry();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// CORS origins — single source of truth, fail-closed in production
function getAllowedOrigins(): string[] | false {
  if (process.env.NODE_ENV !== 'production') {
    return [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
    ];
  }
  // Production: explicit allow-list required; reject all if not configured
  const fromEnv = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean);
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (process.env.FRONTEND_URL) return [process.env.FRONTEND_URL];
  return false; // fail-closed: no origins configured = reject all
}

const corsOrigins = getAllowedOrigins();

// Initialize Socket.IO
initSocketIO(httpServer, corsOrigins);

// Middleware
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
}));
app.use(cookieParser());
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP access logging (pino-http) — structured JSON in prod, with secret redaction.
// Single source of access logs; requestLogger only feeds Sentry breadcrumbs now.
app.use(pinoHttp({
  logger: baseLogger,
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
}));

// Sentry breadcrumbs for each request
app.use(requestLogger);

// Initialize billing jobs (only in production or when explicitly enabled)
if (process.env.ENABLE_BILLING_JOBS === 'true') {
  import('./jobs/billing.js').then(({ initializeBillingJobs }) => {
    initializeBillingJobs().catch((error) => {
      logger.error('Failed to initialize billing jobs', error);
    });
  });
}

// Initialize automation engine (only in production or when explicitly enabled)
if (process.env.ENABLE_AUTOMATION_ENGINE === 'true') {
  import('./jobs/automationEngine.js').then(({ initializeAutomationEngine }) => {
    initializeAutomationEngine().catch((error) => {
      logger.error('Failed to initialize automation engine', error);
    });
  });

  // AI deal-score weekly recalc — same gate (requires BullMQ + Redis)
  import('./jobs/scoreDeals.js').then(({ initializeScoreDealsJob }) => {
    initializeScoreDealsJob().catch((error) => {
      logger.error('Failed to initialize scoreDeals job', error);
    });
  });
}

// Initialize task notification checker (always active — lightweight, no Redis needed)
import('./jobs/taskNotificationChecker.js').then(({ initializeTaskNotificationChecker }) => {
  initializeTaskNotificationChecker();
}).catch((error) => {
  logger.error('Failed to initialize task notification checker', error);
});

import('./jobs/staleDeals.js').then(({ initializeStaleDealsChecker }) => {
  initializeStaleDealsChecker();
}).catch((error) => {
  logger.error('Failed to initialize stale deals checker', error);
});

// Initialize backup job (opt-in — requires ENABLE_BACKUP_JOB=true)
if (process.env.ENABLE_BACKUP_JOB === 'true') {
  import('./jobs/backup.js').then(({ initializeBackupJob }) => {
    initializeBackupJob().catch((error) => {
      logger.error('Failed to initialize backup job', error);
    });
  });
}

// Initialize scheduled reports (opt-in — requires ENABLE_SCHEDULED_REPORTS=true)
if (process.env.ENABLE_SCHEDULED_REPORTS === 'true') {
  import('./jobs/scheduledReports.js').then(({ initializeScheduledReports }) => {
    initializeScheduledReports();
  }).catch((error) => {
    logger.error('Failed to initialize scheduled reports job', error);
  });
}

// Health check
import { getHealthStatus } from './utils/healthCheck.js';

app.get('/health', async (req, res) => {
  try {
    const health = await getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// API Routes
import authRoutes from './routes/auth.js';
import leadRoutes from './routes/leads.js';
import taskRoutes from './routes/tasks.js';
import tagRoutes from './routes/tags.js';
import subscriptionRoutes from './routes/subscriptions.js';
import paymentRoutes from './routes/payments.js';
import webhookRoutes from './routes/webhooks.js';
import userRoutes from './routes/users.js';
import apiKeyRoutes from './routes/apiKeys.js';
import automationRoutes from './routes/automations.js';
import automationLogRoutes from './routes/automationLogs.js';
import whatsappRoutes from './routes/whatsapp.js';
import emailRoutes from './routes/email.js';
import customFieldRoutes from './routes/customFields.js';
import interactionRoutes from './routes/interactions.js';
import notificationRoutes from './routes/notifications.js';
import invitationRoutes from './routes/invitations.js';
import funnelRoutes from './routes/funnels.js';
import scoringRoutes from './routes/scoring.js';
import reportRoutes from './routes/reports.js';
import dealRoutes from './routes/deals.js';
import companyRoutes from './routes/companies.js';
import trackingRoutes from './routes/tracking.js';
import adminRoutes from './routes/admin.js';
import outgoingWebhookRoutes from './routes/outgoingWebhooks.js';
import exportRoutes from './routes/exports.js';
import calendarRoutes from './routes/calendar.js';
import aiRoutes from './routes/ai.js';
import savedViewRoutes from './routes/savedViews.js';
import emailTemplateRoutes from './routes/emailTemplates.js';
import scheduleRoutes from './routes/schedule.js';
import productRoutes from './routes/products.js';
import goalRoutes from './routes/goals.js';
import stageTaskTemplateRoutes from './routes/stageTaskTemplates.js';
import importRoutes from './routes/import.js';
// scaffolding anchor — do not remove (plop injects route imports below)
// plop:import-route

import { Router as ExpressRouter } from 'express';
import prisma from './config/database.js';
import { z as zodLib } from 'zod';
import { NotificationType } from '@prisma/client';
import { notificationService } from './services/notificationService.js';
import { notifyLeadCaptured } from './services/slackService.js';
import { dispatchTrigger } from './jobs/automationEngine.js';

// ============================================
// Versioned API Router (v1)
// ============================================
const API_VERSION = '1';
const v1Router = ExpressRouter();

// Set API version header on all v1 responses
v1Router.use((_req, res, next) => {
  res.setHeader('X-API-Version', API_VERSION);
  next();
});

// Rate limiting — applied unconditionally; limiters self-disable in dev (max: 0)
v1Router.use('/auth/password', passwordResetLimiter);
v1Router.use('/auth', (req, res, next) => {
  if (req.path.startsWith('/password')) return next();
  return authLimiter(req, res, next);
});
v1Router.use('/webhooks', apiLimiter);
v1Router.use('/', apiLimiter);

// CSRF protection — applied to all API routes except webhooks (which use HMAC signatures)
// Auth login/register/refresh are excluded since they don't have a CSRF cookie yet
v1Router.use('/leads', csrfProtection);
v1Router.use('/tasks', csrfProtection);
v1Router.use('/tags', csrfProtection);
v1Router.use('/subscriptions', csrfProtection);
v1Router.use('/payments', csrfProtection);
v1Router.use('/users', csrfProtection);
v1Router.use('/api-keys', csrfProtection);
v1Router.use('/automations', csrfProtection);
v1Router.use('/automation-logs', csrfProtection);
v1Router.use('/whatsapp', csrfProtection);
v1Router.use('/email', csrfProtection);
v1Router.use('/custom-fields', csrfProtection);
v1Router.use('/interactions', csrfProtection);
v1Router.use('/notifications', csrfProtection);
v1Router.use('/outgoing-webhooks', csrfProtection);
v1Router.use('/invitations', (req, res, next) => {
  // POST /invitations/accept is a public endpoint (no session yet) — skip CSRF
  if (req.method === 'POST' && req.path === '/accept') return next();
  csrfProtection(req, res, next);
});
v1Router.use('/funnels', csrfProtection);
v1Router.use('/scoring-rules', csrfProtection);
v1Router.use('/deals', csrfProtection);
v1Router.use('/companies', csrfProtection);
v1Router.use('/reports', csrfProtection);
v1Router.use('/integrations', csrfProtection);
v1Router.use('/auth/profile', csrfProtection);
v1Router.use('/auth/change-password', csrfProtection);
v1Router.use('/auth/tenant', csrfProtection);
v1Router.use('/ai', csrfProtection);
v1Router.use('/saved-views', csrfProtection);
v1Router.use('/email-templates', csrfProtection);
v1Router.use('/schedule', csrfProtection);
v1Router.use('/admin', csrfProtection);
v1Router.use('/products', csrfProtection);
v1Router.use('/goals', csrfProtection);
v1Router.use('/stage-task-templates', csrfProtection);
v1Router.use('/import', csrfProtection);
// scaffolding anchor — do not remove
// plop:csrf

// Tracking routes (public, no auth, no CSRF)
v1Router.use('/track', trackingRoutes);

// API Routes
v1Router.use('/auth', authRoutes);
v1Router.use('/leads', leadRoutes);
v1Router.use('/tasks', taskRoutes);
v1Router.use('/tags', tagRoutes);
v1Router.use('/subscriptions', subscriptionRoutes);
v1Router.use('/payments', paymentRoutes);
v1Router.use('/users', userRoutes);
v1Router.use('/api-keys', apiKeyRoutes);
v1Router.use('/automations', automationRoutes);
v1Router.use('/automation-logs', automationLogRoutes);
v1Router.use('/whatsapp', whatsappRoutes);
v1Router.use('/email', emailRoutes);
v1Router.use('/custom-fields', customFieldRoutes);
v1Router.use('/interactions', interactionRoutes);
v1Router.use('/notifications', notificationRoutes);
v1Router.use('/invitations', invitationRoutes);
v1Router.use('/funnels', funnelRoutes);
v1Router.use('/scoring-rules', scoringRoutes);
v1Router.use('/reports', reportRoutes);
v1Router.use('/deals', dealRoutes);
v1Router.use('/companies', companyRoutes);
v1Router.use('/webhooks', webhookRoutes);
v1Router.use('/outgoing-webhooks', outgoingWebhookRoutes);
v1Router.use('/exports', exportRoutes);
v1Router.use('/integrations', calendarRoutes);
v1Router.use('/ai', aiRoutes);
v1Router.use('/saved-views', savedViewRoutes);
v1Router.use('/email-templates', emailTemplateRoutes);
v1Router.use('/schedule', scheduleRoutes);
v1Router.use('/admin', adminRoutes);
v1Router.use('/products', productRoutes);
v1Router.use('/goals', goalRoutes);
v1Router.use('/stage-task-templates', stageTaskTemplateRoutes);
v1Router.use('/import', importRoutes);
// scaffolding anchor — do not remove
// plop:mount

// Mount v1 router at /api/v1 (canonical) and /api (backwards-compatible alias)
app.use('/api/v1', v1Router);
app.use('/api', v1Router);

// Public routes (no auth required)

const publicRouter = ExpressRouter();

const captureLeadSchema = zodLib.object({
  name: zodLib.string().min(1),
  email: zodLib.string().email().optional(),
  phone: zodLib.string().optional(),
  company: zodLib.string().optional(),
  message: zodLib.string().optional(),
  source: zodLib.string().optional(),
  customFields: zodLib.record(zodLib.any()).optional(),
});

publicRouter.post('/capture/:tenantSlug', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.tenantSlug },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const data = captureLeadSchema.parse(req.body);

    const sourceMap: Record<string, string> = {
      website: 'WEBSITE', social_media: 'SOCIAL_MEDIA', referral: 'REFERRAL',
      email: 'EMAIL', phone: 'PHONE', other: 'OTHER',
    };
    const leadSource = sourceMap[String(data.source || '').toLowerCase()] || 'WEBSITE';

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        source: leadSource as any,
        status: 'NEW',
        customFields: data.customFields || {},
        tenantId: tenant.id,
      },
    });

    // Create initial interaction if message provided
    if (data.message) {
      await prisma.interaction.create({
        data: {
          leadId: lead.id,
          tenantId: tenant.id,
          type: 'NOTE',
          direction: 'INBOUND',
          content: `Lead criado via formulário público: ${data.message}`,
        },
      });
    }

    // Notify tenant admins about new public lead capture
    notificationService.notifyTenantAdmins(tenant.id, {
      type: NotificationType.LEAD_ASSIGNED,
      title: 'Novo lead via formulário',
      message: `${data.name}${data.email ? ` (${data.email})` : ''} preencheu o formulário público.`,
      link: `/app/leads/${lead.id}`,
      metadata: { leadId: lead.id, leadName: data.name, source: 'public_form' },
    }).catch(() => {});

    // Dispatch automation triggers (form_submitted + lead_created) — this route
    // bypasses leadService.create, so we fire both here.
    dispatchTrigger(tenant.id, 'form_submitted', lead.id, {
      source: leadSource,
      formSlug: req.params.tenantSlug,
    }).catch(() => {});
    dispatchTrigger(tenant.id, 'lead_created', lead.id, {
      source: leadSource,
      status: 'NEW',
    }).catch(() => {});

    notifyLeadCaptured(tenant.id, { name: data.name, email: data.email, company: data.company }).catch(() => {});

    res.status(201).json({ status: 201, message: 'Lead captured successfully', leadId: lead.id });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// GET /api/public/plans - Public pricing plans (no auth required)
publicRouter.get('/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
      select: {
        id: true,
        type: true,
        name: true,
        price: true,
        description: true,
        features: true,
        highlighted: true,
      },
    });
    res.json(plans);
  } catch (error) {
    next(error);
  }
});

// GET /api/public/schedule/:slug — public booking page data
publicRouter.get('/schedule/:slug', async (req, res, next) => {
  try {
    const avail = await prisma.meetingAvailability.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, slug: true, title: true, duration: true, bufferMinutes: true, availableHours: true },
    });
    if (!avail) return res.status(404).json({ error: 'Link not found' });
    res.json({ status: 200, data: avail });
  } catch (error) {
    next(error);
  }
});

// POST /api/public/schedule/:slug/book — book a meeting slot (creates a lead interaction)
publicRouter.post('/schedule/:slug/book', async (req, res, next) => {
  try {
    const avail = await prisma.meetingAvailability.findUnique({
      where: { slug: req.params.slug },
      include: { user: { select: { id: true, tenantId: true, name: true } } },
    });
    if (!avail) return res.status(404).json({ error: 'Link not found' });

    const schema = zodLib.object({
      name: zodLib.string().min(1),
      email: zodLib.string().email(),
      dateTime: zodLib.string(), // ISO 8601
      message: zodLib.string().optional(),
    });
    const data = schema.parse(req.body);

    // Create a lead for this booking if it doesn't exist
    let lead = await prisma.lead.findFirst({
      where: { email: data.email, tenantId: avail.user.tenantId },
    });
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          name: data.name,
          email: data.email,
          source: 'OTHER',
          status: 'NEW',
          tenantId: avail.user.tenantId,
        },
      });
    }

    // Create an interaction recording the meeting
    await prisma.interaction.create({
      data: {
        leadId: lead.id,
        tenantId: avail.user.tenantId,
        userId: avail.userId,
        type: 'MEETING',
        direction: 'OUTBOUND',
        content: `Reunião agendada via link público: ${data.dateTime}${data.message ? `\nMensagem: ${data.message}` : ''}`,
      },
    });

    res.status(201).json({ status: 201, message: 'Meeting booked successfully' });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

app.use('/api/v1/public', publicRouter);
app.use('/api/public', publicRouter); // backwards-compatible alias

// OpenAPI spec for the public/developer API (public, no auth/CSRF)
import { buildOpenApiDocument } from './openapi/registry.js';
const openApiDocument = buildOpenApiDocument();
app.get(['/api/v1/openapi.json', '/api/openapi.json'], (_req, res) => {
  res.json(openApiDocument);
});

// Bull Board queue dashboard (Basic-Auth gated; mounted before the 404 handler)
import { mountQueueDashboard } from './admin/queueDashboard.js';
await mountQueueDashboard(app);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server (use httpServer for Socket.IO support) — skipped when imported
// (e.g. by supertest), so tests can mount the app without binding a port.
const isMainModule = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;
export { app, httpServer };

