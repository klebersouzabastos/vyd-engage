import { Router } from 'express';
import { z } from 'zod';
import { interactionService } from '../services/interactionService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createInteractionSchema = z.object({
  leadId: z.string().uuid().optional(),
  type: z.enum(['email', 'whatsapp', 'call', 'meeting', 'note']),
  direction: z.enum(['inbound', 'outbound']),
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

export default router;







