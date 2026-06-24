import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';
import {
  previewAudience,
  buildAudienceLeadIds,
  getCampaignStats,
  type AudienceFilters,
} from '../services/campaignService.js';
import { emailMessagingService } from '../services/emailMessagingService.js';
import { blocksToHtml, applyMergeTags, type MergeTagContext } from '../services/campaignService.js';
import { enqueueCampaignSend, cancelCampaignSend } from '../jobs/campaignSender.js';
import crypto from 'crypto';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const blockSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('text'), content: z.string() }),
  z.object({ id: z.string(), type: z.literal('image'), url: z.string(), alt: z.string().optional() }),
  z.object({ id: z.string(), type: z.literal('button'), label: z.string(), href: z.string() }),
  z.object({ id: z.string(), type: z.literal('divider') }),
  z.object({ id: z.string(), type: z.literal('spacer'), height: z.number().optional() }),
]);

const audienceFiltersSchema = z
  .object({
    status: z.string().optional(),
    tagId: z.string().optional(),
    assignedTo: z.string().optional(),
    source: z.string().optional(),
    minScore: z.number().optional(),
    maxScore: z.number().optional(),
    lastInteractionBefore: z.string().optional(),
    lastInteractionAfter: z.string().optional(),
    noInteractionDays: z.number().optional(),
  })
  .strip();

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
  configId: z.string().optional(),
  subject: z.string().optional(),
  blocks: z.array(blockSchema).optional(),
  audienceFilters: audienceFiltersSchema.optional(),
});

const updateCampaignSchema = createCampaignSchema.partial();

const scheduleSchema = z.object({
  // "Enviar agora" omits sendAt (or sends null); "Agendar para" provides an ISO date.
  sendAt: z.string().datetime().nullish(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Verify Redis is reachable before enqueueing (req: Redis unavailable -> 503).
 * The sender also requires ENABLE_AUTOMATION_ENGINE; if it's off the worker
 * isn't running, so we treat that as service unavailable too.
 */
async function assertQueueAvailable(): Promise<void> {
  if (process.env.ENABLE_AUTOMATION_ENGINE !== 'true') {
    throw createError(
      'Envio de campanhas indisponível: motor de jobs desabilitado',
      503,
      'CAMPAIGN_QUEUE_UNAVAILABLE'
    );
  }
  try {
    const { getCampaignSenderQueue } = await import('../jobs/campaignSender.js');
    const client = await getCampaignSenderQueue().client;
    // ping with a short timeout so a dead Redis doesn't hang the request
    await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('redis ping timeout')), 2000)),
    ]);
  } catch (err: any) {
    logger.warn('Campaign queue unavailable', { error: err?.message });
    throw createError(
      'Envio de campanhas indisponível: serviço de filas (Redis) inacessível',
      503,
      'CAMPAIGN_QUEUE_UNAVAILABLE'
    );
  }
}

// ─── GET / — List campaigns (with basic metrics) ─────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { tenantId } = req.user;

    const campaigns = await prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { recipients: true } },
      },
    });

    // Basic metrics per campaign: sent + unique opens/clicks (lightweight aggregate).
    const data = await Promise.all(
      campaigns.map(async (c) => {
        const sent = await prisma.campaignRecipient.count({
          where: { campaignId: c.id, tenantId, sentAt: { not: null } },
        });
        const openedRows = await prisma.campaignEvent.findMany({
          where: { campaignId: c.id, tenantId, type: 'OPENED' },
          select: { recipientId: true },
          distinct: ['recipientId'],
        });
        const clickedRows = await prisma.campaignEvent.findMany({
          where: { campaignId: c.id, tenantId, type: 'CLICKED' },
          select: { recipientId: true },
          distinct: ['recipientId'],
        });
        const opened = openedRows.length;
        const clicked = clickedRows.length;
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          fromName: c.fromName,
          fromEmail: c.fromEmail,
          configId: c.configId,
          subject: c.subject,
          scheduledAt: c.scheduledAt,
          sentAt: c.sentAt,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          recipientCount: c._count.recipients,
          // Top-level metrics consumed by the list UI (CampaignListItem).
          sentCount: sent,
          openRate: sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0,
          ctr: sent > 0 ? Math.round((clicked / sent) * 1000) / 10 : 0,
        };
      })
    );

    res.json({ status: 200, data });
  } catch (error) {
    next(error);
  }
});

// ─── GET /:id — Get campaign by ID ───────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { tenantId } = req.user;

    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, tenantId },
      include: { _count: { select: { recipients: true } } },
    });
    if (!campaign) return next(createError('Campaign not found', 404));

    res.json({ status: 200, data: campaign });
  } catch (error) {
    next(error);
  }
});

