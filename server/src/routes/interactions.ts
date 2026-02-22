import { Router } from 'express';
import { z } from 'zod';
import { interactionService } from '../services/interactionService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { InteractionType, InteractionDirection } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createInteractionSchema = z.object({
  leadId: z.string().uuid().optional(),
  type: z.nativeEnum(InteractionType),
  direction: z.nativeEnum(InteractionDirection),
  subject: z.string().optional(),
  content: z.string().min(1),
  metadata: z.any().optional(),
  automationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

const querySchema = z.object({
  leadId: z.string().uuid().optional(),
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const filters = querySchema.parse(req.query);
    const result = await interactionService.findAll(req.user.tenantId, filters);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

// GET /api/interactions/inbox - Unified inbox (must be before /:id)
router.get('/inbox', async (req, res, next) => {
  try {
    if (!req.user) return next(createError('Authentication required', 401));

    const channel = req.query.channel as string | undefined;
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;

    const conversations = await interactionService.getInboxConversations(
      req.user.tenantId,
      { channel, search, page, limit }
    );

    res.json({ status: 200, data: conversations });
  } catch (error) {
    next(error);
  }
});

router.get('/leads/:leadId', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const interactions = await interactionService.findByLeadId(
      req.user.tenantId,
      req.params.leadId
    );
    res.json(interactions);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = createInteractionSchema.parse({
      ...req.body,
      userId: req.body.userId || req.user.userId,
    });
    const interaction = await interactionService.create(req.user.tenantId, data);
    res.status(201).json(interaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    await interactionService.deleteInteraction(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
