import { Router } from 'express';
import { z } from 'zod';
import { emailConfigService } from '../services/emailConfigService.js';
import { emailMessagingService } from '../services/emailMessagingService.js';
import {
  scheduleCampaign,
  cancelScheduledCampaign,
  getScheduledCampaignStatus,
} from '../jobs/emailCampaign.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { EmailProvider } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createEmailConfigSchema = z.object({
  name: z.string().min(1),
  provider: z.nativeEnum(EmailProvider),
  fromEmail: z.string().email(),
  fromName: z.string().optional(),
  config: z.any(),
});

const updateEmailConfigSchema = createEmailConfigSchema.extend({
  id: z.string().uuid(),
  verified: z.boolean().optional(),
});

router.get('/configs', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const configs = await emailConfigService.findAll(req.user.tenantId);
    res.json(configs);
  } catch (error) {
    next(error);
  }
});

router.get('/configs/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const config = await emailConfigService.findById(req.user.tenantId, req.params.id);
    res.json(config);
  } catch (error) {
    next(error);
  }
});

router.post('/configs', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = createEmailConfigSchema.parse(req.body);
    const config = await emailConfigService.create(req.user.tenantId, data);
    res.status(201).json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.put('/configs/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = updateEmailConfigSchema.parse({
      ...req.body,
      id: req.params.id,
    });
    const config = await emailConfigService.update(req.user.tenantId, data);
    res.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/configs/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await emailConfigService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/configs/:id/verify', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const config = await emailConfigService.verify(req.user.tenantId, req.params.id);
    res.json(config);
  } catch (error) {
    next(error);
  }
});

// ========================
// Messaging
// ========================

const sendEmailSchema = z.object({
  configId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
  leadId: z.string().uuid().optional(),
});

const bulkSendSchema = z.object({
  configId: z.string().uuid(),
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        leadId: z.string().uuid().optional(),
        variables: z.record(z.string()).optional(),
      })
    )
    .min(1)
    .max(500),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
});

// POST /api/email/send - Send a single email
router.post('/send', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const data = sendEmailSchema.parse(req.body);
    const result = await emailMessagingService.sendEmail(req.user.tenantId, data);
    res.json({ status: 200, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// POST /api/email/send-bulk - Send bulk emails
router.post('/send-bulk', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const data = bulkSendSchema.parse(req.body);
    const result = await emailMessagingService.sendBulk(req.user.tenantId, data);
    res.json({ status: 200, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// POST /api/email/configs/:id/test - Send test email
router.post('/configs/:id/test', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const { toEmail } = req.body;
    if (!toEmail) return next(createError('toEmail is required', 400));

    const result = await emailMessagingService.sendTestEmail(
      req.user.tenantId,
      req.params.id,
      toEmail
    );
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// ========================
// Campaign Scheduling
// ========================

const scheduleCampaignSchema = z.object({
  configId: z.string().uuid(),
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        leadId: z.string().uuid().optional(),
        variables: z.record(z.string()).optional(),
      })
    )
    .min(1)
    .max(500),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
  scheduledAt: z.string().datetime(),
});

// POST /api/email/schedule - Schedule a campaign for later
router.post('/schedule', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const data = scheduleCampaignSchema.parse(req.body);
    const scheduledAt = new Date(data.scheduledAt);

    if (scheduledAt.getTime() <= Date.now()) {
      return next(createError('Scheduled time must be in the future', 400, 'INVALID_SCHEDULE'));
    }

    const campaignId = `${req.user.tenantId}-${Date.now()}`;

    await scheduleCampaign(
      {
        tenantId: req.user.tenantId,
        configId: data.configId,
        recipients: data.recipients,
        subject: data.subject,
        html: data.html,
        text: data.text,
        campaignId,
      },
      scheduledAt
    );

    res.json({
      status: 200,
      data: {
        campaignId,
        scheduledAt: scheduledAt.toISOString(),
        recipientCount: data.recipients.length,
        status: 'scheduled',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/email/schedule/:campaignId - Cancel a scheduled campaign
router.delete('/schedule/:campaignId', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const { campaignId } = req.params;

    // Verify the campaign belongs to this tenant
    if (!campaignId.startsWith(req.user.tenantId)) {
      return next(createError('Campaign not found', 404));
    }

    const cancelled = await cancelScheduledCampaign(campaignId);

    if (!cancelled) {
      return next(createError('Campaign not found or already sent', 404, 'CAMPAIGN_NOT_FOUND'));
    }

    res.json({ status: 200, data: { campaignId, status: 'cancelled' } });
  } catch (error) {
    next(error);
  }
});

// GET /api/email/schedule/:campaignId - Get campaign status
router.get('/schedule/:campaignId', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const { campaignId } = req.params;

    if (!campaignId.startsWith(req.user.tenantId)) {
      return next(createError('Campaign not found', 404));
    }

    const status = await getScheduledCampaignStatus(campaignId);

    if (!status) {
      return next(createError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND'));
    }

    res.json({ status: 200, data: status });
  } catch (error) {
    next(error);
  }
});

export default router;
