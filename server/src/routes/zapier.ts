import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { apiKeyAuth, apiKeyRateLimiter, requireScope } from '../middleware/apiKeyAuth.js';
import { flattenLeadData } from '../utils/webhookPayloads.js';
import { createError } from '../middleware/errorHandler.js';

/**
 * Zapier integration endpoints (API-2.2).
 *
 * Authenticated via `X-API-Key` (no OAuth in MVP — req 24). Polling endpoints
 * return entities in the flat, Zapier-friendly shape produced by
 * `flattenLeadData` (matches the outgoing-webhook payload `data` object).
 */

const router = Router();

// All Zapier endpoints authenticate by API key + per-key rate limit.
router.use(apiKeyAuth);
router.use(apiKeyRateLimiter);

const pollQuerySchema = z.object({
  // Optional ISO timestamp — return only leads created at/after this instant.
  since: z.string().datetime().optional(),
  // Optional page size (Zapier polls in small batches). Default 50, max 100.
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * GET /api/v1/zapier/triggers/lead-created (req 25)
 * Polling trigger: most recent leads, newest first. Supports `?since=ISO`.
 * Requires the `leads:read` scope (legacy keys without scopes have full access).
 */
router.get('/triggers/lead-created', requireScope('leads:read'), async (req, res, next) => {
  try {
    if (!req.apiKey) return next(createError('API key authentication required', 401));

    const parsed = pollQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', parsed.error.errors));
    }
    const { since, limit } = parsed.data;

    const leads = await prisma.lead.findMany({
      where: {
        tenantId: req.apiKey.tenantId,
        deletedAt: null,
        ...(since ? { createdAt: { gte: new Date(since) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit ?? 50,
      include: { tags: { include: { tag: true } } },
    });

    // Zapier expects a flat array of objects, each with a stable `id`.
    res.json(leads.map((lead) => flattenLeadData(lead)));
  } catch (error) {
    next(error);
  }
});

export default router;
