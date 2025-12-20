import { Router } from 'express';
import { z } from 'zod';
import { emailConfigService } from '../services/emailConfigService.js';
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

export default router;