// ─── POST / — Create campaign (DRAFT) ────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { tenantId } = req.user;

    const data = createCampaignSchema.parse(req.body);

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name: data.name,
        fromName: data.fromName ?? null,
        fromEmail: data.fromEmail ?? null,
        configId: data.configId ?? null,
        subject: data.subject ?? '',
        blocks: (data.blocks ?? []) as any,
        audienceFilters: (data.audienceFilters ?? {}) as any,
        status: 'DRAFT',
      },
    });

    res.status(201).json({ status: 201, data: campaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── PUT /:id — Update campaign ──────────────────────────────────────────────

router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { tenantId } = req.user;

    const existing = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return next(createError('Campaign not found', 404));

    // Don't allow editing a campaign that is already sending/sent.
    if (existing.status === 'SENDING' || existing.status === 'SENT') {
      return next(createError('Cannot edit a campaign that is sending or already sent', 409, 'CAMPAIGN_LOCKED'));
    }

    const data = updateCampaignSchema.parse(req.body);

    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.fromName !== undefined ? { fromName: data.fromName } : {}),
        ...(data.fromEmail !== undefined ? { fromEmail: data.fromEmail } : {}),
        ...(data.configId !== undefined ? { configId: data.configId } : {}),
        ...(data.subject !== undefined ? { subject: data.subject } : {}),
        ...(data.blocks !== undefined ? { blocks: data.blocks as any } : {}),
        ...(data.audienceFilters !== undefined ? { audienceFilters: data.audienceFilters as any } : {}),
      },
    });

    res.json({ status: 200, data: campaign });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── DELETE /:id — Delete campaign ───────────────────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { tenantId } = req.user;

    const existing = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return next(createError('Campaign not found', 404));

    // Best-effort cancel any scheduled job, then delete (cascades recipients/events).
    if (existing.status === 'SCHEDULED') {
      cancelCampaignSend(existing.id).catch(() => {});
    }

    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ─── GET /:id/preview-audience — count + 5 sample (req 17) ────────────────────

router.get('/:id/preview-audience', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { tenantId } = req.user;

    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, tenantId },
      select: { audienceFilters: true },
    });
    if (!campaign) return next(createError('Campaign not found', 404));

    const result = await previewAudience(tenantId, (campaign.audienceFilters as AudienceFilters) || {});
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});

// ─── POST /:id/test-email — send test to logged-in user (req 6) ───────────────

router.post('/:id/test-email', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { tenantId, userId } = req.user;

    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId } });
    if (!campaign) return next(createError('Campaign not found', 404));
    if (!campaign.configId) {
      return next(createError('Campaign has no email configuration', 400, 'NO_EMAIL_CONFIG'));
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user?.email) return next(createError('Logged-in user has no email', 400));

    // Render with the user's own data as the merge context for the preview.
    const ctx: MergeTagContext = { name: user.name, email: user.email, company: null };
    const subject = `[Teste] ${applyMergeTags(campaign.subject, ctx)}`;
    const html = blocksToHtml(campaign.blocks, ctx);

    await emailMessagingService.sendEmail(tenantId, {
      configId: campaign.configId,
      to: user.email,
      subject,
      html,
    });

    res.json({ status: 200, data: { sent: true, to: user.email } });
  } catch (error) {
    next(error);
  }
});

// ─── POST /:id/schedule — enqueue send job (req 18) ───────────────────────────

router.post('/:id/schedule', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { tenantId } = req.user;

    const body = scheduleSchema.parse(req.body);

    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId } });
    if (!campaign) return next(createError('Campaign not found', 404));

    // Edge case: already sending -> reject re-send.
    if (campaign.status === 'SENDING') {
      return next(createError('Campaign is already sending', 409, 'CAMPAIGN_ALREADY_SENDING'));
    }
    if (campaign.status === 'SENT') {
      return next(createError('Campaign has already been sent', 409, 'CAMPAIGN_ALREADY_SENT'));
    }

    if (!campaign.configId) {
      return next(createError('Campaign has no email configuration', 400, 'NO_EMAIL_CONFIG'));
    }

    // Edge case: scheduled in the past -> validation error.
    let runAt: Date | null = null;
    if (body.sendAt) {
      runAt = new Date(body.sendAt);
      if (runAt.getTime() <= Date.now()) {
        return next(createError('Scheduled time must be in the future', 400, 'SCHEDULE_IN_PAST'));
      }
    }

    // Resolve audience now and materialize recipients (req 14: exclude unsubscribed).
    const leadIds = await buildAudienceLeadIds(tenantId, (campaign.audienceFilters as AudienceFilters) || {});

    // Edge case: empty audience -> block at API level.
    if (leadIds.length === 0) {
      return next(createError('Audiência vazia: nenhum lead corresponde aos filtros', 400, 'EMPTY_AUDIENCE'));
    }

    // Redis / engine availability (edge case -> 503). Checked before mutating state.
    await assertQueueAvailable();

    // Create recipient rows (idempotent on re-schedule via unique [campaignId, leadId]).
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, tenantId },
      select: { id: true, name: true, email: true },
    });
    await prisma.campaignRecipient.createMany({
      data: leads.map((l) => ({
        campaignId: campaign.id,
        tenantId,
        leadId: l.id,
        email: l.email ?? '',
        name: l.name,
        token: crypto.randomBytes(24).toString('hex'),
      })),
      skipDuplicates: true,
    });

    // Enqueue (delayed if scheduled).
    await enqueueCampaignSend(campaign.id, tenantId, runAt);

    const status = runAt ? 'SCHEDULED' : 'SENDING';
    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status, scheduledAt: runAt },
    });

    res.json({
      status: 200,
      data: { id: updated.id, status: updated.status, scheduledAt: updated.scheduledAt, recipientCount: leadIds.length },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// ─── GET /:id/stats — aggregated metrics (req 34) ─────────────────────────────

router.get('/:id/stats', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const { tenantId } = req.user;

    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, tenantId },
      select: { id: true },
    });
    if (!campaign) return next(createError('Campaign not found', 404));

    const stats = await getCampaignStats(tenantId, req.params.id);
    res.json({ status: 200, data: stats });
  } catch (error) {
    next(error);
  }
});

export default router;
