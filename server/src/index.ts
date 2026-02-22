import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { apiLimiter, authLimiter, passwordResetLimiter } from './middleware/rateLimit.js';
import { csrfProtection } from './middleware/csrf.js';
import { initSentry } from './utils/sentry.js';
import { requestLogger } from './middleware/requestLogger.js';

// Load environment variables
dotenv.config();

// Initialize Sentry (if configured)
initSentry();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS?.split(',') || [process.env.FRONTEND_URL || 'http://localhost:5173'])
    : [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:3000'],
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

// Request logging
app.use(requestLogger);

// HTTP logging (morgan)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

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
import whatsappRoutes from './routes/whatsapp.js';
import emailRoutes from './routes/email.js';
import customFieldRoutes from './routes/customFields.js';
import interactionRoutes from './routes/interactions.js';
import notificationRoutes from './routes/notifications.js';
import invitationRoutes from './routes/invitations.js';
import funnelRoutes from './routes/funnels.js';
import scoringRoutes from './routes/scoring.js';
import reportRoutes from './routes/reports.js';

// Rate limiting — applied BEFORE routes to actually protect them
app.use('/api/auth/password', passwordResetLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/webhooks', apiLimiter); // Webhooks get rate limited too
app.use('/api', apiLimiter);

// CSRF protection — applied to all API routes except webhooks (which use HMAC signatures)
// Auth login/register/refresh are excluded since they don't have a CSRF cookie yet
app.use('/api/leads', csrfProtection);
app.use('/api/tasks', csrfProtection);
app.use('/api/tags', csrfProtection);
app.use('/api/subscriptions', csrfProtection);
app.use('/api/payments', csrfProtection);
app.use('/api/users', csrfProtection);
app.use('/api/api-keys', csrfProtection);
app.use('/api/automations', csrfProtection);
app.use('/api/whatsapp', csrfProtection);
app.use('/api/email', csrfProtection);
app.use('/api/custom-fields', csrfProtection);
app.use('/api/interactions', csrfProtection);
app.use('/api/notifications', csrfProtection);
app.use('/api/invitations', csrfProtection);
app.use('/api/funnels', csrfProtection);
app.use('/api/scoring-rules', csrfProtection);
app.use('/api/reports', csrfProtection);
app.use('/api/auth/profile', csrfProtection);
app.use('/api/auth/change-password', csrfProtection);
app.use('/api/auth/tenant', csrfProtection);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/custom-fields', customFieldRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/funnels', funnelRoutes);
app.use('/api/scoring-rules', scoringRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/webhooks', webhookRoutes);

// Public routes (no auth required)
import { Router as ExpressRouter } from 'express';
import prisma from './config/database.js';
import { z as zodLib } from 'zod';

const publicRouter = ExpressRouter();

const captureLeadSchema = zodLib.object({
  name: zodLib.string().min(1),
  email: zodLib.string().email().optional(),
  phone: zodLib.string().optional(),
  message: zodLib.string().optional(),
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

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        source: 'FORM',
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

    res.status(201).json({ status: 201, message: 'Lead captured successfully', leadId: lead.id });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

app.use('/api/public', publicRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;

