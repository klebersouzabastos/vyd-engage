import { Router } from 'express';
import { z } from 'zod';
import { webhookService, SELECTABLE_WEBHOOK_EVENTS } from '../services/webhookService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);
// Webhooks de saída são integração — item exclusivo de ADMIN (req 13, defesa em profundidade).
router.use(requireRole('ADMIN'));

// Events selectable on creation are exactly the 9 from req 10.
const selectableEvent = z.enum(SELECTABLE_WEBHOOK_EVENTS as unknown as [string, ...string[]]);

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(selectableEvent).min(1),
  // Secret required, non-empty (req 9 edge case).
  secret: z.string().min(1, 'Secret é obrigatório'),
});

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(selectableEvent).min(1).optional(),
  active: z.boolean().optional(),
});

// GET /api/outgoing-webhooks/events - List available (selectable) event types (req 10)
router.get('/events', (_req, res) => {
  res.json(SELECTABLE_WEBHOOK_EVENTS);
});

// GET /api/outgoing-webhooks - List webhooks
router.get('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const webhooks = await webhookService.findAll(req.user.tenantId);
    res.json(webhooks);
  } catch (error) {
    next(error);
  }
});

// GET /api/outgoing-webhooks/:id - Get webhook details
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const webhook = await webhookService.findById(req.user.tenantId, req.params.id);
    res.json(webhook);
  } catch (error) {
    next(error);
  }
});

// POST /api/outgoing-webhooks - Create webhook
router.post('/', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = createWebhookSchema.parse(req.body);
    const webhook = await webhookService.create(req.user.tenantId, data);
    res.status(201).json(webhook);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// PUT /api/outgoing-webhooks/:id - Update webhook
router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const data = updateWebhookSchema.parse(req.body);
    const webhook = await webhookService.update(req.user.tenantId, req.params.id, data);
    res.json(webhook);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// DELETE /api/outgoing-webhooks/:id - Delete webhook
router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    await webhookService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/outgoing-webhooks/:id/logs - Get webhook logs
router.get('/:id/logs', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const logs = await webhookService.getLogs(req.user.tenantId, req.params.id);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// POST /api/outgoing-webhooks/:id/test - Test webhook
// Body (optional): { event?: string } — if provided, sends a realistic sample payload for that event type
router.post('/:id/test', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));
    const event = req.body?.event as string | undefined;
    const result = await webhookService.testWebhook(req.user.tenantId, req.params.id, event);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
