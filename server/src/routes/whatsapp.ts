import { Router } from 'express';
import { z } from 'zod';
import { whatsappService } from '../services/whatsappService.js';
import { authenticate } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { WhatsAppProvider, WhatsAppConnectionStatus } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

const createConnectionSchema = z.object({
  name: z.string().min(1),
  provider: z.nativeEnum(WhatsAppProvider),
  config: z.any(),
});

const updateConnectionSchema = createConnectionSchema.extend({
  id: z.string().uuid(),
  status: z.nativeEnum(WhatsAppConnectionStatus).optional(),
  qrCode: z.string().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const connections = await whatsappService.findAll(req.user.tenantId);
    res.json(connections);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const connection = await whatsappService.findById(req.user.tenantId, req.params.id);
    res.json(connection);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = createConnectionSchema.parse(req.body);
    const connection = await whatsappService.create(req.user.tenantId, data);
    res.status(201).json(connection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Validation error', 400, 'VALIDATION_ERROR', error.errors));
    }
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = updateConnectionSchema.parse({
      ...req.body,
      id: req.params.id,
    });
    const connection = await whatsappService.update(req.user.tenantId, data);
    res.json(connection);
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

    await whatsappService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;







