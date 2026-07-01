import { Router } from 'express';
import { z } from 'zod';
import { customFieldService } from '../services/customFieldService.js';
import { authenticate, requireManagerForWrites } from '../middleware/auth.js';
import { tenantScope } from '../middleware/tenant.js';
import { createError } from '../middleware/errorHandler.js';
import { CustomFieldType, CustomFieldEntity, CustomFieldVisibility } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(tenantScope);
router.use(requireManagerForWrites);

const createCustomFieldSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(CustomFieldType),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  order: z.number().int().optional(),
  entity: z.nativeEnum(CustomFieldEntity).optional().nullable(),
  visibility: z.nativeEnum(CustomFieldVisibility).optional(),
});

const updateCustomFieldSchema = createCustomFieldSchema.extend({
  id: z.string().uuid(),
  active: z.boolean().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const activeOnly = req.query.active === 'true';
    const entityParam = req.query.entity as CustomFieldEntity | undefined;
    const entity =
      entityParam && Object.values(CustomFieldEntity).includes(entityParam)
        ? entityParam
        : undefined;
    const fields = await customFieldService.findAll(req.user.tenantId, activeOnly, entity);
    res.json(fields);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const field = await customFieldService.findById(req.user.tenantId, req.params.id);
    res.json(field);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const data = createCustomFieldSchema.parse(req.body);
    const field = await customFieldService.create(req.user.tenantId, data);
    res.status(201).json(field);
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

    const data = updateCustomFieldSchema.parse({
      ...req.body,
      id: req.params.id,
    });
    const field = await customFieldService.update(req.user.tenantId, data);
    res.json(field);
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

    await customFieldService.delete(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
